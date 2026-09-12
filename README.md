# Third Chair — AI Secretary

**Scheduling in Slack goes like this: "Let's have a talk next Friday." One reply later — "I can't
do Friday" — and the whole group is rescheduling again. Third Chair ends that loop: an AI secretary
sits in the channel, reads what each person has said about their own time, checks the real
calendar, and turns the message into a proposal and action items the group approves with one
click.**

Built solo at the AI Tinkerers "Agents, Everywhere: Beyond The Chatbox" hackathon (Hong Kong,
Sat 12 Sep 2026). A screen-recorded clean run of the demo exists as a wifi fallback; the video is
deliberately not committed to this repository.

## Contents

- [What it does in 60 seconds](#what-it-does-in-60-seconds)
- [The two ideas that matter](#the-two-ideas-that-matter)
- [How it differs from existing tools](#how-it-differs-from-existing-tools)
- [Tech stack at a glance](#tech-stack-at-a-glance)
- [Architecture](#architecture)
- [Dashboard pages](#dashboard-pages)
- [Running it yourself](#running-it-yourself)
- [What was deliberately left out](#what-was-deliberately-left-out)
- [Production design notes](#production-design-notes)
- [Known shortcuts](#known-shortcuts)
- [Stretch work](#stretch-work)

## What it does in 60 seconds

1. Someone writes in a watched Slack channel: *"Let's sync on the deck Friday at 11."*
2. Nobody invokes the agent. It reads the message, decides it is a schedulable action item, and
   extracts a structured intent: title, resolved time, duration, participants, confidence score.
3. It checks the requested slot against the organizer's Google Calendar, the team's other pending
   proposals, and any preferences people have stated in chat ("no meetings on Fridays").
4. It posts an **approval card** in Slack (Approve / Reject / Edit & approve) and adds a row to the
   web dashboard. If the slot clashes, the card carries a **conflict warning** naming the clashing
   block.
5. A human clicks **Approve**. Only then is the Google Calendar event created, and the Slack card
   updates in place.
6. Chatter that is *not* an action item is ignored silently but logged as a `Decision`, so the
   dashboard can show what the agent considered and chose not to act on.

## The two ideas that matter

**1. Unprompted intent detection.** Existing bots wait to be asked. This one reads ordinary
conversation and decides on its own whether something needs doing. A confidence gate keeps it from
being noisy: high-confidence intents post a card, low-confidence chatter is ignored (but recorded),
so the agent is neither invisible nor spammy.

**2. An approval gate before any side effect.** Every extracted intent becomes a **Proposal**: a
Block Kit card in Slack plus a row in the dashboard. The agent never calls the Google Calendar API
until a human clicks Approve. This is the thesis of the project: an agent that acts without asking
is untrustworthy; one that asks about everything is noise.

**Conflict detection is real, not mocked.** The requested slot is checked against Google
`freebusy` for the organizer's whole working day (Hong Kong time), unioned with the team's
still-pending proposals, using one shared overlap check. A clash produces a **conflict warning
card** that names the clashing block, with Approve and Reject still available. A richer variant
(the model proposes two reasoned alternative slots, each with a "Choose" button) was designed but
cut at the build's hard stop; the static warning is what shipped. See
[Where a graph-level pause would fit](#where-a-graph-level-pause-would-fit) and
[Stretch work](#stretch-work).

**Bonus: a per-person preference layer.** Preference facts stated in ordinary messages ("no
meetings on Fridays", "I work 10 to 6") are written to a Graphiti knowledge graph and read back by
the scheduler as busy blocks, so a clash check honours what a person has said about their own time,
not just their calendar.

## How it differs from existing tools

Existing tools solve adjacent slices of this problem, but none combine unprompted detection with an
approval gate:

| Tool | What it does | What it doesn't |
|---|---|---|
| **Slackbot** | Extracts action items, checks availability | You have to invoke it; workspace-scoped; paid plans only |
| **Reclaim, Motion** | Schedule from natural language | Don't read your conversations to find intent; you tell them what to schedule |
| **Slack calendar apps** (native and marketplace) | Create events on command | Command-driven: you ask, they act |
| **Fireflies, Otter, Spinach** | Extract action items from meeting audio | Not from ordinary chat |
| **n8n, Zapier** | Generic human-in-the-loop approval steps | No understanding of your calendar or habits; the approval card is a blank form, not a reasoned proposal |
| **Clockwise** | Prior art in smart scheduling | Shut down 27 March 2026 (team joined Salesforce; product discontinued, user data deleted). Cited as prior art only |
| **Relay.app** | Prior art in AI workflow approval | Winding down; free access ended 15 Aug 2026, paid access ends 14 Sep 2026, two days after this demo |

The gap across all seven: nothing in that list watches an ordinary conversation and decides,
unprompted, that something needs doing.

## Tech stack at a glance

| Layer | Choice |
|---|---|
| Slack | `@slack/bolt` in Socket Mode, Block Kit cards, message shortcut, `/secretary` slash command |
| Agent | LangGraph (`@langchain/langgraph`), one graph of seven nodes, no subgraphs |
| Models | Kilo Gateway (OpenAI-compatible) via one provider module; `MODEL_FAST` for extraction, `MODEL_SMART` for reasoning |
| Calendar | Google Calendar API (`googleapis`): `freebusy` for clash checks, `events.insert` on approval |
| Background jobs | Trigger.dev v4 (optional; switchable to inline via one env flag) |
| Web | Next.js App Router, React Server Components, shadcn/ui, Tailwind v4, TanStack Query, Zustand |
| Generative UI | CopilotKit (commitment ledger at `/commitments`) |
| Data | Postgres via Prisma 7; Neo4j + Graphiti for the preference graph (optional) |
| Tooling | bun, Biome (only formatter/linter), TSDoc on every function, no test framework by rule |

## Architecture

Four processes, each owning a distinct piece of the path from a Slack message to a calendar event:

- **Bolt** (`@slack/bolt`, Socket Mode, its own process) holds the one long-lived WebSocket to
  Slack. It receives watched-channel messages, mentions, shortcuts, slash commands and button
  clicks, acks within 3 seconds, and posts or updates cards via `app.client`. It is a separate
  process because a long-lived WebSocket does not fit request-scoped Next.js route handlers.
- **The Next.js dashboard** shows the proposal queue, the decision log, the preference graph and
  the commitment ledger. Request-scoped; it holds no Slack connection.
- **Trigger.dev tasks** invoke the LangGraph agent, handle retries and idempotency keys, and keep
  anything slow or flaky off the Slack request path. An `AGENT_TRANSPORT=inline|trigger` env flag
  switches between calling the agent directly from Bolt and dispatching it through Trigger.dev.
  The flag exists because Trigger.dev's dev CLI depends on its hosted control plane even for
  "local" runs, which is a venue-wifi risk.
- **Postgres**, via one shared Prisma client per process, holds every row below. Consumers: the
  dashboard, Bolt, and Trigger.dev.

### Data model

```
User          id, team_id, slack_user_id, email, google_refresh_token, tz      @@unique([team_id, slack_user_id])
Installation  team_id (pk), enterprise_id?, payload, installed_by, created_at
Proposal      id, team_id, dedupe_key (unique), title, start, end, tz, status,
              organizer_user_id, calendar_event_id, source_channel, source_ts
Participant   proposal_id, user_id?, slack_user_id?, email, role, response
ActionItem    proposal_id, user_id, kind, state, slack_channel, slack_ts
Decision      id, team_id, source_ts, verdict (acted|ignored), confidence, reason
Preference    user_id, key, value, source
Commitment    id, team_id, author_slack_user_id, direction, what, who, when_promised?, due?,
              status, confidence, is_actionable, reason?, source_channel, source_ts
              @@unique([source_channel, source_ts])
```

### The agent graph

One LangGraph graph, seven nodes, run once per message:

```
extract → classify → resolveTime → checkConflicts → propose → learnPreferences → extractCommitments
```

- `extract` / `classify`: the model reads the message and decides whether it is a schedulable
  intent, with a 0–10 confidence score.
- `resolveTime`: turns "Friday at 11" into a concrete timestamp **deterministically in code**, not
  in the model, so the same phrase always resolves the same way.
- `checkConflicts`: Google `freebusy` + pending proposals + learned preferences, one overlap check.
- `propose`: writes one `Proposal` row and posts the Slack card. The run ends here; it never waits
  on the human.
- `learnPreferences` / `extractCommitments`: side channels that feed the preference graph and the
  commitment ledger from the same message.

### From message to calendar event

**Approval is re-derive, not resume.** The Approve button handler is ordinary backend code, not a
resumed graph. It reads the `Proposal` row, re-checks the calendar as it is *now* (not as it was
when the card was posted), and only then creates the event, updating the same Slack message in
place.

**Idempotency runs at two levels.** One Proposal per intent, via a `dedupe_key` derived from team,
channel, thread, and a normalized form of the intent, so a re-extraction of the same message never
creates a duplicate row. One calendar event per Proposal, via a deterministic event id derived from
the proposal id: an insert that collides falls back to `events.get` and is treated as success, so a
retried approval never double-books.

## Dashboard pages

| Route | What you see |
|---|---|
| `/` | **Queue**: every Proposal with status, time, participants, and the reason the agent extracted it |
| `/decisions` | **Decisions**: the agent's own acted/ignored log, including chatter it deliberately skipped |
| `/graph` | **Graph**: per-user preference hubs from Graphiti, with key=value facts learned from chat |
| `/commitments` | **Commitments**: a CopilotKit ledger of what you promised and what you're owed, extracted from Slack |

Queue, Decisions and Graph poll every 4 seconds so a card posted in Slack appears on stage without
a refresh.

## Running it yourself

Everything below is documented against what actually runs in this repo: the real `package.json`
scripts, `docker-compose.yml`, and the `.env*.example` files.

### Prerequisites

- [bun](https://bun.sh) (package manager and script runner; never npm, npx, yarn, or pnpm)
- [Docker](https://www.docker.com/) with Compose v2, for local Postgres (and optionally Neo4j)
- A Slack app with Socket Mode enabled and `xoxb-` / `xapp-` tokens
- A Google Cloud project with the Calendar API enabled, OAuth consent configured, and a consenting
  test user with a verified refresh token
- A Kilo Gateway API key (OpenAI-compatible; OpenAI itself works as a drop-in fallback)
- A Trigger.dev account and project (only if you set `AGENT_TRANSPORT=trigger`)

### Setup

```bash
cp .env.local.example .env   # or .env.cloud.example for a hosted Postgres/Neo4j target
docker compose up postgres
bun install                  # runs `prisma generate` on postinstall
bunx prisma db push
bun run db:seed
```

For the optional preference graph, the Graphiti service lives in a sibling checkout at
`../graph-service` (override with `GRAPH_SERVICE_DIR`) and starts with
`docker compose --profile graph up`.

### Running

Each of these is its own long-lived process; run them in separate terminals.

| Command | What it starts |
|---|---|
| `bun run dev` | The Next.js dashboard (`next dev`) at http://localhost:3000 |
| `bun run bolt` | The Slack Socket Mode listener (`bunx tsx lib/slack/bolt.ts`) |
| `bunx trigger.dev@4.5.16 dev` | The Trigger.dev CLI; only needed when `AGENT_TRANSPORT=trigger` |

Other scripts:

- `bunx prisma db push`: push the Prisma schema to Postgres (this repo uses `db push` throughout,
  never `prisma migrate dev`).
- `bun run db:seed`: seed identities and demo data.
- `bun run db:studio`: open Prisma Studio.
- `bun run check`: run Biome (`biome check --write .`), the only formatter/linter in this repo.

**Run exactly one Bolt process at a time.** Slack's Socket Mode load-balances events across every
open connection on the same app token, so a second Bolt process anywhere (another worktree, another
laptop) steals events from the first.

Bolt runs under `tsx` rather than bun's own runtime because bun's Socket Mode WebSocket ping
handling failed in a smoke test (`undici_1.ping is not a function`).

### No login (prototype)

There is no auth or login of any kind. The dashboard and the CopilotKit chat under `/commitments`
act as seed user A, taken from `SEED_USER_A_*` in `.env` (see `lib/config.ts` →
`config.seed.userA`). To "switch user", change those values and re-run `bun run db:seed`.

### Environment variables

Every name below is read once, at process start, through the repo's single typed config module
(`lib/config.ts`); no other file reads `process.env` directly. See `.env.local.example` /
`.env.cloud.example` for the exact shape each value takes, and never commit a filled-in `.env`.

| Group | Names |
|---|---|
| Slack | `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_TEAM_ID`, `SLACK_WATCH_CHANNEL_IDS` |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| AI (Kilo Gateway) | `AI_BASE_URL`, `AI_API_KEY`, `MODEL_FAST`, `MODEL_SMART` |
| Postgres | `DATABASE_URL` (pooled), `DIRECT_URL` (unpooled, for `db push`) |
| Trigger.dev | `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_ID` |
| Agent transport | `AGENT_TRANSPORT` (`inline` or `trigger`; defaults to `inline`) |
| Seed identities | `SEED_USER_A_SLACK_ID`, `SEED_USER_A_EMAIL`, `SEED_USER_A_GOOGLE_REFRESH_TOKEN`, `SEED_USER_B_SLACK_ID`, `SEED_USER_B_EMAIL` |
| Preference graph (optional) | `NEO4J_USER`, `NEO4J_PASSWORD`, `GRAPH_SERVICE_URL` |

`docker-compose.yml` additionally reads `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` for
the local container and `GRAPH_SERVICE_DIR` / `GRAPHITI_*` for the graph profile, each with a
default if unset.

### Installing the Slack app

1. Enable Socket Mode.
2. Subscribe to the `message.channels` and `app_mention` events. The agent drops everything outside
   the `SLACK_WATCH_CHANNEL_IDS` allowlist on the handler's first line, which is what makes
   detection unprompted rather than a firehose.
3. Add the `channels:history`, `users:read.email`, `chat:write` and `commands` scopes.
4. Install the app to the workspace and paste the bot and app tokens into `.env` as
   `SLACK_BOT_TOKEN` / `SLACK_APP_TOKEN`.

## What was deliberately left out

Every row below was cut on purpose, not from running out of time. Each says something about what
this project is trying to prove (an approval-gated agent that detects intent unprompted) and what
it is explicitly not trying to be (an autonomous sender, a multi-tenant SaaS, or a durable workflow
engine).

| Feature | Reason |
|---------|--------|
| Autoreply / sending on the user's behalf | Breaks the approval-gate thesis; the agent never acts without a human clicking Approve |
| Tests of any kind, or a test framework in `package.json` | Explicit repo rule for this build; a deliberate decision, not an oversight |
| LangGraph's pause-and-resume primitive for the approval gate, or a durable checkpointer/Redis | Approval waits are unbounded human time; the agent re-derives from the `Proposal` row instead of resuming a paused graph |
| Subgraphs, multi-agent handoff, tool-calling agent loops | One graph, seven linear nodes |
| Unfiltered `message.channels` firehose | Only the `SLACK_WATCH_CHANNEL_IDS` allowlist is processed |
| Sentiment analysis of colleagues | Reads as surveillance; deliberately dropped |
| Public OAuth distribution / Slack Marketplace | One workspace installed for the demo; see [Multi-workspace via OAuth](#multi-workspace-via-oauth) |
| Group-thread organizer election beyond default + tiebreak | Not needed for a two-person demo |
| Recurring events; timezones beyond `Asia/Hong_Kong` | No stage payoff for a one-day demo |
| Prettier, ESLint, a second component library, `tailwind.config.js`, or React Context for app state | Biome is the only formatter/linter; Tailwind v4 is CSS-first; Zustand owns shared client state |
| Any package manager other than bun | bun is the only package manager and script runner in this repo |
| Whole-repo audit passes and live browser design iteration | Setup work the build window couldn't afford |
| Account or tooling setup phases | All accounts, tokens and plugins were prepared before the build window opened |
| Zep Cloud; a cloud graph database during the build window | No free tier; adds venue-wifi round trips to an already wifi-dependent demo |
| Batch sweep / scheduler for detection | Documented as the production design below, not built; detection runs per-message for the demo |
| Account-linking UI | The Slack-user-to-Google-refresh-token mapping is seeded by hand for the demo's two users |
| Auth / login | Prototype only; the web UI and `/commitments` chat are pinned to seed user A via `.env` |

## Production design notes

The demo's design choices are mostly load-bearing for a one-day, one-laptop build. The notes below
say which shortcuts were deliberate and what the production-shaped version of each looks like.

### Batch-first detection

Detection runs **per-message** for the demo (one message in, one intent extracted), but the
production design is **batch-first**, and the reasoning is a cost argument. A Slack message is
roughly 30 tokens; the system prompt that accompanies every extraction call is roughly 700 tokens.
Calling the model once per message pays that ~700-token prompt over and over. Batching a channel's
messages into one call over a bounded window amortizes the same prompt across all of them: roughly
a 20x reduction in prompt cost for the same detection work.

Regex or keyword pre-filtering looks like the obvious way to cut model calls further, but it cannot
be the *primary* filter, because its failure mode is silent. It misses "same time as last week",
"after standup", typos, abbreviations, and Cantonese-English code-switching (real phrasing this
demo's own sample messages produce), and nothing logs a miss, so nothing tells you the rules need
adjusting. The production shape: a cheap local router that only screens for *time-urgent* messages
(poor recall is acceptable there, because the batch sweep is the real net), a per-channel batch
sweep over a bounded window as the actual workhorse, and full extraction plus conflict reasoning run
only on the candidates the sweep surfaces, with the existing `dedupe_key` absorbing any intent that
gets re-extracted because two overlapping windows both saw it.

### Multi-workspace via OAuth

The schema is multi-tenant from the start: `Installation` is keyed by `team_id`, and every `User`
is unique on the pair of `team_id` and `slack_user_id`, because Slack user ids are only unique
within one workspace. The public OAuth install flow that would populate `Installation` from a Slack
Marketplace listing was not built; this demo installs to one workspace by hand.

### Where a graph-level pause would fit

The one place in this codebase where LangGraph's `interrupt()` would earn its place is a pause
measured in seconds where the resumption continues *reasoning*: an agent asking a clarifying
question mid-analysis, say. Not this build's approval gate, which waits on unbounded human time and
is deliberately built to re-derive from a database row instead of resuming a paused graph.

## Known shortcuts

Every deliberate corner cut in the code is marked in place with a `ponytail:` comment naming the
ceiling it hits and the upgrade path. The list below is every marker on `main` as of this writing, with
current line numbers.

### Code-level shortcuts (marker harvest)

```text
components/graph-view.tsx:33, ring layout for the preference graph. ceiling: readable only while node count stays small. upgrade: swap for a force layout if node count outgrows it.

lib/agent/conflict.ts:79, calendar owner resolved as the team's single user with a non-null google_refresh_token. ceiling: a two-user-demo assumption. upgrade: multi-organizer resolution.
lib/agent/conflict.ts:92, a failed freebusy lookup is treated as an empty calendar so the demo path cannot die on a calendar outage. ceiling: a calendar outage looks like a free day. upgrade: none named beyond the loud log line as compensating control. [no-trigger]

lib/agent/graph.ts:227, commitment extraction runs on the trigger message alone, with no channel context. ceiling: "I'll do it" replies cannot resolve what/who from the parent message. upgrade: share channel context via graph state.
lib/agent/graph.ts:448, read-then-post is not race-safe against two concurrent redeliveries both observing card_ts=null. ceiling: accepted for the demo's single-watched-channel volume. upgrade: a DB-level advisory lock or a conditional update.
lib/agent/graph.ts:725, two deliveries in the same instant can both pass the pre-check and both write an ignored Decision. ceiling: single-watched-channel volume. upgrade: a unique (team_id, source_channel, source_ts) constraint on Decision.

lib/slack/bolt.ts:27, message shortcut registered by type, not callback_id. ceiling: exactly one message shortcut installed. upgrade: add callback_id once a second one exists.

lib/slack/post-proposal-card.ts:142, first Decision per Proposal is taken as the Decision. ceiling: one Decision-per-Proposal. upgrade: revisit if more than one is ever linked.

lib/slack/resolve-email.ts:3, in-process email cache cleared on restart. ceiling: a process that runs once per demo window. upgrade: a shared cache if Bolt must survive a restart mid-run.
lib/slack/resolve-profile.ts:9, in-process profile cache, same shape as resolve-email.ts. ceiling: one demo window. upgrade: a shared cache only if this outlives a demo.

utils/time.ts:107, missing time defaults to 10:00 and missing day to tomorrow. ceiling: first guesses, capped at "medium" confidence so the Edit & approve modal is where a human corrects them. upgrade: that modal, not a smarter default here.

11 markers, 1 with no trigger.
```

### Design-level shortcuts

These are documented decisions rather than code-level corner cuts, so they carry no marker:

- The Google refresh token sits in Postgres in plaintext, seeded from env. Accepted for a
  one-laptop demo with no external users.
- `prisma db push` runs for the whole build with no migration history, because migration history
  has no value in a four-hour build.
- Only one Bolt process may run at a time (see [Running](#running)).
- No test files and no test framework anywhere in this repo. Biome is the only linter/formatter,
  and every function, internal helpers included, carries TSDoc.
- Slack-user-to-Google-token linking is hand-seeded for the demo's two users, with no linking UI.

## Stretch work

Two stretch tracks were designed and scoped before the build window, each with its own hard abandon
criterion, because stretch work on this schedule is meant to be abandoned cleanly rather than
finished late. Both were gated on the core demo being rehearsed first.

**Outcome: both shipped and are merged on `main`**, against the schedule's own expectation that
they would be README-only. Each ran in its own worktree beside the integration work once its inputs
(the extraction schema and the dashboard) were on `main`, and merged only after passing its own
demo-ready gate.

| Track | What shipped |
|---|---|
| **Preference memory** (Graphiti + Neo4j) | Preference facts are extracted from ordinary Slack messages and written to a self-hosted Graphiti service. `/graph` shows per-user hubs with key=value facts. The scheduler treats learned `no_meeting_days` / `working_hours` as busy blocks in the conflict check. |
| **Commitment ledger** (CopilotKit) | `/commitments` renders one of four structurally different generative-UI components per row (chase, deadline chip, draft nudge, clarify card), chosen by a deterministic selector rather than the model. A nudge goes out through the same approval card as every other action, never as a direct message. |

The thing that was actually cut is inside the core path, not the stretch: the conflict card with
two model-reasoned alternative slots stopped at the build's hard stop and shipped as the static
warning card instead.
