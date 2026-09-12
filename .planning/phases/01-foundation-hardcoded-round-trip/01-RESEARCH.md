# Phase 1: Foundation + Hardcoded Round Trip - Research

**Researched:** 2026-09-11
**Domain:** Repo scaffold (Next.js 16 + shadcn + Tailwind v4 + Biome under bun) + Prisma 7/adapter-pg + docker-compose + Bolt 5.1 Socket Mode hardcoded round trip
**Confidence:** MEDIUM-HIGH — exact package versions are npm-registry-verified this session; CLI/config *shapes* (Prisma 7 config, create-next-app conflict list, shadcn init flags) are `[CITED]` from official docs/source fetched this session, not executed in this sandbox (wrong OS: this session is Windows Git Bash, not the target WSL Ubuntu box) — every CITED claim below carries an explicit "confirm by running it" note per Pitfall 6/13's own logic.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Phase 1 trigger is an `app_mention` in the test channel, not a `message` listener (scope already installed; no feedback-loop risk from the bot's own card). Phase 2 adds the watched-channel `message` listener calling the same dispatch function.
- **D-02:** Round trip goes through the DB: `app_mention` → `dispatchAgentRun` (inline only) → stub `runAgent` creates hardcoded `Proposal`+`Participant` keyed by `dedupe_key` built from the real mention `ts` → `postProposalCard` stores returned `channel`+`ts` on the row → Approve handler `ack()`s first, reads proposal id from `action.value`, sets `status = confirmed`, calls `updateProposalCard` with the **stored** channel/ts. This is the phase's one real query and proves the Phase 4 "`block_actions` has no in-memory link" pitfall up front.
- **D-03:** Card has Approve only (Reject is Phase 2/SLK-05). Fixed conventions for Phases 2/4/7: action ids are `<verb>_proposal` (`approve_proposal`, later `reject_proposal`); button `value` = proposal id.
- **D-04:** `dispatchAgentRun` exists with only the inline call. `AGENT_TRANSPORT` branching, the Trigger.dev task, and `trigger.config.ts` are all Phase 4 — not skeleton-stubbed here.
- **D-05:** `.planning/research/ARCHITECTURE.md` §"Interfaces Before Implementation" is the signature source, corrected by: kebab-case filenames (`lib/slack/post-proposal-card.ts`, not `postProposalCard.ts`); Bolt entry is `lib/slack/bolt.ts` (not root `bolt.ts`); Trigger.dev tasks live in `lib/agent/tasks/` (not `trigger/`).
- **D-06:** Stubs only for seams a parallel track builds against — Wave A: `lib/slack/client.ts`, card post/update + `buildApprovalBlocks`/`buildConfirmedBlocks`, `lib/calendar` `checkConflicts`/`createCalendarEvent`. Wave B: `lib/agent` `runAgent` + `extractIntents(messages: SlackMessage[], ctx)`, `lib/ai/provider.ts`. Shared: `lib/agent/dedupe.ts` (real), `lib/db.ts`, `lib/config.ts`. No stub for `buildConflictBlocks` (Phase 7 is serial).
- **D-07:** DB entity types come from the generated Prisma client, never re-declared in `types/`. `types/` holds plain runtime-free interfaces (`SlackMessage`, `RunAgentInput`, `RunAgentResult`). LLM-output shapes are Zod schemas in `lib/agent/`, types via `z.infer` in the same file.
- **D-08:** `utils/time.ts` with an HKT formatter (stdlib `Intl.DateTimeFormat`, `timeZone: "Asia/Hong_Kong"`) created in Phase 1 — Slack card (Phase 2) and dashboard (Phase 6) both need it in parallel. No date library.
- **D-09:** Phase 1's schema includes every column any core phase (2–7, 10) needs. `Proposal` adds `confidence`, `card_channel`, `card_ts`, `calendar_html_link`, `meet_link`, `alternatives Json?`, `created_at`. `Decision` adds `source_channel`, `message_text`, `proposal_id?`. `ActionItem` has `expires_at`.
- **D-10:** Field names are snake_case exactly as in PROJECT.md (no `@map`), so APR-02's raw `UPDATE "Proposal" SET organizer_user_id …` works as written. Reversibility: costly.
- **D-11:** Status fields are Prisma enums: `ProposalStatus`: `pending | confirmed | dismissed | already_scheduled`. `DecisionVerdict`: `acted | ignored`.
- **D-12:** Prisma 7 `prisma-client` generator, output under `prisma/generated/`, gitignored, plus a `postinstall` running `prisma generate`. Client constructed once in `lib/db.ts` (globalThis singleton) with `@prisma/adapter-pg`.
- **D-13:** `prisma/seed.ts` idempotent (upserts), reads every identity/secret from env through `lib/config.ts`. Seeds `Installation`, User A (Slack id, email, Google refresh token, `Asia/Hong_Kong`), User B (Slack id, email, no token), one pending Proposal with B as participant, one `acted` and one `ignored` Decision.
- **D-14:** Seeded Proposal is at Thu 17 Sep 2026 15:00 HKT — deliberately not the demo's Fri 18 Sep 11:00/10:30 slots (pending Proposals are unioned into conflict detection).
- **D-15:** `lib/config.ts` holds a single Zod parse of `process.env` at import. Core keys required; stretch keys (`NEO4J_*`, `GRAPH_SERVICE_URL`) optional. Every key any phase uses declared now. Not marked `server-only` (Bolt/Trigger.dev import it outside RSC runtime).
- **D-16:** Every process reads one untracked root `.env`. `.env.local.example`/`.env.cloud.example` are copy sources. Each worktree sets its own `PORT` (`bun run` injects `.env`; `next dev` honours `PORT`).
- **D-17:** `docker-compose.yml`'s `graph-service` build context uses `${GRAPH_SERVICE_DIR:-../graph-service}` — Compose interpolates the whole file even when a profile is off, so an unset var must not break `docker compose up postgres`.
- **D-18:** Repo rules go in root `CLAUDE.md` (FND-01 deliverable). `.claude/CLAUDE.md` is GSD-managed and untouched. Root `CLAUDE.md` states per-process run commands explicitly (Next.js `bun run dev` → `next dev`; Bolt `bun lib/slack/bolt.ts`, fallback `bunx tsx lib/slack/bolt.ts`; Prisma `bunx prisma …`; never `--bun`).
- **D-19:** `package.json` scripts are the written-down run commands: `dev`, `bolt`, `db:push`, `db:seed`, `check` (biome), `postinstall`.
- **D-20:** README skeleton has every FND-02 heading; fills in "What it is" + real Usage section; every other section gets a one-line TODO. Drops to headings-only under cut pressure.
- **D-21:** Install all core-window dependencies in Phase 1 at exact pins (everything in STACK.md except CopilotKit and the Python side), plus `@slack/web-api` and `@prisma/adapter-pg` + `pg`. Gitignore `package-lock.json`.
- **D-22:** shadcn initialised only (`components.json`, `globals.css` variables, `cn`); no components added. `cn` stays at shadcn's default `lib/utils.ts`.
- **D-23:** `biome.json` excludes `components/ui/**`, `prisma/generated/**`, `.next`; sets `css.parser.tailwindDirectives: true`.
- **D-24:** No `.gitkeep` placeholders for empty `hooks/`/`stores/`.
- **D-25:** `app/page.tsx` in Phase 1 is a minimal Server Component rendering a Prisma count — proves Next.js 16 + Turbopack can load the Prisma 7 generated client now. Phase 6 replaces it.
- **D-26:** Rename local `master` → `main`. Phase 1 works on `gsd/phase-1-foundation`, merges to `main`, then `develop` is created from `main`.
- **D-27:** Commit `gsd-prompt-ai-secretary.md` in Phase 1's first plan.

### Claude's Discretion

- Proposal id strategy (`cuid()` is fine: CAL-04 derives the base32hex event id by hashing, so the id charset doesn't matter).
- Hardcoded card copy and layout (Phase 2 replaces it).
- Bolt log level, and the exact config object nesting (sections per ARCHITECTURE.md: `slack`, `google`, `ai`, `db`, `trigger`, `agent`, `graph`).
- Participant/ActionItem key shapes and relations, within PROJECT.md's model.
- Whether the Approve handler uses Bolt's `client` or the `lib/slack/client.ts` singleton (both hold the same bot token).

### Deferred Ideas (OUT OF SCOPE)

- `trigger.config.ts`, the Trigger.dev task wrapper and `AGENT_TRANSPORT` branching: Phase 4.
- Reject button and watched-channel `message` listener with subtype/bot filtering: Phase 2.
- `buildConflictBlocks` stub: Phase 7 (serial, no parallel consumer).
- shadcn components and the retro theme tokens: Phase 6.
- `server-only` guard on config: not applicable (Bolt/Trigger.dev import it).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-01 | `CLAUDE.md` states repo rules before feature code | §Architecture Patterns "Repo skeleton"; gsd-prompt-ai-secretary.md §"Phase 1, first task" quoted verbatim in Code Examples |
| FND-02 | `README.md` skeleton with every required heading | §Code Examples "README skeleton"; headings sourced from gsd-prompt-ai-secretary.md |
| FND-03 | Next.js App Router + TS + shadcn + Tailwind v4 (PostCSS, no config file) + Biome run under bun | §Common Pitfalls 1–4 (create-next-app non-empty dir, shadcn init, Biome Tailwind directives) |
| FND-04 | Deps pinned exactly per STACK.md + new additions (`@slack/web-api`, `@prisma/adapter-pg`, `pg`, `@types/pg`, `dotenv`) | §Package Legitimacy Audit, §Standard Stack |
| FND-05 | `docker compose up` starts postgres (healthcheck, memory limit); neo4j/graph-service behind `graph` profile; env-only credentials | §Code Examples "docker-compose.yml"; §Common Pitfalls 7 |
| FND-06 | One typed config module is the only `process.env` reader; env examples list every key | §Code Examples "lib/config.ts" |
| FND-07 | `DATABASE_URL`/`DIRECT_URL`/`NEO4J_URI` swap is env+restart only | §Common Pitfalls 5 (Prisma 7 datasource-location correction) |
| FND-08 | Prisma schema + `db push` + one real query from a `globalThis` singleton | §Common Pitfalls 5–6; §Code Examples "prisma.config.ts", "lib/db.ts" |
| FND-09 | Stub modules for every cross-track interface | §Architecture Patterns "Interfaces before implementation" (D-05-corrected signature table) |
| FND-10 | Seed data maps A's Slack id → Google refresh token + HKT tz | §Code Examples "prisma/seed.ts" pattern |
| SLK-01 | Bolt runs in Socket Mode as its own process, stable connection ≥1 min | §Common Pitfalls 8–9 (bun WebSocket history — see STACK.md/PITFALLS.md, not re-litigated here) |
| SLK-07 | Trigger → hardcoded card → button → `chat.update` round trip works before any LLM/Calendar code | §Architecture Patterns "System diagram"; §Code Examples "approve_proposal handler" |
</phase_requirements>

## Summary

Phase 1 is a scaffold phase: nothing here is novel product logic, but three sub-systems each have a real, current-documentation trap that would burn the 40-minute box if discovered live rather than planned around. In order of how much they'd cost if missed:

1. **`create-next-app@16.3.4` will refuse to scaffold directly into this repo root.** The CLI's own conflict-checker (fetched from source this session) now allowlists `.claude`, `.cursor`, `.vscode`, `.zed` — so `.claude/` itself is *not* the blocker anymore — but `.planning/`, `.remember/`, and the loose `gsd-prompt-ai-secretary.md` file are **not** on the allowlist and will still trigger a refusal with no `--force` flag to override. The scaffold-into-temp-then-move recipe from CONTEXT.md's research flag is still required, just for a narrower set of reasons than assumed.
2. **Prisma 7 removed `directUrl` and `adapter` from both `schema.prisma` and `prisma.config.ts`.** This is a direct correction to STACK.md/PROJECT.md, which both still describe a `directUrl` field. In v7 there is exactly one datasource URL, and it lives in `prisma.config.ts`'s `datasource.url` — that's the URL the CLI (`db push`, `generate`) uses. Driver-adapter wiring for migrations is automatic; you only pass `PrismaPg` to the `PrismaClient` constructor in application code, not to `prisma.config.ts`. This resolves cleanly for this project: point `prisma.config.ts` at `DIRECT_URL` (unpooled — what the CLI needs) and construct `lib/db.ts`'s `PrismaPg` adapter with `DATABASE_URL` (pooled). `prisma.config.ts` needs an explicit `import "dotenv/config"` — add `dotenv` as a new dev dependency (Prisma's own docs state env loading is not automatic in the config file, independent of bun's runtime auto-load, because the CLI process may not go through bun's loader).
3. **Next.js 16 Turbopack + a custom-output-path `prisma-client` generator has one documented failure report** ("Cannot find module '.prisma/client/default'") whose only confirmed fix reverts to the deprecated `prisma-client-js` provider — which conflicts with D-12's locked decision. No official doc confirms `serverExternalPackages` alone resolves the *custom output path* case (only the default-output case). D-25's `app/page.tsx` Prisma-count smoke test is exactly the right mitigation already locked in; this research adds a concrete two-step fallback ladder if it fails.

Everything else researched (shadcn init, Biome config, Bolt/`@slack/web-api` shapes, docker-compose syntax, Zod env parsing, bun `.env` loading) confirms the CONTEXT.md assumptions were correct and gives exact syntax to copy.

**Primary recommendation:** Scaffold Next.js into a sibling temp directory and move files in (not `--force`, which doesn't exist); write `prisma.config.ts` with `dotenv/config` + `datasource.url: env("DIRECT_URL")`, and construct the app's `PrismaPg` adapter separately with `DATABASE_URL`; treat D-25's Prisma-in-a-Server-Component check as a hard go/no-go gate for the `prisma-client` generator before writing any other Next.js code that imports the generated client.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Repo scaffold / build tooling | N/A (build-time) | — | Next.js CLI, shadcn CLI, Biome — none are runtime capabilities |
| Slack Socket Mode connection + event routing | Bolt process (own Node/bun process) | — | Long-lived WebSocket doesn't fit a request-scoped tier; Bolt owns it exclusively (PROJECT.md) |
| Hardcoded Proposal creation (`runAgent` stub) | Backend / domain logic (`lib/agent/`) | Database | Business logic lives in `lib/`, never in the Bolt listener body itself, per repo rule "thin listeners" |
| Card post/update (Block Kit) | Backend (`lib/slack/`) via Slack Web API | Bolt process (holds the token) | `postProposalCard`/`updateProposalCard` are pure backend functions callable from any process holding the bot token |
| Approve click handling | Bolt process (`block_actions` only ever arrives on the Socket Mode WebSocket) | Database (conditional claim UPDATE) | No other tier can receive this payload — Slack routes it exclusively to the open WebSocket |
| Persistent state (Proposal/Participant/Decision) | Database (Postgres via Prisma) | — | Single source of truth; both Bolt and future Next.js dashboard read from here |
| Env/config | Config module (`lib/config.ts`) | — | Every process (Bolt, Next.js, later Trigger.dev) imports the same typed object; never `process.env` directly elsewhere |
| First-paint proposal count (`app/page.tsx`) | Frontend Server (Next.js Server Component) | Database | Direct Prisma call from an `async` Server Component — no API route needed for first paint (matches ARCHITECTURE.md's "Dashboard: How It Reads Data") |

No capability in Phase 1 is misassigned relative to PROJECT.md/ARCHITECTURE.md's fixed process split; this map exists to catch drift in later phases that build on these stubs.

## Standard Stack

### Core

Every package below except the four new additions is already pinned and npm-verified in `.planning/research/STACK.md` (2026-09-11) — not re-verified here per the prior-progress note. New additions for Phase 1 (D-21), verified against the npm registry this session:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@slack/web-api` | **8.1.1** `[VERIFIED: npm registry]` | Standalone `WebClient` for posting/updating cards outside a Bolt listener (later: from Trigger.dev tasks) | Exact peer version `@slack/bolt@5.1.0` already depends on (`npm view @slack/bolt@5.1.0 dependencies` → `"@slack/web-api": "^8.1.1"`) — pinning the same version avoids two different `WebClient` shapes in one repo |
| `@prisma/adapter-pg` | **7.10.0** `[VERIFIED: npm registry]` | Driver adapter Prisma 7's engine-free client requires | Matches `prisma`/`@prisma/client` major exactly, as STACK.md's Version Compatibility table already requires |
| `pg` | **8.23.0** `[VERIFIED: npm registry]` | node-postgres driver `PrismaPg` wraps | `@prisma/adapter-pg`'s underlying dependency; current stable, 29M weekly downloads |
| `@types/pg` | **8.23.1** `[VERIFIED: npm registry]` | TS types for `pg` (dev dependency) | Needed because `pg` itself ships no types |
| `dotenv` | **17.4.2** `[VERIFIED: npm registry]` | Explicit env loading inside `prisma.config.ts` | **New requirement discovered this session** (see Pitfall 5): Prisma 7 docs state env vars are "not loaded automatically" in `prisma.config.ts` and recommend `import "dotenv/config"` at the top of the file — not covered by STACK.md/D-21's original package list |

**Package name provenance note:** all five names above were already known from CONTEXT.md/STACK.md except `dotenv`, which is `[ASSUMED]` as a name (extremely common, but discovered via this session's WebFetch of Prisma's docs, not Context7/official-package-index cross-check) until the Package Legitimacy Audit below confirms it — which it does.

### Installation (additions only — STACK.md's block already covers everything else)

```bash
bun add @slack/web-api@8.1.1 @prisma/adapter-pg@7.10.0 pg@8.23.0
bun add -D @types/pg@8.23.1 dotenv@17.4.2
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `dotenv/config` import in `prisma.config.ts` | Rely on bun's own `.env` auto-load and hope `bunx prisma` inherits it | Unverified whether `bunx <cli>`'s subprocess model preserves bun's env-injection for a package resolved and invoked via its own shebang; `dotenv` costs one line and one small dependency and removes the ambiguity entirely — lazier to just add it than debug an empty `DIRECT_URL` mid-window |
| `prisma-client` generator (locked, D-12) | `prisma-client-js` (deprecated but Turbopack-safe per one report) | Explicitly against D-12 and STACK.md's "What NOT to Use"; kept as the phase's documented fallback if the D-25 smoke test fails, not a first choice |

## Package Legitimacy Audit

```
gsd_run query package-legitimacy check --ecosystem npm @slack/web-api @prisma/adapter-pg pg @types/pg dotenv
```

| Package | Registry | Weekly Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-------------------|--------------|---------|-------------|
| `@slack/web-api` | npm | 7,080,313 | github.com/slackapi/node-slack-sdk | `SUS` (reason: `too-new` — heuristic reads latest-version publish date, 2026-08-27, not package age; this is Slack's own official SDK monorepo package, first published years ago) | Flagged — planner should add a lightweight `checkpoint:human-verify` before install, but treat as low-risk given the download count + official repo |
| `@prisma/adapter-pg` | npm | 3,087,540 | github.com/prisma/prisma | `SUS` (same `too-new` false-positive — Prisma's official monorepo, ships adapter versions in lockstep with core releases) | Flagged — same low-risk note; version (7.10.0) matches `prisma`/`@prisma/client` exactly, which is itself already `[VERIFIED]` in STACK.md |
| `pg` | npm | 29,246,927 | github.com/brianc/node-postgres | `OK` | Approved |
| `@types/pg` | npm | 31,388,821 | github.com/DefinitelyTyped/DefinitelyTyped | `SUS` (same `too-new` false-positive — DefinitelyTyped publishes constantly) | Flagged — same low-risk note |
| `dotenv` | npm | 95,679,384 | github.com/motdotla/dotenv | `OK` | Approved |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `@slack/web-api`, `@prisma/adapter-pg`, `@types/pg` — all three flagged solely by the legitimacy checker's "too-new" heuristic, which measures latest-publish-date rather than package first-release date. All three have multi-million weekly downloads and a verifiable official source repo (Slack's own SDK monorepo, Prisma's own monorepo, DefinitelyTyped). **Recommendation to planner:** add one combined `checkpoint:human-verify` before the `bun add` step in Phase 1's first plan rather than three separate ones — the risk here is the heuristic's blind spot, not the packages themselves.

## Architecture Patterns

### System Architecture Diagram

```
Slack workspace
      │  app_mention event (Socket Mode WebSocket)
      ▼
┌─────────────────────────────┐
│ Bolt process (bun lib/slack/bolt.ts)                │
│  1. app.event("app_mention") handler                │
│     → calls dispatchAgentRun(input) [inline only]   │
└──────────────┬──────────────────────────────────────┘
               │ (no queue, no Trigger.dev yet — D-04)
               ▼
┌─────────────────────────────┐
│ lib/agent/graph.ts runAgent() [hardcoded stub body]  │
│  2. creates Proposal + Participant row               │
│     (dedupe_key from real mention ts)                │
└──────────────┬──────────────────────────────────────┘
               │ Prisma write
               ▼
        ┌─────────────┐
        │  Postgres   │◄────────────────────┐
        │  (Docker)   │                      │ Prisma write (status=confirmed)
        └──────┬──────┘                      │
               │ Prisma read (proposal row)  │
               ▼                              │
┌─────────────────────────────┐              │
│ lib/slack/post-proposal-card.ts             │
│  3. posts Block Kit card via WebClient      │
│     stores returned {channel, ts} on row    │
└──────────────┬──────────────────────────────┘
               │ chat.postMessage
               ▼
         Slack card appears (Approve button, value=proposalId)
               │  user clicks Approve
               │  block_actions payload (Socket Mode WebSocket — Bolt only)
               ▼
┌─────────────────────────────┐
│ Bolt process: app.action("approve_proposal")│
│  4. ack() FIRST                             │
│  5. read proposal id from action.value      │
│  6. UPDATE Proposal SET status='confirmed'  │
│  7. calls updateProposalCard(storedChannel, │
│     storedTs, proposal) — NOT payload ts    │
└──────────────┬──────────────────────────────┘
               │ chat.update
               ▼
         Slack card updates in place → confirmed chip
```

Reading this diagram end to end from the top proves the round trip SLK-07 requires: nothing in this phase touches an LLM or Google Calendar.

### Recommended Project Structure

```
app/
  layout.tsx          # root layout + globals.css import (scaffold-owned)
  page.tsx             # D-25: async Server Component, prisma.proposal.count()
  globals.css          # shadcn CSS variables + @theme inline (dashboard-track-owned from Phase 6 on)
components/
  ui/                  # shadcn primitives, unmodified (biome-excluded)
hooks/                 # empty until first use (no .gitkeep, D-24)
stores/                # empty until first use (no .gitkeep, D-24)
lib/
  config.ts            # single Zod-parsed env object
  db.ts                # PrismaClient singleton (globalThis), PrismaPg adapter
  slack/
    bolt.ts             # entry: imports/registers listeners+actions only
    client.ts            # standalone WebClient singleton
    post-proposal-card.ts
    update-proposal-card.ts
    blocks.ts            # buildApprovalBlocks/buildConfirmedBlocks (no buildConflictBlocks yet)
  calendar/
    freebusy.ts           # stub: checkConflicts returns []
    create-event.ts        # stub
  ai/
    provider.ts             # stub: complete<T>() returns schema-shaped mock
  agent/
    graph.ts                 # stub: runAgent() returns hardcoded RunAgentResult
    dispatch.ts               # dispatchAgentRun (inline-only body)
    dedupe.ts                  # real: computeDedupeKey (pure function)
utils/
  time.ts                      # HKT formatter (Intl.DateTimeFormat)
types/
  slack.ts                      # SlackMessage
  agent.ts                       # RunAgentInput, RunAgentResult, ExtractedIntent, ConflictSlot
prisma/
  schema.prisma
  seed.ts
  generated/                     # gitignored, prisma-client generator output
docker-compose.yml
biome.json
.env.local.example
.env.cloud.example
CLAUDE.md
README.md
```

### Interfaces Before Implementation (D-05-corrected signature table)

Same table as `.planning/research/ARCHITECTURE.md` §"Interfaces Before Implementation", with every filename corrected to kebab-case and the Bolt entry moved per D-05:

| File | Signature | Real impl by |
|---|---|---|
| `types/slack.ts` | `interface SlackMessage { teamId: string; channelId: string; ts: string; threadTs?: string; userId: string; text: string }` | scaffold |
| `types/agent.ts` | `ExtractedIntent`, `ConflictSlot`, `RunAgentInput`, `RunAgentResult` per ARCHITECTURE.md | scaffold |
| `lib/config.ts` | one typed object, sections `slack`/`google`/`ai`/`db`/`trigger`/`agent`/`graph` | scaffold, extend-only later |
| `lib/db.ts` | `export const prisma: PrismaClient` (globalThis singleton) | scaffold |
| `lib/slack/client.ts` | `export const slackClient: WebClient` | scaffold |
| `lib/ai/provider.ts` | `complete<T>(opts): Promise<T>` | scaffold stub; Phase 5 fills in |
| `lib/agent/graph.ts` | `runAgent(input): Promise<RunAgentResult>` | scaffold stub (hardcoded); Phase 5 replaces |
| `lib/agent/dispatch.ts` | `dispatchAgentRun(input): Promise<void>` | scaffold/Phase 4 |
| `lib/agent/dedupe.ts` | `computeDedupeKey(teamId, channelId, threadOrMessageTs, normalizedIntent): string` | scaffold (real, pure function) |
| `lib/slack/post-proposal-card.ts` | `postProposalCard(proposal): Promise<{ channel: string; ts: string }>` | scaffold stub (hardcoded card); Phase 2 fills in |
| `lib/slack/update-proposal-card.ts` | `updateProposalCard(channel, ts, proposal): Promise<void>` | scaffold stub; Phase 2 fills in |
| `lib/slack/blocks.ts` | `buildApprovalBlocks(p)`, `buildConfirmedBlocks(p)` (no `buildConflictBlocks` — D-06) | Phase 2 |
| `lib/calendar/freebusy.ts` | `checkConflicts(userId, startIso, endIso): Promise<ConflictSlot[]>` | scaffold stub returns `[]`; Phase 3 |
| `lib/calendar/create-event.ts` | `createCalendarEvent(proposal): Promise<{ eventId, meetLink }>` | Phase 3 |
| `lib/slack/bolt.ts` | imports and registers listeners/actions; no logic of its own | scaffold |

### Anti-Patterns to Avoid

- **Constructing a new `PrismaClient` per request/listener** — already covered exhaustively in PROJECT.md/PITFALLS.md; the Phase 1-specific instance is: don't construct it inside the `app_mention` handler or the `approve_proposal` handler — import `lib/db.ts`'s singleton.
- **Reading `channel`/`ts` from the button-click payload instead of the stored row** — D-02 explicitly locks this ("uses the **stored** channel/ts"); PITFALLS.md's `chat.update` gotcha confirms why (drift risk).
- **Passing `adapter` inside `prisma.config.ts`** — this field was removed in Prisma 7 (see Pitfall 5); it will either be silently ignored or throw a config-schema error, not "extra safety".
- **Assuming `${GRAPH_SERVICE_DIR:-../graph-service}`-style defaults only apply when the referencing service is active** — Compose interpolates the entire file before applying `--profile` filtering, so an unset var without a default breaks `docker compose up postgres` even though `graph-service` never starts (`[CITED: docs.docker.com/reference/compose-file/interpolation/]`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Env loading in `prisma.config.ts` | A custom `.env` parser or manual `process.env` assembly | `import "dotenv/config"` (one line) | Prisma's own docs recommend exactly this; reinventing dotenv for one config file is pure waste |
| Button-value type narrowing for `block_actions` | A hand-rolled type guard checking `action.type === "button"` | `body as BlockButtonAction` (`BlockButtonAction = BlockAction<ButtonAction>`, exported from `@slack/bolt`) | The type already exists in the package; bolt-js's own GitHub issues confirm the cast pattern is the documented workaround for imperfect automatic narrowing |
| HKT time formatting | A date-math library (date-fns-tz, luxon) just for one formatter | stdlib `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', ... })` | D-08 already locks this; Node/bun's built-in `Intl` fully supports IANA timezones, no dependency needed for formatting-only (no arithmetic across DST — HKT has none) |
| Postgres readiness wait in Compose | A custom shell-script poll loop before starting dependents | `healthcheck: { test: ["CMD-SHELL", "pg_isready -U ..."] }` + `depends_on: { db: { condition: service_healthy } }` | Native Compose v2 feature, `[CITED: docs.docker.com/compose/how-tos/startup-order/]` |

**Key insight:** every "don't hand-roll" in this phase is a one-line stdlib/already-installed-dependency answer — consistent with the ladder: none of these earn a new abstraction.

## Common Pitfalls

*(Full pitfall catalogue lives in `.planning/research/PITFALLS.md`, already read as a canonical ref — the five below are Phase-1-specific corrections/additions this research session surfaced, not a re-listing of that document.)*

### Pitfall 1: `create-next-app` refuses the repo root — but not for the reason assumed

**What goes wrong:** Running `bunx create-next-app@16.3.4 .` (or with a project name pointing at the repo root) exits with a "directory contains files that could conflict" error and does not scaffold.

**Why it happens:** `create-next-app`'s `is-folder-empty` conflict-check (fetched from `vercel/next.js` canary source this session) allowlists exactly: `.claude`, `.cursor`, `.DS_Store`, `.git`, `.gitattributes`, `.gitignore`, `.gitlab-ci.yml`, `.hg`, `.hgcheck`, `.hgignore`, `.idea`, `.npmignore`, `.travis.yml`, `.vscode`, `.zed`, `LICENSE`, `Thumbs.db`, `docs`, `mkdocs.yml`, `npm-debug.log`, `yarn-debug.log`, `yarn-error.log`, `yarnrc.yml`, `.yarn` `[CITED: raw.githubusercontent.com/vercel/next.js/canary/packages/create-next-app/helpers/is-folder-empty.ts]`. **`.claude/` is now on this list** (a correction to the assumption in CONTEXT.md's research flag that it wasn't) — but **`.planning/`, `.remember/`, and `gsd-prompt-ai-secretary.md` are not**, so the refusal still happens. There is no `--force`/overwrite flag in the CLI's documented option list (`[CITED: nextjs.org/docs/app/api-reference/cli/create-next-app]`, fetched this session) to bypass this.

**How to avoid:** Scaffold into a sibling temp directory, then move the generated files into the repo root, preserving `.planning/`, `.claude/`, `.remember/`, and `gsd-prompt-ai-secretary.md`:

```bash
bunx create-next-app@16.3.4 /tmp/ai-secretary-scaffold \
  --ts --app --tailwind --biome --no-src-dir \
  --import-alias "@/*" --use-bun --turbopack --disable-git --yes
# then, from the repo root:
cp -r /tmp/ai-secretary-scaffold/. . --exclude=.git
rm -rf /tmp/ai-secretary-scaffold
```
(Use `rsync -a --exclude=.git /tmp/ai-secretary-scaffold/ .` if available — cleaner than `cp` for merging into an existing directory tree with pre-existing files.)

**Warning signs:** The CLI prints a "conflicting files" list — read it once; if it names anything other than `.planning`, `.remember`, or the loose `.md` file, something else changed and the temp-dir plan still applies.

**Phase to address:** Phase 1, first task, before any other scaffold step.

---

### Pitfall 2: shadcn init flags may not match the pinned 4.21.0 CLI — docs are unversioned

**What goes wrong:** The publicly fetched shadcn CLI docs this session describe `--defaults`, `--preset`, `--monorepo`, `--base` (component-library choice: base/radix/aria) — features that may not exist in the exact `4.21.0` pin STACK.md verified, since `ui.shadcn.com/docs/cli` documents whatever the *current* CLI is, not a specific historical version.

**Why it happens:** shadcn's docs site is not version-pinned per release the way `nextjs.org`'s versioned doc snapshot is (that page showed `version: 16.3.4` in its own frontmatter; shadcn's did not).

**How to avoid:** Don't trust the flag list found via web docs blindly — run `bunx shadcn@4.21.0 init --help` as the actual ground truth before scripting the init call, and confirm no `tailwind.config.js`/`.ts` is created afterward (already a locked check per PITFALLS.md's "shadcn CLI writes v3-style config if it's stale").

**Warning signs:** `init --help` shows flags absent from this research (e.g., no `--yes`) — adjust the actual command, don't assume.

**Phase to address:** Phase 1, shadcn init step.

---

### Pitfall 3: Prisma 7 removed `directUrl` and `adapter` from config — STACK.md/PROJECT.md's snippets are stale

**What goes wrong:** Copying PROJECT.md's/STACK.md's Prisma snippets verbatim (`directUrl = env("DIRECT_URL")` in the datasource block, or an `adapter` key in `prisma.config.ts`) produces a schema Prisma 7 will not accept, or a config object with an unused/removed field.

**Why it happens:** Prisma 7's `prisma.config.ts` datasource type is `{ url: string; shadowDatabaseUrl?: string }` only — no `directUrl`, no `adapter` (`[CITED: prisma.io/docs/orm/reference/prisma-config-reference, prisma.io/docs/guides/upgrade-prisma-orm/v7]`, both fetched this session). The CLI (`db push`, `migrate`, `generate`) reads the connection string from `prisma.config.ts`'s `datasource.url` field — this is the one place PROJECT.md's "declare both `url` and `directUrl` in the datasource" instruction no longer has anywhere to put the second value. Driver-adapter wiring for CLI migrations is now automatic and needs no config; the adapter is *only* passed to the `PrismaClient` constructor in application code.

**How to avoid:** Two separate, deliberately different values:
- `prisma.config.ts`'s `datasource.url` → `env("DIRECT_URL")` (unpooled — what `db push` needs).
- `lib/db.ts`'s `PrismaPg({ connectionString: process.env.DATABASE_URL })` → `DATABASE_URL` (pooled — what the running app needs).

This preserves FND-07's "env-only swap" property and PROJECT.md's underlying intent (CLI gets the direct connection, app gets the pooled one) without a schema field that no longer exists. See Code Examples for the full `prisma.config.ts`.

**Warning signs:** `bunx prisma db push` prints a schema-validation error mentioning an unrecognized `directUrl`/`adapter` key, or (silently worse) the CLI runs against the pooled URL and a pooler rejects/mangles the DDL statements `db push` issues.

**Phase to address:** Phase 1, schema + `lib/db.ts` step — before `db push` is run for the first time.

---

### Pitfall 4: `prisma.config.ts` does not auto-load `.env` — even under bun

**What goes wrong:** `DIRECT_URL`/`DATABASE_URL` read as `undefined` inside `prisma.config.ts` the first time `bunx prisma db push` runs, even though bun's runtime auto-loads `.env` for `bun run`/`bun <file>` invocations.

**Why it happens:** Prisma's own docs state explicitly: "Environment variables from `.env` files need to be loaded explicitly" inside `prisma.config.ts`, independent of which runtime later executes the rest of the process (`[CITED: prisma.io/docs/orm/reference/prisma-config-reference]`, fetched this session). `bunx <cli>` resolves and may invoke the installed CLI package however that package's own entrypoint/shebang dictates — whether that subprocess model preserves bun's implicit `.env` injection the same way a direct `bun run` script does is not something this session could verify (no runbook confirms it either way for `bunx`-invoked third-party CLIs).

**How to avoid:** Don't rely on the ambiguity — add one line at the top of `prisma.config.ts`:
```ts
import "dotenv/config";
```
This costs one new dev dependency (`dotenv@17.4.2`, `[VERIFIED: npm registry]`) and removes the question entirely, regardless of which runtime `bunx prisma` actually uses under the hood.

**Warning signs:** `bunx prisma db push` fails with a connection error mentioning `undefined` or an empty connection string, not a Postgres-side auth/network error.

**Phase to address:** Phase 1, `prisma.config.ts` authoring step — add the import before the first `db push` attempt, not after debugging a failure.

---

### Pitfall 5: Next.js 16 + Turbopack may not resolve the `prisma-client` generator's custom `output` path

**What goes wrong:** `app/page.tsx` (D-25's smoke test) throws `Cannot find module '.../prisma/generated/...'` or similar the first time it imports the generated client, specifically under Turbopack (not webpack).

**Why it happens:** One documented report (`buildwithmatija.com`, fetched this session, `[CITED]`, LOW-confidence single-source blog, not official) describes Turbopack losing track of the `prisma-client` generator's ESM-optimized output structure during SSR — its only confirmed fix is reverting to the deprecated `prisma-client-js` provider with **no custom `output` field**, which directly conflicts with D-12 (locked: `prisma-client` generator, output under `prisma/generated/`, gitignored). No official Prisma or Next.js doc fetched this session confirms `serverExternalPackages` alone resolves the *custom-output-path* case — the doc language found only discusses the *default*-output case.

**How to avoid — fallback ladder, cheapest first:**
1. Add `serverExternalPackages: ["@prisma/client", "pg"]` to `next.config.ts` (this much is uncontroversial for excluding native/generated code from Turbopack's bundler) and run D-25's smoke test.
2. If step 1 fails, try a `turbopack.resolveAlias` entry pointing the import specifier at the generated client's real path (mentioned in passing by a secondary source this session, not verified with a working example).
3. If step 2 fails inside the 40-minute box, the documented working escape hatch is reverting Phase 1's generator to `prisma-client-js` with the default (no custom `output`) location — a **deliberate, logged deviation from D-12**, reversible once Turbopack's handling of custom-output `prisma-client` improves. Do not spend more than a few minutes on step 2 before falling to step 3; this is exactly the kind of Phase 1 smoke test D-25 exists to front-load.

**Warning signs:** The `app/page.tsx` Prisma-count render throws at request time, not at `next build`/`bunx prisma generate` time — the generate step itself will report success.

**Phase to address:** Phase 1, immediately after `bunx prisma generate` succeeds and before building anything else in `app/`. This is D-25's whole purpose; this pitfall just names the exact failure mode and fallback ladder to have ready.

---

## Code Examples

### `prisma.config.ts` (Prisma 7, corrected for the removed `directUrl`/`adapter` fields)

```typescript
// Source: prisma.io/docs/orm/reference/prisma-config-reference,
// prisma.io/docs/guides/upgrade-prisma-orm/v7 (fetched 2026-09-11)
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  // The CLI (db push, generate) uses this URL. Point it at the UNPOOLED
  // connection (DIRECT_URL) — db push issues DDL a pooler can reject/mangle.
  // The pooled DATABASE_URL is used separately by lib/db.ts's PrismaPg adapter.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
```

### `lib/db.ts` (Prisma 7 + `@prisma/adapter-pg`, globalThis singleton)

```typescript
// Source: prisma.io/docs/guides/upgrade-prisma-orm/v7 (fetched 2026-09-11)
// combined with PROJECT.md's globalThis-singleton rule
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/client";
import { config } from "./config";

/** Global singleton holder so Next.js hot reload doesn't spawn a new pool. */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({
  connectionString: config.db.url, // DATABASE_URL — pooled, used by the running app
  max: 5, // pool max; `?connection_limit=5` in the URL is NOT honoured by `pg` (see below)
});

/** Shared Prisma client for this process. Never construct a second instance. */
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**Why `max: 5` instead of `?connection_limit=5` in the URL:** `pg`'s connection-string parser (`pg-connection-string`) preserves *all* query parameters on the parsed config object rather than rejecting unknown ones, but `pg.Pool`/`PrismaPg` only reads the specific option names it recognizes (`max`, `connectionTimeoutMillis`, `idleTimeoutMillis`, …) — `connection_limit` is a Prisma-engine-only convention `pg` has never read `[CITED: github.com/brianc/node-postgres issue history + prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool, both fetched this session]`. It won't throw, but it also silently does nothing — pass `max` explicitly instead. (Similarly, `?schema=public` is not read by `pg`; a documented open Prisma issue, `prisma/prisma#28611`, reports `PrismaPg`'s own second-argument `{ schema: ... }` option can itself be ignored in some versions — moot here since `public` is Postgres's own default schema.)

### `lib/config.ts` (Zod 4 env parsing — comma list, enum, optional stretch keys)

```typescript
// Source: zod.dev docs pattern (transform + split), cross-checked via
// WebSearch 2026-09-11 against colinhacks/zod discussion #1869
import { z } from "zod";

const envSchema = z.object({
  // Slack
  SLACK_BOT_TOKEN: z.string().min(1),
  SLACK_APP_TOKEN: z.string().min(1),
  SLACK_TEAM_ID: z.string().min(1),
  SLACK_WATCH_CHANNEL_IDS: z
    .string()
    .transform((v) => v.split(",").map((id) => id.trim()).filter(Boolean)),

  // Agent transport (D-15's discretely-typed enum)
  AGENT_TRANSPORT: z.enum(["trigger", "inline"]).default("inline"),

  // Postgres
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  // Stretch (optional — S1)
  NEO4J_URI: z.string().url().optional(),
  NEO4J_USER: z.string().optional(),
  NEO4J_PASSWORD: z.string().optional(),
  GRAPH_SERVICE_URL: z.string().url().optional(),
});

const parsed = envSchema.parse(process.env);

export const config = {
  slack: {
    botToken: parsed.SLACK_BOT_TOKEN,
    appToken: parsed.SLACK_APP_TOKEN,
    teamId: parsed.SLACK_TEAM_ID,
    watchChannelIds: parsed.SLACK_WATCH_CHANNEL_IDS,
  },
  agent: { transport: parsed.AGENT_TRANSPORT },
  db: { url: parsed.DATABASE_URL, directUrl: parsed.DIRECT_URL },
  graph: {
    neo4jUri: parsed.NEO4J_URI,
    neo4jUser: parsed.NEO4J_USER,
    neo4jPassword: parsed.NEO4J_PASSWORD,
    serviceUrl: parsed.GRAPH_SERVICE_URL,
  },
  // ...ai, google, trigger sections per D-15/ARCHITECTURE.md nesting
};
```

### `approve_proposal` action handler (Bolt 5.1.0, `block_actions` type narrowing)

```typescript
// Source: github.com/slackapi/bolt-js/blob/main/src/types/actions/block-action.ts
// (fetched 2026-09-11 — ButtonAction.value?: string, BlockButtonAction = BlockAction<ButtonAction>)
import type { BlockButtonAction } from "@slack/bolt";
import { prisma } from "../../db";
import { updateProposalCard } from "../update-proposal-card";

/**
 * Handles the Approve button click on a Proposal card.
 * @throws never — all failures are caught and logged; Slack must not see a thrown error here
 */
export async function handleApproveProposal({
  ack,
  body,
  client,
}: Parameters<Parameters<typeof import("@slack/bolt").App.prototype.action>[1]>[0]) {
  // ack() FIRST — before any DB/network call (Pitfall 10, PITFALLS.md)
  await ack();

  const action = (body as BlockButtonAction).actions[0];
  const proposalId = action.value; // string | undefined — ButtonAction.value is optional
  if (!proposalId) return;

  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return;

  await prisma.proposal.update({
    where: { id: proposalId },
    data: { status: "confirmed" },
  });

  // Use the STORED channel/ts (D-02), not body.channel.id / body.message.ts
  await updateProposalCard(proposal.card_channel, proposal.card_ts, proposal);
}
```

### Minimal Block Kit approval card (hardcoded body for Phase 1's stub)

```typescript
// Source: docs.slack.dev/tools/bolt-js/concepts/actions/ shape,
// combined with SLK-05's required fields (title, HKT time, participants, confidence)
export function buildApprovalBlocks(p: { id: string; title: string }) {
  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${p.title}*\n(hardcoded Phase 1 card)` },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          action_id: "approve_proposal",
          text: { type: "plain_text", text: "Approve" },
          style: "primary",
          value: p.id,
        },
      ],
    },
  ];
}
```

`chat.postMessage`/`chat.update` both require a top-level `text` fallback alongside `blocks` (accessibility/notification-preview requirement, unchanged Slack API contract) — pass `text: p.title` alongside `blocks: buildApprovalBlocks(p)`.

### `docker-compose.yml` skeleton (postgres default, neo4j/graph-service behind `graph` profile)

```yaml
# Source: docs.docker.com/compose/how-tos/startup-order/ (healthcheck/depends_on),
# docs.docker.com/reference/compose-file/interpolation/ (${VAR:-default} whole-file interpolation),
# GitHub docker/docs#20116 (deploy.resources.limits works under plain `docker compose up`, no swarm)
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ${POSTGRES_DB:-secretary}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres}"]
      interval: 5s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 512m

  neo4j:
    image: neo4j:5-community
    profiles: ["graph"]
    environment:
      NEO4J_AUTH: ${NEO4J_USER:-neo4j}/${NEO4J_PASSWORD:-changeme}
      NEO4J_server_memory_heap_max__size: 512m
      NEO4J_server_memory_pagecache_size: 256m
    ports:
      - "7474:7474"
      - "7687:7687"
    volumes:
      - neo4j_data:/data
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://localhost:7474 || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  graph-service:
    profiles: ["graph"]
    build:
      context: ${GRAPH_SERVICE_DIR:-../graph-service}
    depends_on:
      neo4j:
        condition: service_healthy
    environment:
      NEO4J_URI: bolt://neo4j:7687

volumes:
  postgres_data:
  neo4j_data:
```

Note: `NEO4J_server_memory_heap_max__size`/`NEO4J_server_memory_pagecache_size` are the Neo4j 5 environment-variable names for `dbms.memory.heap.max_size`/`dbms.memory.pagecache.size` (Neo4j's own convention: dots become underscores, and a literal underscore in the setting name is escaped as a double underscore) — this specific naming convention is carried over from training knowledge and PITFALLS.md/PROJECT.md's own text (`[ASSUMED]`, not independently re-fetched from Neo4j docs this session; PROJECT.md already states the same values in prose, so risk of being wrong is low but not zero).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Prisma datasource `url`+`directUrl` in `schema.prisma`, `adapter` in `prisma.config.ts` | Single `datasource.url` in `prisma.config.ts`; adapters auto-wired for CLI migrations | Prisma 7.0 (per upgrade guide) | STACK.md/PROJECT.md's Prisma snippets (written against a pre-7 or early-7 mental model) need the correction in Pitfall 3 above before Phase 1 writes real config files |
| `prisma-client-js` generator | `prisma-client` generator, `output` required | Prisma 7 (deprecation already known per STACK.md) | Confirmed still current; the *new* wrinkle is Turbopack's handling of the custom output path (Pitfall 5), not the generator choice itself |
| Docker Compose `mem_limit` (top-level) | `deploy.resources.limits.memory` (works under plain `docker compose up`, no Swarm required) | Compose V2 (docker/docs#20116) | Either spelling works; `deploy.resources.limits` is the spec-aligned modern spelling and was confirmed this session to apply without Swarm |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `NEO4J_server_memory_heap_max__size`/`NEO4J_server_memory_pagecache_size` are the correct Neo4j 5 env var names (double-underscore escaping convention) | Code Examples, docker-compose.yml | Low — this profile isn't started in Phase 1 exit criteria; wrong var names would only surface if/when the `graph` profile is exercised in a later phase, and are trivially fixed by checking Neo4j's docker docs at that time |
| A2 | `bunx prisma db push`'s subprocess does **not** reliably inherit bun's automatic `.env` loading the same way a direct `bun run <script>` invocation does | Pitfall 4 | Low — mitigated by adding the explicit `dotenv/config` import regardless, so this assumption drives an extra (harmless) safety line rather than a broken build either way |
| A3 | `serverExternalPackages: ["@prisma/client", "pg"]` alone is *not* sufficient to fix Turbopack + a custom-output `prisma-client` generator (only one blog post found, no official confirmation either way) | Pitfall 5 | Medium — if this assumption is wrong and the simple fix works, Phase 1 wastes at most a few minutes trying step 2 of the fallback ladder unnecessarily before discovering step 1 already worked; if right, the fallback ladder saves the phase from stalling on an unfixable Turbopack issue |
| A4 | shadcn CLI docs fetched this session reflect the *current* shadcn CLI, not necessarily the pinned `4.21.0` — flag list may differ | Pitfall 2 | Low — mitigated by the explicit recommendation to run `--help` against the pinned version before scripting |

## Open Questions (RESOLVED)

1. **Does `bunx <cli>` preserve bun's automatic `.env` injection for a Node-shebang'd package like `prisma`?**
   - What we know: bun auto-loads `.env` for `bun run <script>` and `bun <file>.ts`; Prisma's docs say `prisma.config.ts` needs explicit env loading regardless of runtime.
   - What's unclear: whether `bunx prisma db push`'s specific invocation path counts as "running under bun" for auto-load purposes, or resolves+execs the package in a way that bypasses it.
   - RESOLVED: moot — the `dotenv/config` import (Pitfall 4) makes the answer irrelevant; don't spend window time testing it directly.

2. **Does `serverExternalPackages` fully resolve the custom-output `prisma-client` + Turbopack case, or does it require the `turbopack.resolveAlias` addition?**
   - What we know: one report needed a full revert to `prisma-client-js`; no official doc walks through the custom-output case with `serverExternalPackages` alone.
   - What's unclear: whether this is a widely-hit issue or a config-specific edge case (e.g., a particular `output` path shape).
   - RESOLVED: D-25's own smoke test answers this empirically in the actual repo within the first few minutes of Phase 1 — treat the fallback ladder in Pitfall 5 as the answer, not further research.

## Environment Availability

This research session runs on Windows (Git Bash), not the target WSL Ubuntu machine PITFALLS.md and PROJECT.md describe — none of `bun`, `docker`, the WSL-native-filesystem check, or the actual `.wslconfig` memory cap could be probed from here. `.planning/research/PITFALLS.md`'s "Do Tonight" checklist is the authoritative, already-canonical-referenced source for verifying these by hand before the window opens; this section does not duplicate it. Two npm-registry-dependent checks this session's sandbox *could* run and did: `npm view` succeeded for all packages above (network egress to the npm registry is unobstructed from wherever this research ran), which has no bearing on the target machine's Docker/WSL state.

| Dependency | Required By | Available (this session) | Fallback |
|------------|------------|-----------|----------|
| bun ≥1.4.x | Package manager, script runner, Bolt process | Not probed (wrong OS) | PITFALLS.md "Do Tonight" checklist item covers this |
| Docker + Compose v2 | FND-05 | Not probed (wrong OS) | Same |
| WSL native filesystem (not `/mnt/c`) | Fast Refresh / file-watch reliability (Pitfall 2, PITFALLS.md) | Not probed (wrong OS) | Same |
| npm registry reachability | Version verification (this research) | ✓ confirmed (all `npm view` calls succeeded) | — |

**Missing dependencies with no fallback:** none identified beyond what PITFALLS.md's pre-window checklist already covers.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Phase 1 has no user-facing login; Slack request auth is Bolt's own signature/Socket-Mode-token verification (library-internal, not app code) |
| V3 Session Management | No | No sessions created in this phase |
| V4 Access Control | No | Single-workspace, two-user demo; no authz logic in Phase 1 |
| V5 Input Validation | Yes | `lib/config.ts`'s Zod parse at the process/env boundary (D-15) — the only external input Phase 1 actually validates |
| V6 Cryptography | Yes (flagged, not fixed) | User A's Google refresh token is seeded into Postgres **in plaintext** (D-13, "Specific Ideas" §3 in CONTEXT.md explicitly names this a `/ponytail-debt` candidate). No encryption-at-rest is planned for this hackathon build. This is an accepted, documented shortcut for a one-laptop, non-production demo — not a silent gap. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Secret leakage via client bundle | Information Disclosure | `lib/config.ts` is the only `process.env` reader (FND-06, locked); never imported into a `"use client"` component — enforced by code review, not tooling, in Phase 1 |
| SQL injection via raw queries | Tampering | Prisma's parameterized query builder for all normal access; the one raw `$queryRaw`/`UPDATE ... RETURNING` call (APR-02, Phase 4, not Phase 1) must use Prisma's tagged-template raw-query form, which parameterizes automatically — flagged here for Phase 4's researcher, not actionable in Phase 1 |
| Slack payload spoofing | Spoofing | Handled entirely inside `@slack/bolt`'s Socket Mode client (token-based, not signature-based, since there's no public HTTP endpoint) — no app code needed |
| Plaintext secret at rest (Google refresh token) | Information Disclosure | Accepted risk for this build (see V6 row above); documented in README's "known shortcuts" per DMO-04, not fixed in Phase 1 |

## Sources

### Primary (HIGH confidence)
- `github.com/slackapi/bolt-js/blob/main/src/types/actions/block-action.ts` (fetched via WebFetch, GitHub source) — `ButtonAction`, `BlockButtonAction`, `BlockAction` type definitions quoted verbatim
- `raw.githubusercontent.com/vercel/next.js/canary/packages/create-next-app/helpers/is-folder-empty.ts` (fetched via WebFetch, GitHub raw source) — `validFilesOrFolders` array quoted verbatim
- `nextjs.org/docs/app/api-reference/cli/create-next-app` (official docs, version-stamped `16.3.4`, fetched this session) — full CLI flag reference
- npm registry (`npm view <pkg> version`, `npm view <pkg> dependencies`) — direct queries this session for `@slack/web-api`, `@prisma/adapter-pg`, `pg`, `@types/pg`, `dotenv`, and `@slack/bolt@5.1.0`'s dependency on `@slack/web-api@^8.1.1`

### Secondary (MEDIUM confidence)
- `prisma.io/docs/orm/reference/prisma-config-reference`, `prisma.io/docs/guides/upgrade-prisma-orm/v7` (official docs, fetched via WebFetch this session) — `directUrl`/`adapter` removal, `datasource.url` shape, env-loading requirement
- `biomejs.dev/reference/configuration/` (official docs, fetched this session) — `files.includes` negation syntax, `vcs.useIgnoreFile`, `css.parser.tailwindDirectives`
- `docs.docker.com/compose/how-tos/startup-order/`, `docs.docker.com/reference/compose-file/interpolation/` (official docs, fetched this session) — healthcheck/`depends_on` syntax, whole-file interpolation behavior
- `github.com/docker/docs` issue #20116 (WebSearch, cross-checked against docs.docker.com) — `deploy.resources.limits.memory` working under plain `docker compose up`
- `bun.com/docs/runtime/environment-variables` (WebSearch summary, official bun docs domain) — `.env`/`.env.local` auto-load precedence
- `github.com/prisma/prisma` issue #28611 (WebSearch) — `PrismaPg` `schema` option reported ignored in some versions

### Tertiary (LOW confidence)
- `buildwithmatija.com/blog/migrate-prisma-v7-nextjs-16-turbopack-fix` (single blog post, WebSearch-summarized, not independently corroborated) — Turbopack + custom-output `prisma-client` generator failure report; treated as a risk flag with a fallback ladder, not as settled fact
- `ui.shadcn.com/docs/cli` (WebFetch, unversioned docs site) — flag list may not match the pinned `4.21.0` CLI exactly; flagged in Pitfall 2 with a run-time verification step

## Metadata

**Confidence breakdown:**
- Standard stack (new package versions): HIGH — npm-registry-verified this session, cross-checked against `@slack/bolt`'s own declared peer dependency
- Prisma 7 config shape: MEDIUM-HIGH — CITED from two official Prisma doc pages fetched this session, but not executed against a real `bunx prisma db push` in this sandbox (wrong OS)
- create-next-app conflict behavior: HIGH — quoted verbatim from the CLI's own source file this session
- shadcn/Biome/docker-compose syntax: MEDIUM-HIGH — CITED from official docs fetched this session, matches training-knowledge baseline
- Turbopack + custom-output Prisma client risk: LOW — single uncorroborated source; mitigated with an explicit fallback ladder rather than treated as resolved

**Research date:** 2026-09-11
**Valid until:** Effectively for this build window only (Sat 12 Sep 2026) — this is a one-day hackathon build, not a document meant to outlive the phase. If reused, re-verify Prisma/Next.js/shadcn version-specific claims (30-day estimate for the ecosystem facts, but the practical validity window here is "until 15:30 HKT tomorrow").
