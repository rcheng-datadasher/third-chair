---
phase: 05-agent-confidence-gate
plan: 01
subsystem: agent
tags: [langgraph, openai, zod, extraction, confidence-gate, hkt]

requires:
  - phase: 01-foundation-hardcoded-round-trip
    provides: runAgent/complete/extractIntents stubs, Prisma schema, config.ts, HKT formatter
provides:
  - Real MODEL_FAST structured-output extraction over the Kilo Gateway
  - Compiled 5-node LangGraph confidence gate with one Decision write per run
  - Deterministic HKT relative-date resolution (resolveStartIso)
  - Single consolidated ExtractedIntent type (Zod-inferred)
affects: [05-02, 05-03, 07-integrate-conflict-counter-proposal, 08-optional-s2-commitment-ledger]

actuals:
  tokens: 21000
  tasks: 2
  commits: 2
plan_head_before: 0135dadb2afafc29709a623c4840e3d6e162b1df

tech-stack:
  added: ["@langchain/core@1.2.10 (pinned, already present as langgraph peer)"]
  patterns: ["structured-output-first + narrow JSON-mode fallback in lib/ai/provider.ts", "single bucketConfidence gate function", "one Decision write per runAgent invocation regardless of branch"]

key-files:
  created: []
  modified:
    - lib/ai/provider.ts
    - lib/agent/extract-intents.ts
    - lib/agent/graph.ts
    - lib/agent/dedupe.ts
    - utils/time.ts
    - types/agent.ts

key-decisions:
  - "CONFIDENCE_RUBRIC is executor-authored (structural, per 05-RESEARCH), not a verbatim-pasted developer Pre-Window Checklist text — no such file was available to this executor. Open item for the developer to reconcile."
  - "$HOME/p5-samples.json (6 samples, 2 high/2 medium/2 low) is executor-generated, not developer-verified, for the same reason. All 6 bucket to their expected band with HIGH_FROM=0.75/LOW_BELOW=0.4 unchanged from the plan's first guess — no tuning needed."
  - "resolveParticipantEmail kept as graph.ts's existing Phase 1 private helper (always resolves to a placeholder email) rather than adding a new lib/slack/resolve-email.ts the plan's interfaces block assumed but that never existed in this repo."

requirements-completed: [AGT-01, AGT-02, AGT-03, AGT-04, AGT-06, AGT-07, AGT-08, AGT-09, AGT-10]

coverage:
  - id: D1
    description: "High-confidence Slack message -> real MODEL_FAST extraction -> 5-node graph -> Proposal + posted card + one acted Decision, start = next-Friday 11:00 HKT"
    requirement: AGT-01
    verification:
      - kind: integration
        ref: "live runAgent() against real DB + real Kilo Gateway (anthropic/claude-haiku-4.5)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Low-confidence/banter message -> silent, one ignored Decision, no Proposal, no Slack output"
    requirement: AGT-06
    verification:
      - kind: integration
        ref: "live runAgent() against real DB + real Kilo Gateway"
        status: pass
    human_judgment: false
  - id: D3
    description: "Confidence spread across high/medium/low visibly calibrated"
    requirement: AGT-08
    verification:
      - kind: integration
        ref: "$HOME/p5-samples.json x extractIntents + bucketConfidence, 6/6 samples on expected band"
        status: pass
    human_judgment: true
    rationale: "Rubric and samples are executor-authored stand-ins for the developer's own Pre-Window Checklist verification (D-10/D-11 intent not literally satisfied) — a human should confirm the rubric wording before ship."
  - id: D4
    description: "5-node compiled graph, zero-arg compile, one ExtractedIntent definition, env-only MODEL_FAST swap"
    requirement: AGT-10
    verification:
      - kind: unit
        ref: "grep gates (addNode=5, decision.create=1, no MemorySaver/interrupt/process.env/calendar/bolt imports) + bunx tsc --noEmit + bunx biome check"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-12
status: complete
---

# Phase 5 Plan 1: Real extraction + confidence gate + HKT dates Summary

Real `MODEL_FAST` structured-output extraction over the Kilo Gateway feeds a compiled 5-node LangGraph, gated by a single `bucketConfidence` function, into a Proposal/card/Decision round trip proven live against the real DB and real model.

## Performance

- **Duration:** 55 min
- **Tasks:** 2 completed (Task 2 was a checkpoint, approved by the coordinator)
- **Files modified:** 6

## Sample table (D-11, AGT-08)

Executor-generated (no developer Pre-Window Checklist file was available — see Deviations). `HIGH_FROM=0.75`, `LOW_BELOW=0.4`, both left at the plan's first-guess values; no tuning was needed.

| Text | Expected | Band | Confidence |
|---|---|---|---|
| Lets have a talk next Friday at 11am | high | high | 0.92 |
| Can we sync Monday at 10am? | high | high | 0.88 |
| Lets meet on Thursday to discuss the roadmap | medium | medium | 0.62 |
| Lets meet tomorrow to go over the deck | medium | medium | 0.65 |
| haha that meme is great | low | low | 0.05 |
| Good morning everyone! | low | low | 0.05 |

Served model for extraction: `anthropic/claude-haiku-4.5` (MODEL_FAST). Env-only swap to MODEL_SMART verified to change the `[ai]` log line's `requested=` field with no `.env`/code edit.

## Task Commits

1. **Task 1 (tracer): real extraction -> graph -> Proposal + card + Decision** - `f083d45` (feat)
2. **Task 3: pin @langchain/core, single ExtractedIntent, env-swap proof** - `c6162e8` (feat)

_Task 2 (package legitimacy checkpoint) was approved by the coordinator without code changes._

## Files Created/Modified
- `lib/ai/provider.ts` — real `complete<T>()`: structured-output first, narrow JSON-mode fallback, one `[ai]` log line
- `lib/agent/extract-intents.ts` — `ExtractedIntentSchema`/`ExtractionResultSchema`, rubric, `extractIntents`
- `lib/agent/graph.ts` — 5-node `StateGraph`, `bucketConfidence`, `runAgent`
- `lib/agent/dedupe.ts` — `normalizeIntent` appended beside `computeDedupeKey`
- `utils/time.ts` — `hktDateParts`/`resolveStartIso` appended beside the Phase 1 HKT formatter
- `types/agent.ts` — `ExtractedIntent` is now a type-only re-export from `lib/agent/extract-intents.ts`

**Phase 1 `extractIntents` stub location:** already at `lib/agent/extract-intents.ts` (no move needed).

## Decisions Made
See `key-decisions` in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking] Tracked `.env.local` overrode `.env` with a stale OpenRouter-direct `AI_BASE_URL` and fake `MODEL_FAST`/`MODEL_SMART` values**
- **Found during:** Task 1, live-DB verify (401 "Missing Authentication header", then "model does not exist")
- **Issue:** bun gives `.env.local` precedence over `.env`; the worktree's tracked `.env.local` (pre-existing scaffold artifact) pointed AI calls directly at `openrouter.ai` with placeholder model ids instead of the Kilo Gateway.
- **Fix:** neutralized the offending lines in-session; the orchestrator then landed the real values centrally in both `.env` and `.env.local` (main commit `997d5d3`).
- **Files modified:** `.env.local` (never staged/committed by this executor, per instructions).
- **Verification:** re-ran the Kilo structured-output smoke test and the full `runAgent` live verify — both green.

**Open item (not a deviation, flagged per plan's own AGT-08 assumption slot):** `CONFIDENCE_RUBRIC` and `$HOME/p5-samples.json` are executor-authored, not the developer's own verified Pre-Window Checklist text (no such file was supplied to this executor). D-10's "never cut" intent is satisfied structurally (a rubric is baked into the prompt verbatim and never rewritten in the branch logic) but not literally (it isn't the developer's own wording). Recommend a human pass over `CONFIDENCE_RUBRIC` before ship.

---

**Total deviations:** 1 auto-fixed (Rule 3). **Impact:** none on code correctness — environment-only, now resolved centrally.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None.

## Self-Check: PASSED

- `[ -f lib/ai/provider.ts ]`, `[ -f lib/agent/extract-intents.ts ]`, `[ -f lib/agent/graph.ts ]`, `[ -f lib/agent/dedupe.ts ]`, `[ -f utils/time.ts ]`, `[ -f types/agent.ts ]` — all FOUND
- `git log --oneline --all --grep="05-01"` returns 2 commits (`f083d45`, `c6162e8`) — FOUND
- All Task 1/3 acceptance criteria re-verified green (grep gates, `tsc --noEmit`, `biome check`, live `runAgent` round trip, sample table, model-swap proof)
- `commits: 2` measured via `git rev-list --count 0135dad..HEAD`, matches `plan_head_before`
