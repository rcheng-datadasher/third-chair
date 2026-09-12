# API Coverage — Phase 4 (Approval Bridge)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Phase 4 touches three surfaces: the Slack Web API (card state transitions and ephemeral feedback), Google Calendar **only through Phase 3's wrapper** (never called directly), and the Trigger.dev SDK + build config. Everything else is opted out with a reason.
> Clients: `@slack/bolt@5.1.0` (listener side) and `@slack/web-api@8.1.1` (standalone client, already installed in Phase 1); `googleapis@180.0.0` via `lib/calendar/create-event.ts`; `@trigger.dev/sdk` / `@trigger.dev/build` / `trigger.dev` CLI all at 4.5.16. No package is installed in this phase.

## Slack Web API

| capability | decision | reason |
|---|---|---|
| chat.update | INTEGRATE | APR-04 / D-06: the confirmed and dismissed chips are written in place on the **stored** `card_channel`/`card_ts`, through Phase 2's `updateProposalCard` |
| chat.postEphemeral / response_url `respond` | INTEGRATE | D-08 Claude's Discretion: short-lived, per-clicker feedback for the non-organizer, already-claimed, already-handled and unknown-proposal outcomes |
| block_actions interaction payload | INTEGRATE | D-05: the proposal id comes from `actions[0].value` and the clicker from the payload's user id; Bolt's Socket Mode connection is the only receiver |
| chat.postMessage | OPT-OUT | out of scope: Phase 2 owns card posting (`postProposalCard`); this phase only updates existing cards |
| users.info | OPT-OUT | out of scope: Phase 2 owns email resolution (SLK-08); the clicker is resolved from Postgres by the compound team + Slack-user key |
| views.open / view_submission | OPT-OUT | out of scope: the medium-confidence edit modal is Phase 5 (AGT-05) |
| chat.delete | OPT-OUT | not needed — a state transition updates the card in place; the card is never removed |
| chat.scheduleMessage | OPT-OUT | not needed — nothing in this phase is deferred to a later send time |
| reactions.add | OPT-OUT | not needed — the status chip on the card is the only feedback surface |
| conversations.* | OPT-OUT | not needed — the watched-channel allowlist is Phase 2's, read from config, never discovered at runtime |
| files.* | OPT-OUT | not needed — no attachments in the approval flow |
| auth.test | OPT-OUT | not needed — Bolt performs its own handshake at startup; a failed token surfaces there |

## Google Calendar API v3 (consumed, not implemented)

| capability | decision | reason |
|---|---|---|
| `createCalendarEvent(proposal, organizerUserId)` | INTEGRATE | APR-01/APR-03: the single Calendar call in this phase, made after the organizer claim wins or resolves to the clicker |
| every raw Calendar method (`events.insert`, `events.get`, `freebusy.query`, …) | OPT-OUT | out of scope: Phase 3 owns the client and already decided this matrix — see `.planning/phases/03-calendar-client/COVERAGE.md`. Phase 4 never imports `googleapis` and never edits `lib/calendar/**` |
| `checkConflicts` (freebusy at approve time) | OPT-OUT | not needed yet — re-checking the calendar at approval and proposing alternatives is Phase 7 (CFL-*) |

## Trigger.dev SDK and build config

| capability | decision | reason |
|---|---|---|
| `defineConfig` (`trigger.config.ts`) | INTEGRATE | D-14: root config declaring the task directory and the build extension |
| `prismaExtension({ mode: "modern" })` | INTEGRATE | D-14: the generated Prisma 7 client must be bundled into the worker, or the task fails at runtime rather than build time |
| `task({ id, run })` | INTEGRATE | AGT-11 / D-12: the thin `run-agent` wrapper around `runAgent` |
| `tasks.trigger` (typed by the task) | INTEGRATE | APR-05 / D-15: the `trigger` branch of `dispatchAgentRun` |
| `idempotencyKeys.create` | INTEGRATE | AGT-11 / D-13: key derived from team + channel + message timestamp |
| `configure({ secretKey })` | INTEGRATE | D-22: keeps the config module the only environment reader in application code, instead of relying on the SDK's own environment default |
| `runtime: "bun"` | OPT-OUT | rejected: documented gaps (instrumentation, workspace deploys) in exactly the layer that calls Prisma and the agent — the default Node runtime is the decision |
| `trigger.dev deploy` / deployed environments | OPT-OUT | not needed — this build never deploys; only `bunx trigger.dev@4.5.16 dev` runs, and dashboard environment variables therefore never apply |
| `batch.trigger` / `batchTriggerAndWait` | OPT-OUT | not needed — one message dispatches one run; batching is Phase 7's `/secretary scan` question, if it is reached at all |
| `triggerAndWait` / `runs.retrieve` / `runs.poll` | OPT-OUT | not needed — dispatch is fire-and-forget; the card is the completion signal |
| `wait.for` / `wait.until` | OPT-OUT | not needed — every graph invocation runs to completion in one pass (no checkpointer, PROJECT.md) |
| `schedules.task` (cron) | OPT-OUT | not needed — the expiry sweep that would use it is deferred to v2 (SCL-03) |
| `queue` / concurrency keys | OPT-OUT | not needed — a two-user demo on one laptop; the default queue is sufficient |
| `retry` options | OPT-OUT | not needed — the SDK default is fine, and the approve path (the only place a retry would matter) never runs in a task |
| `metadata` / `tags` on runs | OPT-OUT | not needed — the dashboard run list is the demo artefact; no filtering is required |
| `realtime` subscriptions / React hooks | OPT-OUT | out of scope: the dashboard (Phase 6) polls Postgres with TanStack Query and never talks to Trigger.dev |
| `maxDuration` | OPT-OUT | not needed — optional, and omitting it forces no task timeout |
| build extensions other than prisma (`additionalPackages`, `syncEnvVars`, `ffmpeg`, …) | OPT-OUT | not needed — no native binary, and the dev CLI auto-loads the root environment file, so no variable sync is required |
