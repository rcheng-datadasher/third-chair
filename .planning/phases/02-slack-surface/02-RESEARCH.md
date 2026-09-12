# Phase 2: Slack Surface - Research

**Researched:** 2026-09-11
**Domain:** `@slack/bolt` 5.1.0 Socket Mode — watched-channel listener, secondary triggers, ack discipline, Block Kit approval card, `chat.update` in-place transitions, `users.info` email resolution
**Confidence:** MEDIUM-HIGH — Block Kit field limits, `chat.update` semantics, `users.info` scope requirements, and the bun/bolt-js Socket Mode bug history are `[VERIFIED]`/`[CITED]` against official `docs.slack.dev` pages and primary GitHub sources fetched this session. The exact auto-ack-vs-explicit-ack split for event vs. interactive listeners is `[CITED]`-by-inference (official docs state explicit-ack scope for actions/commands/views but never state the negative for events) plus `[ASSUMED]` from Bolt's own architecture — flagged in the Assumptions Log, not stated as harder fact than the sources support.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** First task is a Bolt Socket Mode smoke test under `bun lib/slack/bolt.ts`: post one message, confirm the listener fires. If it doesn't fire or shows WebSocket JSON-parse errors, flip immediately to `bunx tsx lib/slack/bolt.ts` and record which one won. Never `bun --bun`, never `node --experimental-strip-types` (can't resolve `@/` tsconfig paths; PROJECT.md Key Decisions).
- **D-02:** Exactly one Bolt process across every worktree. Before starting Bolt, check `ps aux | grep -i bolt` (or open terminals) and kill any other instance. Socket Mode load-balances events across every connection on the app token.
- **D-03:** Subscribe to `message.channels` and filter by the `SLACK_WATCH_CHANNEL_IDS` env allowlist (read via `lib/config.ts`, never `process.env`). The handler's **first line** drops: channels outside the allowlist, bot messages (incl. the bot's own cards), and edit/delete subtypes. A dropped message produces no log line at all (success criterion 1).
- **D-04:** A message that survives the filter emits a log line within 1 second, then calls the same dispatch function Phase 1's `app_mention` path uses (`dispatchAgentRun`, inherited from Phase 1 D-01/D-04). Inline dispatch only; `AGENT_TRANSPORT` is Phase 4.
- **D-05:** The "Extract action items" message shortcut, `app_mention` and `/secretary` each reach the handler, confirmed by a log line. They route to the same dispatch function as the watched-channel path.
- **D-06:** This is the **first thing cut** if the phase overruns: drop `/secretary` and shortcut wiring, keep only the watched-channel path. Never cut the card, the update, or email resolution.
- **D-07:** `ack()` is the literal first statement of every listener that receives an `ack` (actions, shortcuts, commands). Slow work runs after ack, so Slack never retries and no duplicate cards appear. Detection: a repeated `event_id` within seconds in the log means ack was late.
- **D-08:** The Block Kit card shows the proposal's title, HKT time, duration, participants and confidence, with **Approve** and **Reject** buttons.
- **D-09:** Conventions inherited from Phase 1 D-03, not re-decided: action ids `approve_proposal` and `reject_proposal`; button `value` = proposal id.
- **D-10:** HKT formatting reuses Phase 1's `utils/time.ts` formatter (Phase 1 D-08). No second formatter, no date library.
- **D-11:** On Approve or Reject, the same message updates via `chat.update` using the `card_channel` + `card_ts` **stored on the Proposal row** (Phase 1 D-02), never the channel/ts from the click payload. Buttons are replaced by a status chip: `confirmed` for Approve, `dismissed` for Reject. No new message appears.
- **D-12:** The click handler reads the proposal id from `action.value` as its first act after `ack()`. The real approve body (organizer claim, Calendar write, both links) is Phase 4; this phase only proves the button → row → `chat.update` chip path.
- **D-13:** A participant's email is resolved from their Slack profile via `users.info` (scope `users:read.email`). It lives in `lib/slack/**`. Load-bearing for Phase 4's invite, so it's never cut.
- **D-14:** Owned: `lib/slack/**`. Must not touch: `lib/calendar/**`, `app/**`, `components/**`, `lib/agent/**`, `lib/ai/**`. Named overlaps, extend-only: `types/`, `lib/config.ts`, `prisma/schema.prisma` (merge `develop` first).
- **D-17:** `lib/slack/bolt.ts` stays registration-only. Handler bodies live in separate files, so Phases 4, 5 and 7 can append without restructuring this phase's registrations.
- **D-18:** Bolt runs in Socket Mode with no inbound port. Postgres :5432 is shared and read against hand-seeded rows.
- **D-19:** 2 plans: `02-01` (Bolt runtime smoke test + watched-channel filter + shortcut/mention/slash wiring + ack-first pattern), `02-02` (real approval card + `chat.update` status chip + `users.info` email resolution).

### Claude's Discretion

- Card copy, layout and status-chip wording/format. Confidence is displayed as a number or percent.
- Whether `users.info` results are cached in-process for the demo, and where the resolved email is used this phase: logged, card participant display, and/or `Participant.email` write.
- Whether a Reject/Approve click also sets `Proposal.status` (`dismissed` / `confirmed`) in this phase. Phase 1 D-02 already sets `confirmed` on Approve, so mirroring `dismissed` on Reject is the consistent default.
- File split inside `lib/slack/**` (kebab-case, named exports, TSDoc on every function).
- Log format for the "reached the handler" lines.
- How the message shortcut's `callback_id` is named, as long as it matches the installed app config exactly.

### Deferred Ideas (OUT OF SCOPE)

- Real approve body (read row → organizer claim → Calendar event → confirmed card with event + Meet links), double-click/redelivery guard, `AGENT_TRANSPORT`, Trigger.dev task: Phase 4.
- "Edit & approve" card variant, `views.open` modal, `view_submission`: Phase 5 (append-only to `lib/slack/**`).
- Conflict card variant and `/secretary scan`: Phase 7.
- Real extraction replacing the hardcoded `runAgent` stub: Phase 5.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SLK-02 | Watched-channel messages reach the agent unprompted; other channels/bot/edit-delete dropped on the first line, no log line | §Common Pitfalls 1–2; §Code Examples "watched-channel handler skeleton" |
| SLK-03 | Message shortcut, `app_mention`, `/secretary` each reach the handler | §Code Examples "secondary trigger handlers"; §Common Pitfalls 4 |
| SLK-04 | Every listener acks within 3s and hands slow work off | §Architecture Patterns "Ack discipline"; §Common Pitfalls 3 |
| SLK-05 | Approval card shows title, HKT time, duration, participants, confidence, Approve+Reject | §Code Examples "buildApprovalBlocks"; Block Kit field limits verified |
| SLK-06 | `chat.update` in place using stored channel+ts, buttons→status chip | §Common Pitfalls 5; §Code Examples "chat.update always-pass-both" |
| SLK-08 | Email resolved via `users.info` | §Common Pitfalls 6; §Code Examples "resolveParticipantEmail" |
</phase_requirements>

## Summary

This phase's risk is not "does the API work" — every Slack surface used here (message events, shortcuts, slash commands, `block_actions`, `chat.update`, `users.info`) is stable, well-documented API surface with no version-specific gotchas found for `@slack/bolt` 5.1.0. The risk is entirely in three places, in order of how much time they'd cost if mis-planned:

1. **Ack is two different contracts, not one.** Bolt's official docs state explicitly that "actions, commands, and options requests must always be acknowledged" via a listener-supplied `ack()` function — and the `message`/`app_mention`/`event()` listener signatures documented and shown in every official code sample never include `ack` in their destructured args. The correct reading (confirmed by the shape of every official example, not by a single explicit "events are auto-acked" sentence — flagged `[ASSUMED]` in the Assumptions Log) is: **event listeners have no ack contract at all** — Bolt's receiver acks the Socket Mode envelope for Events-API payloads on its own, before your listener code runs — while **action/shortcut/command/view listeners must call the injected `ack()` as literally their first line**, per D-07. Planning both trigger families under one mental model ("everything needs `ack()`") produces dead code in the `message.channels` handler; planning them as "events: fire and forget, interactive: ack-first" matches both the docs and D-01–D-07/D-09's own split (`app.message`/`app.event`/`app.shortcut` for message shortcuts are actually the outlier — shortcuts DO get `ack`, since they arrive as interactivity payloads, not Events API).
2. **`chat.update`'s `text`-without-`blocks` behavior actively deletes the card's blocks** — confirmed via `docs.slack.dev/reference/methods/chat.update` this session: passing `text` without `blocks` **removes** the existing blocks and falls back to plain text. The only safe pattern for the status-chip transition (SLK-06) is to always construct and pass **both** `text` and `blocks` explicitly on every `chat.update` call — never rely on omission to "just update the text" or "just update the blocks."
3. **The bun+bolt-js Socket Mode WebSocket-parse bug (`oven-sh/bun#4663`, `slackapi/bolt-js#2118`) is still closed "not planned," filed against bun 1.0.0–1.1.8, and this session's WebSearch found zero newer (2025/2026) reports either confirming or denying it persists on bun 1.4.x** — the D-01 smoke test is exactly the right mitigation already locked; this research adds nothing beyond confirming no shortcut exists to skip it.

Everything else researched (Block Kit button/action_id/value limits, `users.info` scope requirements, message-shortcut payload shape, slash-command payload shape, GenericMessageEvent's TypeScript surface) confirms the CONTEXT.md/PITFALLS.md assumptions were correct and gives exact values to copy.

**Primary recommendation:** Treat `message`/`app_mention` listeners as ack-free (no `ack` in the destructure, nothing to call) and `action`/`shortcut`/`command` listeners as ack-first (`await ack()` literally line one); always pass `text` **and** `blocks` together on every `chat.postMessage`/`chat.update` call, never one without the other.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Watched-channel message filtering (SLK-02) | Bolt process (`lib/slack/`) | — | Only the process holding the Socket Mode connection ever sees `message.channels` events; filtering is a pure in-process guard, no DB/network needed to decide drop-vs-dispatch |
| Secondary trigger routing (SLK-03) | Bolt process (`lib/slack/`) | Backend (`lib/agent/dispatch.ts`) | Bolt receives and type-narrows the payload; all three triggers converge on the same `dispatchAgentRun` call already owned by `lib/agent/` (Phase 1) |
| Ack discipline (SLK-04) | Bolt process | — | `ack()` is a Socket Mode envelope response; no other tier can call it, and it must happen before any DB/network hop |
| Approval card composition (SLK-05) | Backend (`lib/slack/blocks.ts`) | Bolt process (holds token to post) | Pure function building Block Kit JSON; posting is a thin `WebClient` call, same split as Phase 1 |
| In-place card update (SLK-06) | Backend (`lib/slack/update-proposal-card.ts`) | Database (read stored channel/ts) | The Proposal row is the source of truth for channel/ts (D-11); the update function reads it, never the click payload |
| Email resolution (SLK-08) | Backend (`lib/slack/`) via Slack Web API | — | `users.info` is a plain Web API call; no Bolt-specific machinery needed, callable from any process holding the bot token |

No capability here is misassigned relative to Phase 1's map; this phase only adds nodes inside the already-fixed Bolt-process/backend split.

## Standard Stack

No new packages this phase. `@slack/bolt@5.1.0` and `@slack/web-api@8.1.1` are already pinned and installed in Phase 1 (D-21 of Phase 1 CONTEXT); this phase only writes code against them. **Package Legitimacy Audit is skipped** — the gate applies only when a phase installs external packages, and this phase installs none (D-14: `lib/slack/**` only, no `package.json`/`bun.lock` touches).

### Installation

```bash
# none — Phase 1 already installed @slack/bolt@5.1.0, @slack/web-api@8.1.1
```

## Architecture Patterns

### System Architecture Diagram

```
Slack workspace
  │
  ├─ message.channels event ─────────────┐
  ├─ app_mention event ───────────────────┤
  ├─ "Extract action items" shortcut ─────┤   (all over the same Socket Mode WebSocket —
  ├─ /secretary slash command ────────────┤    exactly one Bolt process may hold it, D-02)
  ▼                                       ▼
┌───────────────────────────────────────────────────┐
│ Bolt process (bun lib/slack/bolt.ts) — registration only (D-17) │
│                                                                  │
│  message.channels handler (no ack contract — event listener)    │
│    1. FIRST LINE: drop if channel ∉ SLACK_WATCH_CHANNEL_IDS,     │
│       or bot_id present, or subtype ∈ {bot_message,              │
│       message_changed, message_deleted, message_replied,         │
│       channel_join, ...}. Dropped → no log line at all.          │
│    2. Survives → log line within 1s → dispatchAgentRun(input)    │
│                                                                    │
│  app_mention handler (event listener, same dispatch)              │
│  shortcut handler (message_action, HAS ack — call first)          │
│  command handler (/secretary, HAS ack — call first)               │
│    → all three converge on the SAME dispatchAgentRun call         │
│                                                                     │
│  action handler: approve_proposal / reject_proposal (HAS ack)      │
│    1. await ack() — FIRST STATEMENT (D-07)                         │
│    2. read proposal id from action.value                           │
│    3. read Proposal row (card_channel, card_ts) from Postgres      │
│    4. UPDATE status = confirmed | dismissed                        │
│    5. chat.update(card_channel, card_ts, text+blocks) → status chip│
└──────────────────────────┬──────────────────────────────────────┘
                            │ lib/slack/blocks.ts (pure builders)
                            │ lib/slack/post-proposal-card.ts /
                            │ lib/slack/update-proposal-card.ts
                            ▼
                   Slack card appears / updates in place
```

Every arrow into the Bolt box is a Socket Mode envelope; every arrow out is a `WebClient` call using the same bot token. Nothing in this diagram touches Calendar or an LLM (SLK-07 boundary, inherited from Phase 1).

### Ack Discipline — the two contracts

| Listener type | Registered via | Receives `ack`? | Correct pattern |
|---|---|---|---|
| `message.channels` event | `app.message(...)` or `app.event("message")` | No — not in the documented destructure of any official example `[CITED: docs.slack.dev/tools/bolt-js/concepts/message-listening]` | First line is the filter; nothing to ack. Bolt's receiver already acked the Socket Mode envelope before invoking the listener `[ASSUMED — inferred from absence, not an explicit statement; see Assumptions Log A1]` |
| `app_mention` event | `app.event("app_mention", ...)` | No (same as above) | Same — no `ack()` call anywhere in the handler |
| Message shortcut (`type: "message_action"`) | `app.shortcut({callback_id, type: "message_action"}, ...)` | **Yes** — official example destructures `{ shortcut, ack, client, logger }` `[VERIFIED: docs.slack.dev/tools/bolt-js/concepts/shortcuts/]` | `await ack()` first statement |
| `/secretary` slash command | `app.command("/secretary", ...)` | **Yes** — official docs state "actions, commands, and options requests must always be acknowledged" `[CITED: docs.slack.dev/tools/bolt-js/concepts/acknowledge/]` | `await ack()` first statement |
| `block_actions` (Approve/Reject) | `app.action("approve_proposal", ...)` / `app.action("reject_proposal", ...)` | **Yes** | `await ack()` first statement (D-07, already locked) |

**Why "app.message() vs app.event('message')" doesn't matter for this phase:** `app.message()` is Bolt's convenience wrapper around `app.event("message", ...)` with optional string/RegExp pattern-matching middleware layered in front — both receive the same `GenericMessageEvent`-shaped payload and neither receives `ack`. Use `app.message()` bare (no pattern arg) for the watched-channel listener since D-03's filter is channel/subtype/bot-id logic, not text pattern matching — a RegExp filter here would just be a second, redundant gate.

**Late-ack consequence, confirmed:** GitHub issue reports (`slackapi/bolt-js#2487`, aggregated via WebSearch, `[CITED — secondary, cross-referenced across multiple issue threads]`) show the Socket Mode envelope carries `retry_attempt` (0, 1, 2, ...) and `retry_reason` (e.g. `"timeout"`) fields on redelivery — this is the mechanism behind D-07's "a repeated `event_id` within seconds in the log means ack was late" detection. No official `docs.slack.dev` page was found this session spelling out the envelope's retry fields explicitly; treat this as `[CITED: MEDIUM confidence, GitHub issue aggregation]`, not `[VERIFIED]`.

### "Hand off slow work" without Trigger.dev

Phase 4 doesn't exist yet, so "hand off" in this phase means: `await ack()` (interactive listeners) or nothing (event listeners), then run `dispatchAgentRun(...)` as a normal `await`ed call in the same async function — there is no separate queue or non-awaited continuation to build. Because Phase 1's `runAgent` stub is synchronous/fast (hardcoded body, no LLM/Calendar call), the "acked-then-slow-work" ordering matters procedurally (ack first, in source order) but there's no actual latency risk to defend against yet — Trigger.dev is what exists specifically to solve this problem once `runAgent` becomes a real, slow LLM call in Phase 5. Do not build a manual non-awaited/fire-and-forget pattern here; it would just be extra code Phase 4 replaces.

### Recommended File Split (D-17: registration-only `bolt.ts`)

```
lib/slack/
  bolt.ts                    # entry: App construction + every app.message/event/shortcut/command/action registration, no logic
  handlers/
    watched-channel-message.ts   # SLK-02: filter + dispatch
    app-mention.ts                # SLK-03
    extract-shortcut.ts            # SLK-03: message_action shortcut
    secretary-command.ts            # SLK-03: /secretary
    approve-proposal.ts              # SLK-04/06: ack-first, chat.update to confirmed
    reject-proposal.ts                # SLK-04/06: ack-first, chat.update to dismissed
  blocks.ts                   # buildApprovalBlocks / buildConfirmedBlocks / buildDismissedBlocks (Phase 1 stub → real)
  post-proposal-card.ts        # Phase 1 stub → real (unchanged signature)
  update-proposal-card.ts       # Phase 1 stub → real (unchanged signature)
  resolve-email.ts               # SLK-08: users.info wrapper
  client.ts                       # Phase 1: standalone WebClient singleton (unchanged)
```

This matches D-17's constraint exactly: `bolt.ts` only imports and calls `app.message(...)`/`app.event(...)`/`app.shortcut(...)`/`app.command(...)`/`app.action(...)` with a handler function imported from `handlers/`, so Phases 4/5/7 append new files to `handlers/` and add one registration line each without touching existing registrations.

### Anti-Patterns to Avoid

- **Calling `ack()` inside an event listener (`message`, `app_mention`) "to be safe."** There is no `ack` in the destructured args for these — TypeScript will not compile a reference to an undefined `ack`, so this fails loudly, not silently, but don't reach for it out of habit copied from the action handler.
- **Passing `text` alone to `chat.update` when only the status chip should change.** Confirmed this session: `text`-without-`blocks` **deletes** the blocks (see Common Pitfalls 5). Always build and pass the full new `blocks` array plus a matching `text` fallback.
- **Reading `body.channel.id`/`body.message.ts` from the `block_actions` click payload for the update call.** D-11 locks the stored `card_channel`/`card_ts`; PITFALLS.md's "`chat.update` needs the exact channel + ts" gotcha explains why this drifts.
- **Registering the message shortcut's handler with a `callback_id` that doesn't exactly match the string configured in the Slack app manifest/config.** Produces a silent "didn't respond in time" from Slack's side with **no server-side error at all** — confirmed via `docs.slack.dev/interactivity/handling-user-interaction`: "your app must reply... within 3 seconds. If your app doesn't do that, the Slack user who interacted with the app will see an error message" — there's no log line to grep for, only the Slack-side timeout message the user sees. Test it once immediately after wiring, per D-05.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Message subtype/bot filtering | A custom regex over the raw event JSON | `event.subtype` equality checks + `event.bot_id` presence check, both already-typed fields on `GenericMessageEvent` `[VERIFIED: docs.slack.dev/tools/node-slack-sdk/reference/types/interfaces/GenericMessageEvent/]` | The fields exist on the type already; no parsing needed |
| `block_actions` button-click type narrowing | A hand-rolled type guard | `body as BlockButtonAction` — already established in Phase 1 RESEARCH.md's `approve_proposal` example; reuse the identical pattern for `reject_proposal` | One proven pattern, don't invent a second |
| Dedupe against Slack retries | A persistent dedupe table/Redis set | An in-process `Set<string>` of seen `event_id`s (or `client_msg_id` for messages), cleared on process restart | Ponytail: the Bolt process runs once for the whole demo window, never restarts mid-run; a durable store solves a problem (surviving a restart) this demo doesn't have. `ponytail: in-memory Set, upgrade to Redis/DB if the process needs to survive restarts across a longer-lived deployment` |
| HKT time display on the card | A second formatter | `utils/time.ts`'s existing HKT formatter (Phase 1 D-08, locked D-10) | Already built, already tested by Phase 1's exit criterion |

**Key insight:** every hand-roll temptation in this phase is either already-typed data on the event object or an already-built Phase 1 utility — this phase is almost entirely wiring, not new logic.

## Common Pitfalls

*(Phase-2-specific corrections/additions this research session surfaced beyond PITFALLS.md's Pitfall 1/5/10 and Moderate section, already read as canonical refs.)*

### Pitfall 1: Treating event listeners and interactive listeners as needing the same ack pattern

**What goes wrong:** Copy-pasting the `await ack()`-first pattern from the action handler into the `message.channels`/`app_mention` handlers — either a compile error (no `ack` in scope) or, if a generic `(args) => {...}` signature is used without strict typing, a silent `undefined` call that throws at runtime.

**Why it happens:** D-07 says "ack() is the literal first statement of every listener that receives an ack" — read carelessly under time pressure, "every listener" can be misread as "every listener, period," when the qualifier "that receives an ack" is exactly the distinction that matters.

**How to avoid:** Build the watched-channel/app_mention handlers first with a destructure that doesn't include `ack` at all (`{ event, client, logger }`) — TypeScript then makes misuse of a nonexistent `ack` impossible, rather than relying on remembering the rule.

**Warning signs:** A TypeScript error referencing `ack` in a `message`/`event` handler body — that's the compiler doing the check for you, don't suppress it.

**Phase to address:** `02-01`, at the moment the first `message.channels` handler is scaffolded.

---

### Pitfall 2: `bot_id` filter alone isn't enough — the bot's own card posts don't always look the same as its own re-edits

**What goes wrong:** Filtering only `event.bot_id === myBotId` catches the bot's own new messages, but `message_changed`/`message_deleted` subtype events have a different payload shape (the changed/deleted message is nested under `event.message`, not at the top level) — a naive `event.bot_id` check on the outer event object can miss these, since the top-level `message_changed` event itself has no `bot_id` (the nested `event.message.bot_id` does).

**Why it happens:** `message.channels` subscribes to the whole message-lifecycle event family, not just new-message creation; subtype events reshape where fields live.

**How to avoid:** Check `event.subtype` **before** trying to read `bot_id` at all: if `subtype` is anything other than `undefined` (or another explicit non-dispatch-worthy value from D-03's list), drop immediately — don't try to dig into a nested shape to extract a bot id from an edit/delete event just to filter it, since it should already be dropped by the subtype check alone.

**How to avoid (concrete filter order):**
```ts
if (event.channel_type !== "channel") return;                    // safety net beyond the allowlist
if (!config.slack.watchChannelIds.includes(event.channel)) return; // SLK-02 allowlist
if (event.subtype !== undefined) return;                           // drops bot_message, message_changed,
                                                                      // message_deleted, message_replied,
                                                                      // channel_join, file_share, thread_broadcast — everything
if (event.bot_id) return;                                          // belt-and-suspenders for the rare bot post with no subtype
```

**Warning signs:** A log line appears for what turns out to be the bot's own confirmed-chip `chat.update` (chat.update does not create a new event and thus never re-triggers this — but a *new* `chat.postMessage` from the bot, e.g. a future error-reply message, would).

**Phase to address:** `02-01`, watched-channel handler's first-line filter (SLK-02).

---

### Pitfall 3: Ack-before-await isn't automatic — it's about statement order, not framework magic

**What goes wrong:** Writing `const proposal = await prisma.proposal.findUnique(...); await ack();` compiles fine and *usually* still completes within 3 seconds during dev (fast local Postgres), so the bug doesn't show up until a slower network hop (or, live, if Postgres is momentarily slow) pushes past 3 seconds and Slack redelivers the click — producing a second `chat.update` call racing the first.

**Why it happens:** Nothing in Bolt enforces "ack first" structurally; it's purely a hand-written ordering discipline, and JS's implicit async ordering makes "it worked in dev" a false signal.

**How to avoid:** `await ack();` is the first line of every action/shortcut/command handler body, full stop, before any other statement — including a `try` block that wraps later logic. This is exactly D-07, restated here because it's cheap to violate accidentally under time pressure and expensive to debug live.

**Warning signs:** Two `chat.update` calls for one click, visible as a flicker in the Slack UI or two log lines for one `action.value`.

**Phase to address:** `02-02`, both `approve_proposal` and `reject_proposal` handlers.

---

### Pitfall 4: `chat.update` silently drops blocks when only `text` is passed

**What goes wrong:** Calling `client.chat.update({ channel, ts, text: "Confirmed ✅" })` without `blocks` removes the card's existing Block Kit layout entirely and shows plain text — not what SLK-06's "buttons replaced by a status chip" (a *block-based* chip, per the retro theme conventions) requires.

**Why it happens:** Confirmed via `docs.slack.dev/reference/methods/chat.update` this session: "If the `text` argument is provided and `blocks` are not provided, the `blocks` will be removed, and the provided `text` will be used for message rendering."

**How to avoid:** Every `chat.update` call in this phase passes **both** `text` (a short fallback string, e.g. the proposal title + status word) **and** `blocks` (the full rebuilt block array with buttons removed and a status chip block added) — never one without the other. This mirrors Phase 1's requirement that `chat.postMessage`/`chat.update` always carry a top-level `text` fallback (01-RESEARCH.md), extended here with the blocks-removal gotcha specifically for `update`.

**Warning signs:** The card visually collapses to a single line of plain text after Approve/Reject, instead of showing a status chip in the same block layout.

**Phase to address:** `02-02`, `update-proposal-card.ts`.

---

### Pitfall 5: `users.info` needs BOTH scopes, not either — and Phase 1's manifest listed only `users:read.email` in the pre-window checklist

**What goes wrong:** Assuming `users:read.email` alone is sufficient (it's the scope name that sounds most directly relevant) and the call 403s or returns a user object with no `email` field.

**Why it happens:** Confirmed via `docs.slack.dev/reference/methods/users.info` this session: "Apps created after January 4th, 2017 must request both the `users:read` and `users:read.email`" scopes to get the email field back. PROJECT.md's pre-setup list names `users:read.email`, `chat:write`, `commands` explicitly but does not separately call out plain `users:read` — worth a one-call verification per PITFALLS.md's existing "Moderate" pitfall on this exact topic (already a canonical ref), this research just adds the precise dual-scope requirement as the thing to check for.

**How to avoid:** One real `users.info` call against user B's id, first thing in `02-02` before building the resolve-email wrapper's real logic, confirming the response actually contains `profile.email` — not just a 200 status.

**Warning signs:** `missing_scope` error code, or a 200 response whose `user.profile.email` is `undefined`/absent (a scope-mismatch that doesn't even error).

**Phase to address:** `02-02`, before writing `resolve-email.ts`'s real body.

---

## Code Examples

### Watched-channel handler skeleton (SLK-02, no `ack` — event listener)

```typescript
// Source: docs.slack.dev/tools/bolt-js/concepts/message-listening/ (subtype filter pattern),
// docs.slack.dev/tools/node-slack-sdk/reference/types/interfaces/GenericMessageEvent/ (fields)
import type { GenericMessageEvent } from "@slack/bolt";
import { config } from "../../config";
import { dispatchAgentRun } from "../../agent/dispatch";

/**
 * Handles every `message.channels` event. Drops anything outside the
 * watched-channel allowlist, bot traffic, and non-plain-message subtypes
 * on the first line — a dropped message produces no log line at all.
 * @param args Bolt's event listener args (`event`, `client`, `logger`) — no `ack` here, this is an Events API payload, not interactivity
 * @returns void — never throws to Slack; all failures are caught and logged
 */
export async function handleWatchedChannelMessage({
  event,
  logger,
}: {
  event: GenericMessageEvent;
  logger: { info: (msg: string) => void };
}): Promise<void> {
  if (!config.slack.watchChannelIds.includes(event.channel)) return; // SLK-02 allowlist
  if (event.subtype !== undefined) return; // drops bot_message, message_changed, message_deleted,
  // message_replied, channel_join, file_share, thread_broadcast — every non-plain-message subtype
  if (event.bot_id) return; // belt-and-suspenders for a rare bot post with no subtype

  logger.info(`watched-channel message reached handler: ts=${event.ts}`);

  await dispatchAgentRun({
    teamId: config.slack.teamId,
    channelId: event.channel,
    ts: event.ts,
    threadTs: event.thread_ts,
    userId: event.user,
    text: event.text ?? "",
  });
}
```

Register with `app.message(handleWatchedChannelMessage)` (bare — no pattern middleware; the filter above already is the gate) in `bolt.ts`.

### Secondary trigger handlers converging on the same dispatch (SLK-03)

```typescript
// Source: docs.slack.dev/tools/bolt-js/concepts/shortcuts/ (message shortcut shape + ack),
// docs.slack.dev/interactivity/implementing-slash-commands (command payload fields)

/** app_mention: bot's own mention text includes a leading "<@BOTID> " — strip it before dispatch if needed. No `ack` — Events API. */
export async function handleAppMention({ event, logger }: /* SlackEventMiddlewareArgs<"app_mention"> */ any) {
  logger.info(`app_mention reached handler: ts=${event.ts}`);
  await dispatchAgentRun({ /* ...same shape as above, text has the <@BOTID> prefix, extraction phase 5 will strip it */ });
}

/** Message shortcut "Extract action items" — HAS ack, call first. */
export async function handleExtractShortcut({ shortcut, ack, logger }: /* SlackShortcutMiddlewareArgs */ any) {
  await ack(); // FIRST STATEMENT
  logger.info(`shortcut reached handler: ts=${shortcut.message.ts}`);
  await dispatchAgentRun({
    teamId: shortcut.team.id,
    channelId: shortcut.channel.id,
    ts: shortcut.message.ts,
    userId: shortcut.message.user,
    text: shortcut.message.text ?? "",
  });
}

/** /secretary slash command — HAS ack, call first. No message ts exists for a slash command. */
export async function handleSecretaryCommand({ command, ack, logger }: /* SlackCommandMiddlewareArgs */ any) {
  await ack(); // FIRST STATEMENT
  logger.info(`slash command reached handler: user=${command.user_id}`);
  await dispatchAgentRun({
    teamId: command.team_id,
    channelId: command.channel_id,
    ts: undefined, // slash commands carry no message ts — dispatchAgentRun/dedupe must tolerate this
    userId: command.user_id,
    text: command.text ?? "",
  });
}
```

`dispatchAgentRun`'s exact parameter type is Phase 1's, not re-decided here — confirm against `types/agent.ts`'s `RunAgentInput` before wiring (D-16 extend-only rule).

### Ack-first action handler, reject variant (SLK-04/06, mirrors Phase 1's `approve_proposal`)

```typescript
// Source: pattern mirrors 01-RESEARCH.md's approve_proposal handler exactly, extended for reject + chat.update text+blocks pitfall
import type { BlockButtonAction } from "@slack/bolt";
import { prisma } from "../../db";
import { updateProposalCard } from "../update-proposal-card";
import { buildDismissedBlocks } from "../blocks";

/**
 * Handles the Reject button click on a Proposal card.
 * @throws never — all failures are caught and logged; Slack must not see a thrown error here
 */
export async function handleRejectProposal({
  ack,
  body,
}: Parameters<Parameters<typeof import("@slack/bolt").App.prototype.action>[1]>[0]) {
  await ack(); // FIRST STATEMENT — D-07

  const action = (body as BlockButtonAction).actions[0];
  const proposalId = action.value;
  if (!proposalId) return;

  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return;

  await prisma.proposal.update({ where: { id: proposalId }, data: { status: "dismissed" } });

  // updateProposalCard must pass BOTH text and blocks — text-only drops the blocks (Pitfall 4)
  await updateProposalCard(proposal.card_channel, proposal.card_ts, buildDismissedBlocks(proposal));
}
```

### `chat.update` always passing `text` + `blocks` together (SLK-06, Pitfall 4)

```typescript
// Source: docs.slack.dev/reference/methods/chat.update — "text without blocks removes blocks"
import { slackClient } from "./client";

/**
 * Updates a Proposal's card in place using the channel+ts stored on the row.
 * Always passes both `text` and `blocks` — chat.update drops existing blocks
 * if only `text` is supplied.
 * @param channel Proposal.card_channel (stored at post time, never the click payload)
 * @param ts Proposal.card_ts (stored at post time, never the click payload)
 * @param blocks Full rebuilt Block Kit array (buttons removed, status chip added)
 * @param fallbackText Short text fallback for notifications/accessibility
 */
export async function updateProposalCard(
  channel: string,
  ts: string,
  blocks: unknown[],
  fallbackText: string,
): Promise<void> {
  await slackClient.chat.update({ channel, ts, text: fallbackText, blocks });
}
```

### Block Kit approval card with Approve + Reject (SLK-05, verified field limits)

```typescript
// Source: docs.slack.dev/reference/block-kit/block-elements/button-element/
// (value max 2000 chars [VERIFIED], action_id max 255 chars [VERIFIED], style: "primary"|"danger" [VERIFIED])
import { formatHkt } from "../../utils/time"; // Phase 1 D-08, reused per D-10

/**
 * Builds the pending-approval card blocks: title, HKT time, duration,
 * participants, confidence, Approve + Reject buttons.
 * @param p Minimal proposal shape needed for card rendering
 */
export function buildApprovalBlocks(p: {
  id: string;
  title: string;
  start: Date;
  end: Date;
  participants: string[];
  confidence: number;
}) {
  return [
    { type: "header", text: { type: "plain_text", text: p.title } },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*When:*\n${formatHkt(p.start)}` },
        { type: "mrkdwn", text: `*Duration:*\n${Math.round((p.end.getTime() - p.start.getTime()) / 60000)} min` },
        { type: "mrkdwn", text: `*Participants:*\n${p.participants.join(", ")}` },
        { type: "mrkdwn", text: `*Confidence:*\n${Math.round(p.confidence * 100)}%` },
      ],
    },
    {
      type: "actions",
      block_id: "proposal_actions",
      elements: [
        { type: "button", action_id: "approve_proposal", text: { type: "plain_text", text: "Approve" }, style: "primary", value: p.id },
        { type: "button", action_id: "reject_proposal", text: { type: "plain_text", text: "Reject" }, style: "danger", value: p.id },
      ],
    },
  ];
}

/** Status-chip variant: same header/section, actions block replaced with a context chip. */
export function buildConfirmedBlocks(p: { title: string }) {
  return [
    { type: "header", text: { type: "plain_text", text: p.title } },
    { type: "context", elements: [{ type: "mrkdwn", text: "✅ *Confirmed*" }] },
  ];
}

/** Dismissed variant, mirrors buildConfirmedBlocks. */
export function buildDismissedBlocks(p: { title: string }) {
  return [
    { type: "header", text: { type: "plain_text", text: p.title } },
    { type: "context", elements: [{ type: "mrkdwn", text: "❌ *Dismissed*" }] },
  ];
}
```

`value: p.id` — a `cuid()` proposal id is well under the 2000-char limit, no truncation risk `[VERIFIED: docs.slack.dev/reference/block-kit/block-elements/button-element/]`.

### `resolveParticipantEmail` (SLK-08, dual-scope requirement)

```typescript
// Source: docs.slack.dev/reference/methods/users.info — both users:read AND users:read.email required
import { slackClient } from "./client";

const emailCache = new Map<string, string | undefined>(); // ponytail: in-process cache, cleared on restart — fine, process runs once per demo

/**
 * Resolves a Slack user's email via users.info. Requires both `users:read`
 * and `users:read.email` scopes on the installed app (not just the manifest).
 * @param slackUserId Slack user id (e.g. `U12345`)
 * @returns email string, or undefined if the user has none (bot users never do)
 * @throws if the Slack API call itself errors (missing_scope, user_not_found) — caller decides fallback
 */
export async function resolveParticipantEmail(slackUserId: string): Promise<string | undefined> {
  if (emailCache.has(slackUserId)) return emailCache.get(slackUserId);
  const result = await slackClient.users.info({ user: slackUserId });
  const email = result.user?.profile?.email;
  emailCache.set(slackUserId, email);
  return email;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Assuming `oven-sh/bun#4663`/`slackapi/bolt-js#2118` (filed bun 1.0.0–1.1.8) still blocks Socket Mode | Both closed "not planned"; no newer (2025/2026) reports found confirming or denying persistence on bun 1.4.x this session | Issues closed years ago, current status unchanged | D-01's smoke test remains the only way to know for *this* bun version — treat as unresolved-by-research, resolved-by-test |
| `chat.update({text})` assumed to "just update the text and leave blocks alone" | Confirmed: `text`-without-`blocks` removes blocks entirely | N/A — this has been the documented behavior, not a recent change; new information for this build, not a platform change | Every `chat.update` call in `lib/slack/**` must pass both fields, permanently |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Event listeners (`message`, `app_mention`) have no `ack` contract and Bolt's own Socket Mode receiver handles the envelope ack internally, without the developer calling anything | Architecture Patterns "Ack Discipline" | Low — TypeScript will not compile a reference to a nonexistent `ack` in a strictly-typed event handler, so a wrong assumption here fails at compile time, not silently on stage; if somehow wrong, the fix is a one-line addition, not a redesign |
| A2 | Socket Mode envelope's `retry_attempt`/`retry_reason` fields (used for D-07's late-ack detection) are real and named exactly this, based on GitHub issue aggregation, not an official docs page found this session | Architecture Patterns "Late-ack consequence" | Low — D-07's actual detection method (watch for a repeated `event_id`/duplicate log line) doesn't depend on reading these specific field names; they're supplementary context, not load-bearing for the plan |
| A3 | `app.message()` bare (no pattern) and `app.event("message", ...)` receive an identical payload shape for this phase's purposes | Architecture Patterns "Why app.message() vs app.event('message') doesn't matter" | Low — both are documented Bolt APIs for the same underlying event; if a shape difference exists it would surface immediately as a TypeScript error against `GenericMessageEvent`, not a runtime surprise |
| A4 | `pgrep -af "lib/slack/bolt.ts"` is a valid, more precise alternative to CONTEXT.md D-02's `ps aux \| grep -i bolt` on the WSL Ubuntu target machine | Common Pitfalls / process-check tooling note | Low — standard Unix tool knowledge, not independently verified on the target WSL box this session (wrong OS, per Environment Availability); `ps aux \| grep -i bolt` (already locked in D-02) works regardless and is the actual planned check |

**If this table is empty:** N/A — see rows above; none of these carry more than low risk given each has a cheap, immediate detection mechanism (compile error or the already-locked fallback check).

## Open Questions

1. **Does bun 1.4.x actually still hit the Socket Mode WebSocket-parse bug from `oven-sh/bun#4663`?**
   - What we know: both source issues are closed "not planned," filed against bun 1.0.0–1.1.8 (three-plus major versions behind 1.4.2).
   - What's unclear: no 2025/2026 report was found either confirming a fix or a recurrence on current bun.
   - Recommendation: D-01's smoke test (first task of the phase) is the only real answer — don't spend further research time on this, the test is cheaper than more searching.

2. **Does the message shortcut's `shortcut.message.text` field reliably exclude bot-formatted mrkdwn artifacts (e.g. link markup) that would confuse Phase 5's extraction?**
   - What we know: the shortcut payload includes a `message` object with the raw message text.
   - What's unclear: whether Slack's stored `text` for a message with rich-text elements (links, emoji shortcodes) needs any cleanup before being fed to extraction.
   - Recommendation: not this phase's problem — `dispatchAgentRun`/`extractIntents` (Phase 5) own text normalization; this phase only needs the field to exist and be non-empty, which it is.

## Orchestrator Review Notes (read before the Code Examples are copied)

These corrections were verified or checked against locked decisions after the researcher finished. Where they disagree with the sections above, they win.

1. **A1 is now VERIFIED.** `slackapi/bolt-js` `v5.1.0` `src/App.ts` lines 1144–1154: for `IncomingEventType.Event` Bolt calls `await ack()` itself ("Events API requests are acknowledged right away"). The only exception is `function_executed`. `message`/`app_mention` listeners never see `ack`.
2. **Bolt already drops the bot's own events.** `ignoreSelf` defaults to `true` in `App` (`v5.1.0` `App.ts:303,442`). The `subtype`/`bot_id` checks stay as the D-03 first line, because other bots' posts still need dropping, but a feedback loop from our own card is already blocked by the framework.
3. **Keep Phase 1's locked signature.** Use `updateProposalCard(channel, ts, proposal)` (01-RESEARCH stub table), which builds `text` plus the status-appropriate blocks inside. The `(channel, ts, blocks, fallbackText)` example above contradicts both that table and the reject-handler example, which calls it with three args. Don't change a cross-track signature in a parallel wave.
4. **No `any` (repo rule), and use `@/` imports.**
   - Type the secondary handlers with Bolt's exported types: `AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_mention">`, `SlackShortcutMiddlewareArgs<MessageShortcut>`, `SlackCommandMiddlewareArgs`.
   - `app.message()` passes `SlackEventMiddlewareArgs<"message">`, whose `event` is the `MessageEvent` union, not `GenericMessageEvent`. Type the handler with that and narrow via `event.subtype === undefined`. A handler typed `{ event: GenericMessageEvent }` won't type-check against `app.message`.
   - Import with `@/lib/config`, `@/lib/db`, `@/utils/time` (tsconfig paths, which is why Bolt runs under bun or tsx), not `../../`.
5. **`/secretary` has no message `ts`.** `SlackMessage.ts` is a required `string` (Phase 1 type), and Phase 1 D-02 builds `dedupe_key` from the trigger `ts`, so `ts: undefined` in the example won't compile and would break dedupe. SLK-03 only requires "a log line confirms". The lazy default: `/secretary` acks and logs, and dispatches nothing (Phase 7's `scan` gives it a body). It's also the first cut under D-06.
6. **Duplicate cards and redelivery.** Skip the in-memory `event_id` `Set` unless duplicates are actually observed. `Proposal.dedupe_key` is `@unique` (FND-08) and the stub builds it from the trigger `ts`, so a redelivered event fails the insert instead of posting a second card, provided `runAgent` inserts the row **before** `postProposalCard`. The planner should confirm that order in the Phase 1 stub and catch the unique-violation as a no-op.
7. **Scope check to add to 02-02's first task:** one real `users.info` call returning `user.profile.email`. This proves both `users:read` and `users:read.email` are on the *installed* token (Pitfall 5 above).

## Environment Availability

Skipped in the technical sense — this phase's only external dependency is the Slack workspace itself (already installed, tokens issued, per PROJECT.md's pre-setup), and the `message.channels` scope + reinstall is explicitly a "Do Tonight" pre-window item in PITFALLS.md, not something this phase's plan installs. No new tool/runtime dependency is introduced beyond what Phase 1 already established (bun, the already-running Postgres). This research session ran on Windows (Git Bash), not the target WSL Ubuntu machine, so bun/Bolt startup itself could not be probed here — D-01's smoke test is the authoritative first-task check, not this section.

## Validation Architecture

Per DMO/project rules, **no test files of any kind** — every check below is a hand check under one minute, using log lines, a visible card, chip replacement, and `pgrep`/`ps aux`.

| Req ID | Behavior | Hand Check | Time |
|---|---|---|---|
| SLK-02 | Watched-channel filter | Post to the watched channel → log line within 1s; post to a different channel → no log line at all | <1 min |
| SLK-03 | Secondary triggers | Trigger shortcut, `@mention`, `/secretary` once each → one log line per trigger | <1 min |
| SLK-04 | Ack discipline | Click Approve/Reject once → exactly one `chat.update`, no duplicate `event_id` in the log | <1 min |
| SLK-05 | Card contents | Open the posted card → title, HKT time, duration, participants, confidence all visible; Approve + Reject buttons present | <1 min |
| SLK-06 | In-place update | Click Approve or Reject → same message becomes a status chip, no new message appears in the channel | <1 min |
| SLK-08 | Email resolution | Log or inspect the resolved email for a known Slack user id → matches the seeded profile email | <1 min |

**Wave 0 gaps:** none — this phase has no automated test infrastructure to stand up (project-wide rule), and every check above uses tooling already available (Bolt's own console, Slack UI, `ps aux`/`pgrep`).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No user-facing login in this phase; Slack's own Socket Mode token-based auth is library-internal |
| V3 Session Management | No | No sessions created |
| V4 Access Control | Partial | FEATURES.md's "Authorization check on click" note: any channel member can click Approve/Reject unless guarded. For the two-person demo this is explicitly accepted as low-risk (Claude's Discretion doesn't call for an organizer-identity check this phase; Phase 4 owns the real organizer-claim logic per APR-02) — **not fixed here, flagged for Phase 4's researcher** |
| V5 Input Validation | Yes | The `message.channels` handler's first-line filter (D-03) is itself the input-validation boundary — untrusted Slack event payloads are narrowed/dropped before any dispatch. `SLACK_WATCH_CHANNEL_IDS` continues to be read only through `lib/config.ts`'s Zod parse (Phase 1 D-15), never a second `process.env` read |
| V6 Cryptography | No | No new secret handling in this phase; bot/app tokens are already-established Phase 1 config values, read the same way |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Any channel member can click Approve/Reject on someone else's proposal | Elevation of Privilege | Accepted risk for the 2-user demo (see V4 above); Phase 4's organizer-claim `UPDATE ... WHERE organizer_user_id IS NULL` is the real mitigation, out of scope here |
| Slack event/interactivity payload spoofing | Spoofing | Handled entirely inside `@slack/bolt`'s Socket Mode client (token-based, no public HTTP endpoint) — no app code needed, unchanged from Phase 1 |
| Bot-message feedback loop (bot's own card content re-processed as user intent) | Tampering (data integrity) | D-03's subtype/`bot_id` filter, first line of the handler (Common Pitfalls 2) |

## Sources

### Primary (HIGH confidence)
- `docs.slack.dev/reference/block-kit/block-elements/button-element/` — button `value` (2000 char max), `action_id` (255 char max), `style` values (`primary`/`danger`), full JSON example
- `docs.slack.dev/reference/methods/chat.update` — channel-id requirement, `text`-without-`blocks` removes blocks, same-bot-token requirement
- `docs.slack.dev/reference/methods/users.info` — dual-scope requirement (`users:read` + `users:read.email`), error codes, rate tier (Tier 4)
- `docs.slack.dev/tools/bolt-js/concepts/shortcuts/` — message shortcut registration shape, `ack` present in destructure
- `docs.slack.dev/tools/node-slack-sdk/reference/types/interfaces/GenericMessageEvent/` — official type reference confirming `bot_id`, `channel`, `channel_type`, `ts`, `user`, `subtype` fields
- `docs.slack.dev/interactivity/implementing-slash-commands` — slash command payload field list, confirms no message `ts` field
- `docs.slack.dev/interactivity/handling-user-interaction` — 3-second ack requirement, silent-timeout user-facing behavior on missed ack
- `docs.slack.dev/apis/events-api/using-socket-mode/` — up to 10 concurrent connections, "no particular pattern" load-balancing guarantee, envelope_id ack mechanism
- `github.com/oven-sh/bun/issues/4663`, `github.com/slackapi/bolt-js/issues/2118` — both confirmed still "closed as not planned," filed bun 1.0.0–1.1.8, this session found no newer report either direction

### Secondary (MEDIUM confidence)
- `docs.slack.dev/tools/bolt-js/concepts/acknowledge/` — "actions, commands, and options requests must always be acknowledged"; does not explicitly state the negative for events (inference documented as Assumption A1)
- `docs.slack.dev/tools/bolt-js/concepts/message-listening/` — subtype filter pattern, `subtype()` middleware helper
- WebSearch aggregation across `slackapi/bolt-js#2487`, `#2238`, `#2188` — `retry_attempt`/`retry_reason` envelope field names, not independently confirmed against an official docs page this session

### Tertiary (LOW confidence)
- None — every claim above traces to an official `docs.slack.dev` page or a primary GitHub issue this session fetched directly.

## Metadata

**Confidence breakdown:**
- Block Kit field limits, `chat.update`/`users.info` semantics: HIGH — official docs, fetched and quoted this session
- Ack contract split (event vs. interactive listeners): MEDIUM — CITED for the interactive side, ASSUMED-by-inference for the event side (no explicit "events are auto-acked" sentence found)
- bun/bolt-js Socket Mode compatibility: MEDIUM — primary sources confirm no resolution status change, but current-bun behavior is untested by this research (wrong OS this session; D-01's smoke test is the actual test)

**Research date:** 2026-09-11
**Valid until:** Effectively for this build window only (Sat 12 Sep 2026) — hackathon build, not a long-lived reference document.
