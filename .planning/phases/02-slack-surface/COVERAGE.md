# API Coverage — Slack Web/Events API (Phase 2)

Integration surface decisions for `@slack/bolt@5.1.0` + `@slack/web-api@8.1.1`.
Default is INTEGRATE; every OPT-OUT carries a one-line reason. Nothing here installs a package.

| Capability | Decision | Reason |
|---|---|---|
| `message.channels` event (`app.message`) | INTEGRATE | SLK-02, the phase's differentiator — unprompted watched-channel detection (02-01 Task 1) |
| `app_mention` event | INTEGRATE | SLK-03 secondary trigger, inherited from Phase 1's D-01 path (02-01 Task 2) |
| Message shortcut (`message_action`, "Extract action items") | INTEGRATE | SLK-03 secondary trigger; registered by type, not `callback_id` (02-01 Task 2) |
| Slash command (`/secretary`) | INTEGRATE | SLK-03 — acks and logs only; it carries no message `ts`, so it dispatches nothing until Phase 7 |
| `block_actions` (`approve_proposal`, `reject_proposal`) | INTEGRATE | SLK-04/SLK-06 — the approval gate itself (02-02 Task 1 and Task 2) |
| `chat.postMessage` | INTEGRATE | SLK-05 — posts the approval card; always with both `text` and `blocks` (02-02 Task 1) |
| `chat.update` | INTEGRATE | SLK-06 — in-place buttons-to-chip transition on the stored `card_channel`/`card_ts` (02-02 Task 1) |
| `users.info` | INTEGRATE | SLK-08 — participant email resolution, load-bearing for Phase 4's calendar invite (02-02 Task 2) |
| `views.open` / `view_submission` | OPT-OUT | The "Edit & approve" modal is Phase 5; appending a listener file there costs nothing later |
| `chat.postEphemeral` / `response_url` | OPT-OUT | No per-clicker private reply this phase — the card update is the only user feedback; Phase 4 owns "Ada already scheduled this" |
| `conversations.history` | OPT-OUT | Backfill reading belongs to Phase 7's `/secretary scan`; this phase is live-event only |
| `chat.delete` | OPT-OUT | SLK-06's contract is edit-in-place; a decision must never remove the audit trail from the channel |
| `reactions.add` / `reactions.read` | OPT-OUT | No reaction affordance in the approval UX; buttons carry the whole decision |
| `files.info` / `files.upload` | OPT-OUT | No file handling; the `file_share` subtype is dropped by 02-01's first-line guard |
| `conversations.join` | OPT-OUT | The bot is invited to the demo channel by hand (pre-window checklist), not programmatically |
| `users.list` | OPT-OUT | Exactly two demo users; one `users.info` per known id is cheaper and needs no pagination |

**Scope consequence:** the installed token needs `channels:history`, `chat:write`, `commands`,
`users:read` and `users:read.email`. `users:read` is the one most likely missing — `users.info`
returns 200 without it and simply omits `profile.email`, so 02-02 Task 1 probes it with one real call
before anything depends on it.
