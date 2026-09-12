# Phase 1: Foundation + Hardcoded Round Trip - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning
**Mode:** `--auto` (all gray areas auto-resolved to the recommended option; see `01-DISCUSSION-LOG.md`)

<domain>
## Phase Boundary

Serial scaffold on `main`, 11:15–11:55 (40 min). Delivers: root `CLAUDE.md` + `README.md` skeleton; Next.js/shadcn/Tailwind v4/Biome under bun with exact pins; `docker-compose.yml`; `lib/config.ts` + env examples; full Prisma schema pushed + shared client; stub modules for every cross-track interface Wave A and Wave B need; hand-seeded rows; and the hardcoded Slack round trip (trigger → card → Approve → `chat.update` to a confirmed chip), run inline from Bolt. No LLM call and no Calendar call anywhere in this phase.

Requirements: FND-01..10, SLK-01, SLK-07. Everything else (real listeners, Reject, Calendar, Trigger.dev, graph, dashboard UI) belongs to later phases.

</domain>

<decisions>
## Implementation Decisions

### Hardcoded round trip (SLK-07)
- **D-01:** The Phase 1 trigger is an **`app_mention`** in the test channel, not a `message` listener. Why: the scope is already installed (it doesn't wait on tonight's `message.channels` reinstall), and the bot's own card can't retrigger it, so there's no feedback loop. Phase 2 adds the watched-channel `message` listener that calls the same dispatch function.
- **D-02:** The round trip goes **through the DB**, not payload-only:
  1. The mention calls `dispatchAgentRun` (inline only, no transport flag yet).
  2. The stub `runAgent` creates a hardcoded `Proposal` (+ `Participant`), keyed by a `dedupe_key` built from the real mention `ts`, so every mention gets a fresh row.
  3. It calls `postProposalCard` and stores the returned card `channel` + `ts` on the row.
  4. The Approve handler `ack()`s first, reads the proposal id from `action.value`, sets `status = confirmed`, then calls `updateProposalCard` with the **stored** channel/ts.

  This is also the phase's "one real query", and it proves up front the Phase 4 pitfall where `block_actions` has no in-memory link.
- **D-03:** The Phase 1 card has **Approve only**; Reject is Phase 2 (SLK-05). Two conventions are fixed now for Phases 2/4/7: action ids are `<verb>_proposal` (`approve_proposal`, later `reject_proposal`), and button `value` = proposal id.
- **D-04:** `dispatchAgentRun` exists in Phase 1 with only the inline call. `AGENT_TRANSPORT` branching, the Trigger.dev task and `trigger.config.ts` are **all created in Phase 4**, not skeleton-stubbed here. That overrides the roadmap's "trigger.config.ts (skeleton)" files-owned note, because Phase 4 owns the file and must add `prismaExtension` anyway.

### Stub interfaces (FND-09)
- **D-05:** `.planning/research/ARCHITECTURE.md` §"Interfaces Before Implementation" is the signature source, with these corrections from later PROJECT.md decisions:
  - File names are **kebab-case**: `lib/slack/post-proposal-card.ts`, not `postProposalCard.ts`.
  - The Bolt entry is `lib/slack/bolt.ts`, not root `bolt.ts`.
  - Trigger.dev tasks live in `lib/agent/tasks/`, not `trigger/`.
- **D-06:** Stubs are created **only for seams a parallel track builds against**:
  - Wave A: `lib/slack/client.ts`, card post/update + `buildApprovalBlocks`/`buildConfirmedBlocks`, `lib/calendar` `checkConflicts`/`createCalendarEvent`.
  - Wave B: `lib/agent` `runAgent` + `extractIntents(messages: SlackMessage[], ctx)`, `lib/ai/provider.ts`.
  - Shared: `lib/agent/dedupe.ts` (real, since it's a pure function), `lib/db.ts`, `lib/config.ts`.
  - **No stub** for `buildConflictBlocks`: Phase 7 is serial.
- **D-07:** Where shared shapes live:
  - **DB entity types come from the generated Prisma client**; they are never re-declared in `types/`.
  - `types/` holds plain runtime-free interfaces (`SlackMessage`, `RunAgentInput`, `RunAgentResult`).
  - LLM-output shapes are **Zod schemas in `lib/agent/`**, with types via `z.infer` in the same file (AGT-02's one schema for LLM + DB).
- **D-08:** `utils/time.ts` with an HKT formatter (stdlib `Intl.DateTimeFormat`, `timeZone: "Asia/Hong_Kong"`) is created in Phase 1. Why: the Slack card (Phase 2) and the dashboard (Phase 6) both need it and run in parallel, so a later fork is otherwise near-certain. No date library.

### Schema (FND-08)
- **D-09:** Phase 1's schema includes **every column any core phase (2–7, 10) needs**, so no parallel track has to `db push` during the window unless something unforeseen happens. On top of PROJECT.md's data model:
  - `Proposal` adds `confidence`, `card_channel`, `card_ts`, `calendar_html_link`, `meet_link`, `alternatives Json?` (CFL-03) and `created_at`.
  - `Decision` adds `source_channel`, `message_text` and `proposal_id?`, so the DSH-02 log can show the ignored message itself.
  - `ActionItem` has `expires_at` (FND-08).
- **D-10:** Field names are **snake_case exactly as in PROJECT.md** (no `@map`), so APR-02's raw `UPDATE "Proposal" SET organizer_user_id …` works as written. **Reversibility:** costly. Renaming later touches every Prisma call site across all tracks.
- **D-11:** Status fields are **Prisma enums**, a DB constraint rather than app code:
  - `ProposalStatus`: `pending | confirmed | dismissed | already_scheduled` (DSH-01).
  - `DecisionVerdict`: `acted | ignored`.
- **D-12:** Prisma 7 `prisma-client` generator, output under `prisma/generated/`, **gitignored**, plus a `postinstall` running `prisma generate` so every worktree's `bun install` regenerates it. The client is constructed once in `lib/db.ts` (globalThis singleton) with `@prisma/adapter-pg`.

### Seed data (FND-10)
- **D-13:** `prisma/seed.ts` is idempotent (upserts) and reads every identity and secret from env through `lib/config.ts`. The refresh token never appears in code. It seeds:
  - `Installation` (`SLACK_TEAM_ID`).
  - User A: Slack id, email, Google refresh token, `Asia/Hong_Kong`.
  - User B: Slack id, email, no token.
  - One **pending Proposal** with B as participant, which Phase 3 builds against.
  - One `acted` and one `ignored` `Decision`, which Phase 6's exit criterion needs.
- **D-14:** The seeded Proposal is at **Thu 17 Sep 2026 15:00 HKT**, deliberately not the demo's Fri 18 Sep 11:00/10:30 slots. Pending Proposals are unioned into conflict detection (CFL-01), so a seed there would pollute the headline conflict beat.

### Config and env (FND-06, FND-07)
- **D-15:** `lib/config.ts` holds a single Zod parse of `process.env` at import:
  - Core keys are required.
  - Stretch keys (`NEO4J_*`, `GRAPH_SERVICE_URL`) are optional.
  - Every key any phase uses is declared now: Slack, Google, Kilo Gateway, `MODEL_FAST`/`MODEL_SMART`, Trigger.dev, `SLACK_WATCH_CHANNEL_IDS`, `AGENT_TRANSPORT`, the seed identities.
  - Don't mark it `server-only`, because Bolt and Trigger.dev import it outside the RSC runtime.
- **D-16:** Every process reads **one untracked root `.env`**. `.env.local.example` and `.env.cloud.example` are copy sources (`cp .env.local.example .env`). Each worktree sets its own `PORT` there (`bun run` injects `.env`, and `next dev` honours `PORT`).
- **D-17:** `docker-compose.yml`'s `graph-service` build context uses a default, `${GRAPH_SERVICE_DIR:-../graph-service}`. Compose interpolates the whole file even when a profile is off, so an unset var must not break `docker compose up postgres`.

### Repo files and conventions
- **D-18:** Repo rules go in **root `CLAUDE.md`**, which is the FND-01 deliverable. `.claude/CLAUDE.md` is GSD-managed and stays untouched. Root `CLAUDE.md` must state the per-process run commands explicitly, because `.claude/CLAUDE.md`'s generated stack text still says Bolt runs under Node, which PROJECT.md superseded:
  - Next.js: `bun run dev` → `next dev`
  - Bolt: `bun lib/slack/bolt.ts`, fallback `bunx tsx lib/slack/bolt.ts`
  - Prisma: `bunx prisma …`
  - Never `--bun`.
- **D-19:** `package.json` scripts are the written-down run commands: `dev`, `bolt`, `db:push`, `db:seed`, `check` (biome), `postinstall`. Nobody types a raw invocation from memory.
- **D-20:** The README skeleton has every FND-02 heading. It fills in the "What it is" paragraph (from PROJECT.md) and a **real Usage section** (compose, `.env` copy, run scripts); every other section gets a one-line TODO. Under cut pressure it drops to headings only.
- **D-21:** Install **all core-window dependencies in Phase 1** at exact pins (everything in STACK.md except CopilotKit and the Python side). Why: parallel tracks then never both edit `package.json`/`bun.lock`, the documented lockfile-conflict pitfall. Add `@slack/web-api` and `@prisma/adapter-pg` + `pg`. Gitignore `package-lock.json`.
- **D-22:** shadcn is initialised only (`components.json`, `globals.css` variables, `cn`); no components are added (Phase 6 adds them). `cn` stays at shadcn's default `lib/utils.ts` so the CLI isn't fought on every `add`. Record it in CLAUDE.md as the one shadcn-owned lib file.
- **D-23:** `biome.json` excludes `components/ui/**` (shadcn, unmodified), `prisma/generated/**` and `.next`, and sets `css.parser.tailwindDirectives: true`.
- **D-24:** No `.gitkeep` placeholders for empty `hooks/`/`stores/`. CLAUDE.md documents them and they appear when first used.
- **D-25:** `app/page.tsx` in Phase 1 is a minimal Server Component that renders a Prisma count. It proves Next.js 16 + Turbopack can load the Prisma 7 generated client now, not in Phase 6. Phase 6 replaces it.

### Git
- **D-26:** Rename the local `master` → **`main`**. Phase 1 works on `gsd/phase-1-foundation` and merges to `main`, then `develop` is created from `main` for the Wave A tracks. Only `master` exists today and there's no remote.
- **D-27:** Commit `gsd-prompt-ai-secretary.md` in Phase 1's first plan. PROJECT.md names it authoritative for README contents, theme tokens and S1/S2 detail, and untracked files don't exist in GSD worktrees.

### Claude's Discretion
- Proposal id strategy (`cuid()` is fine: CAL-04 derives the base32hex event id by hashing, so the id charset doesn't matter).
- Hardcoded card copy and layout (Phase 2 replaces it).
- Bolt log level, and the exact config object nesting (sections per ARCHITECTURE.md: `slack`, `google`, `ai`, `db`, `trigger`, `agent`, `graph`).
- Participant/ActionItem key shapes and relations, within PROJECT.md's model.
- Whether the Approve handler uses Bolt's `client` or the `lib/slack/client.ts` singleton (both hold the same bot token).

### Pre-applied scope cut (decided 2026-09-12, before the window)
- **README.md is headings only this phase.** Write the section headings and one-line placeholders; no prose. The full README is written in Phase 11, which already owns it. Do not spend phase-1 time on prose a later phase rewrites.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` §"Phase 1: Foundation + Hardcoded Round Trip": deliverables, exit criterion, cut order, time-eaters. Also §"File Ownership Matrix" and §"Flags Resolved".
- `.planning/REQUIREMENTS.md`: FND-01..10, SLK-01, SLK-07 (and SLK-05/06 for the card contract Phase 2 inherits).
- `.planning/PROJECT.md`: stack table and run commands (bun Bolt decision), "Repo rules (become `CLAUDE.md`)", "Services, connections, environments", "Data model", Key Decisions.
- `gsd-prompt-ai-secretary.md` (repo root, to be committed per D-27): §"Phase 1, first task: `CLAUDE.md` and `README.md`" for the exact required CLAUDE.md rules and README sections; §"Services, connections and environments" for the compose requirements (**ignore its `LANGGRAPH_PG_URL`/`PostgresSaver` rows, dropped per PROJECT.md**).

### Research
- `.planning/research/STACK.md`: exact version pins, Prisma 7 adapter requirement, Biome/bun invocation notes. **Its Bolt-under-Node recommendation is superseded by PROJECT.md (bun, fallback tsx).**
- `.planning/research/ARCHITECTURE.md` §"Interfaces Before Implementation": stub signature table, as corrected by D-05.
- `.planning/research/PITFALLS.md`: Pitfalls 2 (`/mnt/c`), 6 (Prisma generate under bun), 13 (`db push` races), 15 (lockfile conflicts); Moderate: "Prisma generator output path mismatch", "Prisma engine binary mismatch Windows/WSL"; Minor: shadcn v3-style scaffold, Biome Tailwind at-rules.
- `.planning/research/SUMMARY.md`: reconciled overview.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None. The repo holds only `.planning/`, `.claude/` and the source doc. This phase creates every asset later phases reuse.

### Established Patterns
- None yet. Phase 1 establishes them: kebab-case files, named exports, TSDoc on every function, the config-only `process.env` reader, the Prisma singleton and the `<verb>_proposal` action ids.

### Integration Points
- `lib/slack/bolt.ts` listener registration is a named overlap for Phases 2 → 4 → 7. Keep registration and handler bodies separate so later phases append rather than restructure.
- `prisma/schema.prisma`, `types/`, `lib/config.ts`, `package.json`/`bun.lock`: the shared files every track extends and never forks.

### Research flags for the phase researcher (verify, don't re-decide)
- `create-next-app@16.3.4` refuses non-empty directories that contain unknown entries (`.planning`, `.claude`). Confirm the flags (`--biome`, `--use-bun`, no `src/`, `@/*` alias) and whether to scaffold into a temp dir and move the files in.
- Prisma 7 + `@prisma/adapter-pg`:
  - Where the datasource URL now lives (`prisma.config.ts` vs schema `url`/`directUrl`) and how `db push` gets `DIRECT_URL`.
  - Whether `prisma.config.ts` needs explicit env loading.
  - Whether `?schema=public&connection_limit=5` is honoured, ignored or rejected by `pg`; the pool size may need to be `PrismaPg`'s `max` instead.
- Next.js 16 Turbopack importing the Prisma 7 generated client from `prisma/generated/` (any `serverExternalPackages` need).
- Bolt 5.1.0 `app_mention` payload and `block_actions` `ack()` shape under bun.

</code_context>

<specifics>
## Specific Ideas

- Demo calendar slots to keep clean: Fri 18 Sep 2026 11:00 HKT (first ask) and 10:30 HKT (B's conflicting ask). Seed data must avoid both (D-14).
- The phase's first two minutes include the ROADMAP time-eater check: edit a file and time the dev-server reload (≈2s), to confirm the repo is on the native WSL filesystem, not `/mnt/c`. The repo currently lives at `C:\coding_proj\ai-secretary`; the pre-window checklist moves it.
- Prisma generate time-box is 15s, with a Node fallback (`node node_modules/.bin/prisma generate`).
- The local refresh token sits in Postgres in plaintext, seeded from env. This is acceptable for a one-laptop demo; it's a candidate for `/ponytail-debt` "known shortcuts".

</specifics>

<deferred>
## Deferred Ideas

- `trigger.config.ts`, the Trigger.dev task wrapper and `AGENT_TRANSPORT` branching: Phase 4 (D-04).
- Reject button and watched-channel `message` listener with subtype/bot filtering: Phase 2.
- `buildConflictBlocks` stub: Phase 7 (serial, no parallel consumer).
- shadcn components and the retro theme tokens: Phase 6.
- `server-only` guard on config: not applicable (Bolt/Trigger.dev import it).

</deferred>

---

*Phase: 01-foundation-hardcoded-round-trip*
*Context gathered: 2026-09-11*
