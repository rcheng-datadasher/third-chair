# Phase 2: Slack Surface - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning
**Source:** PRD Express Path (`.planning/ROADMAP.md` §"Phase 2: Slack Surface" only, plus SLK-02..06/08 in `.planning/REQUIREMENTS.md` and `.planning/PROJECT.md` constraints)

<domain>
## Phase Boundary

Wave A, track A, branch `gsd/phase-2-slack-surface`, 11:55–12:40 (45 min), concurrent with Phase 3 (Calendar Client). Depends on Phase 1.

Turns Phase 1's hardcoded `app_mention` round trip into the real Slack surface:
- a watched-channel `message` listener that drops everything outside the allowlist on its first line;
- secondary triggers (message shortcut, `app_mention`, `/secretary`) each reaching the same handler;
- ack-first discipline on every listener;
- the real Block Kit approval card (title, HKT time, duration, participants, confidence, Approve + Reject);
- `chat.update` replacing the buttons with a status chip on the same message;
- `users.info` email resolution.

Everything runs against Phase 1's **still-hardcoded `runAgent` stub**. No LLM call, no Calendar call, no Trigger.dev, no organizer claim in this phase.

Requirements: SLK-02, SLK-03, SLK-04, SLK-05, SLK-06, SLK-08.

</domain>

<decisions>
## Implementation Decisions

### Runtime (first task)
- **D-01:** The literal first task is a Bolt Socket Mode smoke test under `bun lib/slack/bolt.ts`: post one message, confirm the listener fires. If it doesn't fire or shows WebSocket JSON-parse errors, flip immediately to the fallback `bunx tsx lib/slack/bolt.ts` and record which one won. Never `bun --bun`, never `node --experimental-strip-types` (can't resolve `@/` tsconfig paths; PROJECT.md Key Decisions).
- **D-02:** Exactly one Bolt process across every worktree. Before starting Bolt, check `ps aux | grep -i bolt` (or open terminals) and kill any other instance. Socket Mode load-balances events across every connection on the app token.

### Watched-channel listener (SLK-02)
- **D-03:** Subscribe to `message.channels` and filter by the `SLACK_WATCH_CHANNEL_IDS` env allowlist (read via `lib/config.ts`, never `process.env`). The handler's **first line** drops: channels outside the allowlist, bot messages (incl. the bot's own cards), and edit/delete subtypes. A dropped message produces no log line at all (success criterion 1).
- **D-04:** A message that survives the filter emits a log line within 1 second, then calls the same dispatch function Phase 1's `app_mention` path uses (`dispatchAgentRun`, inherited from Phase 1 D-01/D-04). Inline dispatch only; `AGENT_TRANSPORT` is Phase 4.

### Secondary triggers (SLK-03)
- **D-05:** The "Extract action items" message shortcut, `app_mention` and `/secretary` each reach the handler, confirmed by a log line. They route to the same dispatch function as the watched-channel path.
- **D-06:** This is the **first thing cut** if the phase overruns: drop `/secretary` and shortcut wiring, keep only the watched-channel path. Never cut the card, the update, or email resolution.

### Ack discipline (SLK-04)
- **D-07:** `ack()` is the literal first statement of every listener that receives an `ack` (actions, shortcuts, commands). Slow work runs after ack, so Slack never retries and no duplicate cards appear. Detection: a repeated `event_id` within seconds in the log means ack was late.

### Approval card (SLK-05)
- **D-08:** The Block Kit card shows the proposal's title, HKT time, duration, participants and confidence, with **Approve** and **Reject** buttons.
- **D-09:** Conventions inherited from Phase 1 D-03, not re-decided: action ids `approve_proposal` and `reject_proposal`; button `value` = proposal id.
- **D-10:** HKT formatting reuses Phase 1's `utils/time.ts` formatter (Phase 1 D-08). No second formatter, no date library.

### In-place update (SLK-06)
- **D-11:** On Approve or Reject, the same message updates via `chat.update` using the `card_channel` + `card_ts` **stored on the Proposal row** (Phase 1 D-02), never the channel/ts from the click payload. Buttons are replaced by a status chip: `confirmed` for Approve, `dismissed` for Reject. No new message appears.
- **D-12:** The click handler reads the proposal id from `action.value` as its first act after `ack()`. The real approve body (organizer claim, Calendar write, both links) is Phase 4; this phase only proves the button → row → `chat.update` chip path.

### Email resolution (SLK-08)
- **D-13:** A participant's email is resolved from their Slack profile via `users.info` (scope `users:read.email`). It lives in `lib/slack/**`. Load-bearing for Phase 4's invite, so it's never cut.

### File ownership
- **D-14:** Owned: `lib/slack/**` (`bolt.ts` listener registration, listeners, card block builders, block-action handlers).
- **D-15:** Must not touch: `lib/calendar/**`, `app/**`, `components/**`, `lib/agent/**`, `lib/ai/**`.
- **D-16:** Named overlaps, extend-only:
  - `types/`: extend Phase 1's stub if a shared Slack type is needed; never fork.
  - `lib/config.ts`: extend if a new env key is needed; never duplicate.
  - `prisma/schema.prisma`: only after merging the latest `develop`, then `bunx prisma db push`.
- **D-17:** `lib/slack/bolt.ts` stays registration-only. Handler bodies live in separate files, so Phases 4, 5 and 7 can append without restructuring this phase's registrations.

### Processes
- **D-18:** Bolt runs in Socket Mode with no inbound port. Postgres :5432 is shared and read against hand-seeded rows. The workspace `.env` reserves :3001, unused this phase.

### Plan shape (roadmap suggestion, adopted)
- **D-19:** 2 plans:
  - `02-01`: Bolt runtime smoke test + watched-channel filter + shortcut/mention/slash wiring + ack-first pattern.
  - `02-02`: Real approval card (Block Kit) + `chat.update` status chip + `users.info` email resolution.

### Claude's Discretion
- Card copy, layout and status-chip wording/format. Confidence is displayed as a number or percent.
- Whether `users.info` results are cached in-process for the demo, and where the resolved email is used this phase: logged, card participant display, and/or `Participant.email` write.
- Whether a Reject/Approve click also sets `Proposal.status` (`dismissed` / `confirmed`) in this phase. Phase 1 D-02 already sets `confirmed` on Approve, so mirroring `dismissed` on Reject is the consistent default.
- File split inside `lib/slack/**` (kebab-case, named exports, TSDoc on every function).
- Log format for the "reached the handler" lines.
- How the message shortcut's `callback_id` is named, as long as it matches the installed app config exactly.

### Pre-applied scope cut (decided 2026-09-12, before the window)
- **`/secretary scan` and the message shortcut are stubs this phase.** Still create the handler files, the `bolt.ts` registrations and the single shared dispatch seam exactly as Task 2 specifies — Phases 4, 5 and 7 append to that layout (D-17) and must not be disturbed. But the shortcut and slash-command handler bodies are one-liners that ack and log "not implemented in this build"; do not implement scan-over-history or shortcut extraction.
- **`app_mention` stays fully working** — it is the diagnostic fallback if the watched-channel path misbehaves.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` §"Phase 2: Slack Surface": deliverables, exit criterion, cut order, time-eaters, success criteria. Also §"File Ownership Matrix" (`lib/slack/bolt.ts` named overlap across Phases 2→4→5→7), §"Flags Resolved" (watched-channel allowlist), §"Process & Port Map".
- `.planning/REQUIREMENTS.md`: SLK-02, SLK-03, SLK-04, SLK-05, SLK-06, SLK-08 (and SLK-01/07 for what Phase 1 already delivered).
- `.planning/PROJECT.md`: "Runtime processes" (Bolt), stack table run commands (bun Bolt, `bunx tsx` fallback), Key Decisions (watched-channel allowlist, one Bolt process, Reject beside Approve), Constraints (HKT, two demo users).

### Upstream phase (inherited, not re-decided)
- `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md`:
  - D-01/D-02/D-03/D-04: `app_mention` trigger, DB-backed round trip, action-id/value conventions, `dispatchAgentRun`.
  - D-05/D-06/D-07/D-08: stub file names/signatures, `types/`, `utils/time.ts`.
  - D-09/D-11: `card_channel`/`card_ts`/`confidence` columns, `ProposalStatus` enum.
- `.planning/phases/01-foundation-hardcoded-round-trip/01-RESEARCH.md`: stub signature table (`lib/slack/post-proposal-card.ts`, `update-proposal-card.ts`, `blocks.ts`, `client.ts`, `bolt.ts`), `approve_proposal` handler example, `BlockButtonAction` narrowing, `text` fallback requirement.

### Research
- `.planning/research/PITFALLS.md`:
  - Critical: Pitfall 1 (two Bolt processes), Pitfall 5 (Socket Mode under bun), Pitfall 10 (3-second ack).
  - Moderate: "Bot reprocesses its own messages / message subtypes", "`chat.update` needs the exact channel + ts", "`users.info` 403s without `users:read.email`", "Message shortcut `callback_id` mismatch".
- `.planning/research/FEATURES.md` §"Block Kit Approval UX Patterns".
- `.planning/research/ARCHITECTURE.md` §"Interfaces Before Implementation", §"File Ownership Per Track and Named Overlaps".
- `.planning/research/STACK.md`: `@slack/bolt` 5.1.0 pin. **Its Bolt-under-Node recommendation is superseded by PROJECT.md (bun, fallback tsx).**
- `gsd-prompt-ai-secretary.md` (repo root) §"Runtime processes", §"Architecture decisions already made".

</canonical_refs>

<specifics>
## Specific Ideas

- Exit criterion: a real message with an obvious time+participant ask in the watched channel produces a real card with Approve/Reject. Clicking either updates the same message in place to a status chip, against the still-hardcoded `runAgent` stub.
- Success criteria:
  1. A watched-channel message reaches a Bolt log line within 1s; any other channel produces no log line.
  2. The card shows title, HKT time, duration, participants, confidence, Approve and Reject.
  3. A click replaces the buttons with a chip on the same message; no new message.
  4. Exactly one Bolt process runs across every worktree.
- Time-eater #1: two Bolt processes stealing events. If a click "does nothing" after the smoke test passed once, check the other terminal's log first.
- Time-eater #2: a late ack causing Slack retries and duplicate cards. Watch for a repeated `event_id`.
- Demo users: exactly A and B. Only A has Google consent (irrelevant this phase, since there's no Calendar write).
- Pre-window dependency: the `message.channels` event subscription + `channels:history` scope must have been added and the app reinstalled tonight. Without them the watched-channel listener never fires.

</specifics>

<deferred>
## Deferred Ideas

- Real approve body (read row → organizer claim → Calendar event → confirmed card with event + Meet links), double-click/redelivery guard, `AGENT_TRANSPORT`, Trigger.dev task: Phase 4.
- "Edit & approve" card variant, `views.open` modal, `view_submission`: Phase 5 (append-only to `lib/slack/**`).
- Conflict card variant and `/secretary scan`: Phase 7.
- Real extraction replacing the hardcoded `runAgent` stub: Phase 5.

</deferred>

---

*Phase: 02-slack-surface*
*Context gathered: 2026-09-11 via PRD Express Path*
