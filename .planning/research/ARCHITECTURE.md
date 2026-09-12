# Architecture Research: AI Secretary

**Domain:** Multi-process Slack agent (Bolt + Next.js + Trigger.dev + LangGraph JS + Prisma/Postgres + Google Calendar)
**Researched:** 2026-09-11
**Confidence:** HIGH (Slack Bolt/`@slack/web-api` relationship, LangGraph JS checkpointer-optional compile, Trigger.dev `tasks.trigger`/idempotency API — verified against current docs/source); MEDIUM (`trigger.dev dev` real-world latency on venue wifi — dev mode confirmed to poll a hosted control plane even for local task execution, but no first-party number for round-trip time under bad wifi)

Architecture decisions (process split, re-derive-not-resume, no checkpointer, `dedupe_key`, conditional organizer claim, deterministic calendar event id, folder structure) are fixed in PROJECT.md. This document is only about **how to realize them**: exact code locations, exact data flow, the stub signatures that let two tracks merge mechanically, and build order.

## System Overview

```
┌───────────────────────────┐        ┌──────────────────────────────┐
│   Bolt process (Node)     │        │   Next.js app (Node)          │
│   Socket Mode, own WS      │        │   Server Components + routes  │
│   bolt.ts (root entry)     │        │   app/, components/, hooks/,  │
│   lib/slack/listeners/*    │        │   stores/                     │
│   lib/slack/actions/*      │        └───────────────┬────────────────┘
└──────────┬────────────────┘                         │ Prisma (read)
           │ tasks.trigger()                          │
           │ (@trigger.dev/sdk)                        ▼
           ▼                                   ┌───────────────┐
┌───────────────────────────┐                  │   Postgres     │
│  Trigger.dev dev (cloud    │◄─────Prisma──────┤ (Docker, one   │
│  control plane + local     │      (write)     │  PrismaClient  │
│  worker process)           │                  │  per process)  │
│  trigger/extract-and-      │                  └───────────────┘
│  propose.ts (thin)         │                          ▲
│      │ calls                │                          │ Prisma (write)
│      ▼                     │                          │
│  lib/agent/graph.ts         │──────────────────────────┘
│  (LangGraph, no checkpointer,  extract→classify→resolveTime→
│   single .invoke() per run)     checkConflicts→propose
│      │ posts card via       │
│      ▼ @slack/web-api        │
│  Slack Web API (chat.postMessage) ──────────► Slack ──► user sees card
└───────────────────────────┘
           ▲ block_actions (Approve click) comes back over the
           │ Socket Mode WebSocket, NOT to Trigger.dev
           │
      Bolt process: lib/slack/actions/approve.ts
      → conditional claim UPDATE → lib/calendar/createEvent.ts
      → googleapis events.insert → app.client.chat.update
```

Three long-lived processes (Bolt, Next.js, `trigger.dev dev`) plus Postgres, all sharing **one package.json / one `bun.lock` / one repo**, run with **bun** (`bun install`, `bun run`, `bunx`) rather than npm — this is not a monorepo/workspaces setup, it's one `bun install` with three entrypoints, which is the minimal answer (a Turborepo/pnpm-workspace split would be pure overhead for a 4h build with no independently-versioned packages). The Bolt process is TypeScript run directly by bun (`bun bolt.ts`) — no `tsx`/`ts-node` transpile step, since bun executes TS natively.

## Component Boundaries and Exact Data Flow

Numbered against the flow in the milestone context, with file locations.

1. **Slack message → Bolt.** Bolt subscribes to the `message` event (channel type). Handler lives in `lib/slack/listeners/message.ts`, registered from the root entrypoint `bolt.ts`. First line of the handler checks `SLACK_WATCH_CHANNEL_IDS` (read via `lib/config.ts`, never `process.env` directly) and returns immediately for anything outside the allowlist. Bolt's Socket Mode ack is implicit for Events API payloads (no `ack()` call required the way slash commands/interactivity need one), but the handler must still return fast — do the allowlist check, build the trigger payload, call `tasks.trigger(...)`, and **return** without awaiting anything slow. Slack redelivers an event if the socket doesn't settle quickly, which is the second source of duplicate deliveries (see idempotency below).

2. **Bolt → Trigger.dev task.** `tasks.trigger("extract-and-propose", payload, { idempotencyKey })` from `@trigger.dev/sdk`, called directly inside the Bolt process — no Bolt-specific glue needed, `tasks.trigger` is designed to be called from any backend code. Requires `TRIGGER_SECRET_KEY` (dev secret key, `tr_dev_...`) in Bolt's env, and requires `bunx trigger.dev dev` running as a **third local process** watching `trigger/*.ts` (directory name configured in `trigger.config.ts`'s `dirs` option — the framework's own convention, not one of the eight fixed folders, and the one necessary exception to "folder structure is not negotiable" alongside the root-level process entrypoints). Idempotency key: `idempotencyKeys.create([teamId, channelId, ts])`. This is a **second, independent idempotency layer** from the DB-level `dedupe_key` — Trigger.dev's key stops a duplicate *task run* (e.g. Slack redelivering the same event because Bolt's ack was slow); `dedupe_key` stops a duplicate *Proposal row* (e.g. two different messages normalizing to the same intent, or the idempotency key window having already rolled over). Keep both; they cost nothing and guard different failure modes.

3. **Trigger.dev task → LangGraph.** `trigger/extract-and-propose.ts` is a thin wrapper: parse payload with Zod, call `lib/agent/graph.ts`'s exported `runAgent(input)`, return its result. All real logic lives in `lib/agent/`, not in the task file — this is what lets the env-flag fallback (below) call the exact same function from Bolt without going through Trigger.dev at all.

4. **The graph.** `lib/agent/graph.ts` builds a `StateGraph` over an `Annotation.Root({...})` state, five nodes (`lib/agent/nodes/extract.ts`, `classify.ts`, `resolveTime.ts`, `checkConflicts.ts`, `propose.ts`), one conditional edge out of `classify`, compiled with **no checkpointer argument at all** (compile's `checkpointer` parameter is optional; omitting it means no persistence, matching "no checkpointer, in-memory default" exactly — there is nothing to configure, not even `MemorySaver`, for a single `.invoke()` per message). `classify` is the node that both decides `isActionable` **and**, when false, writes the `Decision` row itself before the conditional edge routes to `END` — keeping "what happens when a message is ignored" in one place (the node that decided it) rather than splitting the decision from its persistence across the graph boundary. `propose` writes `Proposal`/`Participant`/`ActionItem` and calls `lib/slack/postProposalCard.ts` to post the Block Kit card, storing the returned `{channel, ts}` back onto the `Proposal` row for the later `chat.update`.

5. **Posting the card from inside the graph — no Bolt needed.** `@slack/web-api` is a **separate package** (`WebClient`), installed with `bun add @slack/web-api`,, not something reachable only via Bolt. Bolt's `app.client` *is* a `WebClient` instance Bolt constructs internally; `@slack/web-api` is also a declared dependency of `@slack/bolt` itself, but the Trigger.dev task runs in its own bundled process/worker and should not rely on a transitive/hoisted dependency it doesn't declare — add `@slack/web-api` directly to `package.json` and instantiate one `WebClient` singleton in `lib/slack/client.ts` (bot token from `lib/config.ts`). This is the same bot token Bolt uses; there are two `WebClient`-shaped things talking to the same Slack app, which is expected and fine.

6. **Approve click → Bolt (not Trigger.dev).** `block_actions` payloads only ever arrive over the Socket Mode WebSocket Bolt holds open — Trigger.dev has no path back into that. Handler: `lib/slack/actions/approve.ts`, registered via `app.action("approve_proposal", handler)` in `bolt.ts`. It re-derives, per PROJECT.md: read the `Proposal` row, run the conditional-claim `UPDATE ... WHERE organizer_user_id IS NULL RETURNING id`, re-run `lib/calendar/checkConflicts` fresh (not the stale graph-time result), call `lib/calendar/createEvent.ts` (deterministic id, 409-fallback), update the `Proposal` row, then `app.client.chat.update(...)`. Using `app.client` here (rather than the standalone `lib/slack/client.ts` `WebClient`) is simply because this code already runs inside a Bolt listener with `app.client` in scope — not a hard requirement; either client would work since both hold the same bot token.

## Trigger.dev Fallback: env-flag to call the graph inline

Because `trigger/extract-and-propose.ts` is a thin wrapper around `lib/agent/graph.ts`'s `runAgent()`, the fallback costs one `if`, not a parallel implementation:

```typescript
// lib/agent/dispatch.ts
export async function dispatchAgentRun(input: RunAgentInput): Promise<void> {
  if (config.agent.transport === "inline") {
    await runAgent(input); // same function the Trigger.dev task calls
  } else {
    await tasks.trigger("extract-and-propose", input, { idempotencyKey: await computeIdempotencyKey(input) });
  }
}
```

`AGENT_TRANSPORT=trigger|inline` lives in `lib/config.ts`. Bolt's message listener always calls `dispatchAgentRun`, never `tasks.trigger` directly — this is the actual seam, and it's also what the env-flag fallback needs to exist at all.

**Why this matters for the window:** `trigger.dev dev` keeps a polling/dequeue loop against Trigger.dev's hosted control plane even in local dev — only the task *code* runs on the laptop; scheduling and queueing round-trip through their cloud. On good wifi this is unremarkable (sub-second to low-single-digit-second latency is the typical experience reported for dev mode); on venue wifi, the same class of risk PROJECT.md already flags for a cloud graph DB applies here too, and isn't currently named in PROJECT.md. Recommend: default to `trigger` (it's the real architecture and demonstrates the stack), but wire the `inline` flag during the bridge phase — while Trigger.dev's reliability on the actual venue network is still observable — as a proven one-line escape hatch, not a same-day scramble.

## LangGraph JS: Minimal Graph, Confirmed

- `compile({ checkpointer })` — `checkpointer` is an optional parameter. Omitting it entirely means the compiled graph persists nothing between invocations; each `.invoke()` starts from a fresh state object and completes in one pass. This is exactly "no checkpointer at all" and requires zero extra configuration — not even the in-memory `MemorySaver` needs to be imported.
- State: `Annotation.Root({ message: Annotation<SlackMessage>, intent: Annotation<ExtractedIntent | null>, isActionable: Annotation<boolean>, conflicts: Annotation<ConflictSlot[]>, proposalId: Annotation<string | null> })`. Every node receives the full state and returns a partial update object merged by LangGraph.
- Five nodes, one conditional edge: `graph.addConditionalEdges("classify", (state) => state.isActionable ? "resolveTime" : END)`. `END` and `START` are imported from `@langchain/langgraph` alongside `StateGraph` and `Annotation`.
- Confirms PROJECT.md's fallback: because there's no checkpointer and no subgraph, "rip out the graph, call the five node functions in sequence" is genuinely a ten-minute change — each node already has the `(state) => Partial<State>` signature, so a plain `async function runPlain(state) { state = {...state, ...await extract(state)}; if (...) return decision; state = {...state, ...await classify(state)}; ... }` is a mechanical rewrite of the edges into `if`s.

## Interfaces Before Implementation: the Stub Signatures to Fix on `main` in Scaffold

These are the concrete seams that let Slack / Calendar / Extraction / Dashboard build concurrently. Every one of them should exist in the scaffold phase with a **hardcoded or trivially-fake body** — real implementations replace bodies later without changing signatures, so merges are additive, not negotiated.

| File | Signature | Owner in scaffold, real impl by |
|---|---|---|
| `types/slack.ts` | `interface SlackMessage { teamId: string; channelId: string; ts: string; threadTs?: string; userId: string; text: string }` | scaffold |
| `types/agent.ts` | `interface ExtractedIntent { messageIndex: number; type: "meeting" \| "commitment"; title: string; startIso: string \| null; durationMinutes: number; participantSlackIds: string[]; confidence: number; isActionable: boolean; reason?: string }`; `interface ConflictSlot { startIso: string; endIso: string; reason: string }`; `interface RunAgentInput { message: SlackMessage }`; `interface RunAgentResult { proposalId: string \| null; decisionId: string \| null }` | scaffold |
| `lib/config.ts` | `export const config: { slack: {...}; ai: {...}; db: {...}; trigger: {...}; agent: { transport: "trigger" \| "inline" } }` — one typed object, every env var used anywhere in the repo declared here even before it's consumed (including `NEO4J_URI`/`GRAPH_SERVICE_URL` for S1, unused until S1 starts) | scaffold, never re-touched by a track (add keys, don't restructure) |
| `lib/db.ts` | `export const prisma: PrismaClient` (globalThis singleton) | scaffold |
| `lib/slack/client.ts` | `export const slackClient: WebClient` | scaffold |
| `lib/ai/provider.ts` | `export async function complete<T>(opts: { tier: "fast" \| "smart"; system: string; prompt: string; schema: ZodSchema<T> }): Promise<T>` | scaffold stub returns a schema-shaped mock; extraction track fills in the Kilo Gateway call |
| `lib/agent/graph.ts` | `export async function runAgent(input: RunAgentInput): Promise<RunAgentResult>` | scaffold stub returns a hardcoded `RunAgentResult`; extraction track replaces the body with the real compiled graph |
| `lib/agent/dispatch.ts` | `export async function dispatchAgentRun(input: RunAgentInput): Promise<void>` | scaffold/bridge |
| `lib/agent/dedupe.ts` | `export function computeDedupeKey(teamId: string, channelId: string, threadOrMessageTs: string, normalizedIntent: string): string` | scaffold (pure function, trivial to write for real immediately) |
| `lib/slack/postProposalCard.ts` | `export async function postProposalCard(proposal: ProposalWithParticipants): Promise<{ channel: string; ts: string }>` | scaffold stub posts a hardcoded card; Slack track fills in real Block Kit |
| `lib/slack/updateProposalCard.ts` | `export async function updateProposalCard(channel: string, ts: string, proposal: ProposalWithParticipants): Promise<void>` | scaffold stub; Slack track fills in |
| `lib/slack/blocks.ts` | `export function buildApprovalBlocks(p: ProposalWithParticipants): KnownBlock[]`; `buildConfirmedBlocks(p): KnownBlock[]`; `buildConflictBlocks(p, alts: ConflictSlot[]): KnownBlock[]` | Slack track |
| `lib/calendar/freebusy.ts` | `export async function checkConflicts(userId: string, startIso: string, endIso: string): Promise<ConflictSlot[]>` | scaffold stub returns `[]`; Calendar track fills in `freebusy.query` + pending-Proposal union |
| `lib/calendar/createEvent.ts` | `export async function createCalendarEvent(proposal: Proposal): Promise<{ eventId: string; meetLink: string }>` | Calendar track (deterministic id + 409 fallback baked in from the first real version, not added later) |
| `trigger/extract-and-propose.ts` | thin: `export const extractAndPropose = task({ id: "extract-and-propose", run: async (input: RunAgentInput) => runAgent(input) })` | scaffold |
| `bolt.ts` (root) | imports and registers listeners/actions; no logic of its own | scaffold |

Scaffold's own exit criterion should be the hardcoded round trip PROJECT.md names explicitly — "trigger → card → button → `chat.update`" — run through all three of these stubs (`dispatchAgentRun` → `extract-and-propose` task → `postProposalCard` hardcoded card → `approve.ts` → `updateProposalCard`), not deferred into the Slack track. If the Slack track were the one to first prove Bolt↔Trigger.dev↔Slack wiring, the Calendar track running in parallel would be building against an unproven harness, and a wiring bug found only during the Slack track's work would block both tracks' merge, not just one.

## File Ownership Per Track and Named Overlaps

| Track | Owns | Must not touch |
|---|---|---|
| Slack surface | `bolt.ts`, `lib/slack/**` (except `client.ts`, fixed in scaffold), `types/slack.ts` (extend only) | `lib/calendar/**`, `lib/agent/**`, `app/**` |
| Calendar | `lib/calendar/**` | `lib/slack/**`, `lib/agent/**`, `app/**` |
| Extraction | `lib/agent/**`, `lib/ai/**`, `types/agent.ts` (extend only) | `app/**`, `lib/slack/**`, `lib/calendar/**` |
| Dashboard | `app/**` (except root `layout.tsx`/`globals.css`, fixed in scaffold), `components/**`, `hooks/**`, `stores/**` | `lib/agent/**`, `lib/slack/**`, `lib/calendar/**` |

**Named overlap points** (the ones the parallelism rules require calling out explicitly):

- **`prisma/schema.prisma`** — any track may add/extend fields, serialized through `develop` per PROJECT.md: a track pushes and merges to `develop` first, `develop` merges into the other track, which pushes again before it runs its own push. Never two tracks pushing concurrently against the shared dev Postgres.
- **`types/`** — each track may add new files or add optional fields to existing interfaces it doesn't own; nobody edits another track's type file's existing fields without going through `develop` first (same rule as schema, for the same reason: a field rename mid-flight breaks the other track's in-flight work invisibly until compile).
- **`lib/config.ts`** — written once in scaffold with every env key any phase (including stretch) will ever need, specifically so no track needs to re-open this file. If a track discovers it needs a new env var, add the key and merge quickly rather than batching config changes.
- **`package.json` and `bun.lock`** — dependency additions happen per-track as needed (e.g. Calendar track adds `googleapis` via `bun add googleapis`), but resolve merge conflicts on both files by re-running `bun install` after merge rather than hand-splicing the `dependencies` block or `bun.lock` — lockfile churn is expected and fine, hand-merged JSON/lock is where mistakes happen.
- **`app/globals.css`** — dashboard track only, ever. This is the CSS-first Tailwind v4 theme source of truth (shadcn variables, retro palette); no other track has a reason to touch it and doing so is a folder-boundary violation in spirit even though the file itself lives under `app/`.

## Suggested Build Order and Wave Grouping

The user's suggested shape (scaffold → Slack ∥ Calendar → bridge → extraction ∥ dashboard → integrate → conflict ∥ scan → integrate → stretch → rehearse → freeze) is correct in its dependency structure. One refinement, justified above: split scaffold's tail into its own harness step so the hardcoded three-process round trip is proven **once, centrally**, before either Wave A track starts building on top of it.

1. **Scaffold** (serial, `main`) — repo init, `CLAUDE.md`/`README.md` skeleton, Next.js + shadcn + Biome, `prisma/schema.prisma` + `db push`, `docker-compose.yml` (`postgres` default, `neo4j`/`graph-service` behind `graph` profile), `trigger.config.ts`, `lib/config.ts` with all env keys, and every stub signature in the table above with hardcoded bodies. Ends with the **hardcoded round trip working**: a hand-fired message → `dispatchAgentRun` → stub task → hardcoded card → button → `chat.update`. This is scaffold's exit criterion, not a later phase's.
2. **Wave A** (parallel, cap 2) — **Slack surface** (`lib/slack/**`, `bolt.ts`; real listeners, real Block Kit, still calling the stub `runAgent`) ∥ **Calendar integration** (`lib/calendar/**`; real `freebusy.query`/`events.insert` against hand-seeded `Proposal` rows, no dependency on Slack or the agent). Zero file overlap; both only *consume* the schema and types scaffold fixed.
3. **Bridge** (serial, `main`) — wires the real `approve.ts` handler using both tracks' real code; this is also the natural point to prove the `AGENT_TRANSPORT=inline` fallback while Trigger.dev's venue-wifi behavior is fresh information.
4. **Wave B** (parallel, cap 2) — **Extraction** (`lib/agent/**`, `lib/ai/**`; real LangGraph graph replacing the stub `runAgent`) ∥ **Dashboard** (`app/**`, `components/**`; reads Proposal/Decision rows via Prisma — can build against hand-seeded rows without waiting on extraction). Zero file overlap.
5. **Integrate** (serial) — swap the stub `runAgent` for the real graph inside the Trigger.dev task; confirm the dashboard shows real extracted rows end to end.
6. **Wave C** (parallel, cap 2) — **Conflict reasoning** (extends `checkConflicts`/`propose` nodes + `lib/slack/blocks.ts` for alternative-slot buttons) ∥ **`/secretary scan`** (new `lib/slack/listeners/scan.ts` calling the existing `extractIntents`/`runAgent` path with a real array — isolated to one new file). Minor named overlap: both may want new *optional* fields on `AgentState`/`ExtractedIntent`; keep additions additive and this resolves without a merge conversation.
7. **Integrate** (serial) — final wiring; 14:15 cut-line check on conflict work (degrade to a static conflict warning if not started).
8. **Stretch** (optional, throwaway worktrees) — S1/S2, off the critical path entirely.
9. **Rehearse** (serial, `main` only, no new branches).
10. **Freeze** (serial, no code).

## Dashboard: How It Reads Data

Minimal answer consistent with the repo rules ("Server Components by default"; "TanStack Query, not ad-hoc `useEffect` fetching"):

- **First paint:** `app/page.tsx` is an `async` Server Component calling `prisma.proposal.findMany()` / `prisma.decision.findMany()` **directly** — no route handler in between. This is the least code for the initial render (Server Components are the native mechanism for server-side data access in the App Router; adding a fetch layer just for first paint would be the anti-pattern here, not the fix).
- **Live updates during the demo:** a thin route handler (`app/api/proposals/route.ts`, `app/api/decisions/route.ts`) wrapping the same Prisma queries, consumed by a small `"use client"` list component via TanStack Query with a short `refetchInterval` (3–5s). This satisfies the repo's TanStack Query rule while staying minimal — a 3–5s poll is invisible on stage for a two-person demo with a handful of rows.
- **Skipped:** websockets/SSE for real-time push. Add only if a later milestone needs sub-second updates across more than a couple of concurrent viewers; for tomorrow's demo it is pure overhead the polling approach already covers.
- **Skipped:** dashboard-initiated mutations on the critical path — approval happens via the Slack card, not a dashboard button, so the dashboard is read-only for the core demo. If S2 adds a nudge action, that becomes one POST route handler + `useMutation` + `queryClient.invalidateQueries`, not a new data-fetching pattern.

## Anti-Patterns to Avoid

- **Constructing a new `PrismaClient` or Neo4j driver per request/listener/task invocation.** Already called out in PROJECT.md as the connection-exhaustion failure mode; the architectural consequence here is that `lib/db.ts`'s singleton must be imported everywhere (Bolt, Trigger.dev task, Next.js), never reconstructed.
- **Letting `trigger/extract-and-propose.ts` contain real logic.** If graph logic lives in the task file instead of `lib/agent/graph.ts`, the `inline` fallback becomes a second implementation to keep in sync, exactly the drift the interfaces-first approach is meant to prevent.
- **Routing `chat.update` calls through Trigger.dev.** `block_actions` never reaches Trigger.dev — only Bolt's open WebSocket receives them. A design that has the Trigger.dev task "wait" for approval would need `interrupt()`/checkpointing, which PROJECT.md has already ruled out for good reason (unbounded human wait, stale state on resume).
- **Two component libraries or a second Slack client wrapper.** `@slack/web-api`'s `WebClient` is the only Slack Web API surface needed in the Trigger.dev process; do not wrap it in a second abstraction "for consistency" with Bolt's `app.client` — they're the same underlying client type already.

## Sources

- LangGraph.js `StateGraph.compile()` — checkpointer as an optional parameter, confirmed via [StateGraph API Reference](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html) and [StateGraph and Graph Building — DeepWiki](https://deepwiki.com/langchain-ai/langgraphjs/2.1-stategraph). MEDIUM-HIGH: DeepWiki is a secondary/derived source, cross-checked against the official API reference for the checkpointer-optional claim.
- `@trigger.dev/sdk` `tasks.trigger()` and `idempotencyKeys.create()` usage — [Idempotency — Trigger.dev docs](https://trigger.dev/docs/idempotency). HIGH: official docs.
- `trigger.dev dev` local execution model (task code runs locally, scheduling round-trips the hosted control plane) — [How Trigger.dev works](https://trigger.dev/docs/how-it-works), [Local Development — DeepWiki](https://deepwiki.com/triggerdotdev/trigger.dev/7.2-local-development). MEDIUM: architecture confirmed by official docs; exact venue-wifi latency is not something either source measures.
- `@slack/web-api` as a standalone package and as Bolt's internal `WebClient` dependency — [npm: @slack/web-api](https://www.npmjs.com/package/@slack/web-api), [Using the Web API — Slack Developer Docs](https://docs.slack.dev/tools/bolt-js/concepts/web-api/). HIGH: official Slack developer documentation.

---
*Architecture research for: AI Secretary (Slack agent, hackathon build)*
*Researched: 2026-09-11*
