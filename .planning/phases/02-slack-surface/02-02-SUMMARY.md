---
phase: 02-slack-surface
plan: 02
subsystem: slack
tags: [slack, block-kit, table-block, rich-text, chat-update, users-info]

requires:
  - phase: 02-slack-surface
    provides: "02-01's registration-only bolt.ts, dispatch seam, watched-channel/app_mention/shortcut/secretary handlers"
provides:
  - Real Block Kit approval card (table facts + rich_text participants/why), posted as a thread reply
  - chat.update status-driven in-place edit (confirmed/dismissed/already_scheduled), pending-only conditional transition on both buttons
  - users.info email resolution (SLK-08), wired into the card's participant loader
  - listHumanChannelMembers and fetchChannelContext data helpers for Phase 5
affects: [04-organizer-claim, 05-real-extraction, 07-integrate-conflict-counter-proposal]

actuals:
  tokens: 11000
  tasks: 5
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Block Kit table block (Slack 2025 addition) for scalar facts — verified accepted via a live API probe before committing"
    - "rich_text/rich_text_list/rich_text_quote for participants and why — text/user elements render literally, no mrkdwn escaping needed"
    - "Ephemeral DecisionInfo (decidedByUserId/decidedAt) passed through the click payload at decision time, never persisted (no schema change)"

key-files:
  created:
    - lib/slack/handlers/reject-proposal.ts
    - lib/slack/resolve-email.ts
    - lib/slack/build-slack-message.ts
    - lib/slack/fetch-channel-context.ts
    - lib/slack/list-human-channel-members.ts
  modified:
    - lib/slack/blocks.ts
    - lib/slack/post-proposal-card.ts
    - lib/slack/update-proposal-card.ts
    - lib/slack/handlers/approve-proposal.ts
    - lib/slack/handlers/watched-channel-message.ts
    - lib/slack/bolt.ts

key-decisions:
  - "users.info scope probe (Task 1 Step 1): real call against seed user B returned {ok:true, hasEmail:true} — both users:read and users:read.email confirmed on the installed token, no dashboard fix needed"
  - "Confidence scale confirmed as Phase 1's 0-1 fraction (HARDCODED_CONFIDENCE=0.75); card renders Math.round(confidence*100)%"
  - "updateProposalCard's channel/ts params widened to accept null (the one additive contract change; arity and parameter order unchanged)"
  - "Chip copy: pending 🟡, confirmed ✅ (closer: 'Confirmed by @who · HKT time'), dismissed ⛔ (closer: 'Dismissed by @who · HKT time'), already_scheduled 📅"
  - "User-requested redesign (2b/2c, beyond the original plan): no header block, addressee context line, table block for facts (live-API-probe-verified), rich_text participants/why with bold labels and real empty states, thread-reply posting, Reject confirm dialog"
  - "Bolt restart protocol corrected mid-plan: taskkill //F //T //PID <bunx-pid> kills the whole bunx→node→node chain in one call; killing without /T leaves the real Bolt process (a node.exe child) running as an orphan, which is how a 6-instance leak occurred earlier in 02-01. Every restart in 02-02 verified exactly one bunx.exe survived, stable across several seconds, before returning a checkpoint."

requirements-completed: [SLK-04, SLK-05, SLK-06, SLK-08]

coverage:
  - id: D1
    description: "Approval card shows title, HKT time, duration, participants (real mentions), confidence, both buttons"
    requirement: SLK-05
    verification:
      - kind: manual_procedural
        ref: "Task 1 + 2b/2c human-checks: card content confirmed live in Slack across three design iterations"
        status: pass
    human_judgment: true
    rationale: "Visual card content and Block Kit rendering require a human to see it in Slack"
  - id: D2
    description: "chat.update edits the same message in place to a status chip; no new message; text+blocks always both passed"
    requirement: SLK-06
    verification:
      - kind: other
        ref: "grep gates: card coordinates missing guard present, zero chat.postMessage calls in update-proposal-card.ts, text+blocks both present on every call"
        status: pass
      - kind: manual_procedural
        ref: "Human-verified Approve/Reject transitions and repeat-click no-op during 2b/2c and final approval"
        status: pass
    human_judgment: false
  - id: D3
    description: "ack() first in both click handlers; conditional pending-only transition prevents double-decision"
    requirement: SLK-04
    verification:
      - kind: other
        ref: "grep gates: await ack() first statement, updateMany conditional transition, already-decided no-op log line — approve-proposal.ts and reject-proposal.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "users.info resolves and logs one email per Slack participant; never appears on the card"
    requirement: SLK-08
    verification:
      - kind: other
        ref: "grep gates: resolveParticipantEmail wired into post-proposal-card.ts, zero email references in blocks.ts"
        status: pass
      - kind: manual_procedural
        ref: "Live users.info probe (ok:true, hasEmail:true); participant email resolved log line observed during probes and human-checks"
        status: pass
    human_judgment: false

duration: ~2h (incl. four blocking-human checkpoint waits and three user-requested design iterations)
completed: 2026-09-12
status: complete
---

# Phase 2 Plan 02: Slack Surface — Real Approval Card Summary

**Real Block Kit approval card (table facts + rich_text participants/why, posted as a thread reply) with a status-driven `chat.update` chip machinery, conditional pending-only Approve/Reject, and `users.info` email resolution — built out to three rounds of live user-requested redesign beyond the original plan.**

## Task Commits

1. **Task 1 (tracer): real card, Approve+Reject, Reject → chip** - `489a18c` (feat)
2. **Task 2: Approve path onto chip machinery, users.info email resolution** - `2c1ac9d` (feat)
3. **Task 2b (user request): richer card — layout, thread reply, decided-state context** - `705f525` (feat)
4. **Task 2c (user request): structured card blocks (table/rich_text) + channel member/context helpers** - `cf93081` (feat)
5. **Fix: label the Why block and give it an empty state** - `61fd432` (fix)
6. **Fix: label Participants list and its empty state** - `9363046` (fix)

## Files Created/Modified
- `lib/slack/blocks.ts` — table block (facts), rich_text participants (ordered list, labeled, empty-state sentence) and why (quote, labeled, empty-state sentence), dividers between every logical group, Reject confirm dialog, decided-state closers with ephemeral decider/time
- `lib/slack/post-proposal-card.ts` — real body posting as a thread reply (`thread_ts: source_ts`); `loadCardParticipants` (renamed from `loadParticipantLabels`, now structured `ParticipantEntry[]` + email resolution); `loadApprovalCardExtras` (Decision.reason + on-behalf-of resolution)
- `lib/slack/update-proposal-card.ts` — every status loads the full card input so decided cards keep title/addressee/facts; channel/ts widened to accept null
- `lib/slack/handlers/reject-proposal.ts` (new), `approve-proposal.ts` (extended) — conditional `pending`-only transition, ephemeral `decidedByUserId`/`decidedAt` passed at click time
- `lib/slack/resolve-email.ts` (new) — `resolveParticipantEmail` via `users.info`, in-process cache
- `lib/slack/build-slack-message.ts` (new) — shared `SlackMessage` mapper, extracted from `watched-channel-message.ts`
- `lib/slack/list-human-channel-members.ts`, `lib/slack/fetch-channel-context.ts` (new) — data-only helpers for Phase 5's graph; not wired into dispatch this phase

## Decisions Made
See frontmatter `key-decisions`.

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed mention-escaping bug in the Participants field**
- **Found during:** Task 2b, while adding the "On behalf of" mention field
- **Issue:** the original Task 1 `mrkdwnField` helper escaped every field value including pre-built `<@USERID>` mention markup, turning it into literal `&lt;@ID&gt;` text instead of a real mention
- **Fix:** separated escaped (`mrkdwnField`) from trusted-markup rendering; superseded entirely in Task 2c by rich_text `user` elements, which are never escaped by construction
- **Committed in:** `705f525`

**2. [User-requested scope expansion, not a plan deviation] Three rounds of card redesign (2b, 2c, two fixes)**
- The original plan (Task 1/2) shipped a fields-grid card. The user requested, in order: a richer layout with addressee/thread-reply/decided-context (2b); real Block Kit structural primitives — a `table` block (live-API-probe-verified; Slack added it in 2025) and `rich_text` for participants/why (2c); then two small polish fixes for blank/unlabeled empty states. All four rounds stayed within `lib/slack/**`, kept `postProposalCard`/`updateProposalCard`'s frozen signature and arity, and were each verified with the same `tsc`/Biome/grep gates as the original tasks before restarting Bolt.

**3. [Process discovery, not a code deviation] Bolt restart protocol correction**
- `pkill -f`/`taskkill` on just the outer `bunx.exe` PID leaves the real long-lived `node.exe` process (a grandchild, spawned via Windows `CreateProcess`, invisible to this sandbox's MSYS-based process tools) running as an orphan. This caused a 6-instance leak during 02-01's Task 3 hand-check (found and fixed by the orchestrator via `Get-CimInstance`). Corrected protocol for every 02-02 restart: `taskkill //F //T //PID <bunx-pid>` (tree-kill) on the bunx PID, confirmed via `tasklist //FI "IMAGENAME eq bunx.exe"` to kill the whole chain in one call; verified exactly one instance survived, stable for several seconds, before every checkpoint return.

---

**Total deviations:** 1 auto-fixed bug, 1 user-requested scope expansion (three redesign rounds), 1 process-tooling correction. **Impact:** the mention-escaping fix was necessary for correctness (a broken feature would have shipped otherwise); the redesign rounds were explicitly directed by the user and stayed within this plan's file/contract boundaries; the restart-protocol fix eliminated a real multi-instance bug affecting Slack's own event load-balancing.

## Issues Encountered
None beyond what's covered above — every checkpoint in this plan was human-approved after direct verification in Slack (real cards, real clicks, real probes posted and cleaned up).

## User Setup Required
None — `users:read` and `users:read.email` were confirmed already present on the installed token by Task 1's live probe.

## Next Phase Readiness
Phase 2 (both plans) is complete. `lib/slack/list-human-channel-members.ts` and `lib/slack/fetch-channel-context.ts` are ready for Phase 5's graph to consume post-merge (data-only this phase, no dispatch/graph wiring). Phase 4's organizer claim can now populate `Proposal.organizer_user_id`, which the card's "On behalf of" field and `loadCardParticipants`' "organizer" state label already read.

## Self-Check: PASSED
- All created files exist on disk (verified via `[ -f ]` during execution)
- `git log --oneline --all --grep="02-02"` returns 6 commits (`489a18c`, `2c1ac9d`, `705f525`, `cf93081`, `61fd432`, `9363046`)
- All acceptance criteria for Tasks 1 and 2 re-verified via grep gates after every subsequent change (all passed each time)
- `bunx tsc --noEmit` and `bunx biome check lib/slack` re-confirmed clean after the final fix commit

---
*Phase: 02-slack-surface*
*Completed: 2026-09-12*
