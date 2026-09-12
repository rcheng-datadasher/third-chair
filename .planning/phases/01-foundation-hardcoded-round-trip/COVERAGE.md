# Phase 1 — API Coverage Matrix

**Trigger:** the API-coverage detector returned `detected: true` over the Phase 1 plan bodies plus the ROADMAP phase section (signal: the Slack Web API surface in `lib/slack/post-proposal-card.ts`).

**Default disposition is INTEGRATE.** Every OPT-OUT below carries a one-line reason.

## Slack Web API / Socket Mode

| Capability | Decision | Reason |
|---|---|---|
| `chat.postMessage` (Block Kit card) | INTEGRATE | `lib/slack/post-proposal-card.ts` — half the SLK-07 round trip |
| `chat.update` (edit the card in place) | INTEGRATE | `lib/slack/update-proposal-card.ts` — the other half; targets the stored `card_channel`/`card_ts` |
| Socket Mode event `app_mention` | INTEGRATE | The Phase 1 trigger (D-01): scope already installed, no feedback loop from the bot's own card |
| Socket Mode interaction `block_actions` (`approve_proposal`) | INTEGRATE | The Approve click; only the open WebSocket ever receives it |
| Socket Mode event `message.channels` | OPT-OUT | Later phase (2) — SLK-02's watched-channel allowlist listener |
| `views.open` / `views.submit` (modals) | OPT-OUT | Later phase (5) — AGT-05's medium-confidence edit modal |
| `users.info` (participant email resolution) | OPT-OUT | Later phase (2) — SLK-08 |
| Slash command `/secretary` and message shortcuts | OPT-OUT | Later phase (2) — SLK-03 |
| OAuth install flow / `Installation` population | OPT-OUT | Not needed — deferred to v2 (DST-01); Phase 1 hand-seeds one `Installation` row |

## Google Calendar API

| Capability | Decision | Reason |
|---|---|---|
| `freebusy.query` | OPT-OUT | Later phase (3) — CAL-01. Phase 1 stubs `checkConflicts` to an empty array, with no network call |
| `events.insert` (+ `conferenceDataVersion`, Meet link) | OPT-OUT | Later phase (3) — CAL-02/CAL-03. `createCalendarEvent` throws a named not-implemented error rather than faking success |
| `events.get` (409 idempotency fallback) | OPT-OUT | Later phase (3) — CAL-04 |

## Model provider (Kilo Gateway, OpenAI-compatible)

| Capability | Decision | Reason |
|---|---|---|
| Chat completions / structured outputs | OPT-OUT | Later phase (5) — AGT-01. `lib/ai/provider.ts` exists with its final signature but throws until Phase 5 |

## Other

| Capability | Decision | Reason |
|---|---|---|
| Trigger.dev task API | OPT-OUT | Later phase (4) — D-04 gives Phase 4 the task wrapper, `AGENT_TRANSPORT` branching and `trigger.config.ts` |
| Graphiti / Neo4j HTTP service | OPT-OUT | Stretch phase (9) — declared in `docker-compose.yml` behind the `graph` profile, never started in Phase 1 |
| CopilotKit runtime | OPT-OUT | Stretch phase (8) — not installed in the scaffold by explicit decision (D-21) |
