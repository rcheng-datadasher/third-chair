# Phase 5: Agent + Confidence Gate - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning
**Source:** PRD Express Path (`.planning/ROADMAP.md`, Phase 5 section only) + `.planning/REQUIREMENTS.md` AGT-01..AGT-10 + `.planning/PROJECT.md` constraints

<domain>
## Phase Boundary

Wave B, track A, 13:05–13:50 HKT (45 min), branch `gsd/phase-5-agent-confidence`, running alongside Phase 6 (Dashboard). Depends on Phase 4.

Delivers a **real LangGraph extraction pipeline that gates on confidence with a visibly calibrated spread**, replacing Phase 1's `runAgent`/`extractIntents` stub bodies and Phase 1's stub `lib/ai/provider.ts`:

- One graph, at most 5 nodes, no checkpointer.
- `extractIntents(messages[], ctx)` returning Zod-validated intents mapped back to real Slack `ts`.
- Relative dates resolved deterministically in code against `Asia/Hong_Kong`.
- Three confidence branches: high posts the approval card; medium posts an "Edit & approve" card whose button opens a prefilled modal; low/non-actionable is silent. Every run writes a `Decision` row.
- The tonight-tuned confidence rubric baked into the prompt.
- `dedupe_key` for one Proposal per intent, with per-user `ActionItem` rows.

Requirements: AGT-01, AGT-02, AGT-03, AGT-04, AGT-05, AGT-06, AGT-07, AGT-08, AGT-09, AGT-10.

Not this phase: real conflict detection and counter-proposals (Phase 7), wiring the real graph into Phase 4's Trigger.dev task end to end (Phase 7), the LangGraph keep-or-rip decision (Phase 7), dashboard UI (Phase 6), `/secretary scan` (Phase 7, optional).

</domain>

<decisions>
## Implementation Decisions

### Agent graph (AGT-10)
- **D-01:** The agent is **one LangGraph graph of at most five nodes** on the path extract → classify actionability → resolve time → check conflicts → propose. It is compiled with **no `checkpointer` argument at all** and invoked to completion once per message. No `interrupt()`, no subgraphs, no multi-agent handoff, no tool-calling loops, no `MemorySaver`, no `LANGGRAPH_PG_URL`/`PostgresSaver`.
- **D-02:** Phase 5 builds the **5-node skeleton** (roadmap plan 05-01). The check-conflicts node is on the path but its real logic belongs to Phase 7 (CFL-01..05). Phase 5 does not decide how conflicts are detected.
- **D-03:** The **LangGraph keep-or-rip decision is not made in this phase.** It is fixed for Phase 7's integration point (~14:00). Phase 5 keeps node functions plain enough that "call them in sequence" stays a ~10-minute change (AGT-10's fallback clause).
- **D-04:** `runAgent` replaces **Phase 1's stub body**, keeping the stub's fixed signature so Phase 4's Trigger.dev task wrapper and inline transport keep compiling unchanged.

### Model provider (AGT-01)
- **D-05:** Every model call goes through `lib/ai/provider.ts`. It reads `AI_BASE_URL`, `AI_API_KEY`, `MODEL_FAST` and `MODEL_SMART` from the typed config module (`lib/config.ts`), never from `process.env` directly. No other file imports an SDK client.
- **D-06:** The provider uses the **`openai` SDK (7.15.0) pointed at Kilo Gateway's OpenAI-compatible endpoint**, with Zod schemas for structured output. No LangChain chat-model wrapper by default. `@langchain/core` is added only if a node demonstrably needs a LangChain-specific helper.
- **D-07:** Extraction uses **`MODEL_FAST`**. `MODEL_SMART` is reserved for conflict reasoning (Phase 7). Swapping either model is an `.env` edit + restart, with no code edit (success criterion 4).

### Extraction contract (AGT-02, AGT-08)
- **D-08:** The signature is **`extractIntents(messages: SlackMessage[], ctx)`**. Messages are rendered as **numbered lines**. The model returns `message_index` per intent, mapped back to the real Slack `ts` in code. The per-message path passes an array of one.
- **D-09:** The output is validated with **one Zod schema** carrying title, resolved ISO start, duration, participants, `is_actionable`, `confidence`, `message_index`. The same schema backs the DB write. Following Phase 1 (D-07), the LLM-output Zod schema lives in `lib/agent/` with its type via `z.infer` in the same file. **Never cut** (roadmap cut order).
- **D-10:** The **confidence rubric verified tonight** (Pre-Window Checklist: 4–5 sample messages spread across high/medium/low) is baked into the extraction prompt verbatim. **Never cut.**
- **D-11:** The **first minutes** of the phase re-run the same 4–5 samples through the real prompt and eyeball the spread before any branch logic is built on top (roadmap time-eater #1: scores clustering at ~0.85–0.95).

### Time resolution (AGT-03)
- **D-12:** Relative times ("next Friday at 11am") are resolved **in code, not by the model**. Today's date, day-of-week and timezone `Asia/Hong_Kong` are passed to the prompt explicitly, and the day arithmetic is done deterministically in code. Everything is normalized to `Asia/Hong_Kong`.
- **D-13:** Success criterion 3: "next Friday at 11am" resolves to the correct calendar date **for the actual day this phase runs**.

### Confidence branches (AGT-04..07)
- **D-14 (high, AGT-04):** A high-confidence actionable intent creates the Proposal and **posts the approval card** by calling the existing card-posting function unchanged.
- **D-15 (medium, AGT-05):** Per ROADMAP "Flags Resolved", a modal needs a click-borne `trigger_id`, so the modal is **not auto-opened**. The card shows an **"Edit & approve" button**. Clicking it runs `views.open` with a modal prefilled from `private_metadata`. Submitting the modal (`view_submission`) updates the Proposal and shows the approvable card.
- **D-16 (low, AGT-06):** A low-confidence or non-actionable message **posts nothing** and writes a `Decision` row with verdict `ignored`, the confidence and a reason.
- **D-17 (acted, AGT-07):** Actionable messages also write a `Decision` row with verdict `acted`.
- **D-18:** Success criterion 2: every sample run leaves **exactly one `Decision` row**, with a confidence value and a reason.
- **D-19 (cut order):** If overrunning, the medium edit-modal step drops to "posts the card directly". The high/low gate is the load-bearing differentiator.

### Dedupe (AGT-09)
- **D-20:** Exactly **one Proposal per intent**: `dedupe_key = sha256(team_id + channel_id + (thread_ts ?? message_ts) + normalized_intent)`. `normalized_intent` is type + ISO start rounded to 5-minute buckets + the sorted participant set. The key is enforced by the schema's unique `dedupe_key`. Per-user `ActionItem` rows reference the Proposal.
- **D-21:** Phase 1 already created `lib/agent/dedupe.ts` as a real pure function (Phase 1 D-06). Phase 5 **reuses or extends it** and does not write a second hashing helper.

### File ownership and overlaps
- **D-22:** Owned: `lib/agent/**` (graph, nodes, `runAgent`) and `lib/ai/**` (real `provider.ts`).
- **D-23:** Must not touch: `app/**`, `components/**`, `lib/calendar/**`, `lib/agent/tasks/` and `trigger.config.ts` (Phase 4 owned). `prisma/schema.prisma` may be changed only after merging the latest `develop`, then `bunx prisma db push`, per the File Ownership Matrix.
- **D-24:** `lib/slack/**` is **append-only for AGT-05**:
  - a new "Edit & approve" card variant beside Phase 2's approve/reject builder;
  - a `block_actions` → `views.open` listener;
  - a `view_submission` handler.

  It never restructures Phase 2/4 registrations or builders, and calls the existing card-posting function without editing it. Phase 6 doesn't touch `lib/slack/**`, so this is safe in Wave B.
- **D-25:** `types/` is extended from the Phase 1 stub, never forked (ExtractedIntent/AgentState additions if needed). Phase 6 reads Proposal/Decision types in parallel.

### Process and run
- **D-26:** No long-lived server for the graph. It is exercised via a throwaway script, or by manually invoking Phase 4's Trigger.dev task. The workspace has its own untracked `.env` with port :3001. Postgres :5432 is shared and this phase writes real `Proposal`/`Decision`/`ActionItem` rows. Only one Bolt process runs across all worktrees; kill any other first if Bolt is needed for AGT-05.

### Exit criterion
- **D-27:** The 4–5 tonight-verified sample messages, run through the real graph, land on visibly different branches (card / edit-modal / silent+Decision) matching tonight's verification, with a `Decision` row for every one. Success criterion 1: at least one card directly, one edit-modal path, one silent.

### Repo rules inherited (PROJECT.md)
- **D-28:**
  - bun only; never `bun --bun` or `bunx --bun`.
  - Biome `check --write` before done; no test files; TSDoc on every function.
  - Zod at every external boundary; `lib/config.ts` is the only `process.env` reader.
  - Prisma client only from the shared `globalThis` singleton (`lib/db.ts`); never constructed in a node, listener or task body.
  - kebab-case files, named exports, no `any`.
  - No secrets in code.

### Claude's Discretion
- Numeric confidence thresholds for high/medium/low, as long as tonight's samples land on the branches tonight verified.
- Whether "classify actionability" is its own model call or a code branch on the extraction's `is_actionable`/`confidence`. The ponytail default favours one `MODEL_FAST` call.
- Graph state shape and node names, within ≤5 nodes.
- The "next Friday" rule for weekdays other than today's, provided D-13 holds for the day the phase runs (researcher to recommend a rule).
- How the resolved date is produced: model returns a structured relative expression (weekday + offset + time) that code resolves, versus a code post-pass over a model ISO guess. Either way, the arithmetic is in code.
- Structured-output mechanism: `chat.completions.parse` + `zodResponseFormat` with Kilo Gateway `require_parameters: true`, versus the JSON-mode + manual `schema.parse()` + one-retry fallback (STACK.md).
- `private_metadata` payload shape for the edit modal, and the modal's field set (Block Kit inputs).
- Where Decision/Proposal/ActionItem writes live (the propose node, or `runAgent` after graph completion).
- `ctx` object fields (team_id, channel_id, now, tz, user map), within Phase 1's `RunAgentInput` stub.

### Pre-applied scope cut (decided 2026-09-12, before the window)
- **Runs in R1, before Phase 4 exists.** Build and verify the graph via direct script invocation (`bun` a small runner that calls the compiled graph with a sample message). Do not create or edit `lib/agent/tasks/**` or `trigger.config.ts` — Phase 4 owns the Trigger.dev wrapper and will import this graph. Do not touch `lib/slack/**` (the edit-modal files the plan lists are cut above).
- **Drop the medium-confidence edit-modal path (AGT-05).** Do not build the "Edit & approve" card variant, the `block_actions` -> `views.open` listener, or the `view_submission` handler. Medium confidence posts the ordinary approval card, same as high. The confidence gate itself — `is_actionable`, `confidence`, and the low-confidence silent write to `Decision` — is NOT cut; it is a headline feature.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` §"Phase 5: Agent + Confidence Gate": goal, deliverables, files owned/must-not-touch, named overlaps, processes, exit criterion, cut order, time-eaters, success criteria, suggested plans 05-01..03.
- `.planning/ROADMAP.md` §"File Ownership Matrix" (`lib/agent/**`, `lib/ai/**`, `lib/slack/bolt.ts`, card builders, `types/`), §"Flags Resolved" (no checkpointer; "Edit & approve" button, not auto-modal), §"Cut-Line Table" (Phase 5 row), §"Pre-Window Checklist" (structured-output call per model id; 4–5 sample messages + rubric tuning).
- `.planning/REQUIREMENTS.md`: AGT-01..AGT-10 (this phase). AGT-11 is the Phase 4 task wrapper that calls `runAgent`. SLK-05/SLK-06 define the card contract being extended.
- `.planning/PROJECT.md`: §"Agent design" (graph path, re-derive not resume, per-message `extractIntents(messages[])`, `dedupe_key` definition), §"Data model", §"Tech stack", §"Repo rules", §"Constraints", §"Key Decisions".

### Upstream phase context (consume, don't re-decide)
- `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md`:
  - D-02/D-03: DB-backed round trip; `<verb>_proposal` action ids; button `value` = proposal id.
  - D-05..D-07: stub signatures, `lib/agent/dedupe.ts` real, Zod schemas in `lib/agent/`, Prisma types not re-declared.
  - D-08: `utils/time.ts` HKT formatter.
  - D-09/D-11: schema columns incl. `Proposal.confidence`, `Decision.message_text`/`source_channel`/`proposal_id`; enums.
  - D-15: config keys incl. `MODEL_FAST`/`MODEL_SMART`.
- `.planning/phases/01-foundation-hardcoded-round-trip/01-RESEARCH.md`: stub interface code and Prisma 7 client details as researched.
- Phase 2/3/4 CONTEXT.md files, if present when planning: card builder names, `bolt.ts` registration pattern, Trigger.dev task/`dispatchAgentRun` shape.

### Research
- `.planning/research/STACK.md`: `openai@7.15.0` + `zod@4.6.2` structured output; Kilo Gateway `require_parameters` and the JSON-mode fallback; `@langchain/langgraph@1.4.14` peer ranges; no checkpointer; no LangChain wrapper by default.
- `.planning/research/ARCHITECTURE.md` §"Interfaces Before Implementation", with the kebab-case/path corrections in Phase 1 D-05.
- `.planning/research/PITFALLS.md`: confidence calibration, relative-date resolution, LangGraph and structured-output pitfalls.
- `.planning/research/SUMMARY.md`: reconciled overview.
- `gsd-prompt-ai-secretary.md` (repo root): source doc for agent design detail.

</canonical_refs>

<specifics>
## Specific Ideas

- Canonical demo message: B posts "Let's have a talk next Friday at 11am." The demo calendar slots per Phase 1 specifics are Fri 18 Sep 2026 11:00 HKT and 10:30 HKT. Executed on Sat 12 Sep 2026, "next Friday" must resolve to **Fri 18 Sep 2026 11:00 +08:00**.
- Roadmap time-eater #2: "next Friday" resolved wrong. Pass today's date, day-of-week and tz explicitly, and do the day math in code.
- Non-actionable chatter should still leave an `ignored` Decision with the message text. It is a dashboard demo asset ("considered and ignored").
- Precision over recall: a 1% false-positive rate means uninstall (PROJECT.md Key Decisions). Low confidence stays silent.
- Batch-first is the documented production design. The array signature means the batch upgrade is a caller change only.

</specifics>

<deferred>
## Deferred Ideas

- Real conflict detection (freebusy ∪ pending Proposals) and the `MODEL_SMART` two-alternative counter-proposal: Phase 7 (CFL-01..05).
- LangGraph keep-or-rip decision and wiring the real graph into the Trigger.dev task for live traffic: Phase 7.
- `/secretary scan` over ~50 messages (OPT-01): Phase 7, optional.
- `commitment` extraction type: Phase 8 (S2, throwaway).
- Preference memory via Graphiti: Phase 9 (S1, throwaway).
- Expiry sweep re-deriving stale action items: v2 (SCL-03).
- Batch sweep / cheap local router: v2 (SCL-01/02), README only.

</deferred>

---

*Phase: 05-agent-confidence-gate*
*Context gathered: 2026-09-11 via PRD Express Path*
