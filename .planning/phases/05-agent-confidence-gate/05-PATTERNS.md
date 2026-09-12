# Phase 5: Agent + Confidence Gate - Pattern Map

**Mapped:** 2026-09-12
**Files analyzed:** 8 (new/modified)
**Analogs found:** 0 exact in-repo / 8 contract-analogs from Phase 1–4 planning docs

**Repo state note:** Repo is greenfield — `git ls-files` shows only `.planning/`, `.claude/`, and `gsd-prompt-ai-secretary.md`. No application source is committed. Phases 1–4 are planned but not executed, so there is no real code to Read/Grep as an analog. Every "analog" below is instead the exact contract fixed in the cited phase's CONTEXT.md/RESEARCH.md (paths, signatures, field names) — treat these as load-bearing, not illustrative. 05-RESEARCH.md's own `## Code Examples` section already contains the concrete, orchestrator-corrected code for most of these files; this file indexes which excerpt maps to which new file plus the exact upstream contract each must match.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog (contract source) | Match Quality |
|---|---|---|---|---|
| `lib/ai/provider.ts` | service (LLM client) | request-response | Phase 1 RESEARCH.md stub table line 261: `complete<T>(opts): Promise<T>` | contract (replace stub body) |
| `lib/agent/extraction-schema.ts` | model/schema | transform | Phase 1 CONTEXT D-07/D-09; new file, no prior stub | new-file, pattern from 05-RESEARCH §"One Extraction Zod Schema" |
| `lib/agent/graph.ts` | controller (orchestration) | event-driven | Phase 1 RESEARCH.md line 262: `runAgent(input): Promise<RunAgentResult>` (stub → real) | contract (replace stub body, keep signature per D-04) |
| `lib/agent/dedupe.ts` | utility | transform | Phase 1 RESEARCH.md line 264: `computeDedupeKey(...)` — already real, pure function | contract (extend, don't rewrite — D-21) |
| `utils/time.ts` | utility | transform | Phase 1 D-08: HKT `Intl.DateTimeFormat` formatter, existing file to extend | contract (append `resolveNextWeekday`) |
| `lib/slack/edit-approve-listener.ts` (new, append-only) | controller (Bolt action handler) | event-driven | Phase 1 RESEARCH.md `approve_proposal` handler pattern (lines ~491-518); Phase 2 D-07/D-09 ack-first + action-id convention | role-match, same file family as Phase 2's approve/reject handlers |
| `lib/slack/edit-approve-view-handler.ts` (new, append-only) | controller (Bolt view_submission handler) | event-driven | No prior `view_submission` handler exists (Phase 1/2 only built `block_actions`); Bolt's own typed shapes are the analog | role-match via library types, no sibling handler |
| `lib/slack/blocks.ts` (extend) | component (Block Kit builder) | transform | Phase 1 RESEARCH.md line 265-266 `postProposalCard`/`updateProposalCard`; Phase 2 D-08 approval card builder (title/HKT time/duration/participants/confidence/Approve+Reject) | contract (append `buildEditProposalModal` beside existing builders, never restructure — D-24) |

## Pattern Assignments

### `lib/ai/provider.ts` (service, request-response)

**Analog:** Phase 1 stub contract (`complete<T>(opts): Promise<T>`, RESEARCH.md line 261) + 05-RESEARCH.md `## Code Examples > Structured Output Call`.

**Full replacement body is already spelled out in 05-RESEARCH.md lines 340-389** (`chat.completions.parse` + `zodResponseFormat` + Kilo Gateway `require_parameters` cast + JSON-mode fallback). Copy that block, applying **Orchestrator correction #5**: tighten the fallback — only catch parse/unsupported-`response_format` errors (not a bare `catch {}`), and wrap `JSON.parse` inside the retry loop's try.

**Imports pattern:**
```typescript
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { config } from "../config"; // lib/config.ts — the ONLY process.env reader (D-05)
```

**Auth/config pattern:** `new OpenAI({ apiKey: config.ai.apiKey, baseURL: config.ai.baseUrl })` — never read `process.env` directly (D-05, repo rule).

**Core pattern:** `tier: "fast" | "smart"` selects `config.ai.modelFast` / `config.ai.modelSmart` (D-07: extraction always uses `"fast"`).

**Error handling:** catch narrowly (parse/schema-capability errors only) → fall through to JSON-mode retry loop (max 2 attempts) → throw a descriptive error naming `schemaName` if both paths fail.

---

### `lib/agent/extraction-schema.ts` (model/schema, transform)

**Source pattern:** 05-RESEARCH.md `## Code Examples > One Extraction Zod Schema` (lines 260-287), **with Orchestrator correction #1 applied: rename every field to snake_case** (`message_index`, `is_actionable`, `duration_minutes`, `participant_slack_ids`, `time_of_day`, `start_iso` — not the camelCase shown in the raw excerpt), per Phase 1 D-10 (no `@map`, snake_case everywhere) and AGT-02's own snake_case field names.

**And Orchestrator correction #2:** the LLM-facing root schema must be `z.object({ intents: z.array(ExtractedIntentSchema) })` — strict `json_schema` requires an object root; `intents[0] ?? null` is what `graph.ts`'s extract node consumes (05-RESEARCH.md "Note on `state.intent` being singular").

**Rule:** every model-authored field is `.nullable()`, never `.optional()` (openai zod-helper strict-schema requirement, cited in 05-RESEARCH.md line 287).

**Type export:** `export type ExtractedIntent = z.infer<typeof ExtractedIntentSchema>;` in the same file (Phase 1 D-07).

---

### `lib/agent/graph.ts` (controller/orchestration, event-driven)

**Analog/contract:** Phase 1's `runAgent(input): Promise<RunAgentResult>` stub signature is fixed and must not change (D-04) — Phase 4's Trigger.dev task wrapper and Bolt's inline dispatch both compile against it unchanged.

**Core pattern:** 05-RESEARCH.md `## Code Examples > LangGraph JS: Confirmed Minimal-Graph API` (lines 293-336) — `StateGraph` + `Annotation.Root`, 5 nodes (`extract → classify → resolveTime → checkConflicts → propose`), `.compile()` with **no arguments** (D-01, no checkpointer).

**Apply Orchestrator corrections #3 and #4 on top of the raw graph excerpt:**
- #3: the `classify` node (or `runAgent` after `.invoke()`) must write the `ignored` `Decision` row before/at the point it routes to `END` — pick exactly one place, both the no-intent case and the low-confidence-but-actionable case need it.
- #4: routing must bucket on `confidence` (three bands: high/medium/low), not just `is_actionable` — one function does the bucketing (e.g. in `classify` or a shared `bucketConfidence()` helper in `lib/agent/`), and `propose` needs a flag/branch to pick the "Edit & approve" card variant for medium.

**Imports:**
```typescript
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import type { ExtractedIntent } from "./extraction-schema";
import type { ConflictSlot, RunAgentInput, RunAgentResult } from "../../types/agent"; // Phase 1 types/, never forked (D-25)
```

**Reducers:** give `conflicts`, `proposalId`, `decisionId` explicit reducers (overwrite-with-next); `message`/`intent` can use default overwrite since only `extract` writes them.

---

### `lib/agent/dedupe.ts` (utility, transform — EXTEND, do not rewrite)

**Contract:** Phase 1 already created this as a real pure function: `computeDedupeKey(teamId, channelId, threadOrMessageTs, normalizedIntent): string` (Phase 1 RESEARCH.md line 264, CONTEXT D-21). Phase 5 **must reuse or extend this file**, never add a second hashing helper (D-21, explicit "don't hand-roll" rule in 05-RESEARCH.md's table).

**`normalized_intent` construction (D-20):** type + ISO start rounded to 5-minute buckets + sorted participant set — this bucketing logic is new in Phase 5 and belongs in `dedupe.ts` or a small helper it calls, feeding `computeDedupeKey`'s existing last argument.

**P2002 idempotency pattern** (used in `propose` node, not in `dedupe.ts` itself): 05-RESEARCH.md `## Code Examples > dedupe_key collision handling` (lines 588-611) — catch `Prisma.PrismaClientKnownRequestError` with `code === "P2002"`, treat as no-op, fetch-and-return the existing row via `findUniqueOrThrow`. Adjust the example's camelCase (`dedupeKey`) to snake_case (`dedupe_key`) per Phase 1 D-10.

---

### `utils/time.ts` (utility, transform — EXTEND, do not fork)

**Contract:** Phase 1 D-08 already created this file with an HKT `Intl.DateTimeFormat` formatter; Phase 5 appends `resolveNextWeekday`, it does not create a second time-utility file.

**Full implementation:** 05-RESEARCH.md `## Code Examples > Deterministic Next-Weekday Resolution` (lines 393-436) — verified by direct execution against `Asia/Hong_Kong`, no date library, no Temporal API (Node 24/Trigger.dev default runtime doesn't have it stable). Copy verbatim; only the export needs to sit beside the existing HKT formatter in the same file.

---

### `lib/slack/edit-approve-listener.ts` (controller, event-driven, append-only new file)

**Analog:** Phase 1's `approve_proposal` `block_actions` handler pattern (ack-first, read `action.value`, DB read, Slack API call) + Phase 2 D-07 (ack() is the literal first statement) + D-09 (action-id convention `<verb>_proposal`, e.g. `edit_approve_proposal`).

**Full code:** 05-RESEARCH.md `## Code Examples > handleApproveProposal-style AGT-05 listener` (lines 526-553). Note `trigger_id` is a **top-level** field on the `block_actions` payload, not nested under `container` (verified against Bolt's own `block-action.ts` types).

**Constraint (D-24):** this is a **new file** beside Phase 2's approve/reject builder — never edit Phase 2/4's existing registrations in `lib/slack/bolt.ts`; only **register** the new listener there (append, one line).

**`private_metadata` shape (Common Pitfall C):** `{ proposalId }` only — never the full edited payload (3000-char cap on the field; re-derive the rest from Postgres in the view handler, matching the project's "re-derive, don't resume" convention).

---

### `lib/slack/edit-approve-view-handler.ts` (controller, event-driven, append-only new file)

**Analog:** No sibling `view_submission` handler exists yet in this repo (Phase 1/2 only built `block_actions`). The pattern comes directly from `@slack/bolt`'s own typed shapes for `ViewOutput`/`ViewErrorsResponseAction`, confirmed by source-read in 05-RESEARCH.md.

**Full code:** 05-RESEARCH.md `## Code Examples > view_submission handler with validation-error ack()` (lines 559-584). Validation failure → `ack({ response_action: "errors", errors: { blockId: "message" } })`; success → plain `ack()` (closes modal) → `prisma.proposal.update(...)` → call **existing** `updateProposalCard` (never edit that function — D-24).

**Field naming correction:** the excerpt's `data: { title /* ... */ }` must use Prisma's actual snake_case column names once Phase 1's schema is read at execution time (e.g. whatever the schema calls the title/start/duration columns) — do not invent camelCase Prisma fields.

---

### `lib/slack/blocks.ts` (component, transform — EXTEND, append-only)

**Analog:** Phase 2 D-08's approval card builder (title, HKT time, duration, participants, confidence, Approve+Reject) — same file family, same `utils/time.ts` HKT formatter reused (Phase 2 D-10, "no second formatter").

**New export:** `buildEditProposalModal(proposal, { proposalId }): View` — a Block Kit modal `view` object with input blocks for the fields AGT-05 lets the user edit (title, date/time, duration, participants at minimum). Modal's `private_metadata: JSON.stringify({ proposalId })` per Common Pitfall C above.

**Constraint:** append this builder beside the existing approve/reject/confirmed builders; never restructure Phase 2's existing block-builder functions (D-24).

## Shared Patterns

### Config/env access
**Source:** Phase 1 D-15/D-16 (`lib/config.ts` — single Zod parse of `process.env` at import; every key any phase uses is declared there already, including `AI_BASE_URL`/`AI_API_KEY`/`MODEL_FAST`/`MODEL_SMART`).
**Apply to:** `lib/ai/provider.ts` only reads `config.ai.*`; no other Phase 5 file imports an SDK client directly (D-05).

### Prisma access
**Source:** Phase 1 D-12 (`lib/db.ts` — `globalThis` singleton, `PrismaPg` adapter). Field names are snake_case, no `@map` (D-10).
**Apply to:** `graph.ts`'s `propose` node, `dedupe.ts`'s P2002 handling, `edit-approve-view-handler.ts`'s update — all import `{ prisma } from "../db"`, never construct a new `PrismaClient`.

### Ack-first discipline
**Source:** Phase 2 D-07: `ack()` is the literal first statement of every Bolt listener/handler that receives one.
**Apply to:** `edit-approve-listener.ts`'s `block_actions` handler and `edit-approve-view-handler.ts`'s `view_submission` handler both.

### Action-id / button-value convention
**Source:** Phase 1 D-03, Phase 2 D-09: action ids are `<verb>_proposal`; button `value` = proposal id.
**Apply to:** the new "Edit & approve" button should use an id like `edit_approve_proposal`, value = proposal id, consistent with `approve_proposal`/`reject_proposal`.

### Re-derive, don't resume
**Source:** 05-RESEARCH.md Common Pitfall C, matching the project's existing pattern of never trusting stale Slack-round-tripped state.
**Apply to:** `edit-approve-view-handler.ts` re-reads the Proposal row by id rather than trusting anything beyond `{ proposalId }` in `private_metadata`.

### Decision-row-per-run invariant
**Source:** D-16/D-17/D-18 (AGT-06/07) — every graph run writes exactly one `Decision` row, verdict `ignored` or `acted`, always with confidence + reason.
**Apply to:** `graph.ts`'s `classify`/`propose` nodes — pick exactly one write site (Orchestrator correction #3) and use it for every branch, including the no-intent-extracted case.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `lib/agent/extraction-schema.ts` | model/schema | transform | No prior LLM-output schema exists in the repo (Phase 1 only stubbed `complete<T>`); pattern is fully specified by 05-RESEARCH.md's own code example, not copied from elsewhere in-repo |
| `lib/slack/edit-approve-view-handler.ts` | controller | event-driven | No `view_submission` handler built in Phase 1/2; only `@slack/bolt`'s own type definitions serve as the shape reference |

## Metadata

**Analog search scope:** `.planning/phases/01-foundation-hardcoded-round-trip/`, `02-slack-surface/`, `05-agent-confidence-gate/` (CONTEXT.md + RESEARCH.md); `git ls-files` confirmed no tracked application source exists yet.
**Files scanned:** 4 phase-context documents (01, 02, 05 CONTEXT/RESEARCH) + `git ls-files` repo-wide listing.
**Pattern extraction date:** 2026-09-12
