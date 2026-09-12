# Phase 1: Foundation + Hardcoded Round Trip - Pattern Map

**Mapped:** 2026-09-12
**Files analyzed:** ~30 (every file Phase 1 creates)
**Analogs found:** 0 / ~30 — **greenfield repo**

## Repo state

Confirmed via `git ls-files`: the tracked tree contains only `.planning/**`,
`.claude/CLAUDE.md`, and (untracked) `gsd-prompt-ai-secretary.md`. No
`app/`, `lib/`, `prisma/`, `components/`, or any other source directory
exists yet. There is **no in-repo analog for any file this phase creates** —
Phase 1 is the source of every pattern later phases will copy from.

Because there is nothing to search or Read in the codebase, this file skips
the normal per-analog Read/excerpt process and instead maps each new file
directly to its authoritative excerpt source already produced by upstream
agents (CONTEXT.md decisions + RESEARCH.md's `Code Examples`/`Architecture
Patterns` sections, which already contain concrete, ready-to-copy code). Do
not invent code beyond what those sources state.

## File Classification

| New File | Role | Data Flow | Analog | Authoritative excerpt source |
|---|---|---|---|---|
| `CLAUDE.md` (root) | config/docs | — | none | CONTEXT.md D-18; RESEARCH.md §Phase Requirements FND-01; `gsd-prompt-ai-secretary.md` §"Phase 1, first task" |
| `README.md` | config/docs | — | none | CONTEXT.md D-20; RESEARCH.md §Code Examples "README skeleton" |
| `docker-compose.yml` | config | — | none | RESEARCH.md §Code Examples "docker-compose.yml skeleton" (full YAML, lines under that heading) |
| `biome.json` | config | — | none | CONTEXT.md D-23; RESEARCH.md §Common Pitfalls (Biome Tailwind directives, cited in PITFALLS.md) |
| `.env.local.example` / `.env.cloud.example` | config | — | none | CONTEXT.md D-15/D-16; RESEARCH.md §Code Examples "lib/config.ts" (key list) |
| `prisma.config.ts` | config | file-I/O | none | RESEARCH.md §Code Examples "prisma.config.ts (Prisma 7, corrected)" — copy verbatim, it is the fix for Pitfall 3/4 |
| `prisma/schema.prisma` | model | CRUD | none | CONTEXT.md D-09..D-11 (field list, enums, snake_case); PROJECT.md §Data model as the base model |
| `prisma/seed.ts` | model/script | batch | none | CONTEXT.md D-13/D-14 (exact rows, idempotent upserts) |
| `lib/config.ts` | config | request-response | none | RESEARCH.md §Code Examples "lib/config.ts" — copy the Zod schema + `config` object shape verbatim, extend with `ai`/`google`/`trigger` sections per D-15 |
| `lib/db.ts` | service | CRUD | none | RESEARCH.md §Code Examples "lib/db.ts" — copy verbatim (globalThis singleton + PrismaPg adapter) |
| `lib/slack/bolt.ts` | controller (entry) | event-driven | none | RESEARCH.md §Architecture Patterns "System Architecture Diagram" + Interfaces table row `lib/slack/bolt.ts`: imports/registers listeners only, no logic |
| `lib/slack/client.ts` | service | request-response | none | Interfaces table: `export const slackClient: WebClient` (mirrors `lib/db.ts`'s singleton pattern) |
| `lib/slack/post-proposal-card.ts` | service | request-response | none | CONTEXT.md D-02 step 3; RESEARCH.md Interfaces table + "Minimal Block Kit approval card" example for the `blocks`/`text` call shape |
| `lib/slack/update-proposal-card.ts` | service | request-response | none | CONTEXT.md D-02 step 4 (stored channel/ts, not payload); mirrors post-proposal-card.ts shape, using `chat.update` |
| `lib/slack/blocks.ts` (`buildApprovalBlocks`/`buildConfirmedBlocks`) | utility | transform | none | RESEARCH.md §Code Examples "Minimal Block Kit approval card" — copy verbatim for `buildApprovalBlocks`; `buildConfirmedBlocks` follows the same shape swapping the action element for a static confirmed chip |
| `lib/slack/actions/approve-proposal.ts` (or handler in bolt.ts) | controller | event-driven | none | RESEARCH.md §Code Examples "`approve_proposal` action handler" — copy verbatim: `ack()` first, `body as BlockButtonAction`, stored channel/ts update |
| `lib/calendar/freebusy.ts` (`checkConflicts` stub) | service | request-response | none | Interfaces table: stub returns `[]`; no example body needed beyond that signature |
| `lib/calendar/create-event.ts` (stub) | service | request-response | none | Interfaces table signature only — Phase 3 fills in |
| `lib/ai/provider.ts` (`complete<T>` stub) | service | request-response | none | Interfaces table signature only — Phase 5 fills in |
| `lib/agent/graph.ts` (`runAgent` hardcoded stub) | service | event-driven | none | CONTEXT.md D-02 step 2 (hardcoded Proposal+Participant via `dedupe_key`) |
| `lib/agent/dispatch.ts` (`dispatchAgentRun`) | service | event-driven | none | CONTEXT.md D-04 (inline-only body, no transport branching yet) |
| `lib/agent/dedupe.ts` (`computeDedupeKey`) | utility | transform | none | Interfaces table signature: pure function, real implementation this phase |
| `utils/time.ts` (HKT formatter) | utility | transform | none | RESEARCH.md §Don't Hand-Roll "HKT time formatting" row — `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', ... })`, no library |
| `types/slack.ts` | model (types) | — | none | RESEARCH.md Interfaces table: `SlackMessage` shape given verbatim |
| `types/agent.ts` | model (types) | — | none | RESEARCH.md Interfaces table: `ExtractedIntent`, `ConflictSlot`, `RunAgentInput`, `RunAgentResult` (full shapes in ARCHITECTURE.md §"Interfaces Before Implementation", cross-referenced) |
| `app/page.tsx` | component (Server Component) | request-response | none | CONTEXT.md D-25 (`prisma.proposal.count()` smoke test); RESEARCH.md Pitfall 5 fallback ladder if Turbopack import fails |
| `next.config.ts` | config | — | none | RESEARCH.md §Common Pitfalls Pitfall 5 step 1: `serverExternalPackages: ["@prisma/client", "pg"]` |
| `package.json` scripts | config | — | none | CONTEXT.md D-19 (`dev`, `bolt`, `db:push`, `db:seed`, `check`, `postinstall`) |

## Pattern Assignments

No per-file Read-and-excerpt pass was performed because no analog file
exists to Read. Every code excerpt the planner needs is already inline in
RESEARCH.md §"Code Examples" (verbatim, copy-ready) for: `prisma.config.ts`,
`lib/db.ts`, `lib/config.ts`, the `approve_proposal` action handler, the
Block Kit builder, and `docker-compose.yml`. For files with only a
signature (no example body — the Wave A/B stubs), the Interfaces table in
RESEARCH.md §"Architecture Patterns" is the exact and only signature source,
as locked by CONTEXT.md D-05/D-06.

## Shared Patterns

### Config-only env access
**Source:** RESEARCH.md §Code Examples "lib/config.ts"; CONTEXT.md D-15
**Apply to:** every file that needs Slack/DB/Google/Kilo Gateway secrets — never read `process.env` directly outside `lib/config.ts`.

### Prisma singleton
**Source:** RESEARCH.md §Code Examples "lib/db.ts"
**Apply to:** `lib/slack/actions/approve-proposal.ts`, `lib/agent/graph.ts`, `app/page.tsx`, `prisma/seed.ts` — all import `prisma` from `lib/db.ts`, never construct a new `PrismaClient`.

### Stored channel/ts, not payload channel/ts
**Source:** CONTEXT.md D-02; RESEARCH.md §Anti-Patterns to Avoid
**Apply to:** `lib/slack/actions/approve-proposal.ts`'s call into `update-proposal-card.ts` — always use `proposal.card_channel`/`proposal.card_ts` from the DB row, never `body.channel.id`/`body.message.ts`.

### `ack()` before any DB/network call
**Source:** RESEARCH.md §Code Examples "`approve_proposal` action handler"
**Apply to:** every Bolt action handler added in this and later phases.

### kebab-case filenames, named exports, TSDoc
**Source:** CONTEXT.md D-05; RESEARCH.md §Recommended Project Structure
**Apply to:** all new `lib/**` files.

## No Analog Found

All files listed above have no analog — this is expected and correct for a
Phase 1 scaffold in a greenfield repo. Planner should treat RESEARCH.md's
`Code Examples` and `Interfaces Before Implementation` table, plus
CONTEXT.md's `<decisions>` block, as the pattern source for every plan
action in this phase.

## Metadata

**Analog search scope:** entire tracked tree (`git ls-files`) — confirmed empty of source code.
**Files scanned:** 0 source files (repo pre-scaffold); 2 required-reading docs (CONTEXT.md, RESEARCH.md) fully read.
**Pattern extraction date:** 2026-09-12
</content>
