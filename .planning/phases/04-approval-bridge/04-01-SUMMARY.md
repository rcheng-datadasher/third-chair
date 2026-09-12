---
phase: 04-approval-bridge
plan: 01
subsystem: slack
tags: [approve, reject, organizer-claim, google-calendar, chat.update, idempotency]

requires:
  - phase: 02-slack-surface
    provides: blocks.ts builders, update-proposal-card.ts, approve/reject handler skeletons, Bolt registrations
  - phase: 03-calendar-client
    provides: createCalendarEvent (deterministic id, 409 fallback, Meet link, invites)
  - phase: 05-agent-confidence-gate
    provides: real runAgent so Phase 4 wired against the real graph, no stub
provides:
  - lib/slack/approve.ts (approveProposal, ApproveOutcome — token guard, locked organizer claim, real event, in-place confirmed card)
  - lib/slack/reject.ts (rejectProposal, RejectOutcome — dismissed only from pending, re-render on non-pending)
  - buildConfirmedBlocks renders Calendar + Meet links (empty links omitted)
  - thin Bolt handlers: ack → domain call → ephemeral feedback; shared by the dashboard decide route
affects: [07-integrate-conflict-counter-proposal, 10-seed-and-rehearse]

actuals:
  tokens: 6000
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns: ["Bolt-free domain module in lib/slack/ shared by the Slack button and the dashboard route", "conditional UPDATE … WHERE organizer_user_id IS NULL RETURNING id as the organizer claim"]

key-files:
  created:
    - lib/slack/approve.ts
  modified:
    - lib/slack/blocks.ts
    - lib/slack/handlers/approve-proposal.ts
    - lib/slack/update-proposal-card.ts
    - lib/slack/reject.ts

key-decisions:
  - "Task 1 collapsed: Phase 2 was merged to main by its own session (5a88fdd); schema unchanged since 1b7a618 so no db push; /ponytail-review deferred to Phase 7 (user speed cut)"
  - "rejectProposal lives in lib/slack/reject.ts (created by the dashboard track, 93738b7) instead of approve.ts as the plan sketched — one helper, one place; route and handler both import it"
  - "Non-pending Reject re-renders the current card state (one added call) so a redelivered click converges the card to the row"

requirements-completed: [APR-01, APR-02, APR-03, APR-04, APR-05]

coverage:
  - id: D1
    description: "Approve on a live card → real event with Meet link + invite, same card updated in place with both links"
    requirement: APR-01, APR-04
    verification: [human-verified 15:03 on proposal cmty19knh0000acuzasqepz14]
  - id: D2
    description: "Token guard + locked organizer claim; a clicker with no google_refresh_token gets not_organizer and nothing is written"
    requirement: APR-02
    verification: [throwaway script 15:14 — not_organizer, row still pending, organizer null, no event]
  - id: D3
    description: "Second Approve / redelivery on a confirmed row → not_pending, same card, same calendar_event_id; Reject on non-pending → not_pending, no change"
    requirement: APR-03
    verification: [throwaway script 15:14 — event id unchanged; reject-again not_pending; approve-dismissed not_pending]
  - id: D4
    description: "inline transport exercised live: the Task 2 Bolt session ran with AGENT_TRANSPORT=inline; trigger side proven in 04-02 Task 1"
    requirement: APR-05
    verification: [04-02-SUMMARY D1 + this plan's live Bolt session]

duration: 40min
completed: 2026-09-12
status: complete
---

# Phase 4 Plan 1: Approval Bridge Summary

Approve on a Slack card now reads the row, guards the token holder, claims the organizer with the locked conditional UPDATE, creates the real Calendar event through Phase 3's idempotent wrapper, and updates the same card in place with Calendar + Meet links; Reject dismisses without touching Google. Human-verified live at 15:03.

## Task Commits

| Task | Commit | Note |
|------|--------|------|
| 1 | — | Collapsed: merge already on main (`5a88fdd`), schema unchanged, single Bolt restarted (`bunx tsx`) |
| 2 | `2eb83c2` | approveProposal + confirmed chip links + thin handler; tracer proposal `cmty19knh0000acuzasqepz14` approved live |
| 3 | `7708e5d` | non-pending Reject re-renders; edge paths proven by script |

## Deviations from Plan

- Reject domain function is in `lib/slack/reject.ts`, not `approve.ts` (created concurrently by the dashboard track; kept to avoid a duplicate helper). Phase 7's `choose_alt` only needs `approveProposal(proposalId, clickerSlackUserId)` — unchanged.
- `/ponytail-review` on the merged diff deferred to Phase 7 (DMO-05 is signed there).
- The first Task 3 executor was interrupted by a session restart mid-edit; its uncommitted consolidation was discarded in favour of the already-committed `reject.ts`.

## Issues Encountered

- `core.autocrlf=true` in this checkout makes Biome report CRLF "format" errors on every file; committed blobs are LF. Cosmetic.
- Three sessions committing to `main` concurrently — one broad `git add` briefly swept another session's files; recovered.
