---
phase: 10-seed-and-rehearse
plan: 01
subsystem: infra
tags: [prisma, googleapis, calendar, idempotency, demo-reset]

# Dependency graph
requires:
  - phase: 01-foundation-hardcoded-round-trip
    provides: lib/db.ts Prisma singleton, lib/config.ts typed env, prisma/schema.prisma models
  - phase: 03-calendar-client
    provides: lib/calendar/google-client.ts getCalendarClient(userId), the demo=true tag written by create-event.ts
provides:
  - "prisma/reset-demo.ts: idempotent demo reset (tagged Google Calendar event cleanup + team-scoped DB row cleanup)"
affects: [10-02-seed-and-rehearse, 11-freeze-and-record]

# Actuals (#2632)
actuals:
  tokens: 1598
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Demo-cleanup scripts reuse the shared lib/db.ts, lib/config.ts and lib/calendar client rather than adding new helpers"
    - "Two separately logged steps (calendar, then db), never wrapped in one try/catch, so a partial failure's last printed line shows which step completed"

key-files:
  created:
    - prisma/reset-demo.ts
  modified: []

key-decisions:
  - "Mirrored prisma/seed.ts's relative import style (../lib/config, ../lib/db, ../lib/calendar/google-client) rather than the plan's preferred @/lib/... alias, since the sibling script already established the relative convention"
  - "getCalendarClient(userId) is exported from lib/calendar/google-client.ts, so no inline OAuth2 fallback was needed"
  - "No Proposal-child model exists beyond Participant, ActionItem and Decision, confirmed by reading prisma/schema.prisma — no extra deleteMany was added"

patterns-established:
  - "reset-demo.ts stdout contract: 'reset-demo: calendar ...', 'reset-demo: db ...', 'reset-demo: summary ...' lines, consumed by 10-02 and Phase 11"

requirements-completed: [DMO-01]

coverage:
  - id: D1
    description: "prisma/reset-demo.ts deletes A's demo-tagged Google Calendar events and every team-scoped ActionItem/Participant/Decision/Proposal row, printing the calendar/db/summary stdout contract and exiting 0"
    requirement: DMO-01
    verification:
      - kind: integration
        ref: "bash -o pipefail -c 'timeout 90 bun prisma/reset-demo.ts | grep -E \"^reset-demo: summary events=[0-9]+ ...\"' (Task 1 live run)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Reset is idempotent: two back-to-back runs leave zero demo rows and zero tagged events on the second run"
    requirement: DMO-01
    verification:
      - kind: integration
        ref: "bash: two sequential `bun prisma/reset-demo.ts` runs, second run's stdout grep-matched against the exact all-zero summary line (Task 2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "User, Installation and Preference rows are never touched by the reset"
    requirement: DMO-01
    verification:
      - kind: unit
        ref: "grep -vE comment-strip | grep -cE '\\b(user|installation|preference)\\.(delete|deleteMany|update|updateMany|upsert)\\b' prisma/reset-demo.ts -> 0"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-09-12
status: complete
---

# Phase 10 Plan 01: Idempotent Demo Reset Script Summary

**`prisma/reset-demo.ts` — one script that tags-and-deletes A's rehearsal Google Calendar events and team-scoped DB rows, proven idempotent by two back-to-back live runs against the running Postgres and Google Calendar API.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-12T05:36:00Z (approx)
- **Completed:** 2026-09-12T05:58:05Z
- **Tasks:** 2
- **Files modified:** 1 (`prisma/reset-demo.ts`, new)

## Accomplishments
- `prisma/reset-demo.ts` created: `statusOf`, `listDemoEventIds`, `deleteEvents`, `resetDatabase`, `main`, each with a TSDoc block, no `any`, no new dependencies.
- First live run (Task 1) wiped the pre-existing rehearsal/fixture pollution: `reset-demo: calendar tagged=1 deleted=1 alreadyGone=0` then `reset-demo: db actionItems=20 participants=24 decisions=33 proposals=24`, summary line matching, exit 0.
- Reset-twice idempotency proven (Task 2, success criterion 1, D-05): the second of two back-to-back runs printed exactly `reset-demo: calendar tagged=0 deleted=0 alreadyGone=0`, `reset-demo: db actionItems=0 participants=0 decisions=0 proposals=0`, `reset-demo: summary events=0 actionItems=0 participants=0 decisions=0 proposals=0`, and exited 0.
- Biome check passes clean (`bunx --bun @biomejs/biome check prisma/reset-demo.ts`, no diagnostics).
- Committed directly on `main`, no new branch, `package.json` untouched by this plan (the one diff line adding `db:studio` predates this plan and belongs to a concurrent in-flight phase — see Deviations).

## Task Commits

1. **Task 1 (tracer): write prisma/reset-demo.ts and run it once end to end** + **Task 2: reset-twice idempotency smoke test, file-lock/branch guard, commit** — `fe67ca6` (feat) — both tasks land in a single commit because the plan's own Task 2 step 5 specifies the commit point after idempotency is proven on the one file both tasks touch; Task 1 alone had no separate commit instruction in PLAN.md.

**Plan metadata:** committed separately below (STATE.md/ROADMAP.md/REQUIREMENTS.md + this SUMMARY).

## Files Created/Modified
- `prisma/reset-demo.ts` - Idempotent demo reset: paginated tagged-event Calendar cleanup (`privateExtendedProperty: ["demo=true"]`, `sendUpdates: "none"`, 404/410 tolerated) plus one interactive `prisma.$transaction` deleting ActionItem, Participant, Decision, Proposal scoped by `config.slack.teamId`.

## Decisions Made
- Reused `prisma/seed.ts`'s relative import style (`../lib/config`, `../lib/db`, `../lib/calendar/google-client`) instead of the plan's preferred `@/lib/...` alias, since the sibling script in the same directory already set that convention (D-02 reuse-before-writing).
- No inline OAuth2 fallback was written: `getCalendarClient(userId)` is exported from `lib/calendar/google-client.ts`, confirmed by grep before writing.
- Confirmed via `prisma/schema.prisma` that only `ActionItem`, `Participant` and `Decision` hold a `proposal_id` relation to `Proposal` — no additional child-model delete was needed in `resetDatabase`.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing functionality, or blockers required a Rule 1-3 fix during implementation. The script passed Biome and both live smoke tests on the first write.

### Environmental note (not a plan deviation)

The main working tree carries another in-flight phase's uncommitted work at the time of this plan's execution (per explicit orchestrator instruction): untracked `lib/agent/tasks/`, `trigger.config.ts`, `connection_test/`, screenshots, and modified `.gitignore`/`package.json`/`.planning/STATE.md`/`.planning/state.json`. Task 2's automated file-lock verify command (`git status --porcelain --untracked-files=all -- . ':(exclude).planning' ':(exclude)prisma/reset-demo.ts'`) would report those paths if re-run literally — they are not artifacts of this plan. Mid-execution, a race with that concurrent process caused one `git commit` to accidentally pick up 4 extra already-staged files (`.gitignore`, `.planning/phases/04-approval-bridge/deferred-items.md`, `lib/agent/tasks/run-agent.ts`, `trigger.config.ts`) alongside `prisma/reset-demo.ts`. This was caught immediately: `git reset --soft HEAD~1` un-committed without altering any file content or losing any work, the unrelated paths were unstaged with `git restore --staged`, and the commit was redone scoped to exactly `prisma/reset-demo.ts` (verified via `git show --stat HEAD` showing 1 file changed). No other phase's work was lost or altered.

---

**Total deviations:** 0 auto-fixed. One environmental commit-scope correction, self-caught and fixed before this SUMMARY was written; no code or plan-scope impact.
**Impact on plan:** None. `prisma/reset-demo.ts` is the only file this plan owns, and the final commit reflects that precisely.

## Issues Encountered
None beyond the commit-scope race described above, which was corrected before proceeding.

## User Setup Required
None - no external service configuration required. The script reuses A's already-consented Google OAuth refresh token and the existing `.env.local`.

## Next Phase Readiness
- `prisma/reset-demo.ts` is proven idempotent against the live stack (Postgres :5432, Google Calendar API) and is ready for 10-02 to call before/after each rehearsal.
- 10-02's first human step is the D-06 double-post check (needs hand-typed Slack posts), which cannot be automated here.
- User, Installation and Preference rows (A's Google refresh token, the team mapping) are confirmed intact after both live runs — the next rehearsal's Calendar auth will still work.

---
*Phase: 10-seed-and-rehearse*
*Completed: 2026-09-12*

## Self-Check: PASSED

- `prisma/reset-demo.ts` exists on disk: FOUND
- Commit `fe67ca6` exists in git history and touches exactly `prisma/reset-demo.ts` (1 file changed, 188 insertions): FOUND
