# Phase 5: Agent + Confidence Gate - Research

**Researched:** 2026-09-11
**Domain:** LangGraph JS agent graph, Kilo Gateway structured output via `openai` SDK + Zod, deterministic HKT date resolution, Slack Bolt modal round trip, dedupe/idempotency
**Confidence:** HIGH for library API shapes (LangGraph `compile()`, `openai` SDK `zodResponseFormat`, `@slack/bolt` view/action types — all confirmed by reading the packages' own current source/docs this session); MEDIUM for Kilo Gateway-specific request-shape and Node-SDK-casting guidance (no first-party TypeScript example found); LOW/`[ASSUMED]` for the actual confidence-rubric wording and threshold numbers, which are tonight's pre-window empirical output, not something this session can produce

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Agent graph (AGT-10):**
- D-01: One LangGraph graph, ≤5 nodes, path extract → classify actionability → resolve time → check conflicts → propose. Compiled with **no `checkpointer` argument at all**, invoked to completion once per message. No `interrupt()`, no subgraphs, no multi-agent handoff, no tool-calling loops, no `MemorySaver`, no `LANGGRAPH_PG_URL`/`PostgresSaver`.
- D-02: Phase 5 builds the 5-node skeleton. The check-conflicts node is on the path but its real logic belongs to Phase 7 (CFL-01..05). Phase 5 does not decide how conflicts are detected.
- D-03: The LangGraph keep-or-rip decision is **not made in this phase** — fixed for Phase 7's ~14:00 integration point. Phase 5 keeps node functions plain enough that "call them in sequence" stays a ~10-minute change.
- D-04: `runAgent` replaces Phase 1's stub body, keeping the stub's fixed signature so Phase 4's Trigger.dev task wrapper and inline transport keep compiling unchanged.

**Model provider (AGT-01):**
- D-05: Every model call goes through `lib/ai/provider.ts`. It reads `AI_BASE_URL`, `AI_API_KEY`, `MODEL_FAST`, `MODEL_SMART` from `lib/config.ts`, never `process.env` directly. No other file imports an SDK client.
- D-06: The provider uses the `openai` SDK (7.15.0) pointed at Kilo Gateway's OpenAI-compatible endpoint, with Zod schemas for structured output. No LangChain chat-model wrapper by default. `@langchain/core` is added only if a node demonstrably needs a LangChain-specific helper.
- D-07: Extraction uses `MODEL_FAST`. `MODEL_SMART` is reserved for conflict reasoning (Phase 7). Swapping either model is an `.env` edit + restart, no code edit.

**Extraction contract (AGT-02, AGT-08):**
- D-08: Signature is `extractIntents(messages: SlackMessage[], ctx)`. Messages rendered as numbered lines. Model returns `message_index` per intent, mapped back to the real Slack `ts` in code. Per-message path passes an array of one.
- D-09: Output validated with **one Zod schema** carrying title, resolved ISO start, duration, participants, `is_actionable`, `confidence`, `message_index`. The same schema backs the DB write. Lives in `lib/agent/`, type via `z.infer` in the same file. **Never cut.**
- D-10: The confidence rubric verified tonight (4–5 sample messages spread across high/medium/low) is baked into the extraction prompt verbatim. **Never cut.**
- D-11: The first minutes of the phase re-run the same 4–5 samples through the real prompt and eyeball the spread before any branch logic is built on top.

**Time resolution (AGT-03):**
- D-12: Relative times resolved **in code, not by the model**. Today's date, day-of-week and tz `Asia/Hong_Kong` passed to the prompt explicitly; day arithmetic done deterministically in code.
- D-13: "Next Friday at 11am" resolves to the correct calendar date **for the actual day this phase runs**.

**Confidence branches (AGT-04..07):**
- D-14 (high, AGT-04): High-confidence actionable intent creates the Proposal and posts the approval card via the existing card-posting function, unchanged.
- D-15 (medium, AGT-05): Modal needs a click-borne `trigger_id`, so it's **not auto-opened**. Card shows an "Edit & approve" button. Clicking runs `views.open` with a modal prefilled from `private_metadata`. Submitting (`view_submission`) updates the Proposal and shows the approvable card.
- D-16 (low, AGT-06): Low-confidence or non-actionable message posts nothing, writes a `Decision` row (verdict `ignored`, confidence, reason).
- D-17 (acted, AGT-07): Actionable messages also write a `Decision` row (verdict `acted`).
- D-18: Every sample run leaves exactly one `Decision` row, with confidence value and reason.
- D-19 (cut order): If overrunning, medium edit-modal drops to "posts the card directly." Never cut rubric (AGT-08) or Zod (AGT-02).

**Dedupe (AGT-09):**
- D-20: `dedupe_key = sha256(team_id + channel_id + (thread_ts ?? message_ts) + normalized_intent)`. `normalized_intent` = type + ISO start rounded to 5-minute buckets + sorted participant set. Enforced by the schema's unique `dedupe_key`. Per-user `ActionItem` rows reference the Proposal.
- D-21: Phase 1 already created `lib/agent/dedupe.ts` as a real pure function. Phase 5 reuses/extends it, never writes a second hashing helper.

**File ownership:**
- D-22: Owned: `lib/agent/**`, `lib/ai/**`.
- D-23: Must not touch: `app/**`, `components/**`, `lib/calendar/**`, `lib/agent/tasks/`, `trigger.config.ts` (Phase 4 owned). `prisma/schema.prisma` only after merging latest `develop`, then `bunx prisma db push`.
- D-24: `lib/slack/**` is **append-only for AGT-05**: new "Edit & approve" card variant beside Phase 2's approve/reject builder; a `block_actions` → `views.open` listener; a `view_submission` handler. Never restructures Phase 2/4 registrations or builders; calls the existing card-posting function without editing it.
- D-25: `types/` extended from the Phase 1 stub, never forked.

**Process and run:**
- D-26: No long-lived server for the graph — exercised via a throwaway script or by manually invoking Phase 4's Trigger.dev task. Workspace `.env` reserves port :3001. Postgres :5432 shared; this phase writes real `Proposal`/`Decision`/`ActionItem` rows. Only one Bolt process runs across all worktrees.

**Exit criterion:**
- D-27: 4–5 tonight-verified sample messages, run through the real graph, land on visibly different branches (card / edit-modal / silent+Decision) matching tonight's verification, with a `Decision` row for every one.

**Repo rules inherited (PROJECT.md):**
- D-28: bun only, never `bun --bun`/`bunx --bun`. Biome `check --write` before done; no test files; TSDoc on every function. Zod at every external boundary; `lib/config.ts` is the only `process.env` reader. Prisma client only from the shared `globalThis` singleton (`lib/db.ts`); never constructed in a node, listener or task body. kebab-case files, named exports, no `any`. No secrets in code.

### Claude's Discretion

- Numeric confidence thresholds for high/medium/low, as long as tonight's samples land on the branches tonight verified.
- Whether "classify actionability" is its own model call or a code branch on the extraction's `is_actionable`/`confidence`. Ponytail default favours one `MODEL_FAST` call.
- Graph state shape and node names, within ≤5 nodes.
- The "next Friday" rule for weekdays other than today's, provided D-13 holds for the day the phase runs.
- How the resolved date is produced: model returns a structured relative expression (weekday + offset + time) that code resolves, versus a code post-pass over a model ISO guess. Either way, arithmetic is in code.
- Structured-output mechanism: `chat.completions.parse` + `zodResponseFormat` with Kilo Gateway `require_parameters: true`, versus JSON-mode + manual `schema.parse()` + one-retry fallback.
- `private_metadata` payload shape for the edit modal, and the modal's field set.
- Where Decision/Proposal/ActionItem writes live (the propose node, or `runAgent` after graph completion).
- `ctx` object fields (team_id, channel_id, now, tz, user map), within Phase 1's `RunAgentInput` stub.

### Deferred Ideas (OUT OF SCOPE)

- Real conflict detection (freebusy ∪ pending Proposals) and the `MODEL_SMART` two-alternative counter-proposal: Phase 7 (CFL-01..05).
- LangGraph keep-or-rip decision and wiring the real graph into the Trigger.dev task for live traffic: Phase 7.
- `/secretary scan` over ~50 messages (OPT-01): Phase 7, optional.
- `commitment` extraction type: Phase 8 (S2, throwaway).
- Preference memory via Graphiti: Phase 9 (S1, throwaway).
- Expiry sweep re-deriving stale action items: v2 (SCL-03).
- Batch sweep / cheap local router: v2 (SCL-01/02), README only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGT-01 | Every model call through `lib/ai/provider.ts`, env-driven model/provider swap | §Code Examples "lib/ai/provider.ts"; §Standard Stack |
| AGT-02 | `extractIntents(messages, ctx)` numbered-line rendering, Zod-validated output, `message_index` → real `ts` | §Architecture Patterns "One extraction Zod schema"; §Code Examples |
| AGT-03 | Relative dates resolved in code against `Asia/Hong_Kong`, correct for the actual run day | §Common Pitfalls "Next-weekday resolution"; §Code Examples "resolveNextWeekday" |
| AGT-04 | High confidence posts approval card | §Architecture Patterns "5-node graph and confidence gate" |
| AGT-05 | Medium confidence → "Edit & approve" button → `views.open` modal prefilled from `private_metadata` → `view_submission` updates Proposal | §Code Examples "Edit & approve" listener + modal; §Common Pitfalls "private_metadata size" |
| AGT-06 | Low/non-actionable silent + `Decision` row (`ignored`) | §Architecture Patterns "5-node graph" |
| AGT-07 | Actionable also writes `Decision` row (`acted`) | Same |
| AGT-08 | Rubric baked into prompt, visible high/medium/low spread | §Common Pitfalls "Confidence calibration"; §Code Examples "rubric prompt skeleton" |
| AGT-09 | `dedupe_key` — one Proposal per intent | §Common Pitfalls "P2002 on replay"; §Code Examples "handling P2002" |
| AGT-10 | ≤5-node graph, no checkpointer, sequential-fallback-friendly | §Architecture Patterns "LangGraph JS: confirmed minimal-graph API" |
</phase_requirements>

## Summary

Phase 5 has no genuinely new package to install — everything it needs (`@langchain/langgraph`, `openai`, `zod`, `@slack/bolt`) is already pinned in `.planning/research/STACK.md`. The work is entirely in getting four library-specific shapes exactly right, each confirmed this session by reading the library's own current source or official docs rather than trusting STACK.md's month-old snippets or training memory:

1. **`@langchain/langgraph@1.4.14`'s `@langchain/core` peer is `required`, not optional, in the npm registry's own `peerDependencies` field** (`"peerDependencies":{"zod":"^3.25.32 || ^4.2.0","@langchain/core":"^1.1.48"}`, confirmed via `npm view` this session). STACK.md's "only add `@langchain/core` if you actually use a LangChain wrapper" is the right *cost-avoidance* instinct in general, but the type used by `addConditionalEdges`'s `pathMap` parameter (`RunnableLike`) is itself a `@langchain/core` type — install `@langchain/core@1.2.10` in Phase 5 regardless of whether any node calls a LangChain chat-model wrapper, since a required peer that's actually imported for typing will fail to resolve/typecheck without it present.
2. **`chat.completions.parse()` + `zodResponseFormat` accepts plain Zod v4 schemas directly** (`import { z } from "zod"`, not `"zod/v3"`) — `openai@7.15.0`'s own `src/helpers/zod.ts` types `ZodSchema = z3.ZodType | ZodV4Schema`, confirmed by reading the source this session. The official example in `openai-node`'s current docs (moved from root `helpers.md` to `docs/helpers.md`) imports from `'zod/v3'`, which is misleading to copy verbatim for this project — use the project's existing `zod` (v4) import everywhere, per STACK.md's already-locked decision.
3. **Kilo Gateway's `provider.require_parameters` field has no typed home in the `openai` Node SDK** — it's a top-level sibling field to `model`/`messages`/`response_format` in the raw JSON body, not documented anywhere in OpenAI's own SDK types, and the SDK will need an `as` cast or a locally-declared params type augmentation to pass it through `chat.completions.parse()`'s TypeScript signature. No first-party TypeScript example of this exists in Kilo Gateway's own docs (their code samples for this feature are curl/Python); treat the exact cast shape as this phase's own small utility, not a copy-paste from official docs.
4. **`@slack/bolt`'s own type definitions (read directly from `src/types/actions/block-action.ts` and `src/types/view/index.ts` this session) confirm the exact shapes needed for AGT-05**: `trigger_id` is a top-level string field on the `block_actions` payload (not nested), `private_metadata` is a plain `string` field with a documented 3000-character cap, and `response_action: 'errors'` takes a flat `{ [blockId]: string }` map — small, mechanical facts that are easy to get subtly wrong from memory.

Everything else (Prisma `P2002` handling, `node:crypto` SHA-256 under bun, deterministic next-weekday arithmetic) is stdlib/already-decided and is documented below mainly to pin the exact code pattern, not because it was in doubt.

**Primary recommendation:** Install `@langchain/core@1.2.10` alongside `@langchain/langgraph@1.4.14` regardless of D-06's "only if needed" framing (peer-required, not a wrapper choice); keep the extraction Zod schema as **one schema** per D-09 by having the model emit `weekday`/`timeOfDay` hint fields (not a final ISO) and having code compute `startIso` deterministically before the same schema object is used for the DB write; use `chat.completions.parse()` + `zodResponseFormat()` + Kilo Gateway `require_parameters: true` as the primary path with a JSON-mode + `safeParse` + one-retry fallback exactly as STACK.md already specifies, since that fallback is needed regardless of which primary path is chosen.

### Orchestrator corrections (read before copying any code example below)

The orchestrator reviewed the examples in this document against locked upstream decisions. Five of them must be adjusted when planning:

1. **Use snake_case field names.** Phase 1 CONTEXT D-10 locks Prisma fields as snake_case with no `@map` (`dedupe_key`, `organizer_user_id`, `source_ts`, …). AGT-02 also names the LLM fields snake_case (`is_actionable`, `message_index`). The camelCase names in the examples below (`dedupeKey`, `messageIndex`, `isActionable`, `startIso`) will not compile against the Phase 1 schema. They also break "the same Zod schema backs the DB write". Rename them to snake_case when planning. The Prisma import path must match Phase 1's actual generator `output`.
2. **The LLM root must be an object wrapping an array.** Strict `json_schema` needs an object root, and `extractIntents(messages[])` returns many intents. The structured-output schema is therefore `z.object({ intents: z.array(ExtractedIntentSchema) })`, and the per-message path takes `intents[0] ?? null`.
3. **The ignored Decision must be written before `END`.** In the graph example, `classify` routes straight to `END` for non-actionable messages, but AGT-06 and success criterion 2 require exactly one `ignored` Decision row. Write it either in the classify node before routing, or in `runAgent` after `invoke()` when `decisionId` is still null. Pick exactly one place. Messages where extraction returned no intent must also leave a Decision.
4. **Route on confidence, not only `is_actionable`.** The conditional edge example checks `isActionable` only. An actionable intent below the low threshold must also take the silent `ignored` path (AGT-06). Medium must reach `propose` with a flag that selects the "Edit & approve" card variant (AGT-05). Put the three-band bucketing in one function.
5. **Tighten the provider fallback.** In the `complete()` example, `JSON.parse` sits outside any try, so a malformed body throws instead of retrying. The bare `catch {}` also swallows auth, credit and network errors and retries them in JSON mode, which hides the real failure. Fall back only on parse or unsupported-`response_format` errors. Wrap `JSON.parse` inside the retry loop.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Message → structured intent extraction | Backend / domain logic (`lib/agent/`, `lib/ai/`) | — | Model call + Zod validation is pure backend logic, no UI or DB tier involved directly |
| Confidence-based branching (post card / open-modal-button / silent) | Backend / domain logic (`lib/agent/` graph) | Slack surface (`lib/slack/`, card builders) | The *decision* of which branch lives in the graph; the *rendering* of each branch's card is a Slack-tier function the graph calls, never edits |
| Deterministic date arithmetic ("next Friday") | Backend / domain logic (pure function, `lib/agent/` or `utils/`) | — | No model call, no I/O — a pure function is the correct tier, not a Slack or DB concern |
| Edit-modal round trip (button → `views.open` → `view_submission`) | Bolt process (`lib/slack/`) | — | `block_actions`/`view_submission` payloads only ever arrive on Bolt's Socket Mode WebSocket (per ARCHITECTURE.md, already fixed); the graph/agent tier cannot receive these |
| `Decision`/`Proposal`/`ActionItem` persistence | Database (Postgres via Prisma) | Backend (`lib/agent/` propose node) | Single source of truth; propose node is the one write path this phase adds |
| Dedupe / idempotency (`dedupe_key`) | Backend (`lib/agent/dedupe.ts`, pure function) | Database (unique constraint) | Computed in code, enforced at the DB layer — two independent layers by design, matching ARCHITECTURE.md's Trigger.dev-idempotency-key vs `dedupe_key` distinction |
| Model provider abstraction | Backend (`lib/ai/provider.ts`) | — | Single source of truth per AGT-01/D-05; no other file imports an SDK client |

No capability in Phase 5 crosses into `app/**`/`components/**` (Dashboard tier) or `lib/calendar/**` (Calendar tier) — both are explicitly off-limits per D-23, and nothing in this phase's requirement set needs them.

## Standard Stack

### Core

All packages below are already pinned and npm-registry-verified in `.planning/research/STACK.md` (2026-09-11). Re-verified against the live registry this session — **all four match exactly**, confirming the pins are still current:

| Library | Version | Verified this session | Purpose |
|---------|---------|------------------------|---------|
| `@langchain/langgraph` | 1.4.14 | `[VERIFIED: npm registry]` (`npm view @langchain/langgraph version` → `1.4.14`) | Agent graph |
| `@langchain/core` | 1.2.10 | `[VERIFIED: npm registry]` — **install now, not conditionally** (see Summary #1; the `peerDependencies` field of `@langchain/langgraph@1.4.14` requires it: `"@langchain/core":"^1.1.48"`, confirmed via `npm view @langchain/langgraph@1.4.14 peerDependencies`) | LangGraph's own `RunnableLike`/message-plumbing types, used by `addConditionalEdges` even with zero LangChain chat-model usage |
| `openai` | 7.15.0 | `[VERIFIED: npm registry]` | SDK against Kilo Gateway's OpenAI-compatible endpoint |
| `zod` | 4.6.2 | `[VERIFIED: npm registry]` | Validation — confirmed compatible with `openai@7.15.0`'s zod helper directly (`src/helpers/zod.ts` imports `zod/v4` internally) |
| `@slack/bolt` | 5.1.0 | (already verified in STACK.md; not re-checked this session, no new install) | Card variant + `block_actions`/`view_submission` listeners (append-only per D-24) |

**No new packages this phase.** The only correction to STACK.md's installation guidance is D-06/"What NOT to Use"'s framing of `@langchain/core` as conditional — see Summary #1 for why it should be installed unconditionally in this phase.

### Installation

```bash
bun add @langchain/core@1.2.10
# @langchain/langgraph, openai, zod, @slack/bolt already installed in Phase 1 (D-21)
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `chat.completions.parse()` + `zodResponseFormat` (Chat Completions API) | `responses.parse()` + `zodTextFormat` (Responses API, also exported from `openai/helpers/zod`) | Both exist in `openai@7.15.0`'s helpers; Chat Completions is the STACK.md-established default and what Kilo Gateway's own compatibility docs target — no reason to switch for this phase |
| `Annotation.Root(...)` graph state | `import "@langchain/langgraph/zod"` + a `z.object()` state schema, passed directly to `new StateGraph(ZodState)` | Confirmed to exist in current LangGraph JS (a `StateSchema`/Zod-schema-state feature). Ponytail-lazy call: **stick with `Annotation.Root`** — it's what `.planning/research/ARCHITECTURE.md`'s already-fixed state shape and node table assume, it's the older/more-proven path, and a GitHub issue found this session (`langgraphjs#1097`) notes an open TypeScript export-typing wrinkle with the Zod-state variant. Not worth the risk in a 45-minute box for a feature (using Zod for *graph* state, as opposed to *LLM-output* state, which this project already does) that buys nothing extra here. |
| `require_parameters: true` (fail loudly if the routed provider can't do structured output) | Omit it, rely on Kilo Gateway's default soft preference for `response_format`-capable providers | STACK.md already mandates `require_parameters: true` for exactly the reason PITFALLS.md pitfall 12 describes (silent downgrade to a non-schema-honoring provider looks like a Zod bug, not a provider capability gap) — keep it |

## Package Legitimacy Audit

```
gsd_run query package-legitimacy check --ecosystem npm @langchain/core @langchain/langgraph openai zod
```

| Package | Registry | Weekly Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-------------------|--------------|---------|-------------|
| `@langchain/core` | npm | 4,078,497 | github.com/langchain-ai/langchainjs | `SUS` (`too-new` — heuristic reads latest-publish-date, not package age; this is LangChain's own monorepo, publishes on every release cadence) | Flagged — low-risk given official repo + multi-million downloads; same false-positive pattern already documented in Phase 1's audit |
| `@langchain/langgraph` | npm | 2,456,840 | github.com/langchain-ai/langgraphjs | `SUS` (same `too-new` false-positive) | Flagged — same low-risk note |
| `openai` | npm | 29,321,267 | github.com/openai/openai-node | `SUS` (same `too-new` false-positive) | Flagged — same low-risk note |
| `zod` | npm | 206,899,040 | github.com/colinhacks/zod | `SUS` (same `too-new` false-positive) | Flagged — same low-risk note |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** all four, solely on the legitimacy checker's "too-new" heuristic (measures latest-publish date, not first-release date — every actively maintained package in this stack trips it, as already noted in Phase 1's own audit). All four are official-repo, multi-million-download packages already `[VERIFIED]` in STACK.md's separate npm-registry pass. **Recommendation to planner:** no new `checkpoint:human-verify` needed beyond what Phase 1 already established for this exact heuristic blind spot — these are re-audits of already-approved packages plus one new install (`@langchain/core`) from the same trusted monorepo as `@langchain/langgraph`.

## Architecture Patterns

### System Architecture Diagram

```
Slack message (or throwaway-script input, per D-26 — no long-lived server this phase)
      │
      ▼
runAgent(input: RunAgentInput)                      ← Phase 1 stub signature, kept exactly (D-04)
      │ builds ctx { teamId, channelId, now, tz: "Asia/Hong_Kong", userMap }
      │ .invoke({ message: input.message }) — graph compiled with NO checkpointer (D-01)
      ▼
┌───────────────────────────────────────────────────────────────────────┐
│  LangGraph: extract → classify → resolveTime → checkConflicts → propose │
│                                                                           │
│  1. extract        → lib/ai/provider.ts complete({tier:"fast", schema}) │
│                       → extractIntents([message], ctx) under the hood   │
│                       → state.intent = firstIntentOrNull (see note ↓)   │
│                                                                           │
│  2. classify        → CODE BRANCH on state.intent.isActionable          │
│                       false/no-intent → write Decision(ignored) → END   │
│                       true            → continue                        │
│                                                                           │
│  3. resolveTime     → PURE FUNCTION, no model call (AGT-03/D-12)        │
│                       resolveNextWeekday(ctx.now, intent.weekday,       │
│                         intent.timeOfDay) → state.intent.startIso       │
│                                                                           │
│  4. checkConflicts  → calls the (already-real, Phase-3-built)           │
│                       lib/calendar/freebusy.ts checkConflicts()         │
│                       state.conflicts = result — NOT branched on yet    │
│                       (Phase 7 adds the alternate-slot logic, D-02)     │
│                                                                           │
│  5. propose         → CODE BRANCH on state.intent.confidence            │
│                       high    → write Proposal+Participant+ActionItem   │
│                                  + Decision(acted) → postProposalCard   │
│                       medium  → write Proposal (same as high) + Decision│
│                                  (acted) → postEditApproveCard variant  │
│                       low     → already routed to END at step 2         │
└──────────────────────────┬────────────────────────────────────────────┘
                            │ RunAgentResult { proposalId, decisionId }
                            ▼
                    (back to caller — Bolt inline call or Trigger.dev task)


Medium-confidence branch, continued (AGT-05 — separate from the graph, Bolt-only):

Slack card "Edit & approve" button click
      │ block_actions payload — arrives ONLY on Bolt's Socket Mode WebSocket
      ▼
app.action("edit_approve_proposal", async ({ ack, body, client }) => {
  await ack();                                    // ack() FIRST (Pitfall 10)
  await client.views.open({
    trigger_id: body.trigger_id,                  // top-level field, <3s to use
    view: buildEditProposalModal(proposal, {       // private_metadata ≤3000 chars
      private_metadata: JSON.stringify({ proposalId }),
    }),
  });
})
      │ user edits fields, submits
      ▼
app.view("edit_approve_proposal_modal", async ({ ack, view }) => {
  const { proposalId } = JSON.parse(view.private_metadata);
  const values = view.state.values;                // read edited fields
  // validate → ack({response_action:"errors", errors:{...}}) on failure
  await ack();                                      // plain ack() = close modal
  await prisma.proposal.update({ where:{id:proposalId}, data:{...edited} });
  await updateProposalCard(...);                     // reuse existing function (D-24)
})
```

**Note on `state.intent` being singular, not an array:** `extractIntents` has the batch-capable array signature (AGT-02), but `.planning/research/ARCHITECTURE.md`'s already-fixed graph state (`intent: Annotation<ExtractedIntent | null>`) and Phase 1's `RunAgentResult { proposalId: string | null; decisionId: string | null }` are both singular. For the per-message demo path this phase builds, take `intents[0] ?? null` from `extractIntents`'s result and act on it only. `ponytail:` this is a deliberate simplification — if a single short Slack message ever yields two intents in the same call, the second is silently dropped this phase; the documented upgrade path is the batch-sweep design already written up for README (SCL-01), where `runAgent`-equivalent logic runs once per intent outside the graph, not inside it.

### One Extraction Zod Schema (AGT-02/D-09), Time Resolution Folded In

D-09 locks "**one** Zod schema... resolved ISO start... same schema backs the DB write," while D-12 locks "arithmetic in code, not the model." Both are satisfiable with one schema if the model's structured-output call fills in *hint* fields for relative time, and code fills in the final `startIso` before the object is used for the DB write — same object, same schema, two authors of different fields:

```typescript
// lib/agent/extraction-schema.ts
import { z } from "zod";

/**
 * One schema for both the LLM structured-output call and the Proposal/Decision DB write.
 * The model fills every field EXCEPT startIso for relative-time messages; code computes
 * startIso deterministically (AGT-03) before this object is persisted.
 */
export const ExtractedIntentSchema = z.object({
  messageIndex: z.number().int().nonnegative(),
  title: z.string(),
  isActionable: z.boolean(),
  /** 0–1, rubric-anchored (AGT-08). Code buckets into high/medium/low via fixed thresholds — the model is not asked to self-categorize, avoiding a second inconsistent signal. */
  confidence: z.number().min(0).max(1),
  durationMinutes: z.number().int().positive().nullable(),
  participantSlackIds: z.array(z.string()),
  /** Relative-time hint the model IS allowed to produce; null when the message has no time or an already-absolute date. */
  weekday: z.enum(["sunday","monday","tuesday","wednesday","thursday","friday","saturday"]).nullable(),
  /** 24h "HH:MM" wall-clock in Asia/Hong_Kong, or null. */
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  /** FINAL value. Model may leave this null for relative-time messages; code overwrites it via resolveNextWeekday() before this schema round-trips to the DB write. */
  startIso: z.string().nullable(),
});
export type ExtractedIntent = z.infer<typeof ExtractedIntentSchema>;
```

Why not `.optional()` for the nullable fields: `openai`'s zod helper strict-schema conversion requires **every object property to be present** in the model's answer — "to emulate an optional value, make the field nullable instead of using plain `.optional()`" `[CITED: github.com/openai/openai-node docs/helpers.md, fetched this session]`. `.nullable()` throughout, never `.optional()`, on any field the model itself produces.

### LangGraph JS: Confirmed Minimal-Graph API

Read directly from the current `StateGraph` API reference this session:

```typescript
compile(options?: {
  cache?: BaseCache<unknown>;
  checkpointer?: boolean | BaseCheckpointSaver<number>;
  description?: string;
  interruptAfter?: "*" | N[];
  interruptBefore?: "*" | N[];
  name?: string;
  store?: BaseStore;
}): CompiledStateGraph<...>
```

**All parameters are optional** `[CITED: langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html, fetched this session]`. `.compile()` with **no arguments at all** is a fully valid call — this is literally "no checkpointer" (D-01), not even `MemorySaver` needs importing.

```typescript
// lib/agent/graph.ts
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import type { ExtractedIntent } from "./extraction-schema";
import type { ConflictSlot } from "../../types/agent";

const AgentState = Annotation.Root({
  message: Annotation<SlackMessage>(),
  intent: Annotation<ExtractedIntent | null>(),
  conflicts: Annotation<ConflictSlot[]>({ reducer: (_, next) => next, default: () => [] }),
  proposalId: Annotation<string | null>({ reducer: (_, next) => next, default: () => null }),
  decisionId: Annotation<string | null>({ reducer: (_, next) => next, default: () => null }),
});

const graph = new StateGraph(AgentState)
  .addNode("extract", extractNode)
  .addNode("classify", classifyNode)
  .addNode("resolveTime", resolveTimeNode)
  .addNode("checkConflicts", checkConflictsNode)
  .addNode("propose", proposeNode)
  .addEdge(START, "extract")
  .addEdge("extract", "classify")
  .addConditionalEdges("classify", (s) => (s.intent?.isActionable ? "resolveTime" : END))
  .addEdge("resolveTime", "checkConflicts")
  .addEdge("checkConflicts", "propose")
  .addEdge("propose", END)
  .compile(); // no argument — no checkpointer, matches D-01 exactly
```

Give every field more than one node could plausibly write an explicit reducer (`conflicts`, `proposalId`, `decisionId` above) — `.planning/research/PITFALLS.md`'s already-documented minor pitfall ("`Annotation` fields overwrite by default, not append") is real risk for array/object fields; `message`/`intent` are written by exactly one node each (`extract`), so they can use LangGraph's default overwrite-on-write behavior safely.

### Structured Output Call (AGT-01/AGT-02)

```typescript
// lib/ai/provider.ts (excerpt — extraction call path)
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod"; // Zod v4 — confirmed accepted directly by openai@7.15.0's zod helper, no "zod/v3" needed
import { config } from "../config";

const client = new OpenAI({ apiKey: config.ai.apiKey, baseURL: config.ai.baseUrl });

export async function complete<T>(opts: {
  tier: "fast" | "smart";
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
}): Promise<T> {
  const model = opts.tier === "fast" ? config.ai.modelFast : config.ai.modelSmart;
  try {
    const completion = await client.chat.completions.parse({
      model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.prompt },
      ],
      response_format: zodResponseFormat(opts.schema, opts.schemaName),
      // Kilo Gateway-only field, no typed home in the SDK — cast is required (see Common Pitfalls)
      ...( { provider: { require_parameters: true } } as Record<string, unknown> ),
    });
    const parsed = completion.choices[0]?.message.parsed;
    if (parsed) return parsed;
  } catch {
    // fall through to JSON-mode fallback below
  }
  // Fallback: JSON-mode + manual Zod parse + one retry (STACK.md's own documented safety net)
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: `${opts.system}\nRespond with ONLY valid JSON, no markdown fences.` },
        { role: "user", content: opts.prompt },
      ],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message.content ?? "{}";
    const result = opts.schema.safeParse(JSON.parse(raw));
    if (result.success) return result.data;
  }
  throw new Error(`complete(): structured output failed for schema ${opts.schemaName} after fallback + retry`);
}
```

`[CITED: github.com/openai/openai-node docs/helpers.md — zodResponseFormat/`.parse()`/`.message.parsed` shape, fetched this session]`. The OpenRouter `provider.require_parameters` cast pattern is `[ASSUMED]` for the exact TypeScript spelling (no official Node-SDK example found — see Common Pitfalls) but the underlying field and its purpose are `[CITED: openrouter.ai/docs/guides/routing/provider-selection]`.

### Deterministic Next-Weekday Resolution (AGT-03)

```typescript
// utils/time.ts (extends Phase 1's HKT formatter, D-08 — no date library)
const WEEKDAY_INDEX = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 } as const;

/**
 * Resolves a "next <weekday>" phrase to an absolute ISO instant, deterministically.
 * "Next X" always means a future occurrence — if today IS weekday X, resolves to
 * next week's X, never today (this is "next Friday" semantics, not "this Friday").
 * @param now Current instant (inject for testability; runAgent passes real Date)
 * @param weekday Target weekday, Sunday-indexed per WEEKDAY_INDEX
 * @param timeOfDay "HH:MM" 24h wall-clock in Asia/Hong_Kong
 * @returns ISO 8601 string with explicit +08:00 offset
 */
export function resolveNextWeekday(
  now: Date,
  weekday: keyof typeof WEEKDAY_INDEX,
  timeOfDay: string,
): string {
  // Get today's day-of-week IN Asia/Hong_Kong (not the process's local tz)
  const hktParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(now);
  const todayDow = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
    .indexOf(hktParts.find((p) => p.type === "weekday")!.value);
  const y = hktParts.find((p) => p.type === "year")!.value;
  const m = hktParts.find((p) => p.type === "month")!.value;
  const d = hktParts.find((p) => p.type === "day")!.value;

  const targetDow = WEEKDAY_INDEX[weekday];
  let daysUntil = (targetDow - todayDow + 7) % 7;
  if (daysUntil === 0) daysUntil = 7; // "next X" never means today

  const todayHkt = new Date(`${y}-${m}-${d}T00:00:00+08:00`);
  const targetDate = new Date(todayHkt.getTime() + daysUntil * 86_400_000);
  const [hh, mm] = timeOfDay.split(":");
  const yyyy = targetDate.getUTCFullYear();
  const MM = String(targetDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(targetDate.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}:00+08:00`;
}
```

**Verified this session by direct execution** (not merely reasoned about): `new Date('2026-09-12T00:00:00+08:00').toLocaleDateString('en-US',{weekday:'long',timeZone:'Asia/Hong_Kong'})` → `Saturday`; the same for `2026-09-18` → `Friday`. `2026-09-12` is the actual build-window date (Sat 12 Sep 2026 per PROJECT.md); `resolveNextWeekday(now, "friday", "11:00")` called on that date must return `2026-09-18T11:00:00+08:00`, matching D-13's success criterion and the demo's canonical Fri 18 Sep 2026 11:00 HKT slot named in CONTEXT.md's `<specifics>`. `Asia/Hong_Kong` has no DST, so no arithmetic edge case exists across the offset `[VERIFIED: direct execution this session]`.

**Do not use the Temporal API for this.** `Temporal` is stable/default-on only from **Node.js 26** (Active LTS from Oct 2026); Node 24 — Trigger.dev's current default task runtime — has it only behind a flag `[CITED: nodejs.org/en/blog/release/v26.0.0, trigger.dev changelog, both via WebSearch this session]`. Bun 1.4.x has partial native Temporal work in progress (`oven-sh/bun#15853`) but no confirmed-stable status. Since this phase's code may eventually run under either runtime (Trigger.dev task in Phase 7, or a throwaway script under bun this phase), depending on Temporal risks a runtime-dependent failure. Plain `Date` + `Intl.DateTimeFormat` (as above) works identically on both and matches Phase 1 D-08's existing no-date-library convention.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON-schema-constrained LLM output | Hand-rolled prompt-to-JSON-Schema conversion, or a bespoke `zod-to-json-schema` fork | `zodResponseFormat()` from `openai/helpers/zod` | Already handles the strict-subset conversion (required-vs-nullable rules, etc.) and is already the STACK.md-locked mechanism |
| dedupe/idempotency hashing | A second hash helper "just for this phase" | Extend Phase 1's real `lib/agent/dedupe.ts` (D-21) | Explicit repo rule (reuse-before-writing); a second hashing helper under a different name is exactly the failure mode PROJECT.md's "Reuse before writing" rule exists to prevent |
| SHA-256 hashing | A userland hash library | `node:crypto`'s `createHash("sha256").update(...).digest("hex")` | Implemented natively in both bun and Node `[CITED: bun.com/reference/node/crypto/createHash, WebSearch this session]` — zero new dependency |
| Relative-date arithmetic | `date-fns`, `luxon`, `dayjs`, or the not-yet-universally-stable `Temporal` | Plain `Date` + `Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Hong_Kong', ...})` | D-08 already locks this; HKT has no DST so there is no arithmetic edge case a date library would meaningfully protect against here |
| Unique-constraint retry logic | A generic retry-with-backoff wrapper around every Prisma write | Catch `Prisma.PrismaClientKnownRequestError` with `code === "P2002"` once, treat as no-op/fetch-existing (see Common Pitfalls) | A `dedupe_key` collision means "this exact Proposal already exists" — retrying the identical write reproduces the identical error; the correct behavior is recognize-and-skip, not retry |

**Key insight:** every "don't hand-roll" in this phase is either a library feature already installed for another reason, or a one-line stdlib call — consistent with the project's own ladder-first instinct.

## Common Pitfalls

*(Full catalogue in `.planning/research/PITFALLS.md`, already a canonical ref — pitfall 11/12 and the "next Friday" pitfall are the ones directly on this phase's path and are not re-derived here, only cited. The items below are corrections/additions this session's source-reading surfaced.)*

### Pitfall A: `@langchain/core` treated as optional when it's a required peer

**What goes wrong:** Following D-06's "only add `@langchain/core` if you actually use a LangChain wrapper" literally, `bun install` completes without it, and either a peer-dependency warning is ignored or (worse) a type error surfaces mid-graph-authoring on `addConditionalEdges`'s `pathMap` parameter, which types against `RunnableLike` from `@langchain/core`.

**Why it happens:** `npm view @langchain/langgraph@1.4.14 peerDependencies` returns `{"zod":"^3.25.32 || ^4.2.0","@langchain/core":"^1.1.48"}` — a required (non-optional) peer `[VERIFIED: npm registry, this session]`. D-06's framing is about *avoiding a LangChain chat-model wrapper*, which is correct and doesn't need `@langchain/core` to be uninstalled — those are two different questions being conflated.

**How to avoid:** `bun add @langchain/core@1.2.10` as part of this phase's setup, unconditionally. This does not mean using any LangChain wrapper — `lib/ai/provider.ts` still calls the plain `openai` SDK per D-06's real intent.

**Warning signs:** A TypeScript error mentioning `RunnableLike` or a peer-dependency warning printed by `bun install` naming `@langchain/core`.

**Phase to address:** Phase 5, before writing `lib/agent/graph.ts`.

---

### Pitfall B: Kilo Gateway's `provider.require_parameters` has no typed home in the `openai` Node SDK

**What goes wrong:** Passing `provider: { require_parameters: true }` directly inside `chat.completions.parse({...})`'s params object produces a TypeScript error, because the SDK's own `ChatCompletionCreateParams` type has no such field — it's an Kilo Gateway-only extension to the OpenAI-compatible surface.

**Why it happens:** The field is real and works at the JSON/HTTP level (OpenRouter's own docs confirm it, `[CITED: openrouter.ai/docs/guides/routing/provider-selection]`), but the `openai` npm package's types are written against OpenAI's own API surface, not OpenRouter's superset. No first-party TypeScript example of passing it through the Node SDK was found this session (OpenRouter's own SDK-integration doc gives Python's `extra_body=` pattern, which has no Node-SDK equivalent by that name).

**How to avoid:** Spread the extra field into the params object with a local type widening (`as Record<string, unknown>` or a small local type intersection), as shown in the Code Examples section above. This is a one-line cast, not a library gap worth spending time on.

**Warning signs:** A TS2353 "object literal may only specify known properties" error naming `provider`.

**Phase to address:** Phase 5, `lib/ai/provider.ts` authoring — budget one minute for the cast, don't debug it as if it were a real API problem.

---

### Pitfall C: `private_metadata` treated as unlimited, or JSON-stringified without checking size

**What goes wrong:** Packing the full edited-proposal payload (title, ISO start, duration, all participant ids/emails) into `private_metadata` as JSON works fine in dev with short test data, then silently truncates or errors once a longer title/participant list is used.

**Why it happens:** `private_metadata` is a plain string capped at **3000 characters** `[CITED: docs.slack.dev views.open reference, WebSearch this session]` — not documented as an error on overflow by every client, so it can silently truncate.

**How to avoid:** Keep the modal's `private_metadata` to just `{ proposalId }` (one short string), not the full proposal payload — the modal's `view_submission` handler re-reads the current Proposal row from Postgres by id (matches the project's own "re-derive, don't resume" philosophy already applied to `block_actions` elsewhere) rather than trusting a stale snapshot round-tripped through Slack. This is also cheaper to implement than serializing/deserializing a larger payload.

**Warning signs:** None visible until a long title is tested — verify by hand with a message that has a long title and 2+ participants before considering AGT-05 done.

**Phase to address:** Phase 5, `lib/slack/` "Edit & approve" listener — decide the `private_metadata` shape (`{ proposalId }` only) before writing the modal builder.

---

### Pitfall D: Confidence self-categorization drift (model emits both a number and a band that disagree)

**What goes wrong:** If the extraction schema asks the model for both a numeric `confidence` and a categorical `confidenceBand` ("high"/"medium"/"low"), the two can disagree (e.g. `confidence: 0.72, confidenceBand: "high"`), and the graph has to pick which one is authoritative — a decision that shouldn't need to exist.

**Why it happens:** Asking an LLM to self-classify into a bucket is a second, independent judgment call layered on top of the numeric rubric-anchored score, and LLMs are not perfectly self-consistent between the two framings in the same completion.

**How to avoid:** Only the schema above (`## One Extraction Zod Schema`) — a single numeric `confidence` field — is sent to the model. Code derives the band deterministically via fixed thresholds (tunable per D-11's sample-verification step) in exactly one place, so the gate's behavior is reproducible and adjustable without touching the prompt.

**Warning signs:** None yet observed empirically (no band field in the recommended schema) — this pitfall is preventative, addressed by the schema design itself, not a runtime check.

**Phase to address:** Phase 5, extraction schema authoring — resolved by construction, not by a later check.

---

### Reused from `.planning/research/PITFALLS.md` (canonical, not re-derived)

- **Pitfall 11 (Confidence scores cluster uncalibrated):** the rubric must be tonight's tuned, verified copy, baked in verbatim (D-10) — not invented fresh in this phase. See Code Examples for the *structure* the rubric should follow; the actual wording is a pre-window checklist output this research session cannot produce.
- **Pitfall 12 (Kilo Gateway strict-schema support is per-provider-endpoint, not per-model):** `require_parameters: true` converts a silent capability gap into a loud failure; the JSON-mode fallback in Code Examples is the safety net either way.
- **"Next Friday" resolved wrong by the LLM:** solved by construction here — the model never computes a final date; `resolveNextWeekday` (deterministic, code-only) does.
- **LangGraph `Annotation` fields overwrite by default:** addressed above by giving `conflicts`/`proposalId`/`decisionId` explicit reducers.

## Code Examples

### `handleApproveProposal`-style AGT-05 listener (extends Phase 1's `<verb>_proposal` convention)

```typescript
// lib/slack/edit-approve-listener.ts
import type { BlockButtonAction } from "@slack/bolt";
import { prisma } from "../db";
import { buildEditProposalModal } from "./blocks";

/**
 * Opens the edit-approve modal for a medium-confidence Proposal.
 * private_metadata carries only { proposalId } — the modal handler re-derives
 * the rest from Postgres rather than round-tripping a stale snapshot.
 * @throws never — all failures logged, Slack must not see a thrown error
 */
export async function handleEditApproveProposal({
  ack, body, client,
}: Parameters<Parameters<typeof import("@slack/bolt").App.prototype.action>[1]>[0]) {
  await ack(); // FIRST — before any DB/network call (Pitfall 10, PITFALLS.md)
  const action = (body as BlockButtonAction).actions[0];
  const proposalId = action.value;
  if (!proposalId) return;

  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return;

  await client.views.open({
    trigger_id: (body as BlockButtonAction).trigger_id, // top-level field, <3s to use
    view: buildEditProposalModal(proposal, { proposalId }),
  });
}
```

`[VERIFIED: github.com/slackapi/bolt-js src/types/actions/block-action.ts, read this session — line quoted: `trigger_id: string;` at the top level of the `BlockAction<...>` interface, not nested under `container`]`.

### `view_submission` handler with validation-error `ack()`

```typescript
// lib/slack/edit-approve-view-handler.ts
import { prisma } from "../db";
import { updateProposalCard } from "./update-proposal-card";

export async function handleEditApproveSubmission({ ack, view }: {
  ack: (response?: { response_action: "errors"; errors: Record<string, string> } | void) => Promise<void>;
  view: { private_metadata: string; state: { values: Record<string, Record<string, { value?: string | null }>> } };
}) {
  const { proposalId } = JSON.parse(view.private_metadata) as { proposalId: string };
  const values = view.state.values;
  const title = values.title_block?.title_input?.value?.trim();

  if (!title) {
    await ack({ response_action: "errors", errors: { title_block: "Title is required" } });
    return;
  }
  await ack(); // plain ack() closes the modal (no response_action = default close)

  const proposal = await prisma.proposal.update({
    where: { id: proposalId },
    data: { title /* ...other edited fields */ },
  });
  await updateProposalCard(proposal.card_channel, proposal.card_ts, proposal); // reuse (D-24), never edit
}
```

`[VERIFIED: github.com/slackapi/bolt-js src/types/view/index.ts, read this session — `ViewOutput.private_metadata: string`; `ViewErrorsResponseAction { response_action: 'errors'; errors: { [blockId: string]: string } }`]`.

### `dedupe_key` collision handling (AGT-09) — P2002 as no-op, not retry

```typescript
// lib/agent/propose-node.ts (excerpt)
import { Prisma } from "../../prisma/generated/client"; // matches Phase 1's prisma-client generator output path
import { prisma } from "../db";
import { computeDedupeKey } from "./dedupe"; // reuse Phase 1's real pure function (D-21)

async function createProposalIdempotent(input: ProposalCreateInput): Promise<{ id: string; alreadyExisted: boolean }> {
  const dedupeKey = computeDedupeKey(input.teamId, input.channelId, input.threadOrMessageTs, input.normalizedIntent);
  try {
    const created = await prisma.proposal.create({ data: { ...input, dedupeKey } });
    return { id: created.id, alreadyExisted: false };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Same dedupe_key already exists — this is "one Proposal per intent" working as designed,
      // not an error. Fetch and return the existing row instead of retrying the identical write.
      const existing = await prisma.proposal.findUniqueOrThrow({ where: { dedupeKey } });
      return { id: existing.id, alreadyExisted: true };
    }
    throw err;
  }
}
```

`[CITED: WebSearch aggregation of Prisma community discussions/docs this session — `instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'` is the standard pattern]`.

### Confidence rubric prompt — structure, not tonight's verified wording

```
System prompt skeleton (the ACTUAL wording is fixed by tonight's Pre-Window Checklist
sample-message run — D-10/D-11 — and must be pasted here verbatim once verified, not
invented during planning):

"Today is {weekday}, {ISO date}, {time} Asia/Hong_Kong.
Extract scheduling intents from the numbered messages below.
For each intent, output a confidence score using this rubric:
  - 0.85+ ONLY if an explicit time AND explicit participant(s) are stated
  - 0.5–0.7 if the intent is implied but time OR participant is vague/missing
  - below 0.4 if this reads as commentary/banter with no concrete ask
Do not invent a final date — if a relative weekday is mentioned, output the
weekday name and time-of-day only; the caller resolves the actual date."
```

`[ASSUMED — structure only]`: the anchored-signal pattern above is `[CITED: PITFALLS.md pitfall 11]`, already a canonical ref. The bracketed thresholds and exact phrasing are placeholders; D-10 requires tonight's actually-verified rubric text (run against 4–5 real sample messages before the window opens) to replace them verbatim — this research session, run in advance of that checklist item, cannot supply the verified copy itself.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `openai-node`'s root `helpers.md` | Moved to `docs/helpers.md` | Some point before this session (repo default branch is `main`, not `master`) | Any bookmarked/cached link to root `helpers.md` 404s; use `docs/helpers.md` or the rendered docs site |
| Zod v3-only strict-schema helpers in `openai`'s zod adapter | Zod v3 **and** v4 both accepted directly (`z3.ZodType \| ZodV4Schema` union in `src/helpers/zod.ts`) | Landed by `openai@5.23.2` per STACK.md, confirmed still true at `7.15.0` this session | The project's `zod@4.6.2` needs no `zod/v3` import path despite the official doc *example* using it |
| Temporal API as an experimental/flagged feature everywhere | Stable/default-on in Node.js 26 (LTS from Oct 2026); still flagged in Node 24 | Node 26 released ~mid-2026 per WebSearch this session | Do not adopt Temporal in code that might run under Trigger.dev's Node-24 default task runtime this phase |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact TypeScript cast/spelling for passing Kilo Gateway's `provider.require_parameters` through `chat.completions.parse()`'s params object (no official Node-SDK example found) | Code Examples, Common Pitfalls B | Low — worst case is a few minutes adjusting the cast shape; the underlying field and its JSON effect are `[CITED]`, only the TS spelling is unconfirmed |
| A2 | The confidence-rubric wording shown in Code Examples is a structural placeholder, not tonight's actually-verified text | Code Examples "Confidence rubric prompt" | Medium if the planner/executor mistakes the placeholder for the real, tonight-verified rubric (D-10 requires verbatim tonight's text) — flagged explicitly inline to prevent this |
| A3 | `@langchain/langgraph`'s `addConditionalEdges` genuinely requires `@langchain/core` to be *installed* (not just referenced in types) for a working `bun install`/typecheck, based on the peer-dependency declaration and the `RunnableLike` type's origin — not independently reproduced by an actual `bun install` in this sandbox (wrong OS, no bun available here) | Common Pitfalls A, Standard Stack | Low — installing `@langchain/core` regardless costs nothing (it's already STACK.md-pinned at 1.2.10); if the assumption is wrong, it's an unnecessary-but-harmless extra install |
| A4 | Bun 1.4.x's Temporal support status (partial/native, tracked in `oven-sh/bun#15853`) — not independently verified by running bun in this sandbox | Code Examples "Deterministic Next-Weekday Resolution" | Low — the recommendation either way is to NOT use Temporal this phase, so this assumption doesn't change the recommendation, only the stated reason for it |

**If this table is empty:** N/A — see entries above; none of these change the phase's recommended course of action, all are low-risk by construction.

## Open Questions

1. **Does `extractIntents`'s per-message call ever realistically return more than one intent for a single short Slack message?**
   - What we know: the array signature is batch-capable by design (production would pass many messages); the schema's `messageIndex` field exists specifically to support multiple intents across multiple messages.
   - What's unclear: whether a single message like "let's meet Friday, and separately can you send me the doc" could yield two intents from one message, and whether Phase 5's "take `intents[0]`" simplification (see Architecture Patterns note) would silently drop the second.
   - Recommendation: accept the simplification for the 4–5 tonight-verified demo messages (none are compound asks per the demo script); document it as a `ponytail:` comment in code per the Architecture Patterns note, not a blocking question for this phase.

2. **Exact numeric confidence thresholds for high/medium/low.**
   - What we know: D-11 requires re-running tonight's 4–5 samples in the first minutes of the phase and eyeballing the spread before building branch logic.
   - What's unclear: the actual numbers, which depend on the actual rubric text and actual model responses, neither of which exist yet at research time.
   - Recommendation: start with `>=0.75 high / 0.4–0.74 medium / <0.4 low` as a first guess (mirrors PITFALLS.md pitfall 11's example bands) and tune against tonight's real sample-message scores per D-11 — this is explicitly a Claude's-Discretion item, not something to lock here.

## Environment Availability

This research session runs on Windows (Git Bash), not the target WSL Ubuntu machine PROJECT.md/PITFALLS.md describe — `bun`, `docker`, Postgres reachability, and Kilo Gateway's actual response behavior for the chosen `MODEL_FAST`/`MODEL_SMART` ids could not be probed from here. `.planning/research/PITFALLS.md`'s "Do Tonight" checklist (including "one real structured-output call per chosen model id... confirmed to parse" and "4–5 representative sample messages... confidence scores actually spread") is the authoritative, already-canonical-referenced source for verifying these before the window opens; this section does not duplicate it.

| Dependency | Required By | Available (this session) | Fallback |
|------------|------------|-----------|----------|
| bun ≥1.4.x / Node (for a throwaway script or Trigger.dev task invocation) | AGT-10 graph execution | Not probed (wrong OS) | Pre-Window Checklist covers this |
| Kilo Gateway API reachability + chosen model ids' structured-output support | AGT-01, AGT-02, AGT-08 | Not probed (wrong OS/no API key here) | Pre-Window Checklist item explicitly covers this; JSON-mode fallback in `lib/ai/provider.ts` is the code-level safety net regardless |
| Postgres (shared, already running from earlier phases) | AGT-06, AGT-07, AGT-09 writes | Not probed (wrong OS) | Phases 1–4 already establish this; Phase 5 is a consumer, not a first prover |
| npm registry reachability | Version verification (this research) | ✓ confirmed (all `npm view` calls succeeded) | — |

**Missing dependencies with no fallback:** none beyond what PITFALLS.md's pre-window checklist already covers.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No login surface added this phase |
| V3 Session Management | No | No sessions created |
| V4 Access Control | No | Two-user demo; no new authz logic — approval-claim guard is Phase 4's, unchanged here |
| V5 Input Validation | Yes | The extraction Zod schema (D-09) is the boundary between untrusted LLM output and the DB write — every field validated before any Prisma call, including the fallback JSON-mode path's `schema.safeParse()` |
| V6 Cryptography | Yes (non-secret use) | `dedupe_key`'s SHA-256 hash is for determinism/idempotency, not secrecy — no key material, no sensitive data hashed for protection purposes; standard `node:crypto`, not hand-rolled |

### Known Threat Patterns for this phase's surface

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Prompt injection via Slack message content reaching the extraction system prompt | Tampering | Not a new risk introduced by this phase beyond what extraction inherently has — the Zod schema is the actual security boundary (structured output can't smuggle arbitrary code/SQL even if the model is manipulated into a weird response, since it must conform to the schema or fail parse) |
| Unbounded `private_metadata` payload growth over time (feature creep on the modal) | — (design discipline, not a STRIDE category) | Keep `private_metadata` to `{ proposalId }` only (Common Pitfalls C) — re-derive from Postgres, matching the project's existing "re-derive, don't resume" philosophy |
| `dedupe_key` collision treated as an application error instead of expected idempotency behavior | — (correctness, not security) | P2002-as-no-op pattern (Code Examples) — prevents duplicate Proposals from becoming duplicate Slack cards, which PITFALLS.md flags as a demo-visible failure mode |

## Sources

### Primary (HIGH confidence)
- `github.com/openai/openai-node` `docs/helpers.md` (main branch, fetched via `raw.githubusercontent.com` this session) — `zodResponseFormat`/`chat.completions.parse`/`.message.parsed` exact code, nullable-vs-optional strict-schema rule, quoted verbatim
- `github.com/openai/openai-node` `src/helpers/zod.ts` (main branch, fetched this session) — `ZodSchema = z3.ZodType | ZodV4Schema` union confirming Zod v4 direct support
- `github.com/slackapi/bolt-js` `src/types/actions/block-action.ts` (main branch, fetched this session) — `BlockAction.trigger_id: string`, `BlockButtonAction` type, quoted verbatim
- `github.com/slackapi/bolt-js` `src/types/view/index.ts` (main branch, fetched this session) — `ViewOutput.private_metadata`, `ViewErrorsResponseAction`, `ViewUpdateResponseAction`, quoted verbatim
- `langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html` — `compile()` signature, all-optional parameters, fetched this session
- npm registry (`npm view <pkg> version`, `npm view <pkg> peerDependencies`) — direct queries this session for `@langchain/langgraph`, `@langchain/core`, `openai`, `zod`, confirming exact versions and the required (non-optional) `@langchain/core` peer
- Direct code execution this session (`node -e` via Bash tool) — confirmed `2026-09-12` = Saturday and `2026-09-18` = Friday in `Asia/Hong_Kong`, the exact dates D-13's success criterion depends on

### Secondary (MEDIUM confidence)
- `docs.slack.dev/surfaces/modals` (WebFetch this session) — `private_metadata` 3000-char cap, `app.view()` handler shape, `response_action: 'errors'`/`'update'`/`'clear'` semantics
- `openrouter.ai/docs/guides/routing/provider-selection` (WebSearch this session) — `require_parameters` field purpose and JSON shape
- `nodejs.org/en/blog/release/v26.0.0`, InfoQ Node 26 coverage (WebSearch this session) — Temporal API stable-by-default in Node 26, flagged in Node 24
- `trigger.dev/changelog/bun-node-22-runtime` and related (WebSearch this session) — Node 24 as Trigger.dev's current default task runtime
- `bun.com/reference/node/crypto/createHash` (WebSearch this session) — `node:crypto` SHA-256 implemented natively in bun

### Tertiary (LOW confidence)
- WebSearch-aggregated Prisma community discussions on `P2002` handling pattern (no single canonical doc page cited, but the `instanceof Prisma.PrismaClientKnownRequestError` pattern is Prisma's own long-documented convention, widely corroborated across results)
- `oven-sh/bun#15853` (GitHub issue, WebSearch-summarized) — bun's Temporal support status, tracked but not confirmed complete/stable

## Metadata

**Confidence breakdown:**
- Library API shapes (LangGraph compile, openai zod helper, Bolt view/action types): HIGH — read from each package's own current source this session, not training memory
- Kilo Gateway-specific request shape and Node-SDK casting: MEDIUM — the field and its purpose are officially documented; the exact TypeScript spelling for passing it through the `openai` SDK is inferred, not found in an official example
- Confidence rubric wording and numeric thresholds: LOW / explicitly placeholder — this is tonight's pre-window empirical output (D-10/D-11), not producible by this research session
- Deterministic date arithmetic: HIGH — verified by direct code execution this session against the actual build-window date

**Research date:** 2026-09-11
**Valid until:** Effectively for this build window only (Sat 12 Sep 2026) — re-verify any library-version-specific claim if reused beyond this hackathon.
