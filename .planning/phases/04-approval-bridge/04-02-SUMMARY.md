---
phase: 04-approval-bridge
plan: 02
subsystem: agent
tags: [trigger.dev, prisma, agent-dispatch, idempotency, transport-switch]

requires:
  - phase: 05-agent-confidence-gate
    provides: the real runAgent graph (lib/agent/graph.ts) this plan wraps and dispatches against
  - phase: 01-foundation
    provides: config.agent.transport enum, Trigger.dev secret section, RunAgentInput/SlackMessage types, Prisma singleton
provides:
  - trigger.config.ts (root Trigger.dev build config, prismaExtension, Node runtime default)
  - lib/agent/tasks/run-agent.ts (runAgentTask, thin wrapper, task id run-agent)
  - lib/agent/dispatch.ts trigger branch (derived idempotency key, type-only task import, configure() from config module)
affects: [04-01-approval-flow, 07-integrate-conflict-counter-proposal]

actuals:
  tokens: 4200
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns: ["type-only task import keeps worker code out of the Bolt bundle", "configure() called inside the trigger branch from config.trigger.secretKey rather than SDK env auto-read"]

key-files:
  created:
    - trigger.config.ts
    - lib/agent/tasks/run-agent.ts
  modified:
    - lib/agent/dispatch.ts

key-decisions:
  - "maxDuration set in trigger.config.ts — the pinned SDK's TriggerConfig type requires it (deviation from the plan's 'optional, omit it' assumption)"
  - "dotenv loaded explicitly in trigger.config.ts against .env.local per this repo's proven connection_test pattern, because config evaluation happens before the CLI's own auto-load"
  - "lib/config.ts and .env.local.example needed no change — TRIGGER_PROJECT_ID and the Trigger.dev secret section already existed from Phase 1"
  - "Task 3 (live both-transports hand-check) deferred by human decision at 14:13 (speed cut) — not executed, not skipped-and-forgotten"

requirements-completed: [AGT-11]

coverage:
  - id: D1
    description: "Trigger.dev task wrapper + config proven end to end: one triggered run reaches the real agent graph, writes real Proposal+Decision rows, posts a real Slack card"
    requirement: AGT-11
    verification:
      - kind: integration
        ref: "one-off tasks.trigger script against local CLI: run run_06g98atq7l71uoaacevc47a701 COMPLETED in 4.9s, one Haiku extraction call, Proposal cmtxyw9qy0000b0uz2iyzf16j (confidence 0.92) + Decision row written, card posted to C0C17MQJ2HF (card_ts 1789192295.177309)"
        status: pass
    human_judgment: true
    rationale: "Human verified the dashboard run and the Slack card visually at 14:03; the dashboard/channel state itself isn't machine-checkable from this session."
  - id: D2
    description: "dispatchAgentRun's trigger branch: derived idempotency key from teamId/channelId/ts, typed tasks.trigger call via type-only runAgentTask import, configure() from config.trigger.secretKey; inline branch and Phase 1 signature unchanged"
    requirement: APR-05
    verification:
      - kind: unit
        ref: "bunx tsc --noEmit + bunx biome check lib/agent lib/config.ts + grep gates (idempotencyKeys.create, config.agent.transport, type-only import, no process.env reads, teamId/channelId present) — all exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Live both-transports hand-check from a real Slack message (trigger side visible in dashboard + card; inline side works with CLI stopped and Bolt restarted; no code edit between)"
    requirement: APR-05
    verification: []
    human_judgment: true
    rationale: "Deferred by explicit human decision at 14:13 (speed cut), not executed. The trigger side is already proven end-to-end by D1's one-off run; the inline side is the unchanged Phase 1 call path and will be exercised live in 04-01 Task 2, where Bolt runs with AGENT_TRANSPORT=inline. Coverage not determined at authoring time for the combined-both-transports claim — verifier must classify against that later live check."

duration: 25min
completed: 2026-09-12
status: complete
---

# Phase 4 Plan 2: Trigger.dev Task Wrapper + Transport Switch Summary

Trigger.dev task wrapper proven end-to-end with a real triggered run (row written, card posted), and `dispatchAgentRun`'s trigger branch filled in with a derived team/channel/timestamp idempotency key — the live both-transports hand-check itself is deferred, not executed.

## Performance

- **Duration:** ~25 min (Tasks 1-2)
- **Tasks:** 2 of 3 completed; Task 3 deferred by human decision
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `trigger.config.ts` at repo root: project ref from `TRIGGER_PROJECT_ID`, `dirs` -> `lib/agent/tasks`, `prismaExtension({ mode: "modern" })`, no runtime override
- `lib/agent/tasks/run-agent.ts`: `runAgentTask`, id `run-agent`, single-call wrapper around `runAgent` — no logic of its own
- D-14 proof run: run `run_06g98atq7l71uoaacevc47a701` COMPLETED in 4.9s (one Haiku extraction call), Proposal `cmtxyw9qy0000b0uz2iyzf16j` (confidence 0.92) + Decision row written, card posted to `C0C17MQJ2HF` (`card_ts` `1789192295.177309`); human verified dashboard + Slack card at 14:03
- `dispatchAgentRun`'s trigger branch: idempotency key from `[teamId, channelId, ts]`, `tasks.trigger<typeof runAgentTask>("run-agent", ...)` via a type-only task import, `configure({ accessToken: config.trigger.secretKey })` called inside the branch; inline branch (Phase 1 body) and the function's signature both unchanged

## Task Commits

Each completed task was committed atomically:

1. **Task 1 (tracer): trigger.config.ts + thin run-agent task wrapper, real run proven** - `2eace07` (feat)
2. **Task 2: fill trigger branch in dispatchAgentRun** - `32ca96f` (feat)
3. **Task 3: hand-check both transports** - DEFERRED, not executed (see below)

## Files Created/Modified
- `trigger.config.ts` - Root Trigger.dev build config: task dir, Prisma build extension, default Node runtime
- `lib/agent/tasks/run-agent.ts` - `runAgentTask`, thin wrapper, task id `run-agent`
- `lib/agent/dispatch.ts` - trigger branch filled in: derived idempotency key, typed `tasks.trigger` call, `configure()` from config module

## Decisions Made
See `key-decisions` in frontmatter. Notably: `maxDuration` in `trigger.config.ts` was required by the pinned SDK's `TriggerConfig` type (the plan assumed it was optional and omittable) — added as a Rule 3 blocking auto-fix. `lib/config.ts` and `.env.local.example` were left untouched: `TRIGGER_PROJECT_ID` and the Trigger.dev secret property both already existed from Phase 1, so no additive extension was needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `maxDuration` required by the pinned SDK's `TriggerConfig` type**
- **Found during:** Task 1 (writing `trigger.config.ts`)
- **Issue:** The plan's action step said `maxDuration` is optional and omitting it forces no timeout; the pinned Trigger.dev SDK's `TriggerConfig` type actually requires the key to type-check.
- **Fix:** Added `maxDuration: 300` to `trigger.config.ts`.
- **Files modified:** `trigger.config.ts`
- **Committed in:** `2eace07` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking). **Impact on plan:** Necessary for `bunx tsc --noEmit` to pass; no scope creep.

## Issues Encountered
None beyond the deviation above.

## Deferred: Task 3 (both-transports live hand-check)

Task 3 — the live Slack round trip proving both transports from a real watched-channel message (APR-05, D-17, ROADMAP success criterion 3) — was **deferred by explicit human decision at 14:13** (speed cut), not executed and not skipped silently:

- The **trigger side** is already proven end-to-end by Task 1's real triggered run (dashboard run, real rows, real card, human-verified at 14:03) — this is the harder half of D-17 and it already has live evidence.
- The **inline side** is the unchanged Phase 1 call path (`dispatchAgentRun`'s first branch, untouched by this plan) and will be exercised live in **04-01 Task 2**, where Bolt runs with `AGENT_TRANSPORT=inline`.
- Bolt runtime note carried forward: `bunx tsx lib/slack/bolt.ts` (bun's own Socket Mode ping is broken per 02-01-SUMMARY.md) — relevant whenever the deferred hand-check is picked back up.
- The same deferral is recorded in `.planning/phases/04-approval-bridge/deferred-items.md` (append below).

This defers only the *combined, both-transports-from-one-live-message* proof — not the individual pieces, which are each independently verified (trigger side live, inline side by code being unchanged plus 04-01's own restart-based check).

## Success Criterion 5 (no npm lockfile)

Verified: `ls package-lock.json` -> no such file; `git status --short` lists no lockfile. Satisfied.

## Requirements

- **AGT-11**: done — task runs on default Node runtime, wraps the agent with no logic of its own, keys on team + channel + timestamp, posts through the standalone Web API client (proven by the D-14 run).
- **APR-05**: code-complete — both branches exist behind one environment flag with the Phase 1 signature frozen; the live both-transports check itself is deferred to 04-01/Phase 7.

## User Setup Required
None - no new external service configuration required (Trigger.dev project ref and secret already existed).

## Next Phase Readiness
- `dispatchAgentRun` is ready for 04-01 to call from the real Slack listener; only the deferred hand-check remains before APR-05's live proof is closed out.
- 04-01's Bolt run (with `AGENT_TRANSPORT=inline`) is the natural place to close the inline half of the deferred check; the trigger half needs no further proof beyond Task 1's run.

---
*Phase: 04-approval-bridge*
*Completed: 2026-09-12*
