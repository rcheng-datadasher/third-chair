# Requirements: AI Secretary

**Defined:** 2026-09-11
**Core Value:** Unprompted intent detection with an approval gate: an ordinary Slack message becomes an approvable proposal and, after one click, a real Google Calendar event with a Meet link. Nobody invokes the agent, and nothing reaches the calendar without approval.

Every requirement's check is a hand check that takes under a minute. No requirement is satisfied by, or requires, a test file.

## v1 Requirements

### Foundation (FND)

- [x] **FND-01**: `CLAUDE.md` exists before any feature code and states the repo rules: fixed folder structure (`app/ components/ components/ui/ hooks/ stores/ lib/{slack,calendar,ai,agent}/ utils/ types/ prisma/`), reuse-before-writing, TSDoc on every function (comments survive ponytail passes), single sources of truth (`lib/ai/provider.ts`, shadcn CSS variables, one typed env module), Biome only, no tests, Next.js conventions, Zustand not Context, React Hook Form + Zod, naming, Prisma singleton + `db push`, bun-only commands, one Bolt process at a time
- [x] **FND-02**: `README.md` skeleton exists with every required section heading (what it is, core functionality, how it differs, problems tackled, architecture, usage, scope/non-goals, production design notes)
- [x] **FND-03**: Next.js App Router + TypeScript + shadcn/ui + Tailwind v4 (PostCSS, CSS-first, no `tailwind.config.js`) + Biome run with bun; `bun run dev` serves a page and `bunx biome check` passes
- [x] **FND-04**: Dependencies are pinned exactly per research/STACK.md (Prisma 7.10.0 + adapter-pg; LangGraph, Trigger.dev and googleapis pins); `bun.lock` committed and `package-lock.json` gitignored
- [x] **FND-05**: `docker compose up` starts `postgres` (16-alpine, named volume, healthcheck, memory limit); `neo4j` (512m heap / 256m page cache) and `graph-service` start only under `--profile graph`; every credential and URL comes from env
- [x] **FND-06**: One typed config module is the only reader of `process.env`; `.env.local.example` and `.env.cloud.example` list every key
- [x] **FND-07**: Pointing `DATABASE_URL`/`DIRECT_URL` at hosted Postgres, or `NEO4J_URI` at Aura, works with an env edit and restart only: no code change, no conditional
- [x] **FND-08**: Prisma schema has `User` (`@@unique([team_id, slack_user_id])`), `Installation`, `Proposal` (unique `dedupe_key`), `Participant`, `ActionItem` (with `expires_at`), `Decision`, `Preference`; `bunx prisma db push` succeeds and one real query runs from a shared `globalThis` Prisma client singleton
- [ ] **FND-09**: Stub modules with fixed signatures and hardcoded bodies exist on `main` for every cross-track interface (shared `types/`, `lib/agent` `runAgent`/`extractIntents(messages[], ctx)`, `lib/slack` card builders/posters, `lib/calendar` freebusy/createEvent, `lib/ai/provider.ts`), so parallel tracks merge mechanically
- [x] **FND-10**: Seed data maps A's Slack user to A's Google refresh token and HKT timezone (hand-seeded; no account-linking UI)

### Slack surface (SLK)

- [ ] **SLK-01**: The Bolt process runs in Socket Mode as its own process (`bun lib/slack/bolt.ts`) and holds a stable connection for at least a minute
- [x] **SLK-02**: Messages in channels listed in `SLACK_WATCH_CHANNEL_IDS` reach the agent unprompted; messages from other channels, bot messages and edit/delete subtypes are dropped on the handler's first line
- [x] **SLK-03**: The "Extract action items" message shortcut, `app_mention` and `/secretary` each reach the handler (a log line confirms)
- [x] **SLK-04**: Every listener acks within 3 seconds and hands slow work off, so no duplicate cards appear from Slack retries
- [x] **SLK-05**: An approval card (Block Kit) shows the proposal's title, HKT time, duration, participants and confidence, with **Approve** and **Reject** buttons whose `value` carries the proposal id
- [x] **SLK-06**: On Approve or Reject, the same message updates in place via `chat.update` using the channel + ts stored on the Proposal; the buttons are replaced by a status chip (confirmed / dismissed)
- [ ] **SLK-07**: The trigger → hardcoded card → button → `chat.update` round trip works end to end before any LLM or calendar code exists
- [x] **SLK-08**: A participant's email is resolved from their Slack profile via `users.info`

### Calendar (CAL)

- [x] **CAL-01**: `freebusy.query` returns A's busy blocks for a given HKT window, with explicit `+08:00` offsets
- [x] **CAL-02**: `events.insert` creates an event on A's calendar with a Meet link (`conferenceDataVersion=1` + `createRequest.requestId`) visible when the event is opened
- [x] **CAL-03**: The event invites B by email with `sendUpdates: 'all'`, and B's inbox receives the invite
- [x] **CAL-04**: The event id is derived deterministically from the proposal id in the base32hex charset; a repeat insert hits 409, falls back to `events.get`, and is treated as success
- [x] **CAL-05**: Demo-created events are tagged (`extendedProperties.private.demo=true`) so they can be cleaned up

### Approval gate (APR)

- [ ] **APR-01**: Approving a Proposal runs ordinary backend code: read the row, claim the organizer, create the calendar event, update the card. No graph resume and no model call after approval
- [ ] **APR-02**: The organizer is claimed with `UPDATE "Proposal" SET organizer_user_id = $me WHERE id = $p AND organizer_user_id IS NULL RETURNING id`; no row back renders an "already scheduled" card state, not an error
- [ ] **APR-03**: Double-clicking Approve, or a Slack redelivery, creates exactly one calendar event
- [ ] **APR-04**: The confirmed card shows the calendar event link and Meet link
- [ ] **APR-05**: `AGENT_TRANSPORT=trigger|inline` switches between Trigger.dev and running the agent inline from Bolt with an env change and restart only

### Agent and confidence gate (AGT)

- [x] **AGT-01**: Every model call goes through `lib/ai/provider.ts`, which reads `AI_BASE_URL`, `AI_API_KEY`, `MODEL_FAST`, `MODEL_SMART` from config; switching provider or model is an env change only
- [x] **AGT-02**: `extractIntents(messages: SlackMessage[], ctx)` renders numbered lines and returns Zod-validated intents (title, resolved ISO start, duration, participants, `is_actionable`, `confidence`, `message_index`) that map back to real Slack `ts`; the same Zod schema backs the DB write
- [x] **AGT-03**: Relative times ("next Friday at 11am") resolve correctly against the current date in `Asia/Hong_Kong`, with the date and day-of-week passed explicitly and the arithmetic done in code
- [x] **AGT-04**: A high-confidence intent posts the approval card
- [x] **AGT-05**: A medium-confidence intent posts a card whose action opens an edit modal (prefilled from `private_metadata`); submitting the modal updates the Proposal and shows the approvable card
- [x] **AGT-06**: A low-confidence or non-actionable message posts nothing and writes a `Decision` row (verdict `ignored`, confidence, reason)
- [x] **AGT-07**: Actionable messages also write a `Decision` row (verdict `acted`)
- [x] **AGT-08**: The extraction prompt carries a confidence rubric so sample messages visibly spread across high / medium / low
- [x] **AGT-09**: One Proposal per intent: `dedupe_key = sha256(team_id + channel_id + (thread_ts ?? message_ts) + normalized_intent)` (type + ISO start in 5-minute buckets + sorted participants); per-user `ActionItem` rows reference it
- [x] **AGT-10**: The agent is one LangGraph graph of at most five nodes (extract → classify → resolve time → check conflicts → propose), compiled with no checkpointer and invoked to completion per message. If the graph is still fighting back at the fixed decision time, it is replaced by the same node functions called in sequence
- [x] **AGT-11**: A Trigger.dev task (Node runtime) wraps `runAgent()` with an idempotency key from team + channel + ts, and posts the card with a plain `WebClient`

### Conflict counter-proposal (CFL)

- [ ] **CFL-01**: The agent detects a clash between an intent's slot and A's calendar busy blocks unioned with pending Proposals in the DB
- [ ] **CFL-02**: On a clash, one `MODEL_SMART` call receives the busy blocks plus known preferences (working with zero Preference rows) and returns exactly two alternative slots, each with a one-line human reason
- [ ] **CFL-03**: The card renders both alternatives with their reasons as buttons (`value` = proposal id + slot index); choosing one runs the same approve path against that slot
- [ ] **CFL-04**: Demo beat: after the Friday 11:00 event exists, B's ask for 10:30 the same day produces the conflict card with two reasoned alternatives
- [ ] **CFL-05**: Degraded form (if conflict work hasn't started by 14:15): the card shows a static conflict warning naming the clashing block

### Dashboard (DSH)

- [ ] **DSH-01**: The dashboard lists action items / proposals with status (pending, confirmed, dismissed, already scheduled), HKT time and confidence
- [ ] **DSH-02**: The dashboard shows the `Decision` log, including considered-and-ignored messages with confidence and reason
- [ ] **DSH-03**: New proposals and decisions appear without a manual reload (TanStack Query polling)
- [ ] **DSH-04**: The retro dark theme is defined once as shadcn CSS variables in `app/globals.css` (with `@theme inline` mappings for custom tokens); no component contains a colour literal
- [ ] **DSH-05**: Retro devices applied consistently: 1–2px hard borders, `4px 4px 0` unblurred shadows, 2–4px radii, monospace for data/timestamps/confidence/chips with tabular numerals, uppercase micro-labels, status encoded in form (chip / left stripe / symbol) as well as colour
- [ ] **DSH-06**: Amber and cyan pass contrast on the near-black ground, and every interactive element has a visible focus state
- [ ] **DSH-07**: `/impeccable critique` + `polish` have been applied, and `/impeccable audit` has run on the running app before freeze

### Demo and delivery (DMO)

- [ ] **DMO-01**: `prisma/reset-demo.ts` clears demo DB rows and deletes tagged calendar events, so a repeated seeded message produces a fresh card
- [ ] **DMO-02**: The demo conversation is seeded in the watched channel by hand, and the full flow (ignored chatter → Friday 11:00 proposal → approve → B's 10:30 ask → conflict alternatives) runs three times on `main`
- [ ] **DMO-03**: One clean run is screen-recorded as the wifi fallback
- [x] **DMO-04**: The final README covers every required section: the competitive comparison (Slackbot, Reclaim/Motion, Clockwise noted as shut down, Slack calendar apps, Fireflies/Otter/Spinach, n8n/Zapier, Relay.app noted as winding down); batch-first detection with the ~20× cost reasoning and why regex pre-filtering fails; multi-workspace via OAuth; the one-line `interrupt()` note; known shortcuts from `/ponytail-debt`; abandoned stretch work and why
- [ ] **DMO-05**: Each merge window ends with `/ponytail-review` on the diff before the track merges into `develop`

### Optional core (OPT): build only if the core demo is done

- [ ] **OPT-01**: `/secretary scan` runs `extractIntents` over the last ~50 messages of the current channel and produces proposals/decisions

### Stretch (STR): abandon rather than finish late; nothing merges to `main` unless demo-ready

- [ ] **STR-01** (S1): A separate-repo FastAPI Graphiti service exposes `POST /episodes` and `GET /preferences?user_id=` against Neo4j (one driver per process, TLS via URI scheme)
- [ ] **STR-02** (S1): Distilled JSON preference facts from a closed vocabulary (`working_hours`, `default_meeting_duration`, `buffer_between_meetings`, `no_meeting_days`, `preferred_slot_of_day`) are ingested and read back
- [ ] **STR-03** (S1): The same input visibly produces a different, better proposal after a preference is learned, and `graph/queries.cypher` shows the graph before and after in Neo4j Browser
- [ ] **STR-04** (S2): Extraction emits a `commitment` type with direction (owed by me / owed to me), what, who, when promised, due, source link and status
- [ ] **STR-05** (S2): A CopilotKit surface renders the commitment ledger, choosing a different component per row type (deadline chip + block time, draft nudge, chase, clarify), and nudges go through the same approval card

## v2 Requirements

Deferred. Tracked, not in the roadmap.

### Detection at scale

- **SCL-01**: Per-channel batch sweep over a bounded window as the primary detector
- **SCL-02**: Cheap local router for time-urgent messages only
- **SCL-03**: Expiry sweep (Trigger.dev) re-invokes the same agent on expired action items with the intent prefilled and fresh calendar/preference context, writing a new record (re-derive, not resume). Deferred because it needs a scheduler the demo doesn't; the README documents the design

### Distribution

- **DST-01**: Public Slack OAuth install flow populating `Installation`
- **DST-02**: Account-linking UI (Slack user → Google consent)

### Stretch follow-ons

- **STR-06**: Relationship and cadence brief per person (pairs with S1)
- **STR-07**: Time-allocation reality check with "reclaim this" focus-time booking
- **STR-08**: In-dashboard graph render (`GET /graph` + `react-force-graph-2d`)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Autoreply / sending on the user's behalf | Breaks the approval-gate thesis; roadmap-only line in the README |
| Tests of any kind / test frameworks | User's explicit repo rule; testing is a later decision the user will raise |
| LangGraph `interrupt()` / durable checkpointer / Redis | Approval waits are unbounded; re-derive from the row instead |
| Subgraphs, multi-agent handoff, tool-calling loops | Hard ≤5-node scope cap |
| Unfiltered `message.channels` firehose | Only the env allowlist is processed |
| Sentiment analysis of colleagues | Reads as surveillance |
| Slack Marketplace distribution | One workspace on the day |
| Group-thread organizer election beyond default + tiebreak | Two-person demo |
| Recurring events; timezones beyond `Asia/Hong_Kong` | No stage payoff |
| Prettier / ESLint / second component library / `tailwind.config.js` / React Context for app state | Fixed stack and repo rules |
| npm / npx / yarn / pnpm commands | bun only |
| `/ponytail-audit`, `/impeccable init`, live browser iteration setup | Setup or whole-repo scans the window can't afford |
| Account or tooling setup phases | Done before the window |
| Zep Cloud; cloud graph DB during the window | No free tier; venue-wifi round trips |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Complete |
| FND-02 | Phase 1 | Complete |
| FND-03 | Phase 1 | Complete |
| FND-04 | Phase 1 | Complete |
| FND-05 | Phase 1 | Complete |
| FND-06 | Phase 1 | Complete |
| FND-07 | Phase 1 | Complete |
| FND-08 | Phase 1 | Complete |
| FND-09 | Phase 1 | Pending |
| FND-10 | Phase 1 | Complete |
| SLK-01 | Phase 1 | Pending |
| SLK-07 | Phase 1 | Pending |
| SLK-02 | Phase 2 | Complete |
| SLK-03 | Phase 2 | Complete |
| SLK-04 | Phase 2 | Complete |
| SLK-05 | Phase 2 | Complete |
| SLK-06 | Phase 2 | Complete |
| SLK-08 | Phase 2 | Complete |
| CAL-01 | Phase 3 | Complete |
| CAL-02 | Phase 3 | Complete |
| CAL-03 | Phase 3 | Complete |
| CAL-04 | Phase 3 | Complete |
| CAL-05 | Phase 3 | Complete |
| APR-01 | Phase 4 | Pending |
| APR-02 | Phase 4 | Pending |
| APR-03 | Phase 4 | Pending |
| APR-04 | Phase 4 | Pending |
| APR-05 | Phase 4 | Pending |
| AGT-11 | Phase 4 | Complete |
| AGT-01 | Phase 5 | Complete |
| AGT-02 | Phase 5 | Complete |
| AGT-03 | Phase 5 | Complete |
| AGT-04 | Phase 5 | Complete |
| AGT-05 | Phase 5 | Complete |
| AGT-06 | Phase 5 | Complete |
| AGT-07 | Phase 5 | Complete |
| AGT-08 | Phase 5 | Complete |
| AGT-09 | Phase 5 | Complete |
| AGT-10 | Phase 5 | Complete |
| DSH-01 | Phase 6 | Pending |
| DSH-02 | Phase 6 | Pending |
| DSH-03 | Phase 6 | Pending |
| DSH-04 | Phase 6 | Pending |
| DSH-05 | Phase 6 | Pending |
| DSH-06 | Phase 6 | Pending |
| CFL-01 | Phase 7 | Pending |
| CFL-02 | Phase 7 | Pending |
| CFL-03 | Phase 7 | Pending |
| CFL-04 | Phase 7 | Pending |
| CFL-05 | Phase 7 | Pending |
| DMO-05 | Phase 7 | Pending |
| OPT-01 | Phase 7 | Pending |
| STR-04 | Phase 8 (optional) | Pending |
| STR-05 | Phase 8 (optional) | Pending |
| STR-01 | Phase 9 (optional) | Pending |
| STR-02 | Phase 9 (optional) | Pending |
| STR-03 | Phase 9 (optional) | Pending |
| DSH-07 | Phase 10 | Pending |
| DMO-01 | Phase 10 | Pending |
| DMO-02 | Phase 10 | Pending |
| DMO-03 | Phase 11 | Pending |
| DMO-04 | Phase 11 | Complete |

**Coverage:**

- v1 requirements: 62 total (56 core, 1 optional core, 5 stretch)
- Mapped to phases: 62
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-11*
*Last updated: 2026-09-11 after roadmap creation — 62/62 requirements mapped, 0 orphans*
