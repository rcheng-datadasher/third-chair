# AI Secretary

Built solo at the AI Tinkerers "Agents, Everywhere: Beyond The Chatbox" hackathon (Hong Kong, Sat
12 Sep 2026) and documented as a real open-source project.

## What it is

A Slack agent that reads ordinary conversation in a watched channel, decides on its own whether a
message is an action item, and turns scheduling intents into **Proposals**. A proposal is a Block
Kit approval card in Slack plus a row in a Next.js dashboard. Nothing is written to Google
Calendar until the user approves. When a request clashes with the calendar, the agent proposes
concrete alternative slots and says why.

## The core functionality

TODO: Phase 11 (freeze-and-record) writes the full description of unprompted intent detection,
the approval gate, and the per-person knowledge layer here.

## How it differs from what exists today

TODO: Phase 11 writes the competitive comparison (Slackbot, Reclaim/Clockwise/Motion, Fireflies/
Otter/Spinach, Relay.app/n8n/Zapier) here.

## The problems it tackles

TODO: Phase 11 writes the problem statement (commitments evaporating into scrollback, scheduling
round trips, trust in an acting-without-asking agent, noise from an agent that asks about
everything) here.

## Architecture

TODO: Phase 11 writes the runtime processes, data model, and message-to-calendar flow here.

## Usage

### Prerequisites

- [bun](https://bun.sh) (package manager and script runner — never npm/npx/yarn/pnpm)
- [Docker](https://www.docker.com/) with Compose v2, for local Postgres (and optionally Neo4j)
- A Slack app with Socket Mode enabled and `xoxb-`/`xapp-` tokens
- A Google Cloud project with the Calendar API enabled and a verified OAuth refresh token

### Setup

```bash
cp .env.local.example .env
docker compose up postgres
bun install
bun run db:push
bun run db:seed
```

### Running

- `bun run dev` — starts the Next.js dashboard.
- `bun run bolt` — starts the Bolt process (Slack Socket Mode listener). Exactly one Bolt process
  should run at a time across all worktrees.
- `bun run db:push` — pushes the Prisma schema to Postgres.
- `bun run db:seed` — seeds identities and demo data.
- `bun run check` — runs Biome (the only formatter/linter in this repo).

### Installing the Slack app

TODO: Phase 11 writes the full Slack app installation walkthrough (scopes, event subscriptions,
Socket Mode tokens) here.

## Scope and non-goals

TODO: Phase 11 writes the full scope cut list (see `.planning/PROJECT.md` "Out of Scope") here.

## Production design notes

TODO: Phase 11 writes the batch-first detection reasoning, multi-workspace via OAuth, and the
`/ponytail-debt` known-shortcuts list here.
