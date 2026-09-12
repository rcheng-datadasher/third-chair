---
phase: 05-agent-confidence-gate
plan: 03
subsystem: slack
tags: [slack, block-kit, modal, bolt, confidence-gate]

requires:
  - phase: 05-agent-confidence-gate
    provides: 05-01's graph/rubric, 05-02's redelivery safety and ActionItems
provides:
  - Edit & approve card variant + band-selected poster in proposeNode
  - Prefilled edit-proposal modal, views.open listener, view_submission handler
affects: [07-integrate-conflict-counter-proposal]

actuals:
  tokens: 26000
  tasks: 3
  commits: 6
plan_head_before: e700701dbe35b9a0a70c44bd749c73a051994e06

tech-stack:
  added: []
  patterns: ["poster-selected-by-band in one call site", "re-derive from Postgres, never resume from private_metadata"]

key-files:
  created:
    - lib/slack/post-edit-approve-card.ts
    - lib/slack/handlers/edit-approve-proposal.ts
    - lib/slack/handlers/edit-approve-submission.ts
  modified:
    - lib/slack/blocks.ts
    - lib/slack/bolt.ts
    - lib/agent/graph.ts

key-decisions:
  - "Built AGT-05's modal path per the PLAN (05-03-PLAN.md), which predates 05-CONTEXT.md's later 'Pre-applied scope cut' lines 100-102. The coordinator first ordered a revert per that locked cut (tagged p5-edit-modal at 7be6ad9, reverted in 36a1dcb+c1afc18), then the user overrode the cut and asked to keep the modal — un-reverted via db8947e+f86fd91 (git revert of the revert commits, no history rewrite). Net effect: modal path is live; tag p5-edit-modal still points at the pre-override state for reference."
  - "Task 3's live Slack modal round trip (button click -> modal open -> submit -> card update -> Approve click) is DEFERRED to post-R1-merge UAT. Phase 2 owns the sole Bolt process this round (D-26) and this executor must never start one; the interactive steps need a live Socket Mode connection. The automated portions (exit-run table, one Decision per sample, three visible branches, tsc/Biome/append-only gates) are accepted now per the coordinator."
  - "reject_proposal button (added to buildEditApproveBlocks per the plan's own verify contract) has no registered handler in this worktree — Phase 2's richer card / reject flow hasn't merged into this parallel branch. Surfaced, not fixed here; Phase 2's merge supplies it."
  - "updateProposalCard (Phase 1) always renders the confirmed chip with no pending branch in this branch's version, so handleEditApproveSubmission re-renders via slackClient.chat.update + buildApprovalBlocks directly (the plan's own anticipated fallback), not via updateProposalCard."

requirements-completed: [AGT-04, AGT-05, AGT-06, AGT-07]

coverage:
  - id: D1
    description: "Medium-band run posts an Edit & approve card (no one-click approve); high-band run still posts the ordinary approve/reject card"
    requirement: AGT-04
    verification:
      - kind: integration
        ref: "live Slack post via slackClient (2 medium + 2 high samples) + conversations.history check for action ids"
        status: pass
    human_judgment: false
  - id: D2
    description: "Edit & approve modal opens prefilled from the live Proposal row; submitting it validates, updates only title/start/end, and re-renders the same message with no calendar write"
    requirement: AGT-05
    verification:
      - kind: integration
        ref: "direct handleEditApproveSubmission() calls against the real DB (empty-title reject, valid mention-markup submission)"
        status: pass
    human_judgment: true
    rationale: "The direct-call verify proves the handler's logic against a synthesized view payload, but the live button-click -> views.open -> user types -> submit round trip inside Slack itself is deferred to post-R1-merge UAT (Bolt is owned by Phase 2 during R1); a human must confirm the real click path once Bolt is live on merged main."
  - id: D3
    description: "The sample set lands on three visibly different branches (approve/reject card, Edit & approve card, silence) with exactly one Decision row each"
    requirement: "AGT-06, AGT-07"
    verification:
      - kind: integration
        ref: "exit-run script, 6 samples, printed table below"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-09-12
status: complete
---

# Phase 5 Plan 3: Edit & approve card, modal round trip, and the phase exit run Summary

The medium confidence band now posts a distinct Edit & approve card whose modal writes back to the live Proposal row and re-renders the same message; the live in-Slack button-click round trip is deferred to post-merge UAT since this executor may not run Bolt during R1.

## Performance

- **Duration:** 70 min (includes a revert-then-restore cycle — see Deviations)
- **Tasks:** 3 (Task 3's automated portion complete; interactive portion deferred)
- **Files modified:** 6 (3 new, 3 modified)

## Exit-run table (accepted evidence for Task 3, no Bolt required)

| # | Text | Expected | Decisions | Verdict | Confidence | Branch |
|---|---|---|---|---|---|---|
| 0 | Lets have a talk next Friday at 11am | high | 1 | acted | 0.92 | approve/reject card |
| 1 | Can we sync Monday at 10am? | high | 1 | acted | 0.92 | approve/reject card |
| 2 | Lets meet on Thursday to discuss the roadmap | medium | 1 | acted | 0.55 | edit & approve card |
| 3 | Lets meet tomorrow to go over the deck | medium | 1 | acted | 0.65 | edit & approve card |
| 4 | haha that meme is great | low | 1 | ignored | 0.05 | silent |
| 5 | Good morning everyone! | low | 1 | ignored | 0.05 | silent |

All three branches present, one Decision row per sample, confidence + reason on every row (ROADMAP success criteria 1 and 2).

## Task Commits

1. **Task 1: Edit & approve card variant + band-selected poster** - `7333427` (feat)
2. **Task 2: modal round trip — listener, handler, registrations** - `7be6ad9` (feat)
3. **Coordinator-ordered revert per 05-CONTEXT's locked scope cut** - `36a1dcb`, `c1afc18` (revert)
4. **User override — keep the modal, un-revert** - `db8947e`, `f86fd91` (revert-of-revert)

`git diff --stat p5-edit-modal HEAD -- lib/slack lib/agent` is empty — the restored code is byte-identical to what tag `p5-edit-modal` (at `7be6ad9`) recorded.

## Files Created/Modified
- `lib/slack/blocks.ts` (append-only) — `buildEditApproveBlocks`, `EDIT_APPROVE_MODAL_CALLBACK_ID`, `buildEditProposalModal`
- `lib/slack/post-edit-approve-card.ts` (new) — `postEditApproveCard`, signature-identical to `postProposalCard`
- `lib/slack/handlers/edit-approve-proposal.ts` (new) — `handleEditApproveProposal`
- `lib/slack/handlers/edit-approve-submission.ts` (new) — `handleEditApproveSubmission`, `EditModalFieldsSchema`
- `lib/slack/bolt.ts` (append-only) — two new registrations
- `lib/agent/graph.ts` — `proposeNode` selects poster by `state.band`

**Modal field set:** `title_block`/`title_input` (plain_text_input), `date_block`/`date_input` (datepicker), `time_block`/`time_input` (timepicker), `duration_block`/`duration_input` (plain_text_input), plus a read-only participants context line. `private_metadata` = `{ proposalId }` only, 42 characters in the live test.

**Re-render route used:** the local `slackClient.chat.update(...)` + `buildApprovalBlocks(updated)` fallback — `updateProposalCard` (Phase 1) always renders the confirmed chip in this branch's version (no `pending` branch to reuse), matching the plan's own anticipated contingency.

## Decisions Made
See `key-decisions` in frontmatter.

## Deviations from Plan

**1. [Rule 4-adjacent — coordinator-directed] Revert, then user override, then restore.** 05-CONTEXT.md's "Pre-applied scope cut" (lines 100-102) locks a decision to drop AGT-05 entirely; 05-03-PLAN.md predates that cut and builds it anyway. The coordinator first ordered a revert to honor the locked cut (tag `p5-edit-modal` at `7be6ad9`, then `git revert --no-edit 7be6ad9 7333427`). Before the SUMMARY was written, the user explicitly overrode the cut and asked to keep the modal, so the two revert commits were themselves reverted (`git revert --no-edit c1afc18 36a1dcb`) — no history rewrite, no `reset --hard`, at any point. Net: the modal path is live on this branch; the four extra commits are a permanent, honest record of the back-and-forth.

**2. [Rule 3 - blocking, carried from Task 1] `reject_proposal` button has no handler.** `buildEditApproveBlocks` includes a Reject button (the plan's own verify requires the action id in the rendered output), but no `app.action("reject_proposal", …)` registration exists in this worktree — Phase 2's richer card and reject flow haven't merged into this parallel branch. The button is visually present and inert until Phase 2/4 merge supplies the handler.

**3. [process] Task 3's interactive Slack round trip deferred.** Steps 4-9 of the plan's Task 3 checklist (click Edit & approve, submit the modal, click Approve) require a live Bolt Socket Mode connection. Phase 2 owns the sole Bolt process during this R1 round, and this executor must never start one. The automated exit-run table above stands as the accepted evidence for this round; the coordinator will route the live click-through to post-R1-merge UAT.

---

**Total deviations:** 3 (1 coordinator-directed scope reversal, 1 carried blocking gap, 1 process deferral). **Impact:** none on shipped code correctness — every automated verify in Tasks 1 and 2 passed before and after the revert/restore cycle.

## Issues Encountered
None beyond the deviations above.

## User Setup Required
None.

## Self-Check: PASSED

- `[ -f lib/slack/post-edit-approve-card.ts ]`, `[ -f lib/slack/handlers/edit-approve-proposal.ts ]`, `[ -f lib/slack/handlers/edit-approve-submission.ts ]` — all FOUND
- `git log --oneline --all --grep="05-03"` returns 2 commits (`7333427`, `7be6ad9`); the revert/restore commits are additionally visible in `git log --oneline` — FOUND
- `git diff --stat p5-edit-modal HEAD -- lib/slack lib/agent` — empty, confirms restore is byte-identical
- `git diff --stat 0135dad HEAD -- lib/slack` — non-empty (modal code is present, as intended after the override)
- Re-ran `tsc --noEmit` (clean except the pre-existing, unrelated `app/layout.tsx` error) and the append-only/scope grep gates after the restore — all pass
- `commits: 6` measured via `git rev-list --count e700701..HEAD`, matches `plan_head_before`
