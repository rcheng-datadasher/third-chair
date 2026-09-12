---
phase: 07-integrate-conflict-counter-proposal
plan: 01
subsystem: integration
tags: [prisma, trigger-dev, langgraph, slack-bolt, google-calendar, biome]

# Dependency graph
requires:
  - phase: 05-agent-confidence-gate
    provides: real runAgent graph (extractNode/classifyNode/resolveTimeNode/checkConflictsNode/proposeNode), confidence bucketing, redelivery-safe dedupe
  - phase: 06-dashboard
    provides: dashboard reading real Proposal/Decision rows on :3000
  - phase: 04-approval-bridge
    provides: approveProposal(proposalId, clickerSlackUserId) domain function (landed mid-plan, commit 2eb83c2)
provides:
  - Verified Wave-B (Phase 2 Slack + Phase 5 agent + Phase 6 dashboard) is fully on main with zero schema drift and a synced live database
  - Recorded, verbatim approve-function contract for 07-02's choose_alt handler
  - Live proof that an ordinary watched-channel message reaches the real graph and becomes a real card under AGENT_TRANSPORT=inline
  - Live proof that approveProposal creates a real Google Calendar event with a Meet link and flips the Proposal to confirmed (evidence borrowed from 04-01's own tracer row, not re-clicked in this plan)
  - LangGraph keep-or-rip decision recorded as KEEP
affects: [07-integrate-conflict-counter-proposal (07-02, 07-03), 10-demo-rehearsal]

# Actuals (#2632)
actuals:
  tokens: 6000
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Doc comments that name a forbidden import path must avoid the literal substring an automated import-graph grep checks for, or the grep false-positives on the comment itself"

key-files:
  created: []
  modified:
    - lib/agent/tasks/run-agent.ts

key-decisions:
  - "keep-or-rip=KEEP: lib/agent/graph.ts still exports all five node functions and runAgent(input) with 0 tsc errors and no LangGraph-specific failure, so the compiled StateGraph stays (no rip performed)"
  - "AGENT_TRANSPORT=inline proven live via real Prisma rows (two Friday-ask Proposals with real extracted titles and card_ts); AGENT_TRANSPORT=trigger deferred untested this plan (Trigger.dev CLI ran the whole session with zero run-agent runs recorded despite live traffic) — matches 04-02's prior human decision to defer the both-transports hand-check"
  - "Low-confidence chatter and same-text replay were not re-run live in 07-01; both are covered by 05-02's committed evidence (redelivery-safe runAgent, confidence-gate dedupe) rather than re-proven here, per coordinator decision under time pressure"
  - "Approve -> Calendar leg evidence is 04-01's own tracer Proposal (id cmty19knh0000acuzasqepz14, 'demo review sync'), not a fresh operator click in this plan — the operator did not click Approve on the Friday card before close-out"

requirements-completed: [DMO-05]

coverage:
  - id: D1
    description: "Wave-B (Slack + agent + dashboard) fully merged into main, zero schema drift, live database in sync"
    requirement: "DMO-05"
    verification:
      - kind: other
        ref: "git merge-base --is-ancestor feature/dashboard-layout main; git diff feature/dashboard-layout main -- prisma/schema.prisma (empty); bunx prisma db push (already in sync)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Approve-function contract read off disk and recorded verbatim for 07-02's choose_alt handler"
    verification:
      - kind: other
        ref: "lib/slack/approve.ts#approveProposal (commit 2eb83c2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "One ordinary watched-channel message reaches the real graph and becomes a real card (AGENT_TRANSPORT=inline)"
    verification:
      - kind: integration
        ref: "Prisma probe: Proposal rows cmty184jv... and cmty1a6ag... (title='Plan the demo next Friday'/'Meet next Friday to plan demo', confidence 0.92-1.0, non-null card_ts); zero run-agent entries in the Trigger.dev CLI log for the same window"
        status: pass
    human_judgment: true
    rationale: "No human in this session visually confirmed the rendered Slack card or dashboard row — DB-level proof is strong but the plan's own human-check step (card text, dashboard eyeball) was not exercised live"
  - id: D4
    description: "Approve click creates a real Google Calendar event with a Meet link and confirms the Proposal"
    verification:
      - kind: integration
        ref: "Prisma probe: Proposal cmty19knh0000acuzasqepz14 status=confirmed, calendar_event_id=5d1873b5...4ee1, meet_link=https://meet.google.com/xzv-hxsz-stj, via lib/slack/approve.ts#approveProposal (commit 2eb83c2)"
        status: pass
    human_judgment: true
    rationale: "This is 04-01's own tracer proof, not a fresh Approve click by the operator in this plan — the operator did not click Approve before close-out, so a human should confirm this evidence substitution is acceptable for the demo"
  - id: D5
    description: "LangGraph keep-or-rip decision taken by the fixed rule and recorded"
    verification:
      - kind: other
        ref: "grep for 5 node functions + runAgent export in lib/agent/graph.ts; bunx tsc --noEmit (0 errors)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Confidence gate (low-confidence chatter -> silent + ignored Decision) and same-text replay dedupe"
    verification: []
    human_judgment: true
    rationale: "Not re-run live in 07-01 per coordinator decision (time pressure); relying on 05-02's committed evidence for redelivery-safe dedupe and the confidence gate rather than a fresh live proof this plan"

# Metrics
duration: ~40min
completed: 2026-09-12
status: complete
---

# Phase 7 Plan 1: Merge Verification, Live Dry Run, LangGraph Keep-or-Rip Summary

**Wave-B merge confirmed intact on `main` with a synced schema; the real graph is proven live under `AGENT_TRANSPORT=inline`; Approve-to-Calendar is proven via 04-01's own tracer row; LangGraph keeps its compiled `StateGraph`.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-09-12
- **Tasks:** 3 (Task 1 full; Task 3 step 1 decided; Task 2 and Task 3's remaining steps partially evidenced, see Deviations)
- **Files modified:** 1

## Accomplishments
- Verified `main` already carries Wave B (Phase 2 Slack + Phase 5 agent + Phase 6 dashboard): `feature/dashboard-layout` is an ancestor of `main`, `05-0[123]`/`06-0[123]`/`02-0[12]` commits all present, schema diff against the Wave-B branch is empty, `bunx prisma db push` reports already-in-sync, `bunx prisma generate` clean, `bunx tsc --noEmit` clean.
- Read the real approve contract off disk after 04-01 landed mid-plan (commit `2eb83c2`): `lib/slack/approve.ts#approveProposal(proposalId: string, clickerSlackUserId: string): Promise<ApproveOutcome>`.
- Proved a real watched-channel message reaches `runAgent` and posts a real card, live, under `AGENT_TRANSPORT=inline` (two separate Friday-scheduling messages, each a real card with 0.92-1.0 confidence and a model-derived title, not stub text).
- Proved the Approve -> Calendar leg is live on `main`: Proposal `cmty19knh0000acuzasqepz14` is `status=confirmed` with a real `calendar_event_id` and `meet_link`, via `approveProposal` (04-01's own tracer, not re-clicked by the operator in this plan).
- Decided and recorded `[p7-01] keep-or-rip=KEEP`: `lib/agent/graph.ts` still exports all five node functions and `runAgent(input: RunAgentInput)`, the compiled `StateGraph` registers exactly the five expected nodes, and `tsc --noEmit` is clean with no `@langchain/langgraph` error — nothing was actively failing, so the graph was not ripped out.
- Fixed a false-positive in the plan's own import-graph guard: `lib/agent/tasks/run-agent.ts`'s doc comment named `lib/slack/bolt.ts`/`@slack/bolt` while warning against importing them, which the guard's own grep flagged as a hit. Reworded without changing meaning.

## Task Commits

Each task was committed atomically:

1. **Task 1 (deviation fix surfaced during import-graph guard check): reword Bolt-avoidance comment** - `8709913` (fix)

_Task 1's merge/schema/lockfile verification, Task 2's live dry run, and Task 3's remaining steps (transport re-check, confidence gate re-run, dashboard eyeball) produced no further code changes — see Deviations and Issues Encountered for what was proven by evidence instead of a fresh live run._

**Plan metadata:** (this commit)

## Files Created/Modified
- `lib/agent/tasks/run-agent.ts` - reworded a doc comment so the import-graph guard grep no longer false-positives on it; no behavior change, still calls the real `runAgent` from `lib/agent/graph`

## Decisions Made
- `[p7-01] keep-or-rip=KEEP` — see coverage D5.
- `AGENT_TRANSPORT=inline` proven live; `trigger` deferred untested (Trigger.dev CLI ran the entire session and logged zero `run-agent` runs despite two live messages producing cards, so traffic was clearly served inline) — accepted per 04-02's prior human decision to defer the both-transports hand-check.
- Low-confidence chatter and same-text replay were **not re-run live in 07-01**; relying on 05-02's committed evidence (redelivery-safe `runAgent`, confidence-gate dedupe) instead, per coordinator decision under time pressure.
- The Approve leg's Calendar-write evidence is 04-01's own tracer Proposal row, not a fresh Approve click by the operator — the operator never clicked Approve on the Friday card before close-out was ordered.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Import-graph guard false-positived on its own warning comment**
- **Found during:** Task 2's import-graph guard check (`grep -rnE '@slack/bolt|slack/bolt' lib/agent lib/ai`)
- **Issue:** `lib/agent/tasks/run-agent.ts`'s doc comment literally named `lib/slack/bolt.ts` and `@slack/bolt` while warning against importing them, so the plan's own automated guard matched the comment, not a real import.
- **Fix:** Reworded the comment to describe the same danger without the literal substring; no logic change.
- **Files modified:** `lib/agent/tasks/run-agent.ts`
- **Verification:** Guard command re-run, prints nothing (pass).
- **Committed in:** `8709913`

---

**Total deviations:** 1 auto-fixed (1 blocking-guard false positive)
**Impact on plan:** Cosmetic fix only; no behavior change to the dispatch/graph wiring.

### Not fixed — pre-existing, out of scope

- `bunx --bun @biomejs/biome check .` reports ~44 "format" errors across the whole repo (pre-existing, unrelated to this plan's changes). Confirmed via `git diff --stat` (empty against `HEAD` for every flagged file) and a byte/md5 comparison on a sample file that this is a Windows `core.autocrlf=true` checkout artifact (working tree CRLF vs. committed LF), not real content drift. Attempted a one-line `biome.json` fix (`lineEnding: "crlf"`) and reverted it — it only matches this one machine's local git setting and would break the check on a checkout without `autocrlf`. Left unfixed and documented here; not re-run per coordinator's final instruction.

## Issues Encountered
- **`bun.lock` staleness trigger fired but no real change resulted.** `package.json`'s last real commit (`5a88fdd`) postdates `bun.lock`'s (`99937ab`), so `bun install` was run per this plan's own rule; it reported "no changes" and the regenerated lockfile is byte-identical to `HEAD` (confirmed via `git diff`), so no lockfile commit was needed.
- **Concurrent session activity on the shared main tree.** Throughout this plan, another session (04-01, then general demo-prep traffic) actively wrote to `lib/slack/**` and posted unrelated test messages ("Nudge: Sam — send the updated deck", "04-01 tracer: demo review sync") into the same watched Slack channel used for this plan's dry run. Per this plan's explicit file-ownership rule, none of `lib/slack/approve.ts`, `lib/slack/handlers/approve-proposal.ts`, `lib/slack/handlers/reject-proposal.ts`, or `lib/slack/blocks.ts` were read as final, edited, or staged until 04-01's landing commit (`2eb83c2`) was confirmed in git history.
- **Same-text "replay" edge case reinterpreted, not failed.** Two textually-identical Slack messages ("Let's meet next Friday at 11am to plan the demo") posted as separate events produced two separate Proposals, not one. Read `lib/agent/dedupe.ts#computeDedupeKey`: the dedupe key is intentionally keyed on the message's own Slack `ts` (redelivery-safety per AGT-09/05-02), not on message content — so two distinct human-authored posts of the same sentence are, by design, two distinct Proposals. This is not a bug; it does mean this plan's literal "replay" edge case (same text twice -> one Proposal) does not hold for two independently-typed messages, only for an actual redelivery of the same Slack event. Flagged for whoever owns the demo script: if the "replay" beat is performed live, use an actual Slack message-edit/resend of the identical event, not a freshly typed duplicate.
- **Trigger.dev CLI ran the whole session with only file-watcher rebuilds, never a triggered run** — this is the evidence `AGENT_TRANSPORT=inline` was live throughout, not a CLI malfunction.
- **Operator did not click Approve** on the live Friday card before this plan was closed out; the Approve->Calendar leg is evidenced by 04-01's own tracer row instead (see coverage D4 and its rationale — a human should confirm this substitution is acceptable).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `main` is merge-verified, schema-synced, and the real graph/dashboard/calendar path is proven live (modulo the Approve leg being evidenced rather than freshly clicked) — 07-02's conflict work and 07-03's optional scan can build on it without re-doing this plan's checks.
- 07-02 (clash detection + CFL-05) has already merged to `main` at `45f7cce` and has its own `07-02-SUMMARY.md`.
- Bolt is currently **not running** (will be restarted for Phase 10). The Trigger.dev dev CLI I started in this plan (background, log at `C:/Users/RonaldCheng/AppData/Local/Temp/claude/p7-01/trigger-dev.log`) is still up; whoever resumes should decide whether to leave it running or stop it before Phase 10's rehearsal.
- Outstanding, flagged for a human: the Approve leg was proven by borrowed evidence (04-01's own tracer row), not a fresh operator click on the Friday demo card in this plan. If the actual demo rehearsal needs a freshly-clicked Approve on that specific card, that has not yet happened.
- `bunx --bun @biomejs/biome check .`'s pre-existing ~44 CRLF-related findings are unresolved (documented above as out-of-scope); a future pass on a non-Windows-autocrlf checkout (or a `.gitattributes` addition) would settle this permanently without touching biome.json.

---
*Phase: 07-integrate-conflict-counter-proposal*
*Completed: 2026-09-12*
