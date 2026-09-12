# Walking Skeleton — AI Secretary

**Phase:** 1 (Foundation + Hardcoded Round Trip)
**Generated:** 2026-09-12

## Capability Proven End-to-End

A person mentions the bot in a Slack channel and gets back an approval card; one click on **Approve** updates that same Slack message in place to a confirmed chip, with the proposal row written, read and updated in Postgres along the way — and a Next.js page at :3000 renders a live count of those rows.

That single sentence exercises Slack ↔ Bolt ↔ domain logic ↔ Prisma ↔ Postgres ↔ Slack, plus the web tier reading the same database. It is the whole product's shape with the LLM and the Calendar removed.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Package manager / runtime | bun 1.4.x for install, scripts and the Bolt process (`bun lib/slack/bolt.ts`, fallback `bunx tsx …`, never `--bun`) | Fixed by project decision; PROJECT.md supersedes the older "Bolt under Node" guidance. The bun Socket Mode risk is retired by Phase 1's own 60-second stability check rather than by pre-emptively splitting runtimes |
| Web framework | Next.js 16.3.4, App Router, Turbopack, React 19.3.0 | Dashboard and any future route handlers live here; Server Components read Postgres directly, so first paint needs no API route |
| Styling | Tailwind v4 CSS-first via `@tailwindcss/postcss`, shadcn initialised but no components | No `tailwind.config.*` exists by rule; Phase 6 owns `app/globals.css` theme tokens and every shadcn component |
| Lint / format | Biome 2.5.13, sole tool, `bun run check` | No Prettier, no ESLint, no second config. `components/ui/**`, `prisma/generated/**` and `.next` excluded |
| Data layer | Postgres 16 in Docker + Prisma 7.10.0 with the `prisma-client` generator and `@prisma/adapter-pg` | Engine-free client needs a driver adapter; the CLI reads the unpooled `DIRECT_URL` from `prisma.config.ts` while the app uses the pooled `DATABASE_URL` |
| Schema evolution | `bunx prisma db push` only, never `prisma migrate dev` | Timestamped migrations create non-linear history across two concurrent tracks; the whole build window is `db push` |
| Client lifetime | One `PrismaClient` per process behind a `globalThis` holder in `lib/db.ts`, adapter pool `max: 5` | Connection exhaustion is the documented failure mode; never construct a client inside a handler or task body |
| Configuration | One Zod parse of the environment at import in `lib/config.ts`; every key any phase will ever use declared now; not `server-only` | Bolt and Trigger.dev import it outside the RSC runtime. Local vs cloud differ by env vars only — no hostname, port or credential in source |
| Background work | None in Phase 1. `dispatchAgentRun` calls `runAgent` inline; the transport switch, the task wrapper and `trigger.config.ts` are Phase 4 | A transport branch with one branch is not a branch |
| Directory layout | `app/`, `components/`, `components/ui/`, `hooks/`, `stores/`, `lib/{slack,calendar,ai,agent}/`, `utils/`, `types/`, `prisma/` — a file lives in exactly one of them | Fixed in root `CLAUDE.md`; `lib/utils.ts` is the single shadcn-owned exception (it holds `cn`) |
| Entry points | Bolt at `lib/slack/bolt.ts` (registration only); background tasks would live at `lib/agent/tasks/`; demo reset at `prisma/reset-demo.ts` | No new top-level directories are created for entry points |
| Shared shapes | DB entity types come from the generated Prisma client; `types/` holds runtime-free interfaces only; LLM output shapes are Zod schemas in `lib/agent/` | One schema per boundary, never a hand-copied mirror of a table |
| Deployment target | None — local only. The full-stack run is `docker compose up postgres`, `bun run dev`, `bun run bolt` | One-day hackathon on one laptop; cloud is an env-var swap the design preserves but the window never exercises |

## Stack Touched in Phase 1

- [x] Project scaffold — Next.js + shadcn + Tailwind v4 + Biome under bun, every dependency exactly pinned (`01-01`)
- [x] Routing — one real route (`app/page.tsx`) served at :3000 (`01-01` scaffold, `01-02` makes it real)
- [x] Database — real write (`prisma/seed.ts` upserts, `runAgent` creates a Proposal) **and** real read (`prisma.proposal.count()` in a Server Component, the approve handler's row lookup) (`01-02`, `01-03`)
- [x] UI — one real interactive element wired end to end: the Slack **Approve** button, whose click updates a database row and edits the originating message in place (`01-03`)
- [x] Local full-stack run documented — `docker compose up postgres`, `bun run db:push`, `bun run db:seed`, `bun run dev`, `bun run bolt`, all written down in `package.json` scripts, `CLAUDE.md` and the README Usage section

## Out of Scope (Deferred to Later Slices)

Explicit so no later phase re-litigates Phase 1's minimalism:

- Any language-model call, any prompt, any confidence scoring — Phase 5
- Any Google Calendar read or write, any Meet link, any invite — Phase 3
- A watched-channel `message` listener, subtype/bot filtering, the `/secretary` command, the message shortcut — Phase 2
- A Reject button and the dismissed card state — Phase 2
- `trigger.config.ts`, the background task wrapper, `AGENT_TRANSPORT` branching — Phase 4
- The organizer claim, the duplicate-event guard, the confirmed card's event and Meet links — Phase 4
- `buildConflictBlocks`, alternative-slot buttons, conflict reasoning — Phase 7
- Every shadcn component, the retro theme tokens, the dashboard itself — Phase 6
- Neo4j, Graphiti, CopilotKit — stretch Phases 8/9, declared in compose behind the `graph` profile but never started
- Encryption at rest for the Google refresh token — accepted plaintext shortcut for this one-laptop demo, documented in the README known-shortcuts list

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2** — a real message in a watched channel produces a real Block Kit card with Approve and Reject, and either button updates it in place
- **Phase 3** — a proposal becomes a real Calendar event with a Meet link and an invited participant, idempotent on retry
- **Phase 4** — clicking Approve on a real card writes that real Calendar event and shows both links, through either transport
- **Phase 5** — the card's content comes from a real extraction over real conversation, gated by confidence
- **Phase 6** — the same rows are visible in a dashboard in the retro theme, updating without a reload
- **Phase 7** — a clashing request produces two reasoned alternative slots, and the full demo path runs live
- **Phase 10/11** — the path runs three times from a clean reset, then once more on camera
