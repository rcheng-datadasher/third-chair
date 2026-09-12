---
phase: 05-agent-confidence-gate
plan: 02
subsystem: agent
tags: [langgraph, prisma, idempotency, action-items]

requires:
  - phase: 05-agent-confidence-gate
    provides: 05-01's compiled graph, extraction pipeline, sample table
provides:
  - Redelivery-safe runAgent (Decision pre-check, P2002 dedupe reuse, card-recovery)
  - Whitespace-only-message skip (no model call)
  - Per-user ActionItem rows for every newly-created Proposal
affects: [05-03, 07-integrate-conflict-counter-proposal]

actuals:
  tokens: 8000
  tasks: 2
  commits: 1
plan_head_before: 8fb3d269a5e3cd3370f5d7ca70d45f2218c3b3a6

tech-stack:
  added: []
  patterns: ["Prisma P2002 recognize-and-reuse (no retry wrapper)", "card recovery gated on card_ts == null"]

key-files:
  created: []
  modified:
    - lib/agent/graph.ts

key-decisions:
  - "Tasks 1 and 2 committed together — both touch the same proposeNode/runAgent call sites (ActionItem creation reads the Proposal that P2002-recovery produces), and splitting them would have required an intermediate half-working commit."
  - "ActionItem.kind/state are free strings (schema has no enum) — used \"meeting\"/\"pending\" per the plan's own fallback."

requirements-completed: [AGT-06, AGT-07, AGT-09, AGT-10]

coverage:
  - id: D1
    description: "Replaying the same message twice returns identical proposalId/decisionId with exactly one Proposal, one Decision, one [ai] log line"
    requirement: AGT-09
    verification:
      - kind: integration
        ref: "live runAgent() x2 + count() against real DB"
        status: pass
    human_judgment: false
  - id: D2
    description: "Whitespace-only message: one ignored Decision naming 'empty', zero model calls"
    requirement: AGT-10
    verification:
      - kind: integration
        ref: "live runAgent() against real DB, grep -c '[ai]' == 0 for that call"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every acted proposal carries >=1 ActionItem; low-band samples carry none"
    requirement: AGT-07
    verification:
      - kind: integration
        ref: "live sample-set run x6, actionItem.count per proposal"
        status: pass
    human_judgment: false
  - id: D4
    description: "Next-Friday sample's Proposal start is the correct HKT instant for the run day"
    requirement: AGT-09
    verification:
      - kind: integration
        ref: "printed sample table row 0: start=2026-09-18T03:00:00.000Z (11:00 HKT)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-12
status: complete
---

# Phase 5 Plan 2: Redelivery-safe runAgent + per-user ActionItems Summary

`runAgent` now survives Slack/Trigger.dev redelivery and empty messages without a duplicate Proposal, card, or Decision, and every acted proposal gets one ActionItem per resolvable participant.

## Performance

- **Duration:** 20 min
- **Tasks:** 2 completed (landed in a single commit — see Deviations)
- **Files modified:** 1

## Sample-run table (re-run of 05-01's 6 samples)

| Expected | Decisions | Verdict | Confidence | Card | Start | ActionItems |
|---|---|---|---|---|---|---|
| high | 1 | acted | 0.92 | true | 2026-09-18T03:00:00.000Z | 1 |
| high | 1 | acted | 0.95 | true | 2026-09-14T02:00:00.000Z | 1 |
| medium | 1 | acted | 0.62 | true | 2026-09-17T02:00:00.000Z | 1 |
| medium | 1 | acted | 0.62 | true | 2026-09-13T02:00:00.000Z | 1 |
| low | 1 | ignored | 0 | false | null | 0 |
| low | 1 | ignored | 0.05 | false | null | 0 |

No threshold retune needed — `HIGH_FROM=0.75`/`LOW_BELOW=0.4` unchanged from 05-01. `ActionItem.kind`/`state` used: `"meeting"`/`"pending"` (schema columns are free strings, no enum).

## Task Commits

1. **Tasks 1+2: redelivery-safe runAgent + per-user ActionItems** - `0cbc0ef` (feat)

## Files Created/Modified
- `lib/agent/graph.ts` — Decision pre-check, empty-message skip, P2002 recovery + card recovery, `actionItem.createMany`

## Decisions Made
See `key-decisions` in frontmatter.

## Deviations from Plan

**1. [process] Tasks 1 and 2 landed in one commit instead of two.** Both tasks edit the same `proposeNode`/`runAgent` region — Task 2's `ActionItem` creation reads the exact Proposal object Task 1's P2002-recovery branch produces. Splitting them into two commits would have required committing a Task 1 state where `createProposal`'s extraction was already done but unused, or reconstructing the diff after the fact. No functional impact; both tasks' acceptance criteria are independently verified above.

---

**Total deviations:** 1 (process only, no code/behavior impact).

## Issues Encountered
None.

## User Setup Required
None.

## Self-Check: PASSED

- `[ -f lib/agent/graph.ts ]` — FOUND
- `git log --oneline --all --grep="05-02"` returns 1 commit (`0cbc0ef`) — FOUND
- Both tasks' acceptance criteria re-verified green: replay identity, one `[ai]` line across 3 calls, empty-message skip, `actionItem.createMany` present, `decision.create` count still 1, scope guard clean, `tsc --noEmit` / `biome check` clean
- `commits: 1` measured via `git rev-list --count 8fb3d26..HEAD`, matches `plan_head_before`
