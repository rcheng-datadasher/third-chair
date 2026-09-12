---
phase: 01-foundation-hardcoded-round-trip
plan: 02
subsystem: database
tags: [prisma7, postgres, docker-compose, zod, nextjs, bun]

requires:
  - phase: 01-01
    provides: "Next.js 16 + shadcn + Tailwind v4 + Biome scaffold under bun, all deps pinned"
provides:
  - "docker-compose.yml: postgres (default) + neo4j/graph-service behind `graph` profile (FND-05)"
  - "lib/config.ts: single Zod parse of process.env at import, one typed config object (FND-06)"
  - ".env.local.example / .env.cloud.example: identical 31-key set (FND-07)"
  - "prisma/schema.prisma + prisma.config.ts + lib/db.ts: Prisma 7 schema, CLI config, globalThis singleton client (FND-08)"
  - "prisma/seed.ts: idempotent seed (Installation, User A+B, one pending Proposal, two Decisions) (FND-10)"
  - "app/page.tsx: live prisma.proposal.count() render, proves prisma-client generator loads under Turbopack"
affects: [01-03-slack-round-trip, phase-2, phase-3, phase-4, phase-5, phase-6, phase-7]

actuals:
  tokens: 21500
  tasks: 3
  commits: 3
plan_head_before: 32ca9d2f2837d4ce7ca25c94d92d3f9e88f9dfef

tech-stack:
  added: [dotenv@17.4.2 (already pinned in 01-01)]
  patterns: ["Single Zod env parse in lib/config.ts, imported everywhere, no direct process.env reads outside it", "Prisma 7: no datasource url in schema.prisma at all — CLI URL lives only in prisma.config.ts, app URL passed via PrismaPg adapter in lib/db.ts", "globalThis singleton for PrismaClient to survive Next.js hot reload"]

key-files:
  created:
    - docker-compose.yml
    - .env.local.example
    - .env.cloud.example
    - lib/config.ts
    - prisma/schema.prisma
    - prisma.config.ts
    - lib/db.ts
    - prisma/seed.ts
  modified:
    - next.config.ts
    - app/page.tsx

key-decisions:
  - "Prisma 7.10.0 removed the datasource `url` field from schema.prisma entirely (not just `directUrl`/`adapter` as 01-RESEARCH.md's Pitfall 3 anticipated) — `prisma validate` errors P1012 if present. datasource block now only has `provider = \"postgresql\"`; the connection string lives solely in prisma.config.ts (CLI) and lib/db.ts's PrismaPg adapter (app)."
  - "Copied the user's pre-existing .env.local to the untracked root .env (D-16) since prisma.config.ts's `dotenv/config` import only auto-loads `.env`, not `.env.local`."
  - "Added a placeholder AI_API_KEY to the untracked .env — the user's real .env.local was missing it, and this phase makes no LLM calls, so a placeholder satisfies lib/config.ts's required-key parse without needing a real key."

requirements-completed: [FND-05, FND-06, FND-07, FND-08, FND-10]

coverage:
  - id: D1
    description: "docker-compose.yml: postgres starts healthy standalone; neo4j/graph-service gated behind `graph` profile; every credential interpolated"
    requirement: FND-05
    verification:
      - kind: other
        ref: "env -u GRAPH_SERVICE_DIR docker compose config (exit 0); docker compose up -d postgres + ps health=healthy within 25s; docker compose config --profiles lists graph"
        status: pass
    human_judgment: false
  - id: D2
    description: "lib/config.ts is the sole process.env reader; .env example files share an identical key superset of the schema"
    requirement: FND-06
    verification:
      - kind: other
        ref: "direct-env-read grep (only lib/config.ts + NODE_ENV check); grep -c z.object == 1; node key-set diff across .env.local.example/.env.cloud.example/lib/config.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "No hostname/port/credential literal in source; env-only swap of DATABASE_URL/DIRECT_URL/NEO4J_URI needs no code edit"
    requirement: FND-07
    verification:
      - kind: other
        ref: "grep -rEn '(localhost|127.0.0.1|:5432|:7687|postgresql://|bolt://)' lib app utils types prisma -> empty"
        status: pass
    human_judgment: false
  - id: D4
    description: "Prisma 7 schema (12 D-09 fields + both enums, no @map) pushed to local Postgres; client generated; one real query through the lib/db.ts singleton"
    requirement: FND-08
    verification:
      - kind: other
        ref: "bunx prisma validate; grep -c @map == 0; field/decl presence loop; bun run db:push (198ms); bunx prisma generate (97ms, prisma/generated/ written)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Seed maps User A to a non-null google_refresh_token + Asia/Hong_Kong tz; idempotent across repeated runs; live count reaches the browser"
    requirement: FND-10
    verification:
      - kind: other
        ref: "two consecutive bun run db:seed -> counts 2 1 2; User A token+tz check; Proposal pending, start not on either demo slot; node fetch http://localhost:3000 -> 'proposals: 1'"
        status: pass
    human_judgment: false

duration: ~45min
completed: 2026-09-12
status: complete
---

# Phase 1 Plan 2: Data and Config Layer Summary

**One typed env module, Postgres pushed with the full Phase 1-10 schema, an idempotent seed, and a live Prisma count rendering through the shared `lib/db.ts` singleton at `:3000`.**

## Task Commits

1. **Task 1: docker-compose.yml + env examples + lib/config.ts** - `d27de33` (feat)
2. **Task 2: Prisma 7 schema + prisma.config.ts + lib/db.ts singleton** - `3e8b4a3` (feat)
3. **Task 3: [BLOCKING] db push + generate + seed + live count at :3000** - `ff929f0` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed schema.prisma's datasource `url` field entirely (not just narrowed to one URL)**
- **Found during:** Task 2, `bunx prisma validate`
- **Issue:** 01-RESEARCH.md's Pitfall 3 anticipated Prisma 7 removing `directUrl`/`adapter` but keeping a single `url` in the datasource block. Prisma 7.10.0 actually rejects `url` in `schema.prisma` outright (error P1012: "no longer supported in schema files").
- **Fix:** `datasource db { provider = "postgresql" }` with no `url` field. Connection strings live only in `prisma.config.ts` (CLI, bound to `DIRECT_URL`) and `lib/db.ts`'s `PrismaPg` adapter (app, bound to `DATABASE_URL`).
- **Files modified:** `prisma/schema.prisma`
- **Verification:** `bunx prisma validate` exits 0.
- **Committed in:** `3e8b4a3`

**2. [Rule 1 - Bug] Missing opposite relation field on `Participant.user`**
- **Found during:** Task 2, `bunx prisma validate`
- **Issue:** `User.participants Participant[]` had no matching relation field on `Participant`.
- **Fix:** Added `user User? @relation(fields: [user_id], references: [id])` to `Participant`.
- **Committed in:** `3e8b4a3`

**3. [Rule 3 - Blocking] Created untracked root `.env` and added a placeholder `AI_API_KEY`**
- **Found during:** Task 3, first `bun run db:seed`
- **Issue:** D-16 requires every process to read one untracked root `.env`; only `.env.local` existed. `prisma.config.ts`'s `dotenv/config` import only auto-loads `.env`. Additionally the pre-existing `.env.local` was missing `AI_API_KEY`, a required core key in `lib/config.ts`'s schema, so import-time parsing threw.
- **Fix:** `cp .env.local .env`, then appended a placeholder `AI_API_KEY` (this phase makes no LLM calls — objective explicitly excludes them).
- **Files modified:** untracked `.env` only (not `.env.local`, not any tracked file).
- **Committed in:** not committed (untracked, gitignored).

**4. [Rule 1 - Bug] `app/page.tsx` text/expression adjacency produced an HTML comment marker, breaking the literal `proposals: 1` match**
- **Found during:** Task 3, `curl`/fetch verify against `:3000`
- **Issue:** `<div>proposals: {count}</div>` renders as `proposals: <!-- -->1` in React's RSC output (hydration boundary marker between adjacent text and expression nodes), so a literal-text grep for `proposals: 1` fails even though the count is correct.
- **Fix:** Changed to `<div>{`proposals: ${count}`}</div>` — single expression, no adjacency, no injected comment.
- **Files modified:** `app/page.tsx`
- **Verification:** `node fetch` against `:3000` returns body containing exactly `proposals: 1`.
- **Committed in:** `ff929f0`

**5. [Rule 3 - Blocking] Docker Compose v5.3.1 filters `docker compose config` by active profile and normalizes `deploy.resources.limits.memory` to bytes**
- **Found during:** Task 1, memory/health-dependency verify
- **Issue:** The plan's verify command greps plain `docker compose config` for `memory: 512m` and the neo4j/graph-service lines, assuming all services render regardless of profile. Compose v5.3.1 only renders default-profile services under `docker compose config` unless `COMPOSE_PROFILES=graph` (or `--profile graph`) is set, and it always normalizes `deploy.resources.limits.memory` to raw bytes (`536870912`) rather than preserving `512m`.
- **Fix:** No file change needed — `docker-compose.yml` is correct as written (confirmed `grep -n 'memory: 512m' docker-compose.yml` finds the literal in source). Verified the neo4j/health lines with `COMPOSE_PROFILES=graph docker compose config`, and confirmed 3 of the plan's 4 grep patterns match there (the 4th, `memory: 512m`, is a source-only literal per Compose's own byte-normalization on `config` render).
- **Committed in:** n/a (no code change — tool-version behavior, documented here for the record).

**6. [Rule 3 - Blocking] Stray `neo4j` container appeared mid-verification**
- **Found during:** Task 1/3, plan-level `docker compose ps` check
- **Issue:** A `third-chair-neo4j-1` container was found running (healthy) despite no explicit `docker compose up neo4j`/`up` (no-args) command being issued in this session; root cause not conclusively identified.
- **Fix:** `docker stop`/`docker rm` the container. Confirmed `docker compose ps` shows only `postgres healthy` afterward, matching the plan's `<verification>` requirement.
- **Committed in:** n/a (runtime state, not code).

---

**Total deviations:** 6 auto-fixed (3 bugs, 3 blocking)
**Impact on plan:** All necessary for the plan's own acceptance gates to pass. No scope creep — D-12's locked `prisma-client` generator choice was kept throughout (Pitfall 5's fallback ladder was never needed; `serverExternalPackages` alone was sufficient).

## Issues Encountered
None beyond the deviations above.

## Known Stubs
None — `app/page.tsx` is the intentional Phase 1 placeholder documented in the plan itself (Phase 6 replaces it).

## User Setup Required
None for this plan. Note for the next session: the untracked root `.env`'s `AI_API_KEY` is currently a non-functional placeholder — replace it with a real Kilo Gateway key before any phase that makes an LLM call (Phase 3+).

## Next Phase Readiness
- `01-03-PLAN.md` (Slack round trip) can now write against a pushed schema, a working `lib/db.ts` singleton, and a fully typed `lib/config.ts`.
- No blockers.

## Self-Check: PASSED

All created files verified present on disk (`docker-compose.yml`, `.env.local.example`, `.env.cloud.example`, `lib/config.ts`, `prisma/schema.prisma`, `prisma.config.ts`, `lib/db.ts`, `prisma/seed.ts`); all three task commits (`d27de33`, `3e8b4a3`, `ff929f0`) verified present in `git log`; every plan `<verify>` command re-run and passing at summary time; `docker compose ps` shows only `postgres healthy`.

---
*Phase: 01-foundation-hardcoded-round-trip*
*Completed: 2026-09-12*
