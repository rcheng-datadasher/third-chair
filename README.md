# AI Secretary

Built solo at the AI Tinkerers "Agents, Everywhere: Beyond The Chatbox" hackathon (Hong Kong, Sat
12 Sep 2026) and documented as a real open-source project. A screen-recorded clean run of the demo
exists as a wifi fallback; the video itself is deliberately not committed to this repository.

## What it is

A Slack agent that reads ordinary conversation in a watched channel, decides on its own whether a
message is an action item, and turns scheduling intents into **Proposals**. A proposal is a Block
Kit approval card in Slack plus a row in a Next.js dashboard. Nothing is written to Google
Calendar until the user approves.
<!-- REFRESH-AT-FREEZE -->
When a request clashes with the calendar, the agent is designed to propose two concrete alternative
slots, each with a one-line stated reason. This conflict-counter-proposal path
(Phase 7 of the build) is being integrated as this README is written; if the build window closes
before it lands, the demo instead shows a static conflict warning naming the clashing block. See
"Where a graph-level pause would fit" and "Abandoned stretch work" below for how the rest of the
build's optional scope was handled under the same time pressure.

## The core functionality

Two capabilities anchor the core build. First, **unprompted intent detection**: nobody invokes the
agent — it reads ordinary Slack conversation in a watched channel and decides on its own whether a
message is a schedulable action item, extracting a structured intent (title, resolved time,
duration, participants, confidence) only when it is. Second, **an approval gate before anything is
written to a calendar**: every extracted intent becomes a Proposal — a Block Kit card in Slack and
a row in the dashboard — and the agent never calls the Google Calendar API until a human clicks
Approve. A confidence gate sits in front of both: high-confidence intents post the card directly,
low-confidence non-actionable chatter is ignored silently (and recorded as a `Decision`, visible in
the dashboard), so the agent is neither invisible nor noisy.

## How it differs

Existing tools solve adjacent slices of this problem, but none combine unprompted detection with
an approval gate the way this project does:

- **Slackbot** extracts action items and checks availability, but you have to invoke it; it is
  workspace-scoped and gated to paid plans.
- **Reclaim and Motion** schedule from natural language, but neither reads your conversations to
  find intent — you tell them what to schedule.
- **Clockwise** — shut down 27 March 2026. The team joined Salesforce in an acquihire; the product
  itself was discontinued and user data deleted. Cited here only as prior art in this space, never
  as a live competitor.
- **Slack calendar apps** (native integrations and marketplace bots) are command-driven: you ask,
  they act.
- **Fireflies, Otter and Spinach** extract action items from meeting audio, not from ordinary chat.
- **n8n and Zapier** offer generic human-in-the-loop approval steps, but with no understanding of
  your calendar or your habits — the approval card is a blank form, not a reasoned proposal. They
  lead this comparison because they are the two still active.
- **Relay.app** — winding down; free access ended 15 August 2026 and paid access ends
  14 September 2026, two days after this demo. Cited only with that status, never as a live
  competitor.

The gap across all seven: nothing in that list watches an ordinary conversation and decides,
unprompted, that something needs doing.

## The problems it tackles

Commitments made in chat evaporate into scrollback; scheduling costs a round trip of messages; an
agent that acts without asking is untrustworthy; an agent that asks about everything is noise,
which is why the confidence gate exists.

## Architecture

Four processes, each owning a distinct piece of the path from a Slack message to a calendar event:

- **Bolt** (`@slack/bolt`, Socket Mode, its own process) holds the one long-lived WebSocket to
  Slack — receives watched-channel messages, mentions, shortcuts, slash commands and block
  actions, acks within 3 seconds, and posts/updates cards via `app.client`. It is a separate
  process because a long-lived WebSocket does not fit request-scoped Next.js route handlers.
- **The Next.js App Router dashboard** shows the action-item queue and the `Decision` log
  ("considered and ignored" is itself a demo asset). Request-scoped; it holds no Slack connection.
- **Trigger.dev tasks** invoke the LangGraph agent, handle retries and idempotency keys, and keep
  anything slow or flaky off the Slack request path. An `AGENT_TRANSPORT=inline|trigger` env flag
  switches between calling the agent directly from Bolt and dispatching it through Trigger.dev,
  because Trigger.dev's dev CLI depends on its hosted control plane even for "local" runs — a
  venue-wifi risk this flag exists to route around.
- **Postgres**, via one shared Prisma client per process, holds every row below. Consumers: the
  dashboard, Bolt, and Trigger.dev.

**Data model** (starting point):

```
User          id, team_id, slack_user_id, email, google_refresh_token, tz      @@unique([team_id, slack_user_id])
Installation  team_id (pk), enterprise_id?, payload, installed_by, created_at
Proposal      id, team_id, dedupe_key (unique), title, start, end, tz, status,
              organizer_user_id, calendar_event_id, source_channel, source_ts
Participant   proposal_id, user_id?, slack_user_id?, email, role, response
ActionItem    proposal_id, user_id, kind, state, slack_channel, slack_ts
Decision      id, team_id, source_ts, verdict (acted|ignored), confidence, reason
Preference    user_id, key, value, source
```

**Message to proposal to approval to calendar.** A watched-channel message reaches Bolt, which
hands it to the agent (directly or via Trigger.dev per `AGENT_TRANSPORT`). The agent extracts an
intent, resolves its time deterministically in code, checks it against calendar busy blocks and
other pending Proposals, and — above the confidence threshold — writes one `Proposal` row and
posts a Block Kit card. The agent's run ends there; it never waits on the human. **Approval is
re-derive, not resume**: the Approve handler is ordinary backend code, not a resumed graph — it
reads the Proposal row, re-checks the calendar as it is *now* (not as it was when the card was
posted), and only then creates the event, updating the same Slack message in place.

**Idempotency runs at two levels.** One Proposal per intent, via a `dedupe_key` derived from team,
channel, thread, and a normalized form of the intent — so a re-extraction of the same message never
creates a duplicate row. One calendar event per Proposal, via a deterministic event id derived from
the proposal id — an insert that collides falls back to `events.get` and is treated as success, so
a retried approval never double-books.

## Usage

Everything below is documented against what actually runs on this repo as of this writing — the
real `package.json` scripts, `docker-compose.yml`, and the `.env*.example` files, read at execution
time rather than assumed.

### Prerequisites

- [bun](https://bun.sh) (package manager and script runner — never npm, npx, yarn, or pnpm)
- [Docker](https://www.docker.com/) with Compose v2, for local Postgres (and optionally Neo4j)
- A Slack app with Socket Mode enabled and `xoxb-` / `xapp-` tokens
- A Google Cloud project with the Calendar API enabled, OAuth consent configured, and a consenting
  test user with a verified refresh token
- A Kilo Gateway API key (OpenAI-compatible; OpenAI itself works as a drop-in fallback)
- A Trigger.dev account and project

### Setup

```bash
cp .env.local.example .env   # or .env.cloud.example for a hosted Postgres/Neo4j target
docker compose up postgres
bun install
bunx prisma db push
bun run db:seed
```

### Running

Each of these is its own long-lived process; run them in separate terminals. Exactly **one** Bolt
process should run at a time across every workspace/worktree — Slack's Socket Mode load-balances
events across every open connection on the same app token, so a second Bolt process elsewhere
steals events from the first.

- `bun run dev` — starts the Next.js dashboard (wraps `next dev`).
- `bun run bolt` — starts the Bolt process (wraps `bun lib/slack/bolt.ts`; Socket Mode listener). If
  bun's runtime ever misbehaves with Socket Mode, the documented fallback is
  `bunx tsx lib/slack/bolt.ts`.
- `bunx trigger.dev@4.5.16 dev` — starts the Trigger.dev CLI, which invokes the LangGraph agent as
  a background task when `AGENT_TRANSPORT=trigger`. Not yet wrapped in a `package.json` script as
  of this writing; run it directly with `bunx`.
- `bunx prisma db push` — pushes the Prisma schema to Postgres (this repo uses `db push` for the
  whole build, never `prisma migrate dev`).
- `bun run db:seed` — seeds identities and demo data.
- `bun run check` — runs Biome (`biome check --write .`), the only formatter/linter in this repo.

### Environment variables

Every name below is read once, at process start, through the repo's single typed config module
(`lib/config.ts`) — no other file reads `process.env` directly. Names only; see
`.env.local.example` / `.env.cloud.example` for the exact shape each value takes, and never commit
a filled-in `.env`.

| Group | Names |
|---|---|
| Slack | `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_TEAM_ID`, `SLACK_WATCH_CHANNEL_IDS` |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| AI (Kilo Gateway) | `AI_BASE_URL`, `AI_API_KEY`, `MODEL_FAST`, `MODEL_SMART` |
| Postgres | `DATABASE_URL` (pooled), `DIRECT_URL` (unpooled, for `db push`) |
| Trigger.dev | `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_ID` |
| Agent transport | `AGENT_TRANSPORT` (`inline` or `trigger`) |
| Seed identities | `SEED_USER_A_SLACK_ID`, `SEED_USER_A_EMAIL`, `SEED_USER_A_GOOGLE_REFRESH_TOKEN`, `SEED_USER_B_SLACK_ID`, `SEED_USER_B_EMAIL` |
| Graph stack (S1, optional) | `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `GRAPH_SERVICE_URL` |

`docker-compose.yml` also reads `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` for the local
container, each with a default if unset.

### Installing the Slack app

Enable Socket Mode. Subscribe to the `message.channels` event (the agent drops everything outside
the `SLACK_WATCH_CHANNEL_IDS` allowlist on the handler's first line, so this is what makes
detection unprompted rather than a firehose) plus the `app_mention` event. Add the
`channels:history`, `users:read.email`, `chat:write` and `commands` scopes, then install the app to
the workspace and paste the resulting bot and app tokens into the env file under the
`SLACK_BOT_TOKEN` / `SLACK_APP_TOKEN` names above.

## Scope and non-goals

Every row below was cut deliberately, not from running out of time — each says something about
what this project is trying to prove (an approval-gated agent that detects intent unprompted) and
what it is explicitly not trying to be (an autonomous sender, a multi-tenant SaaS, or a durable
workflow engine).

| Feature | Reason |
|---------|--------|
| Autoreply / sending on the user's behalf | Breaks the approval-gate thesis; the agent never acts without a human clicking Approve |
| Tests of any kind, or a test framework in `package.json` | Explicit repo rule for this build; a later, deliberate decision, not an oversight |
| LangGraph's pause-and-resume primitive for the approval gate, or a durable checkpointer/Redis | Approval waits are unbounded human time; the agent re-derives from the `Proposal` row instead of resuming a paused graph |
| Subgraphs, multi-agent handoff, tool-calling agent loops | Hard cap of one graph, at most five nodes |
| Unfiltered `message.channels` firehose | Only the `SLACK_WATCH_CHANNEL_IDS` allowlist is processed |
| Sentiment analysis of colleagues | Reads as surveillance; deliberately dropped |
| Public OAuth distribution / Slack Marketplace | One workspace installed for the demo — see "Multi-workspace via OAuth" below |
| Group-thread organizer election beyond default + tiebreak | Not needed for a two-person demo |
| Recurring events; timezones beyond `Asia/Hong_Kong` | No stage payoff for a one-day demo |
| Prettier, ESLint, a second component library, `tailwind.config.js`, or React Context for app state | Biome is the only formatter/linter; Tailwind v4 is CSS-first; Zustand owns shared client state |
| Any package manager other than bun (`npm`/`npx`/`yarn`/`pnpm` commands) | bun is the only package manager and script runner in this repo |
| `/ponytail-audit`, `/impeccable init`, live browser iteration setup | Whole-repo scans or setup work the build window can't afford |
| Account or tooling setup phases | All accounts, tokens and plugins were prepared before the build window opened |
| Zep Cloud; a cloud graph database during the build window | No free tier; adds venue-wifi round trips to an already wifi-dependent demo |
| Batch sweep / scheduler for detection | Documented as the production design below, not built — detection runs per-message for the demo |
| Account-linking UI | The Slack-user-to-Google-refresh-token mapping is seeded by hand for the demo's two users |

## Production design notes

The demo's design choices are mostly load-bearing for a one-day, one-laptop build; the notes below
say which shortcuts were deliberate and what the production-shaped version of each looks like.

### Batch-first detection

Detection runs **per-message** for the demo — one message in, one intent extracted — but the
production design is **batch-first**, and the reasoning is a cost argument, not a preference. A
Slack message is roughly 30 tokens; the system prompt that has to accompany every extraction call
is roughly 700 tokens. Calling the model once per message therefore pays that ~700-token prompt
over and over, while batching a channel's messages into one call over a bounded window amortizes
the same prompt across all of them — roughly a 20x reduction in prompt cost for the same detection
work.

Regex or keyword pre-filtering looks like the obvious way to cut model calls further, but it cannot
be the *primary* filter, because its failure mode is silent. It misses "same time as last week",
"after standup", typos, abbreviations, and Cantonese-English code-switching — real phrasing this
demo's own sample messages produce — and every one of those misses is silent and untunable: nothing
logs a miss, so nothing tells you the rubric needs adjusting. The production shape this project
would ship instead: a cheap local router that only screens for *time-urgent* messages (poor recall
is acceptable there, because the batch sweep is the real net), a per-channel batch sweep over a
bounded window as the actual workhorse, and full extraction plus conflict reasoning run only on the
candidates that sweep surfaces — with the existing `dedupe_key` absorbing any intent that gets
re-extracted because two overlapping windows both saw it.

### Multi-workspace via OAuth

The schema is multi-tenant from the start: `Installation` is keyed by `team_id`, and every `User`
is unique on the pair of `team_id` and `slack_user_id`, because Slack user ids are themselves only
unique within one workspace. The public OAuth install flow that would actually populate
`Installation` from a Slack Marketplace listing was not built — this demo installs to one
workspace by hand.

### Where a graph-level pause would fit

The one place in this codebase where LangGraph's `interrupt()` would actually earn its place is a
pause measured in seconds where the resumption continues *reasoning* — an agent asking a
clarifying question mid-analysis, say — and not this build's approval gate, which waits on
unbounded human time and is deliberately built to re-derive from a database row instead of resume a
paused graph.

### Known shortcuts

The list below splits into what a tool can verify mechanically and what only a person reviewing the
design can judge.
<!-- REFRESH-AT-FREEZE -->
This is the literal, unedited output of running `/ponytail-debt` against this repository during
this plan's execution window (in parallel with later build phases, ahead of the actual freeze) —
the orchestrator re-runs it once more at the actual freeze point before the demo.

#### /ponytail-debt output (verbatim)

```text
./lib/agent/graph.ts:247, read-then-post check for an existing Proposal card is not race-safe against two concurrent redeliveries of the same message both observing card_ts=null. ceiling: accepted for the demo's single-watched-channel volume. upgrade: a DB-level advisory lock or a conditional update.

./.planning/phases/02-slack-surface/02-RESEARCH.md:490, in-process email-lookup cache cleared on restart, quoted in a planning doc rather than shipped as-is in this exact form. ceiling: cache lives only as long as the process; fine, the process runs once per demo. upgrade: none named. [no-trigger]

./.planning/phases/09-optional-s1-graphiti-preference-memory/09-01-PLAN.md:468, planning-doc instruction directing a future executor to write a `# ponytail:` marker on the Neo4j driver swap — Phase 9 has not been executed, so no such marker exists in shipped code yet. ceiling (as instructed): driver defaults, pool 100, acquisition timeout 60s. upgrade (as instructed): the client swap itself, or a Neo4jDriver subclass.

./.planning/phases/09-optional-s1-graphiti-preference-memory/09-01-PLAN.md:502, the matching acceptance criterion for the same not-yet-written driver-default marker above — also planning prose, not a shipped marker.

4 markers, 1 with no trigger.
```

#### Other known shortcuts (design decisions, not ponytail markers)

The grep pattern above only catches `#`/`//`-prefixed line comments; it silently misses a marker
written as a TSDoc block-comment continuation line (`* ponytail: ...`), which matters here because
this repo mandates TSDoc on every function. A broadened `git grep -n 'ponytail:' -- ':!*.md'` scan
(run alongside the command above, over every tracked non-markdown file) confirms the under-report
is real, not hypothetical — it surfaced two markers the default pattern missed:

**Markers the default `/ponytail-debt` pattern missed (broadened scan, not in the verbatim fence
above):**

- `lib/agent/graph.ts:444` — two message redeliveries landing within the same instant can both
  pass the pre-check read and both write an ignored `Decision` row. Accepted for the demo's
  single-watched-channel volume; upgrade path is a unique `(team_id, source_channel, source_ts)`
  constraint on `Decision`.
- `utils/time.ts:107` — a relative-date hint missing a time defaults to 10:00, and one missing a
  day defaults to tomorrow; `bucketConfidence` caps a hint missing either at "medium" so the Edit &
  approve modal is where a human corrects it, rather than a smarter default in code.

Design-level shortcuts accepted for this one-day, one-laptop build, none of which are marked with a
`ponytail:` comment because they are documented decisions rather than code-level corner cuts: the
Google refresh token sits in Postgres in plaintext, seeded from env — accepted for a one-laptop
demo with no external users. `prisma db push` runs for the whole build window with no migration
history, because migration history has no value in a four-hour build. Only one Bolt process may
run at a time across every workspace, because Slack's Socket Mode load-balances events across every
open connection on one app token, and a second process would steal events from the first. There are
no test files and no test framework anywhere in this repo — Biome is the only linter/formatter, and
every function, internal helpers included, carries TSDoc. Slack-user-to-Google-token linking is
hand-seeded for this demo's two users, with no linking UI.

### Abandoned stretch work

Two stretch tracks were designed and scoped before the build window, each carrying its own hard
abandon criterion, because stretch work on this schedule is meant to be abandoned cleanly rather
than finished late: **S1**, per-user preference memory via a self-hosted Graphiti service and Neo4j,
gated on the core demo being rehearsed and on Phase 7 (the conflict counter-proposal work above)
finishing materially early; and **S2**, a CopilotKit generative-UI surface starting with a
commitment ledger ("what you promised, what you're owed"), gated the same way.
<!-- REFRESH-AT-FREEZE -->
As written, at execution time: neither track has started. `git log` on `main` shows work through
Phase 5 (the confidence-gated extraction graph) and partial Phase 6 (the dashboard layout and
theme), with Phase 7's conflict-detection node still an unimplemented stub that always reports no
conflicts (`lib/agent/graph.ts`, `checkConflictsNode`). The `gsd/phase-8-s2-commitment-ledger` and
`gsd/phase-9-s1-graphiti` branches both point at the same commit as `main` — no commits ahead —
confirming neither track has been touched. This is the "never started" outcome the plan for both
tracks anticipated: each was gated on Phase 7's full dry run passing with room to spare, and the
build's schedule had not opened that gate by the time this README was written. Both remain designed
and scoped, not built. Abandoning cleanly here beats finishing either one late: unfinished stretch
work merged onto `main` risks the core demo, and the core demo — not a stretch feature — is the
deliverable that has to work on stage.
