---
phase: 03-calendar-client
plan: 01
subsystem: calendar
tags: [googleapis, oauth2, freebusy, hkt]

requires:
  - phase: 01-foundation
    provides: lib/db.ts prisma singleton, lib/config.ts, freebusy.ts stub, seeded User A refresh token
provides:
  - Real Google OAuth2 client (getGoogleAuth/getCalendarClient) built from a user's stored refresh token
  - Real checkConflicts backed by freebusy.query, with +08:00-normalized request/response logging
  - toHktRfc3339 RFC3339 formatter with a fixed +08:00 offset
  - lib/calendar/smoke.ts live exercise script
affects: [03-02, 07-conflict-detection, 10-demo-cleanup]

actuals:
  tokens: 1876
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns: ["dual-log +08:00 request and HKT-re-rendered response so success doesn't depend on Google's undocumented response offset format"]

key-files:
  created:
    - lib/calendar/google-client.ts
    - lib/calendar/hkt-rfc3339.ts
    - lib/calendar/smoke.ts
  modified:
    - lib/calendar/freebusy.ts

key-decisions:
  - "lib/config.ts already had a google section (clientId/clientSecret/redirectUri) from an earlier phase commit — no config change needed"

requirements-completed: [CAL-01]

coverage:
  - id: D1
    description: "Token scope check runs before any Calendar call and gates PASS/FAIL correctly"
    requirement: CAL-01
    verification:
      - kind: other
        ref: "bun lib/calendar/smoke.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "checkConflicts returns real busy blocks from freebusy.query with +08:00 request/response logging"
    requirement: CAL-01
    verification:
      - kind: other
        ref: "bun lib/calendar/smoke.ts"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-12
status: complete
plan_head_before: 0135dadb2afafc29709a623c4840e3d6e162b1df
---

# Phase 03 Plan 01: Google Calendar Client Summary

Real OAuth2 client + live `freebusy.query`-backed `checkConflicts`, with dual-logged `+08:00` request/response offsets, replacing Phase 1's stub.

## Task Commits

1. **Task 1: Google OAuth2 client, scope check, live freebusy smoke** - `62d5fb6` (feat)
2. **Task 2: Real checkConflicts with +08:00 HKT offsets** - `38c1e72` (feat)

## Notes

- Auth gate: the worktree's seeded refresh token was initially a tracked-in-git placeholder (`.env.local` shadowed the real `.env`). Orchestrator untracked it and re-seeded with a real token (scope `https://www.googleapis.com/auth/calendar`, DB token len=103). Re-verified: `[scope-check] PASS scopes=https://www.googleapis.com/auth/calendar`, `[smoke] freebusy ok`.
- Logged scope list: `https://www.googleapis.com/auth/calendar` (full scope — covers both freebusy and insert/get).
- A's calendar was empty for the Thu 17 Sep 2026 HKT window at test time (`slots=0`) — expected per plan; 03-02 re-checks busy-block rendering against the seeded event.
- `lib/config.ts` was not modified — the `google` section already existed from an earlier commit.
- Pre-existing `tsc --noEmit` error outside this plan's scope: `app/layout.tsx(20,50): error TS2304: Cannot find name 'LayoutProps'` — not fixed (out of scope).

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
- `lib/calendar/google-client.ts`, `lib/calendar/hkt-rfc3339.ts`, `lib/calendar/freebusy.ts`, `lib/calendar/smoke.ts` all exist on disk
- `git log --oneline --all --grep="03-01"` returns commits `62d5fb6`, `38c1e72`
- All task `<acceptance_criteria>` re-verified passing (biome clean, tsc clean under lib/calendar, exact log tags present)
