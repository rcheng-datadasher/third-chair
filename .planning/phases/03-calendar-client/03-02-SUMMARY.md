---
phase: 03-calendar-client
plan: 02
subsystem: calendar
tags: [googleapis, events-insert, idempotency, meet-link]

requires:
  - phase: 03-calendar-client
    provides: "03-01's getCalendarClient, toHktRfc3339, checkConflicts"
provides:
  - "createCalendarEvent(proposal, organizerUserId?) — real events.insert with Meet link, invite, deterministic id, demo tag, and idempotent 409 fallback"
  - "deriveEventId(proposalId) — sha256-hex deterministic Calendar event id"
affects: [04-approval-bridge, 10-seed-and-rehearse]

actuals:
  tokens: 2500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns: ["deterministic sha256-hex event id as idempotency key; 409 -> events.get fallback never re-inserts or re-notifies"]

key-files:
  created:
    - lib/calendar/event-id.ts
  modified:
    - lib/calendar/create-event.ts
    - lib/calendar/smoke.ts

key-decisions:
  - "Kept lib/calendar/smoke.ts (research suggested deleting before merge) — left under Claude's discretion per the plan, and it's the one-command idempotency/scope re-check for Phases 4, 10, 11"

requirements-completed: [CAL-02, CAL-03, CAL-04, CAL-05]

coverage:
  - id: D1
    description: "Real events.insert creates a Meet-linked, demo-tagged, invited event with a deterministic id"
    requirement: CAL-02
    verification:
      - kind: other
        ref: "bun lib/calendar/smoke.ts"
        status: pass
    human_judgment: true
    rationale: "Task 1 tracer human-check confirmed by user: event opened in Google Calendar shows the Meet link, B's inbox received the invite (approved before Task 2 started)"
  - id: D2
    description: "Repeat createCalendarEvent hits 409 -> events.get and returns the same event; no second insert or invite"
    requirement: CAL-04
    verification:
      - kind: other
        ref: "bun lib/calendar/smoke.ts"
        status: pass
    human_judgment: true
    rationale: "Script-level idempotency proven (two 409 lines, same eventId); exactly-one-event-on-calendar and exactly-one-invitation-in-inbox is the deferred end-of-phase human-check per HUMAN_VERIFY_MODE=end-of-phase"

duration: 25min
completed: 2026-09-12
status: complete
plan_head_before: b19b55cb6a395c88c2e4ad4e3e9018df88db2147
---

# Phase 03 Plan 02: Google Calendar Event Creation Summary

Real `createCalendarEvent` — Meet link, invite, deterministic sha256-hex id, demo tag, and an idempotent 409-to-`events.get` fallback that never double-inserts or double-invites.

## Task Commits

1. **Task 1: events.insert with Meet link, invite, deterministic id, demo tag** - `78c6e66` (feat)
2. **Task 2: Idempotent 409 fallback and real busy-block check** - `8ce32cf` (feat)

**Plan metadata:** (this commit)

## Notes

- eventId: `328f88debb855605f24c8224f61c9dd6519f7357a69e23211c4d8bae32d89899` (64-char lowercase hex, matches `deriveEventId`).
- D-18 invite cut: not taken — real `sendUpdates: "all"` insert ran; no time overrun.
- Task 1 human-check (approved by user before Task 2 started): event opened in A's Google Calendar shows a `meet.google.com` link, lists B as guest, starts Thu 17 Sep 2026 15:00 HKT; B's inbox received the invitation.
- Task 2 human-check ("exactly one event, exactly one invitation despite 3 calls") is the deferred end-of-phase batch check per `HUMAN_VERIFY_MODE=end-of-phase` — not run standalone here.
- Busy-block re-check: `checkConflicts` now returns the seeded event as a real slot covering `2026-09-17T15:00:00+08:00..2026-09-17T16:00:00+08:00`, closing success criterion 1 against real data (03-01 saw an empty calendar).
- Pre-existing `tsc --noEmit` error outside scope: `app/layout.tsx(20,50): error TS2304: Cannot find name 'LayoutProps'` — not fixed.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
- `lib/calendar/event-id.ts`, `lib/calendar/create-event.ts` exist on disk with required exports/substrings
- `git log --oneline --all --grep="03-02"` returns commits `78c6e66`, `8ce32cf`
- All task `<acceptance_criteria>` re-verified passing (biome clean, tsc clean under `lib/calendar/`, two `409 -> events.get` lines, no fresh insert on retry, `[smoke] idempotent OK` and `[smoke] busy-block OK` present)
