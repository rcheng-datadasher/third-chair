---
phase: 07-integrate-conflict-counter-proposal
plan: 02
subsystem: agent
tags: [conflict-detection, langgraph, slack-blocks, cut-line, cfl-05]

requires:
  - phase: 05-agent-confidence-gate
    provides: the compiled 5-node graph (extract/classify/resolveTime/checkConflicts/propose) this plan fills in
  - phase: 03-calendar-integration (assumed, read-only)
    provides: checkConflicts (freebusy.query) and toHktRfc3339
provides:
  - lib/agent/overlap.ts (rangesOverlap, findClash) — the single overlap predicate
  - lib/agent/conflict.ts (hktWorkingDayWindow, collectBusyBlocks, summarizeClash)
  - real checkConflictsNode body + a conflict branch in proposeNode (lib/agent/graph.ts)
  - lib/slack/conflict-blocks.ts (buildConflictWarningBlocks) — deviation location, see below
  - lib/slack/post-conflict-card.ts (postConflictCard, WebClient-only poster)
affects: [07-03-optional-secretary-scan, 08-optional-s2-commitment-ledger]

actuals:
  tokens: 4200
  tasks: 1
  commits: 1
plan_head_before: 20453e65288188e9141b3135610068efb3132b5f

tech-stack:
  added: []
  patterns:
    - "sibling poster file per card variant (post-conflict-card.ts), matching Phase 5's post-edit-approve-card.ts precedent"
    - "conflict-card block builders live in a sibling file (conflict-blocks.ts), not blocks.ts, to avoid a concurrent-worktree merge conflict with 04-01"

key-files:
  created:
    - lib/agent/overlap.ts
    - lib/agent/conflict.ts
    - lib/slack/conflict-blocks.ts
    - lib/slack/post-conflict-card.ts
  modified:
    - lib/agent/graph.ts

key-decisions:
  - "D-18's 14:15 hard cut line was evaluated with the real system clock (not the session's narrative time) at the start of Task 2 and had already fired (14:52 HKT observed via Node's Intl.DateTimeFormat, since Git Bash's `date` on this Windows host does not honor TZ) — Task 2 (CFL-02, the MODEL_SMART two-alternative call) was NOT started, per the plan's own explicit gate instruction, even though the orchestrator's stated objective asked for Tasks 1 and 2. This is a deliberate deviation from the objective in favor of the plan's own must_haves.truths (D-18) — flagged prominently for the orchestrator."
  - "Task 3 was independently gated off for a second, unrelated reason: lib/slack/handlers/approve-proposal.ts still only flips status to confirmed and calls updateProposalCard — it is Phase 2's placeholder approve, not 04-01's real Approve -> Calendar write. 04-01's approve-contract line does not exist yet. Per reality-adjustment #5, Task 3's real code (choose-alt.ts, bolt.ts registration) was not written."
  - "buildConflictWarningBlocks was placed in a new lib/slack/conflict-blocks.ts rather than lib/slack/blocks.ts, per reality-adjustment #2 (04-01 owns blocks.ts concurrently this round). It imports buildApprovalBlocks and escapeMrkdwn from blocks.ts read-only."
  - "Biome's directory-wide --write on `lib/agent lib/slack` reformatted ~20 files this executor never intended to touch (import order/line endings on files owned by other in-flight worktrees, e.g. lib/slack/bolt.ts, lib/slack/handlers/*). All were reverted via targeted `git checkout --` before staging; only the 5 files listed above were committed."

requirements-completed: [CFL-01, CFL-05]

coverage:
  - id: D1
    description: "rangesOverlap/findClash: half-open overlap rule, both touching directions return false, a genuine overlap and a UTC-expressed busy block both return true, first clashing block is returned"
    requirement: CFL-01
    verification:
      - kind: unit
        ref: "bun -e overlap probe (6 checks: touchBefore, touchAfter, real, utcSide, empty, hit)"
        status: pass
    human_judgment: false
  - id: D2
    description: "hktWorkingDayWindow: in-hours request yields the day's 09:00-19:00 HKT window; out-of-hours request widens to cover itself; every bound carries +08:00"
    requirement: CFL-01
    verification:
      - kind: unit
        ref: "bun -e window probe (w1/w2 checks)"
        status: pass
    human_judgment: false
  - id: D3
    description: "collectBusyBlocks: real freebusy.query call against the live calendar-connected user plus pending-Proposal union, logging [conflict] window/busy= — run once against live Postgres+Google as a read-only probe (not via a live Slack-triggered agent run)"
    requirement: CFL-01
    verification:
      - kind: integration
        ref: "bun -e probe: collectBusyBlocks({teamId: T0C1B9HPRCG, ...}) -> busy=5, includes pending 'Talk'/'Team sync' rows; freebusy.query returned [] (no confirmed calendar event yet, since 07-01's approval hadn't landed at probe time)"
        status: pass
    human_judgment: true
    rationale: "The probe proves the function's real DB/API wiring, but not the full seeded demo beat (B's actual 10:30 Slack message through the live graph) — that live fire-and-observe step is deferred to the orchestrator post-merge, per reality-adjustment #4."
  - id: D4
    description: "checkConflictsNode/proposeNode: node count stays at exactly 5 (checkConflicts/classify/extract/propose/resolveTime), no path under app/components/lib/calendar touched, tsc --noEmit and Biome clean on the 5 changed files"
    requirement: "CFL-01, AGT-10"
    verification:
      - kind: unit
        ref: "grep addNode gate (5 names match), git status --porcelain app components lib/calendar (empty), bunx tsc --noEmit (clean except pre-existing unrelated app/layout.tsx error), biome check (clean)"
        status: pass
    human_judgment: false
  - id: D5
    description: "CFL-05 degraded warning card: names the clashing block, reuses Phase 2's Approve/Reject buttons verbatim via buildApprovalBlocks"
    requirement: CFL-05
    verification:
      - kind: unit
        ref: "grep gates: buildConflictWarningBlocks exports, buildApprovalBlocks/buildConfirmedBlocks still both present in blocks.ts, no bolt import in post-conflict-card.ts/conflict-blocks.ts"
        status: pass
    human_judgment: true
    rationale: "The card's actual rendered appearance in Slack (readable on a projector, names the right block) is an eyeball check — deferred to the orchestrator post-merge along with the live [conflict] window/clash log lines from a real Slack-triggered run."

duration: ~20min
completed: 2026-09-12
status: complete
---

# Phase 7 Plan 2: Clash detection + CFL-05 warning card (Task 1 only) Summary

Task 1 shipped in full — clash detection (`rangesOverlap`/`findClash`, the day-window busy-set union, and the CFL-05 static warning card reusing Phase 2's Approve/Reject buttons verbatim). Task 2 (the `MODEL_SMART` two-alternative upgrade) was **not started**: the plan's own D-18 hard cut-line gate (14:15 HKT) had already fired (real clock read 14:52 HKT) when Task 2's mandatory first action ran that check. Task 3 was independently blocked: 04-01's real Approve → Calendar function has not landed yet.

## IMPORTANT — deviation from the stated objective

The orchestrator's objective for this run was "Execute Tasks 1 and 2... Task 3 only if its gate opens." Task 2 was **not executed**. This plan's own Task 2 action step 1 (D-18) reads: *"Cut-line gate — run this first. Print the wall clock with `TZ=Asia/Hong_Kong date +%H:%M`. If it is at or past 14:15, STOP: do not start this task."* Running that exact check (via Node's `Intl.DateTimeFormat`, since Git Bash's `date` on this Windows host silently ignores `TZ` and prints UTC) returned **14:52 HKT** — past both the 14:15 cut and the 14:45 phase-end. Per D-18/D-19 (locked decisions, not discretionary) and the plan's own `must_haves.truths` ("the 14:15 cut is a stop point, never an unbuilt branch"), Task 2 was skipped and this plan stops at Task 1's CFL-05 degraded form. This directly contradicts the stated objective's request for Task 2 — flagging this prominently rather than silently picking one instruction over the other. **The orchestrator should decide whether to re-run Task 2 in a follow-up plan** (the D-18 cut, correctly applied, means CFL-02/03 were never attempted this round at all, not merely deferred mid-flight).

## Performance

- **Duration:** ~20 min
- **Tasks:** 1 of 3 completed (Task 1). Task 2 not started (D-18 cut). Task 3 not written (see below).
- **Files created:** 4. **Files modified:** 1.

## Cut-line gate evidence (D-18)

- Real wall clock at Task 2's gate check: **14:52 HKT** (`node -e` `Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Hong_Kong', ...})` against the live system clock; UTC was `2026-09-12T06:52:09.948Z`).
- `TZ=Asia/Hong_Kong date +%H:%M` in this Git-Bash-on-Windows environment printed `06:52` (ignores `TZ`, prints UTC) — the Node probe is the trustworthy reading and is what the gate decision was made on.
- Per D-18: Task 2 (CFL-02) not started. CFL-05 (Task 1's warning card) is the final, shipped form of the conflict feature for this plan.

## Accomplishments (Task 1 only)

- `lib/agent/overlap.ts`: `rangesOverlap(aStart, aEnd, bStart, bEnd)` (half-open, end-exclusive) and `findClash(requestedStart, requestedEnd, busy)` — the single overlap comparison in the repo.
- `lib/agent/conflict.ts`: `hktWorkingDayWindow` (09:00-19:00 HKT, widens to cover an out-of-hours request), `collectBusyBlocks` (freebusy.query ∪ pending-Proposal union, excluding rows that already carry `alternatives`), `summarizeClash`.
- `lib/agent/graph.ts`: real `checkConflictsNode` body (logs `[conflict] window`/`[conflict] busy=`/`[conflict] clash`), and a clash branch in `proposeNode` that posts the conflict card instead of the band-selected card when `findClash` finds a hit. Node count unchanged at 5.
- `lib/slack/conflict-blocks.ts` (new file, deviation — see below): `buildConflictWarningBlocks(p, clashSummary)`, prepending a warning section to Phase 2's `buildApprovalBlocks(p)` output so Approve/Reject are reused verbatim.
- `lib/slack/post-conflict-card.ts`: `postConflictCard(proposal, variant)` — a `{ kind: "warning"; clashSummary }` variant this task, posts via the WebClient singleton, no Bolt import. The variant type is written so Task 2 (whenever it runs) adds an `"alternatives"` member without changing this file's shape.

## Logged `[conflict] window` line (evidence, from an offline probe — see caveat below)

```
[conflict] window timeMin=2026-09-18T09:00:00+08:00 timeMax=2026-09-18T19:00:00+08:00
[freebusy] request {"timeMin":"2026-09-18T09:00:00+08:00","timeMax":"2026-09-18T19:00:00+08:00","timeZone":"Asia/Hong_Kong","items":[{"id":"primary"}]}
[freebusy] response raw []
[freebusy] response hkt []
[conflict] busy=5
```

**Caveat:** this was produced by calling `collectBusyBlocks` directly in a `bun -e` probe against the live DB/Google Calendar (read-only), not by a live Slack-triggered `runAgent` run through the graph — no live Slack/Bolt activity was performed from this worktree (reality-adjustment #4). Both bounds carry `+08:00` (success criterion 3, D-10) — confirmed. `freebusy.query` returned an empty `busy` array for the calendar owner at probe time (07-01's Friday 11:00 approval had not yet landed on the calendar when this probe ran); the 5 busy blocks came entirely from the pending-Proposal union (concurrent test data from other in-flight sessions, e.g. rows titled "Talk"/"Team sync" around 11:00 and 15:00 HKT on Fri 18 Sep).

## Deferred live checks (not run from this worktree — reality-adjustment #4)

- Firing B's actual seed message (`Can we talk Friday at 10:30? Need about an hour`) through live Slack and observing the posted card (Task 1 steps 6-7).
- The third automated verify in Task 1 (querying the two newest Proposal rows for `card_ts`/`status`/duration ≥45min from a *live* fired message) — not run; no such message was posted this session.
- The human-check in Task 1's `<verify>` (eyeballing the card in the watched channel and the terminal's `[conflict]` lines from a live run).
- `extracted duration_minutes` / FA-1 seed-wording evidence — N/A, no live message was sent.

All of the above require a live Bolt/Slack round trip and are explicitly deferred to the orchestrator after merge, per the reality-adjustments given to this run.

## CFL-02/CFL-03 status (Task 2/3 not executed)

- **Task 2 (CFL-02):** not started — D-18 cut fired (see above). No `lib/agent/conflict-schema.ts`, no `proposeAlternatives`, no `MODEL_SMART` call, no `alternatives` persistence, no `[conflict] retry`/`[conflict] patched` lines (none possible — the code path doesn't exist yet).
- **Task 3 (CFL-03/CFL-04):** not written, for two independent reasons: (1) the D-18 cut already means there are no alternatives to choose between; (2) `lib/slack/handlers/approve-proposal.ts` is still Phase 2's placeholder (`status: "confirmed"` + card update only — no Google Calendar write, no Meet link, no organizer claim) — 04-01's real Approve → Calendar function has not landed, so the `[p7-01] approve-contract=` line Task 3 is supposed to be written against does not exist. Per reality-adjustment #5, Task 3's real code (`lib/slack/handlers/choose-alt.ts`, the `bolt.ts` registration) was correctly **not** written.
- Task 3's cut-branch steps: step 4b (the degraded dry run: seed message -> warning card -> Approve click -> confirmed chip) requires a live Bolt process and was **not run** from this worktree (one-Bolt rule; the operator's terminals own the process). Step 5 (mandatory `/ponytail-review`) was run in a time-boxed pass — see below.

## `/ponytail-review` (DMO-05, D-22) — time-boxed pass, findings only, not fixed

Reviewed only this plan's own diff (Task 1's single commit, 5 files) — not the full merged Phase 7 diff, since 07-01 and 04-01 are still in flight in other sessions and haven't merged yet. **The orchestrator must still run a full-merged-diff `/ponytail-review` pass after all Phase 7 worktrees land**, per D-22's "whole build" scope; this pass only covers what this worktree shipped.

Findings (recorded, not fixed — reality-adjustment #6):
1. **P2002-replay self-conflict edge case (not fixed).** `checkConflictsNode` re-runs on every graph invocation, including a P2002-triggered retry of the *same* message. On a retry, the Proposal this same message already created now exists as a `pending` row and would appear in `collectBusyBlocks`'s pending-Proposal union, potentially registering as a "clash" against itself. This is analogous to the redelivery races 05-02 already ponytail-accepted (concurrent-read races); not fixed here, flagged as a known shortcut for `/ponytail-debt`.
2. **`summarizeClash` repeats the full date on both sides** (e.g. "Fri, Sep 18, 2026, 15:00 - Fri, Sep 18, 2026, 15:30") — cosmetic only, not fixed.
3. **`collectBusyBlocks` runs a fresh `user.findFirst` calendar-owner lookup on every call** — cheap at this data volume (single-digit rows), not fixed; would want caching if this ever ran per-message at scale.

No architectural or security findings. Everything else in the diff (overlap predicate, window widening, union query, card builder location) reviewed clean.

## Deviations from Plan

### Auto-fixed / process deviations

**1. [Process] `buildConflictWarningBlocks` placed in a new `lib/slack/conflict-blocks.ts`, not `lib/slack/blocks.ts`.**
- **Reason:** reality-adjustment #2 — 04-01 owns `lib/slack/blocks.ts` concurrently this round; editing it here would guarantee a merge conflict.
- **Fix:** new sibling file, importing `buildApprovalBlocks`/`escapeMrkdwn`/`ApprovalCardInput` from `blocks.ts` read-only. `postConflictCard` imports from this new file.
- **Files:** `lib/slack/conflict-blocks.ts` (new), `lib/slack/post-conflict-card.ts`.
- **Verification:** `git diff --stat` against `blocks.ts` shows zero changes after the fix; the plan's own grep acceptance check (`export function buildConflictWarningBlocks` in `blocks.ts`) was correspondingly re-pointed at `conflict-blocks.ts` for this run.
- **Commit:** `0a65133`.

**2. [Rule 3-adjacent — self-caught, no code impact] Directory-wide Biome `--write` reformatted ~20 unrelated files.**
- **Found during:** Task 1 step 8 (`bunx --bun @biomejs/biome check --write lib/agent lib/slack`).
- **Issue:** running Biome's `--write` over the whole `lib/agent`/`lib/slack` trees reformatted files this plan never touches (e.g. `lib/slack/bolt.ts`, every handler under `lib/slack/handlers/`, `lib/agent/dedupe.ts`, `lib/agent/dispatch.ts`) — import-order/line-ending normalization only (confirmed via `git diff --stat`, zero real line changes on all but one; `.impeccable/hook.cache.json` also picked up an unrelated session-cache truncation). Left uncommitted, these would have created spurious merge noise against other in-flight worktrees (04-01, 07-01, 07-03) that also touch those files.
- **Fix:** reverted all of them via targeted `git checkout -- <file>` before staging; re-ran Biome scoped to only the 5 files this plan actually changed.
- **Files reverted (not committed):** `lib/agent/dedupe.ts`, `lib/agent/dispatch.ts`, `lib/agent/extract-intents.ts`, `lib/agent/tasks/run-agent.ts`, `lib/slack/bolt.ts`, `lib/slack/build-slack-message.ts`, `lib/slack/client.ts`, `lib/slack/dispatch-slack-message.ts`, `lib/slack/fetch-channel-context.ts`, all of `lib/slack/handlers/*.ts`, `lib/slack/list-human-channel-members.ts`, `lib/slack/post-edit-approve-card.ts`, `lib/slack/post-proposal-card.ts`, `lib/slack/resolve-email.ts`, `lib/slack/update-proposal-card.ts`.
- **Verification:** `git status --short` after revert shows only the 5 intended files plus environment noise (`bun.lock`, `.impeccable/hook.cache.json`, both left unstaged).
- **Commit:** none needed (reverted before staging; never committed).

---

**Total deviations:** 2 (1 file-location process deviation, 1 self-caught tooling-scope correction). **Impact:** none on shipped code correctness; both are process/location corrections that keep this worktree's diff scoped to its own files.

## Verify-command caveat (grep false positive, not a real violation)

The plan's own scope-guard grep (`! grep -rnE '@slack/bolt|slack/bolt' lib/agent lib/ai --include=*.ts`) matches a **TSDoc comment** in the pre-existing `lib/agent/tasks/run-agent.ts` (04-02, untouched by this plan) that says *"never import... from `lib/slack/bolt.ts`"* — the comment itself contains the forbidden string. Confirmed via a real-import-only grep (`^import` lines only) that no actual Bolt import exists anywhere in `lib/agent`/`lib/ai`. Not a violation; a plan-authored grep limitation.

## Issues Encountered

None beyond the deviations and the D-18 cut documented above.

## User Setup Required

None.

## Next Phase Readiness

- Task 2 (CFL-02, `MODEL_SMART` two-alternative counter-proposal) is **fully unstarted** — not partially built, not to be resumed mid-function. A follow-up plan/session should re-run Task 2's action steps from scratch against the code this plan shipped (`lib/agent/overlap.ts`/`conflict.ts`/`graph.ts`'s clash branch are all ready inputs).
- Task 3 needs 04-01's real Approve → Calendar function to land and its `[p7-01] approve-contract=` line to exist in `07-01-SUMMARY.md` before `choose-alt.ts` can be written against a real signature.
- A full-merged-diff `/ponytail-review` (DMO-05, D-22) is still owed once 07-01/04-01/07-02(-continued)/07-03 have all merged to `main` — this plan's pass covered only its own single commit.

## Self-Check: PASSED

- `[ -f lib/agent/overlap.ts ]`, `[ -f lib/agent/conflict.ts ]`, `[ -f lib/slack/conflict-blocks.ts ]`, `[ -f lib/slack/post-conflict-card.ts ]` — all FOUND
- `git log --oneline --all --grep="07-02"` returns 1 commit (`0a65133`) — FOUND
- Task 1's acceptance criteria re-verified green: overlap probe (6/6), window probe (2/2), node-registration count (5, unchanged), scope guard (`app`/`components`/`lib/calendar` untouched), `bunx tsc --noEmit` clean (excluding the pre-existing, unrelated `app/layout.tsx` error), Biome clean on the 5 changed files
- `commits: 1` measured via `git rev-list --count 20453e6..HEAD`, matches `plan_head_before`
