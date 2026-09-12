# Phase 8: [optional] S2 — Commitment Ledger - Research

**Researched:** 2026-09-11
**Domain:** CopilotKit generative UI (Next.js 16 App Router) + additive Zod extraction schema + nudge-through-approval-card wiring
**Confidence:** MEDIUM — package versions/exports are npm-registry-verified this session (HIGH); CopilotKit API-shape and Kilo Gateway-compatibility claims are `[CITED]` from official docs and GitHub issues fetched/searched this session, not executed against a live Next.js 16 app in this sandbox (LOW-MEDIUM per source, see per-claim tags). No code exists in this repo yet — Phase 1 is still in planning, not executed — so every "upstream interface" cited below is a **planned signature from CONTEXT.md/RESEARCH.md files**, not a file this session opened and ran.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Gating and time box (locked by roadmap)**
- **D-01:** Latest start 13:45 HKT, only if Phase 7's full dry run has already passed on `main`. Budget ~45–60 min. Must be merged to `main` demo-ready by 14:40 (before Phase 10 rehearsal).
- **D-02:** Abandon criterion: if the ledger isn't rendering at least two different component types by 14:40, abandon — do not merge, do not spend more time. Abandoned work becomes a README line (Phase 11 owns the README).
- **D-03:** Branch `gsd/phase-8-s2-commitment-ledger`, labelled `[throwaway]`: never merges unless demo-ready. This branch rebases on any late Phase 7 change, never the reverse.
- **D-04:** Runs alongside nothing. Never alongside Phase 9 or Phase 10.

**Extraction schema (STR-04)**
- **D-05:** Add a `commitment` intent type beside `meeting` in `lib/agent/**`'s extraction schema. Additive only: never edit the `meeting` shape. Existing meeting extraction must keep working (success criterion 1).
- **D-06:** Commitment fields: direction (`owed_by_me` / `owed_to_me`), what, who, when promised, due, source link, status (`open` / `done` / `overdue` / `dropped`), per PROJECT.md "Stretch detail — S2".
- **D-07:** Validation stays Zod: one schema per LLM output, shared by the extraction call and the DB write (PROJECT.md stack rule). All model calls go through `lib/ai/provider.ts`.

**Generative UI surface (STR-05)**
- **D-08:** CopilotKit is the chosen tool (fixed stack). Its dependency (`@copilotkit/react-core`, `@copilotkit/react-ui`, plus whatever runtime package the route needs) is installed only now, in this phase, per the PROJECT.md key decision. CLAUDE.md pins `@copilotkit/react-core`/`react-ui` at 1.71.0.
- **D-09:** Heterogeneous rows pick different components: deadline chip + "block time" (dated promise), draft-nudge (overdue on my side), chase (owed to me, drafts the message), clarify card (ambiguous). Minimum bar for merge: two visibly different component types.
- **D-10:** Two different commitment-shaped questions render two visibly different components (exit criterion).
- **D-11:** CopilotKit is a frontend/runtime layer, not an agent framework; do not build a second agent loop in it (source doc "Agent orchestration").

**Nudge → approval card**
- **D-12:** Sending a nudge is an action, so it goes through the same approval-card flow as scheduling. Sending a nudge produces a Slack approval card, never a message sent directly (success criterion 3; PROJECT.md out-of-scope "Autoreply").
- **D-13:** Phase 8 may only call the existing approval-card function in `lib/slack/**`; it must not edit `lib/slack/**` internals.

**Suggested plan split (roadmap recommendation, adopted)**
- **D-14:** 2 plans: 08-01 `commitment` extraction type + heterogeneous component selection logic; 08-02 CopilotKit ledger surface + nudge-through-approval-card wiring.

**File ownership (locked by roadmap)**
- **D-15:** Owns `app/api/copilotkit/**` (or equivalent runtime route), `components/commitment-ledger/**`, and additive-only changes to `lib/agent/**`'s extraction schema.
- **D-16:** Must not touch `lib/slack/**` internals (beyond calling the existing approval-card function) or `lib/calendar/**`.
- **D-17:** Named overlap: `lib/agent/**` extraction schema, additive field only.

**Processes / ports (locked by roadmap)**
- **D-18:** Next.js dev on its own workspace port :3003 (`bun run dev`, plain `next dev`, no `--bun`); Postgres :5432 shared.

**Project constraints that apply (PROJECT.md)**
- **D-19:** No test files; Biome only (`biome check --write` before done); TSDoc on every function; kebab-case files, PascalCase components, named exports, no `any`.
- **D-20:** Colours only through shadcn CSS variables in `app/globals.css`; no colour literals in components. Retro dark theme devices (hard borders, offset shadows, monospace data, uppercase micro-labels, status in form not colour alone).
- **D-21:** Server Components by default, `"use client"` only where interactivity demands it; no secrets in client components; thin route handlers with logic in `lib/`; one typed config module is the only reader of `process.env`.
- **D-22:** Impeccable is in scope for this phase (it touches `app/` and `components/`), but only as much as the time box allows.
- **D-23:** bun only: `bun add` with exact pins, never `bunx --bun` / `bun --bun`; never hand-merge `bun.lock`.

### Claude's Discretion
- Where commitment rows persist: a new Prisma model via `db push` on the throwaway branch, reuse of an existing table, or no persistence (render from extraction/seed). Any schema change follows the `develop`-serialized `db push` rule and is `[throwaway]`-scoped.
- Which CopilotKit mechanism renders per-row components (e.g. frontend actions with `render`, tool-call rendering) and which CopilotKit runtime service adapter is used, provided model traffic still goes through `lib/ai/provider.ts` / Kilo Gateway env.
- How "block time" works (it may reuse the existing scheduling proposal flow) and how the nudge approval card is expressed without editing `lib/slack/**` internals (the existing card is proposal-shaped; researcher/planner must resolve this tension).
- Where the ledger page lives under `app/` and how it fetches data (TanStack Query per repo rules).
- How commitment rows get into the demo (live extraction vs hand-seeded rows) within the time box.
- Where the "component selection logic" lives (pure function in `lib/` or `utils/`).

### Deferred Ideas (OUT OF SCOPE)
- S2 priority (2) Relationship and cadence brief (STR-06) and (3) Time-allocation reality check (STR-07): v2, not this phase.
- Sentiment analysis of colleagues: deliberately dropped, never reintroduce.
- Batch sweep over a window for commitment detection: documented production design only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STR-04 | Extraction emits a `commitment` type with direction, what, who, when promised, due, source link and status | §Code Examples "Additive commitment Zod schema"; §Architecture Patterns "Extraction schema addition" |
| STR-05 | A CopilotKit surface renders the commitment ledger, choosing a different component per row type, and nudges go through the same approval card | §Architecture Patterns "Deterministic component selection"; §Common Pitfalls 3–5; §Code Examples "CopilotKit route + frontend tool"; §Architecture Patterns "Nudge → approval card resolution" |
</phase_requirements>

## Summary

CopilotKit at the pinned `1.71.0` ships **two parallel API generations in the same package**, selectable by import path: the package's **default export** (`@copilotkit/react-core`, `@copilotkit/runtime`) is the older, still-shipped, still-supported API (`<CopilotKit runtimeUrl>`, `useCopilotAction`, `CopilotRuntime` + `OpenAIAdapter` + `copilotRuntimeNextJSAppRouterEndpoint`), and the `/v2` subpath (`@copilotkit/react-core/v2`, `@copilotkit/runtime/v2`) is the new, currently-documented-as-default quickstart API (`CopilotKitProvider`, `useFrontendTool`, `BuiltInAgent` + `createCopilotRuntimeHandler`, model selected by a `"provider:model"` string). Both are real, both are present in the exact pinned version's `exports` map `[VERIFIED: npm registry — package.json exports field]`, confirming the phase's "API churn" risk is real and current, not stale training data.

**Primary recommendation: use the default (non-`/v2`) API for this phase.** The `/v2` path's `BuiltInAgent({ model: "provider:model" })` shorthand has no documented mechanism this session could confirm for pointing at an arbitrary OpenAI-compatible `baseURL` (Kilo Gateway) — every `/v2` example found uses first-party provider strings. The default-export `OpenAIAdapter` accepts a **caller-constructed `OpenAI` client instance**, and multiple independently-found examples (docs + community + a filed GitHub issue) confirm the exact `new OpenAI({ apiKey, baseURL: "https://api.kilo.ai/api/gateway" })` → `new OpenAIAdapter({ openai, model })` pattern works for Kilo Gateway today `[CITED: GitHub issue CopilotKit/CopilotKit#3317, docs.copilotkit.ai patterns cross-checked via WebSearch]`. This is the only path in reach this session that satisfies the repo rule "all model calls go through `lib/ai/provider.ts`" with an actual mechanism (construct one `OpenAI` client in `provider.ts`, export it, pass it to `OpenAIAdapter`), so it is the prescribed choice even though CopilotKit's own docs now lead with `/v2`.

**A live, filed, unresolved bug is a real risk for this specific demo shape.** `CopilotKit/CopilotKit#3317` reports that with `OpenAIAdapter` + Kilo Gateway, the **second request in the same chat session** is mis-routed to Kilo Gateway's `/responses` endpoint instead of `/chat/completions` and fails. The phase's own exit criterion is "ask two different commitment-shaped questions" — precisely a two-request-same-session shape. Mitigation (cheap, in scope): don't drive the two questions through one continuous chat thread; use two independent single-shot invocations (e.g., two buttons that each open/reset a fresh CopilotKit session, or two separately-mounted ledger views) so neither request is ever a "second request" in the buggy sense. This is a Common Pitfall, not a blocker — flag it to the planner explicitly.

**The generative-UI mechanism should be deterministic, not model-whim-dependent**, per the phase's own instruction. Recommend one `useCopilotAction`/frontend-tool ("queryCommitments") whose `render` prop iterates matching rows and calls a **pure function** `selectCommitmentComponent(row): "deadline-chip" | "draft-nudge" | "chase" | "clarify"` — the LLM's role is limited to deciding *which* commitments answer the user's question (real tool-calling, real "agent picks"), while *which component renders each row* is a deterministic lookup on `direction`/`status`/`due` fields. This guarantees D-10's exit check never depends on model behavior for the part being graded ("two visibly different components").

**Nudge → approval card has a real, documented tension the roadmap already names but doesn't resolve.** The existing approve-card round trip (Phase 1/4 design, not yet built) is calendar-shaped: on Approve, the handler re-derives from the `Proposal` row and calls `lib/calendar/createEvent.ts`. Phase 8 is expressly forbidden from editing that handler. The lightest compliant option is: create a real `Proposal` row for the nudge (reusing the *existing* Prisma model, with placeholder `start`/`end`/`tz` values) and call the *existing* `postProposalCard(proposal)` function — this satisfies success criterion 3 exactly ("sending a nudge produces a Slack approval card, not a message sent directly") because the criterion only checks that a card appears, not what a click on Approve later does. Clicking Approve on a nudge card would, as designed today, attempt to create a nonsensical calendar event — a known, documented residual risk the planner should either accept (add a demo-script note: don't click Approve on a nudge card) or descope by never wiring a real "send the drafted nudge" side effect at all (Approve just flips status, same DB write, no calendar call — since Phase 8 cannot edit the handler that decides what Approve *does*, this outcome is not under Phase 8's control either way). This must go to the planner as an explicit open decision, not something this research resolves unilaterally.

**Persistence: recommend hand-seeded/hardcoded ledger rows, not a new DB round trip for rendering.** A new Prisma `Commitment` model + `db push` is *technically* safe (additive, doesn't touch `Proposal`/`Decision`), but costs schema-authoring + `db push` + seed time inside a 45–60 minute box for data that only needs to *look* real on stage. Recommend: hardcode 4–6 commitment rows (mix of `owed_by_me`/`owed_to_me`, mix of status) directly in a `lib/commitment-ledger/` module, and prove STR-04's extraction requirement *separately* with one real `extractIntents` hand-check (a message like "I'll send the deck by Friday" → one `commitment`-typed intent, verified by log/console, not by wiring the ledger UI to live extraction output). This decouples "the schema change works" (STR-04's actual check) from "the UI renders two different components reliably on stage" (STR-05's actual check) — two different risk profiles, so don't couple their failure modes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Commitment extraction (`commitment` type in Zod schema) | Backend / domain logic (`lib/agent/`) | AI provider (`lib/ai/provider.ts`) | Same tier as existing `meeting` extraction — additive schema field, not a new subsystem |
| Commitment ledger rendering (heterogeneous components) | Frontend Server + Client (Next.js `app/`, `"use client"` ledger components) | — | CopilotKit is explicitly a frontend/runtime layer (D-11); rendering decisions belong in `components/commitment-ledger/**` |
| Component-selection logic (row → component kind) | Pure function, `lib/` or `utils/` | Frontend (calls it from a render prop) | Deterministic business logic, not UI — belongs beside other pure helpers (`lib/agent/dedupe.ts` precedent), callable from both the CopilotKit render prop and, if reused, a non-CopilotKit fallback render path |
| CopilotKit runtime route (`app/api/copilotkit/route.ts`) | API / Backend (thin Next.js route handler) | AI provider (proxies to Kilo Gateway via `lib/ai/provider.ts`'s client) | Repo rule: "thin route handlers with logic in `lib/`" — the route only wires `CopilotRuntime`+adapter+endpoint, no business logic |
| Nudge → Proposal row creation | Backend / domain logic (new `lib/commitment-ledger/` or extending `lib/agent/`) | Database (Proposal write) | Reuses the existing Proposal persistence tier; Phase 8 must not add logic inside `lib/slack/**` |
| Nudge card posting | Backend (`lib/slack/post-proposal-card.ts`, called not edited) | — | D-13 locks this: call, don't modify |
| Approve-click handling for a nudge card | Bolt process (`lib/slack/**` internals, **out of Phase 8's control**) | — | Explicitly not ownable by this phase; documented residual risk, not a Phase 8 deliverable |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@copilotkit/react-core` | **1.71.0** `[VERIFIED: npm registry]` | Frontend hooks/provider for the CopilotKit surface | CLAUDE.md pin; matches `@copilotkit/runtime`'s exact version (monorepo, versions move in lockstep) |
| `@copilotkit/react-ui` | **1.71.0** `[VERIFIED: npm registry]` | Optional prebuilt chat UI components (sidebar/popup) if used for the question-asking surface | Same monorepo/version lockstep |
| `@copilotkit/runtime` | **1.71.0** `[VERIFIED: npm registry]` | Backend runtime: `CopilotRuntime`, `OpenAIAdapter`, `copilotRuntimeNextJSAppRouterEndpoint` (default export) | Not listed explicitly in CLAUDE.md's pin table but required by the route handler; same version as the two pinned packages avoids a cross-version mismatch |
| `openai` | **7.15.0** (already pinned, project-wide) | Constructs the `OpenAI` client instance passed into `OpenAIAdapter({ openai, model })`, pointed at Kilo Gateway's `baseURL` | `@copilotkit/runtime@1.71.0`'s own `dependencies` field declares `"openai": "^4.85.1 || >=5.0.0"` `[VERIFIED: npm registry — npm view @copilotkit/runtime@1.71.0 dependencies]` — 7.15.0 satisfies `>=5.0.0`, so no conflict with the project-wide pin |
| `zod` | **4.6.2** (already pinned, project-wide) | Extraction schema, additive `commitment` branch | `@copilotkit/react-core@1.71.0`'s peer range is `zod: ">=3.25"` `[VERIFIED: npm registry — npm view @copilotkit/react-core@1.71.0 peerDependencies]`; 4.6.2 satisfies it. Note `@copilotkit/runtime@1.71.0` itself has its **own internal** `zod: "^3.23.3"` regular dependency `[VERIFIED: npm registry]` — this is CopilotKit's own bundled internal use, not something the project's code imports; no action needed, but do not be surprised to see a second zod major in `node_modules` |

**No new package needed for Kilo Gateway routing** — `OpenAIAdapter` takes any object shaped like the `openai` SDK's client; pointing it at Kilo Gateway is a constructor argument (`baseURL`), not a different package.

### Installation

```bash
bun add @copilotkit/react-core@1.71.0 @copilotkit/react-ui@1.71.0 @copilotkit/runtime@1.71.0
```

(`openai` and `zod` are already installed project-wide since Phase 1/5 — do not re-add.)

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Default-export (`v1`) CopilotKit API | `/v2` API (`CopilotKitProvider`, `useFrontendTool`, `BuiltInAgent`) | `/v2` is CopilotKit's own currently-documented default and the actively-maintained direction (`useCopilotAction` is marked deprecated in favor of `useFrontendTool`/`useRenderToolCall`). Rejected for this phase only because this session found no confirmed way to point `BuiltInAgent`'s `"provider:model"` shorthand at an arbitrary Kilo Gateway `baseURL` — the exact thing this project's stack requires (`AI_BASE_URL` env-swappable). If a future non-time-boxed phase revisits S2, re-research `/v2`'s model-provider configuration surface directly (not found this session) before defaulting to it. |
| Hand-seeded ledger rows | New `Commitment` Prisma model + `db push` + seed script | A real model is more "correct" for a production path and is fully compatible with the `develop`-serialized `db push` rule, but costs schema+push+seed time this 45–60 min box can't spare for data that only needs to look right on stage. Recommended as the discretionary upgrade if the phase runs ahead of schedule, not as the default. |
| Nudge posts through the real `Proposal` model | A hypothetical second lightweight "notification" table | Rejected: would require a **second** card-building/posting path, and D-13 only grants Phase 8 permission to *call* the existing approval-card function — introducing a parallel Slack-posting mechanism it wasn't given access to build would itself be a `lib/slack/**` internals change in spirit. |

## Package Legitimacy Audit

```
gsd_run query package-legitimacy check --ecosystem npm @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime
```

| Package | Registry | Weekly Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-------------------|--------------|---------|-------------|
| `@copilotkit/react-core` | npm | 332,866 | github.com/CopilotKit/CopilotKit | `SUS` (reason: `too-new` — heuristic reads latest-version publish timestamp, 2026-09-09, two days before this research; this is CopilotKit's own official monorepo, versions ship in lockstep on every release) | Flagged — low-risk false positive given download count + official repo, consistent with the same false-positive pattern Phase 1's research already documented for monorepo packages (`@slack/web-api`, `@prisma/adapter-pg`) |
| `@copilotkit/react-ui` | npm | 197,899 | github.com/CopilotKit/CopilotKit | `SUS` (same `too-new` false positive) | Flagged — same low-risk note |
| `@copilotkit/runtime` | npm | 268,576 | github.com/CopilotKit/CopilotKit | `SUS` (same `too-new` false positive) | Flagged — same low-risk note |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** all three, solely by the "too-new" heuristic (measures latest-publish-date, not package age — CopilotKit has been an active project for years, verified by download counts and its GitHub org). **Recommendation to planner:** one combined `checkpoint:human-verify` before `bun add`, matching the precedent already set in `01-RESEARCH.md` for the same heuristic blind spot — not three separate checkpoints.

## Architecture Patterns

### System Architecture Diagram

```
User types a commitment-shaped question into the CopilotKit chat surface
      │  (e.g. "what do I owe people?" / "what's overdue?")
      ▼
┌───────────────────────────────────────────────────┐
│ Next.js Client Component (app/(ledger)/…, "use client")           │
│  <CopilotKit runtimeUrl="/api/copilotkit">                        │
│    useCopilotAction("queryCommitments", { parameters, handler,    │
│      render })                                                    │
└──────────────────┬──────────────────────────────────────────────┘
                    │ POST (chat completion request, tool schema attached)
                    ▼
┌───────────────────────────────────────────────────┐
│ app/api/copilotkit/route.ts (thin route handler)                  │
│  CopilotRuntime + OpenAIAdapter({ openai: providerClient,         │
│    model: MODEL_FAST })  — providerClient constructed in          │
│    lib/ai/provider.ts, baseURL = Kilo Gateway                       │
└──────────────────┬──────────────────────────────────────────────┘
                    │ chat.completions (Kilo Gateway, tool-calling enabled)
                    ▼
              Model decides: call queryCommitments(direction?, status?)
                    │ tool call returned to the client
                    ▼
┌───────────────────────────────────────────────────┐
│ Client: handler(args) → filters hardcoded/seeded commitment rows  │
│         render({ args, status, result }) → for each matching row: │
│           selectCommitmentComponent(row) — PURE FUNCTION, no LLM  │
│           → "deadline-chip" | "draft-nudge" | "chase" | "clarify" │
│         → renders the matching React component                    │
└──────────────────┬──────────────────────────────────────────────┘
                    │ user clicks "Nudge Bob" on a "chase" row
                    ▼
┌───────────────────────────────────────────────────┐
│ POST /api/commitment-ledger/nudge (new, Phase-8-owned route)       │
│   creates a Proposal row (title="Nudge: …", placeholder start/end,│
│   status=pending) via Prisma                                       │
│   calls the EXISTING postProposalCard(proposal) — not edited       │
└──────────────────┬──────────────────────────────────────────────┘
                    │ chat.postMessage (existing function, existing card shape)
                    ▼
              Slack approval card appears (Approve/Reject, value=proposalId)
              — clicking Approve runs the EXISTING approve_proposal handler,
                which Phase 8 does not own and cannot change (residual risk,
                flagged to planner, not resolved here)
```

### Recommended Project Structure

```
app/
  api/
    copilotkit/
      route.ts               # CopilotRuntime + OpenAIAdapter + copilotRuntimeNextJSAppRouterEndpoint
    commitment-ledger/
      nudge/
        route.ts              # creates Proposal row, calls postProposalCard (existing fn)
  (dashboard or wherever the ledger page mounts)/
    commitment-ledger/
      page.tsx                # "use client" boundary, <CopilotKit runtimeUrl="/api/copilotkit">
components/
  commitment-ledger/
    deadline-chip.tsx          # PascalCase component, dated promise
    draft-nudge.tsx            # overdue on my side
    chase.tsx                  # owed to me, drafts the nudge message + "Nudge" button
    clarify-card.tsx           # ambiguous row
lib/
  commitment-ledger/
    select-component.ts        # selectCommitmentComponent(row): pure function
    seed-rows.ts                # hardcoded demo commitment rows (Claude's Discretion: seed vs live)
  agent/
    <existing extraction schema file>.ts   # ADDITIVE: commitment branch added to the discriminated union
  ai/
    provider.ts                # ADDITIVE: export the raw OpenAI client instance CopilotKit needs
                                # (existing complete<T>() wrapper untouched)
```

### Extraction schema addition (STR-04)

The `types/agent.ts` stub interface already anticipates this discriminator from Phase 1's own research: `[VERIFIED: .planning/research/ARCHITECTURE.md:96 — "interface ExtractedIntent { messageIndex: number; type: \"meeting\" | \"commitment\"; title: string; startIso: string | null; durationMinutes: number; participantSlackIds: string[]; confidence: number; isActionable: boolean; reason?: string }"]`. That interface only carries a bare `"commitment"` string literal in the union — it does **not** yet carry the commitment-specific fields (direction, who, due, source link, status) D-06 requires. Phase 8's job is to extend the **Zod schema** (not this plain interface) with a proper discriminated union so `type: "commitment"` rows carry their own required fields, while `type: "meeting"` rows are untouched:

```typescript
// Illustrative shape — the real file/name is created by Phase 5 (AGT-02),
// not yet on disk. Phase 8 extends it additively; locate the actual file
// at execution time (see Open Questions).
import { z } from "zod";

const MeetingIntentSchema = z.object({
  messageIndex: z.number(),
  type: z.literal("meeting"),
  title: z.string(),
  startIso: z.string().nullable(),
  durationMinutes: z.number(),
  participantSlackIds: z.array(z.string()),
  confidence: z.number(),
  isActionable: z.boolean(),
  reason: z.string().optional(),
});

// ADDITIVE — new branch, meeting branch above is untouched
const CommitmentIntentSchema = z.object({
  messageIndex: z.number(),
  type: z.literal("commitment"),
  direction: z.enum(["owed_by_me", "owed_to_me"]),
  what: z.string(),
  who: z.string(),
  whenPromisedIso: z.string(),
  dueIso: z.string().nullable(),
  sourceLink: z.string(), // Slack permalink or ts-derived reference
  status: z.enum(["open", "done", "overdue", "dropped"]),
  confidence: z.number(),
  isActionable: z.boolean(),
  reason: z.string().optional(),
});

export const ExtractedIntentSchema = z.discriminatedUnion("type", [
  MeetingIntentSchema,
  CommitmentIntentSchema,
]);
export type ExtractedIntent = z.infer<typeof ExtractedIntentSchema>;
```

`z.discriminatedUnion("type", [...])` is the correct Zod primitive for "additive, never touches the other branch" — confirmed current in Zod 4 `[CITED: zod.dev discriminated-union docs, matches training-knowledge baseline, not independently re-fetched this session — LOW-MEDIUM]`.

### `lib/ai/provider.ts` addition — the compliant Kilo Gateway wiring

D-07/AGT-01 requires "all model calls go through `lib/ai/provider.ts`." That module's locked stub signature (Phase 1) is `complete<T>(opts): Promise<T>` — a structured-output wrapper, **not** a raw client export `[VERIFIED: .planning/phases/01-foundation-hardcoded-round-trip/01-RESEARCH.md:261 — "lib/ai/provider.ts | complete<T>(opts): Promise<T> | scaffold stub; Phase 5 fills in"]`. `OpenAIAdapter` needs a raw `OpenAI` **instance**, not this wrapper function. The compliant resolution: add one more named export to the same file — the raw client — so there is still exactly one place in the repo that reads `AI_API_KEY`/`AI_BASE_URL` and constructs an SDK client:

```typescript
// lib/ai/provider.ts — additive export, existing complete<T>() untouched
import OpenAI from "openai";
import { config } from "@/lib/config";

/**
 * The single OpenAI-SDK client instance for this process, pointed at
 * Kilo Gateway. Exported (not just used internally by complete<T>) so
 * CopilotKit's OpenAIAdapter can be constructed from the same client —
 * this keeps "all model calls through lib/ai/provider.ts" true even
 * for CopilotKit's own request path, which needs a raw client object,
 * not the complete<T>() wrapper.
 */
export const openaiClient = new OpenAI({
  apiKey: config.ai.apiKey,
  baseURL: config.ai.baseUrl, // Kilo Gateway: https://api.kilo.ai/api/gateway
});

// existing: export async function complete<T>(opts): Promise<T> { ... }
```

```typescript
// app/api/copilotkit/route.ts
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime"; // default export — NOT "@copilotkit/runtime/v2"
import { NextRequest } from "next/server";
import { openaiClient } from "@/lib/ai/provider";
import { config } from "@/lib/config";

const serviceAdapter = new OpenAIAdapter({
  openai: openaiClient,
  model: config.ai.modelFast, // reuse the existing MODEL_FAST env value; verify tool-calling support
});

const runtime = new CopilotRuntime();

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
};
```

Import names (`CopilotRuntime`, `OpenAIAdapter`, `copilotRuntimeNextJSAppRouterEndpoint`) and the constructor shape (`new OpenAIAdapter({ openai, model })`) are `[CITED: docs.copilotkit.ai/runtime-server-adapter + WebSearch-aggregated Kilo Gateway examples, cross-checked against GitHub issue #3317's own working snippet]` — MEDIUM confidence, not executed in this sandbox.

**Tool-calling requirement:** before wiring `MODEL_FAST` into `OpenAIAdapter`, confirm the chosen model supports tool/function calling on Kilo Gateway — the same `https://api.kilo.ai/api/gateway/models?supported_parameters=...` check STACK.md already prescribes for structured outputs applies here for `tools`, and is a separate capability from `structured_outputs` `[ASSUMED — carried over from STACK.md's existing pattern for a different capability flag, not independently re-verified for `tools` this session]`.

### Deterministic component selection (research question 3)

```typescript
// lib/commitment-ledger/select-component.ts
import type { CommitmentRow } from "./types";

export type CommitmentComponentKind =
  | "deadline-chip"
  | "draft-nudge"
  | "chase"
  | "clarify";

/**
 * Picks which component renders a commitment row. Pure function —
 * deliberately NOT delegated to the model, so the exit criterion
 * (two questions → two visibly different components) is guaranteed
 * by data shape, not by LLM behavior on the day.
 * @param row a single commitment-shaped record
 * @returns the component kind to render
 */
export function selectCommitmentComponent(
  row: CommitmentRow,
): CommitmentComponentKind {
  if (row.status === "open" && row.direction === "owed_by_me" && row.dueIso) {
    return "deadline-chip"; // dated promise I owe — "block time for this"
  }
  if (row.status === "overdue" && row.direction === "owed_by_me") {
    return "draft-nudge"; // overdue on my side
  }
  if (row.direction === "owed_to_me" && (row.status === "open" || row.status === "overdue")) {
    return "chase"; // owed to me — draft a nudge message
  }
  return "clarify"; // no due date, dropped, or otherwise ambiguous
}
```

This is called from the `render` prop of the single `useCopilotAction`/frontend-tool, once per matching row — the render function fans out to the four components using this lookup, not a second model call.

### Nudge → approval card resolution (research question 4)

```typescript
// app/api/commitment-ledger/nudge/route.ts
import { prisma } from "@/lib/db";
import { postProposalCard } from "@/lib/slack/post-proposal-card"; // CALL, don't edit
import { config } from "@/lib/config";

/**
 * Creates a Proposal row for a commitment nudge and posts the SAME
 * approval card function scheduling uses. Satisfies "sending a nudge
 * produces a Slack approval card, never a message sent directly"
 * (success criterion 3). Does NOT control what happens after Approve —
 * that handler lives in lib/slack/**, out of Phase 8's ownership.
 */
export async function POST(req: Request) {
  const { who, what, sourceChannelId } = await req.json();

  const proposal = await prisma.proposal.create({
    data: {
      team_id: config.slack.teamId,
      dedupe_key: `nudge:${who}:${what}:${Date.now()}`, // simple, unique enough for a throwaway demo path
      title: `Nudge: ${who} re: ${what}`,
      start: new Date(), // placeholder — nudge has no real meeting time
      end: new Date(Date.now() + 15 * 60 * 1000),
      tz: "Asia/Hong_Kong",
      status: "pending",
      source_channel: sourceChannelId,
    },
  });

  const { channel, ts } = await postProposalCard(proposal);
  await prisma.proposal.update({
    where: { id: proposal.id },
    data: { card_channel: channel, card_ts: ts },
  });

  return Response.json({ proposalId: proposal.id });
}
```

**Open tension flagged to planner, not resolved here:** the Prisma `Proposal` field list above (`start`, `end`, `tz`, `card_channel`, `card_ts`) is quoted from planning documents, not read from an executed schema `[CITED: .planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md D-09 — "Proposal adds confidence, card_channel, card_ts, calendar_html_link, meet_link, alternatives Json?, and created_at" plus PROJECT.md's base model "Proposal id, team_id, dedupe_key (unique), title, start, end, tz, status, organizer_user_id, calendar_event_id, source_channel, source_ts"]` — by 13:45 these should be real (Phase 1 runs first), but the planner must verify the actual field list and required/optional-ness against the executed `prisma/schema.prisma` at Phase 8's start, not trust this research's copy of a plan. **Also flagged:** clicking Approve on this row runs the pre-existing, calendar-shaped `approve_proposal` handler (Phase 1/4 design), which Phase 8 cannot modify (D-16). The planner must pick one of: (a) accept the residual risk and add a demo-script note not to click Approve on nudge cards, or (b) confirm with the user whether this is acceptable before merge. This is a genuine open decision, not a researched-away one.

### Anti-Patterns to Avoid

- **Mixing `/v2` frontend hooks with default-export backend adapters (or vice versa).** No source found this session confirms cross-API-generation compatibility; keep the whole surface on one generation (this research recommends the default/non-`/v2` generation throughout, for Kilo Gateway control).
- **Letting the LLM pick the component.** D-9/D-10's exit criterion must pass reliably on stage; a model-chosen component is exactly the "model whims" risk research question 3 asks to avoid. Selection is a pure function, called from the render prop, not a second tool call.
- **Editing `lib/slack/blocks.ts`/`approve.ts` to special-case nudges.** D-16 forbids this outright; any plan step that proposes it is out of scope for Phase 8.
- **Driving the two demo questions through one continuous CopilotKit chat thread.** Directly triggers the known second-request/Kilo Gateway routing bug (`#3317`); use two independent single-shot invocations instead (see Common Pitfalls).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rendering a different component per tool-call result | A custom message-parsing/routing layer on top of raw chat completions | CopilotKit's `render` prop on `useCopilotAction`/frontend tool | This is exactly what the "render" mechanism exists for; hand-rolling it duplicates CopilotKit's own reason for being in the stack |
| OpenAI-compatible client construction for Kilo Gateway | A bespoke fetch wrapper | `new OpenAI({ apiKey, baseURL })` — same pattern the rest of the project already uses for `lib/ai/provider.ts`'s `complete<T>()` | Kilo Gateway is fully OpenAI-SDK-compatible; a second HTTP client for CopilotKit's needs would violate "all model calls through `lib/ai/provider.ts`" and add surface for zero benefit |
| Approval-card posting for the nudge | A parallel `chat.postMessage` call inside the new route | `postProposalCard(proposal)` (existing, called not edited) | D-13 already grants exactly this; duplicating the Block Kit card logic would both violate the file-ownership rule and diverge visually from the real approval card |

**Key insight:** every "don't hand-roll" in this phase resolves to "use the mechanism the chosen tool already provides" — consistent with the ladder; the phase's actual risk is API-generation confusion and the Kilo Gateway routing bug, not missing tooling.

## Common Pitfalls

### Pitfall 1: Picking the wrong CopilotKit API generation burns the whole time box

**What goes wrong:** Following the *first* CopilotKit doc page found (quickstart, currently `/v2`-first) produces a `BuiltInAgent({ model: "openai:gpt-5.4-mini" })` setup with no discovered way to point it at Kilo Gateway's `baseURL`, discovered only after wiring the whole surface.

**Why it happens:** CopilotKit's docs default to the newer `/v2` API generation; the Kilo Gateway-compatible `OpenAIAdapter` pattern lives in the *older*, still-shipped default export, documented in different, less-prominent pages (`runtime-server-adapter`, community posts, a bug report).

**How to avoid:** Use the default-export imports from the first line of code (`@copilotkit/runtime`, not `@copilotkit/runtime/v2`; `@copilotkit/react-core`, not `@copilotkit/react-core/v2`) as prescribed in Code Examples above. Do not "start with the quickstart and migrate later" — there is no time budget for a mid-phase API-generation swap.

**Warning signs:** Any doc page or generated code mentioning `BuiltInAgent`, `CopilotKitProvider`, or `createCopilotRuntimeHandler` — those are `/v2` symbols; stop and switch imports before writing more code against them.

**Phase to address:** Phase 8, first task (route.ts + provider wiring), before any component work.

---

### Pitfall 2: The Kilo Gateway "second request" bug (`CopilotKit/CopilotKit#3317`)

**What goes wrong:** The first chat-completion request in a CopilotKit session succeeds against Kilo Gateway; a second request in the *same session* is misrouted by CopilotKit's runtime to Kilo Gateway's `/responses` endpoint instead of `/chat/completions` and fails.

**Why it happens:** Filed and unresolved as of the version this session could check (`@copilotkit/runtime@1.52.1`, no fix mentioned in the issue thread) `[CITED: github.com/CopilotKit/CopilotKit/issues/3317, fetched via WebFetch this session — LOW-MEDIUM, single-source, not independently reproduced]`. Whether this specific bug is still present at the pinned `1.71.0` was **not** independently confirmed this session — flag as an assumption, not a certainty.

**How to avoid:** Don't drive the demo's two required questions through one continuous chat thread. Use two independently-mounted single-shot invocations (e.g., two separate buttons/pages, each constructing a fresh CopilotKit request), so no request in the demo path is ever a "second request in the same session" in the sense the bug triggers on.

**Warning signs:** The second of two demo questions returns an error, or the chat UI shows a failed/red response, while the first question worked identically-shaped.

**Phase to address:** Phase 8, as soon as the route is wired — smoke-test with two sequential questions in the *same* session first (to confirm the bug's presence/absence at this exact version), then decide whether the two-independent-invocations mitigation is actually needed.

---

### Pitfall 3: `lib/ai/provider.ts`'s locked stub signature has no raw-client export yet

**What goes wrong:** Assuming `complete<T>()`'s existing signature can be handed to `OpenAIAdapter` directly (it can't — `OpenAIAdapter` needs a raw `OpenAI` instance, not a generic structured-output wrapper), and either duplicating client construction elsewhere (violates the repo's single-source-of-truth rule) or blocking on this mismatch mid-phase.

**Why it happens:** Phase 1's locked interface only specifies `complete<T>(opts): Promise<T>` `[VERIFIED: .planning/phases/01-foundation-hardcoded-round-trip/01-RESEARCH.md:261]` — it was designed before CopilotKit's needs were in scope.

**How to avoid:** Add one additive named export (`openaiClient`) to the same file, as shown in Code Examples — this is a compliant, additive change to a file Phase 8 doesn't otherwise own, in the same spirit as the extraction-schema additive-only rule (D-17). Confirm at execution time that `lib/ai/provider.ts` is real and has this exact exported shape (Phase 5 builds the real body; Phase 1 only stubs it) before assuming the addition is trivial.

**Warning signs:** A type error passing `complete` (the function) where `OpenAIAdapter` expects an object with `.chat.completions.create`.

**Phase to address:** Phase 8, route.ts step.

---

### Pitfall 4: Nudge Proposal row breaks on required-but-meaningless fields

**What goes wrong:** The real `Proposal` model (once Phase 1 executes) may have non-nullable columns that only make sense for meetings (e.g. a required `organizer_user_id`, a non-null `end` with meeting-duration semantics elsewhere in the codebase assuming it), causing the nudge's Prisma `create()` call to fail or to silently produce a row other code misinterprets as a real meeting.

**Why it happens:** The `Proposal` model was designed calendar-first; a nudge is being shoehorned into it per the "lightest compliant option" recommendation above.

**How to avoid:** Read the actual `prisma/schema.prisma` (once it exists) before writing the nudge route; use placeholder `start`/`end` values that are clearly non-meaningful (e.g., both set to "now") and confirm no other code path (dashboard row rendering, conflict detection's "pending Proposals" union — CFL-01) treats every `pending` Proposal as a real calendar candidate. If conflict detection unions *all* pending Proposals including nudges, a nudge could pollute Phase 7's conflict-detection demo — flag this cross-phase interaction explicitly to the planner.

**Warning signs:** The nudge's Prisma `create()` throws a NOT NULL constraint error, or the dashboard/conflict logic shows the nudge as a real meeting slot.

**Phase to address:** Phase 8, nudge route step — read the real schema first, don't copy this research's field list blindly.

---

### Pitfall 5: bun + React 19 peer-dependency noise on `bun add`

**What goes wrong:** `bun add @copilotkit/...` prints peer-dependency warnings.

**Why it happens:** React 19 ecosystem-wide peer-range churn is common and CopilotKit has had its own React-19-related peer-dependency issues reported (`CopilotKit/CopilotKit#2840`) `[CITED: WebSearch aggregated, not independently reproduced — LOW]`. However, the peer ranges checked this session for the exact pinned version (`react: "^18 || ^19 || ^19.0.0-rc"` on both `react-core` and `react-ui` `[VERIFIED: npm registry]`) already cover the project's pinned `react@19.3.0` cleanly — no actual conflict expected, just possible warning noise.

**How to avoid:** Don't reach for `--force`/`--legacy-peer-deps`-equivalent flags reflexively; bun does not hard-fail installs on peer mismatches the way strict npm can, so a warning is very likely cosmetic here given the verified peer range already covers 19.3.0.

**Warning signs:** `bun add` exits non-zero (would indicate an actual, not cosmetic, problem) — distinguish this from a printed warning with exit code 0.

**Phase to address:** Phase 8, install step.

## Code Examples

See inline code blocks under **Architecture Patterns** above (extraction schema, `provider.ts` addition, `route.ts`, `select-component.ts`, nudge route) — all copy-paste starting points for the planner's tasks, each already source-tagged per claim.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `useCopilotAction` for defining + rendering an agent-callable action | `useFrontendTool` (define+render) / `useRenderToolCall` (render-only, headless UIs) | CopilotKit "v2" API generation, exact version not dated by any source found this session | `useCopilotAction` is `[CITED: docs.copilotkit.ai/a2a/concepts/which-hook, cross-checked via WebSearch]` still supported at the pinned `1.71.0` (not removed), but documented as the path being migrated away from. This research recommends `useCopilotAction` anyway for this phase specifically because it lives in the same API generation as the Kilo Gateway-compatible `OpenAIAdapter` — consistency within one generation outweighs chasing the newest hook name for a 45–60 min throwaway phase. |
| `CopilotRuntime` + `OpenAIAdapter` + `copilotRuntimeNextJSAppRouterEndpoint` | `CopilotRuntime` (from `/v2`) + `BuiltInAgent` + `createCopilotRuntimeHandler` | Same API-generation shift as above | The `/v2` runtime is built on the AG-UI protocol and Vercel AI SDK provider packages (confirmed by `@copilotkit/runtime@1.71.0`'s own `dependencies`: `@ag-ui/*`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, etc. `[VERIFIED: npm registry]`) rather than direct `openai`-SDK client objects — this is *why* the Kilo Gateway-`baseURL` story is murkier on `/v2`: model routing there goes through AI-SDK provider factories, which this session didn't find documented with a custom-baseURL example. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Kilo Gateway "second request → `/responses` endpoint" bug (`#3317`, filed against `1.52.1`) is still present at the pinned `1.71.0` | Common Pitfalls 2 | Medium — if already fixed, the planner wastes a small amount of time building an unneeded two-session mitigation; if not fixed and unmitigated, the phase's own two-question exit check could fail live on stage. Recommend the smoke test named in Pitfall 2 as the first thing done after route wiring, before building any ledger components. |
| A2 | `OpenAIAdapter`'s constructor shape (`new OpenAIAdapter({ openai, model })`) and `copilotRuntimeNextJSAppRouterEndpoint`'s signature are unchanged at exactly `1.71.0` vs. the versions the found examples were written against (mix of undated community posts and one 1.52.1-era GitHub issue) | Standard Stack, Architecture Patterns code examples | Medium — a constructor-shape change would surface immediately as a TypeScript error at `bun run dev`, cheap to detect and fix, but costs time inside the box |
| A3 | The `/v2` API's `BuiltInAgent`/model-string mechanism has **no** way to target a custom Kilo Gateway `baseURL` | Summary, Alternatives Considered | Low-Medium — if wrong (a mechanism does exist but wasn't found this session), the `/v2` path would actually have been available and possibly simpler; the default-export recommendation is still safe (proven to work), just possibly not the most "current" choice CopilotKit's own docs would make today |
| A4 | The `Proposal` model's field list Phase 8 depends on for the nudge route (`start`, `end`, `tz`, `card_channel`, `card_ts`, `status`, `dedupe_key`) matches what Phase 1 actually pushes to Postgres | Architecture Patterns "Nudge → approval card resolution" | Medium — this entire research session ran against an unexecuted repo (Phase 1 is still `status: planning`); every quoted field name is copied from planning documents, not read from `schema.prisma`. The planner/executor MUST re-verify against the real schema at Phase 8's actual start time (13:45+), not trust this copy. |
| A5 | `zod.dev`'s `z.discriminatedUnion` API is unchanged in Zod 4.6.2 from training-knowledge baseline | Code Examples, extraction schema | Low — `discriminatedUnion` is a long-stable Zod primitive; not independently re-fetched this session |

**If this table is empty:** N/A — populated above; several claims need user/planner confirmation before being treated as locked.

## Open Questions

1. **Is `CopilotKit/CopilotKit#3317` (Kilo Gateway second-request routing bug) still present at `1.71.0`?**
   - What we know: filed against `1.52.1`, no fix mentioned in the thread as of this session's fetch.
   - What's unclear: whether a later `1.5x`–`1.71.0` release silently fixed it (CopilotKit ships frequently; the gap between `1.52.1` and `1.71.0` is large).
   - Recommendation: the first executable task in Phase 8 should be a 2-minute smoke test — wire the route, ask two questions in one chat session, see if the second one 500s. This answers the question empirically faster than more research would.

2. **Does the real, executed `Proposal` Prisma model (once Phase 1 runs) have any NOT NULL constraint that breaks the placeholder nudge row?**
   - What we know: the planned field list from CONTEXT/RESEARCH docs (A4 above).
   - What's unclear: exact nullability, and whether `organizer_user_id`/`calendar_event_id` are required at insert time or only populated on Approve.
   - Recommendation: read `prisma/schema.prisma` directly at Phase 8's start; do not proceed on this research's copied field list alone.

3. **Does conflict detection (Phase 7, CFL-01: "busy blocks unioned with pending Proposals in the DB") treat a nudge's placeholder `start`/`end` as a real busy slot, polluting the headline conflict demo?**
   - What we know: CFL-01 unions *all* pending Proposals, not just meeting-typed ones (no `kind`/`type` discriminator exists on `Proposal` per any planning doc read this session).
   - What's unclear: whether Phase 7's actual implementation filters by anything that would exclude a nudge row.
   - Recommendation: if Phase 8 is attempted and the schedule allows, either (a) set the nudge's placeholder `start`/`end` to a window nowhere near the demo's Fri 18 Sep 11:00/10:30 slots (cheap, matches Phase 1's own seed-data avoidance pattern, D-14 in 01-CONTEXT.md), or (b) confirm with the user this is an acceptable, documented shortcut. Do not silently risk the headline demo beat.

## Environment Availability

No new external service dependency — CopilotKit talks to Kilo Gateway, which the project's existing `AI_BASE_URL`/`AI_API_KEY` env already targets (Phase 1/5 dependency, not new to Phase 8). No Docker/WSL-specific probe applies to this phase; skip per the "code/config-only" carve-out for anything beyond the already-established Next.js dev process on port :3003 (D-18, locked).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| npm registry reachability | Package version verification (this research) | ✓ confirmed (all `npm view` calls succeeded this session) | — | — |
| Kilo Gateway reachability + chosen model's tool-calling support | CopilotKit route, nudge/query tool calls | Not probed this session (env-dependent, same risk STACK.md already names for `MODEL_FAST`/`MODEL_SMART`) | — | Same JSON-mode + manual `zod.parse()` fallback STACK.md already documents for structured outputs, if tool-calling support turns out to be missing on the chosen model |

**Missing dependencies with no fallback:** none identified.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Single-workspace, two-user demo; no new auth surface in Phase 8 |
| V3 Session Management | No | No new sessions; CopilotKit's own chat-session state is client-local, not a security session |
| V4 Access Control | No | Same two-user demo scope as the rest of the project; no new authz logic |
| V5 Input Validation | Yes | The extraction schema's `commitment` branch is Zod-validated exactly like `meeting` (D-07); the nudge route must validate its request body (who/what/sourceChannelId) before writing a Proposal row — not shown as a hard requirement in the illustrative code above, flag to planner to add a small Zod schema there too, consistent with "Zod at every external boundary" |
| V6 Cryptography | No new surface | No new secrets introduced; `AI_API_KEY`/`AI_BASE_URL` already flow through `lib/config.ts` per the existing pattern; the new `openaiClient` export reads from the same config module, not a new `process.env` access point |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Secret leakage via client bundle | Information Disclosure | `openaiClient`/`AI_API_KEY` construction happens only in `app/api/copilotkit/route.ts` (a server-only route handler) and `lib/ai/provider.ts`; never imported into a `"use client"` ledger component — same pattern as the rest of the repo, enforced by code review not tooling |
| Unvalidated nudge-target injection | Tampering | The nudge route must Zod-validate `who`/`what` before writing to `Proposal.title` (which is later rendered verbatim inside a Slack Block Kit card) — treat this identically to any other user-influenced string reaching Slack; no new class of risk beyond what Phase 2's card-building already handles for meeting titles |
| CopilotKit tool-calling surface accepting arbitrary filter arguments | Tampering (low severity) | `queryCommitments`'s parameters should be a small closed enum/string set (matching `direction`/`status` values), not free-text SQL/query fragments — since ledger data is either hand-seeded or filtered client-side in this phase's recommended design, there is no injection surface into a real query string |

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view <pkg> version`, `npm view <pkg> peerDependencies`, `npm view <pkg> dependencies`, `npm view <pkg> exports`) — direct queries this session for `@copilotkit/react-core@1.71.0`, `@copilotkit/react-ui@1.71.0`, `@copilotkit/runtime@1.71.0`, `@copilotkit/runtime-client-gql@1.71.0` — versions, peer ranges, bundled dependencies (including the internal `openai`/`zod` deps of `@copilotkit/runtime`), and the exact `exports` map proving both the default and `/v2` entry points exist simultaneously in the pinned version
- `.planning/phases/01-foundation-hardcoded-round-trip/01-RESEARCH.md` (read this session) — `lib/ai/provider.ts`'s locked `complete<T>()` stub signature, quoted verbatim at line 261
- `.planning/research/ARCHITECTURE.md` (read this session) — `ExtractedIntent` interface with the `type: "meeting" | "commitment"` discriminator, quoted verbatim at line 96

### Secondary (MEDIUM confidence)
- `github.com/CopilotKit/CopilotKit` issues #3317 (Kilo Gateway routing bug), #2622, #2932, #2840 (hook migration / dependency issues) — fetched/searched this session via WebSearch and WebFetch
- `docs.copilotkit.ai/reference/hooks/useFrontendTool`, `docs.copilotkit.ai/runtime-server-adapter`, `docs.copilotkit.ai/quickstart`, `docs.copilotkit.ai/a2a/concepts/which-hook` — fetched via WebFetch this session; CopilotKit's docs site is not version-pinned per release (same caveat Phase 1's research already flagged for shadcn's docs site), so these reflect "current" docs, not necessarily `1.71.0`-exact — cross-checked against the npm `exports` map (Primary) wherever possible

### Tertiary (LOW confidence)
- WebSearch-aggregated summaries (not single-sourced) for: bun + React 19 peer-dependency noise generally, CopilotKit's own React-19 dependency history, and general community Kilo Gateway+CopilotKit code snippets not tied to an official doc page

## Metadata

**Confidence breakdown:**
- Package versions/exports/peer ranges: HIGH — npm-registry-verified this session
- CopilotKit API-generation shape (`/v2` vs default) and Kilo Gateway wiring pattern: MEDIUM — CITED from official docs + a real filed bug report, not executed in this sandbox
- Nudge/approval-card tension and its resolution: MEDIUM — architecturally sound given the locked constraints, but depends on unverified real-schema field names (A4) and an unresolved cross-phase interaction with CFL-01 (Open Question 3)
- Extraction schema addition: MEDIUM-HIGH — Zod discriminated unions are a stable, well-understood pattern; the specific field list is locked by CONTEXT.md D-06, not researched

**Research date:** 2026-09-11
**Valid until:** This build window only (Sat 12 Sep 2026) — CopilotKit is explicitly a fast-moving package (`/v2` migration actively in progress per its own docs); do not reuse this research beyond the hackathon without re-verifying the API-generation landscape.
