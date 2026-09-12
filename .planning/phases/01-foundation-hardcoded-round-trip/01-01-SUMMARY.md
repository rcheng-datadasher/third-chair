---
phase: 01-foundation-hardcoded-round-trip
plan: 01
subsystem: infra
tags: [nextjs, shadcn, tailwindcss-v4, biome, bun, prisma, slack-bolt, langgraph, zustand, react-hook-form, zod, trigger-dev]

# Dependency graph
requires: []
provides:
  - "Root CLAUDE.md with all 13 repo-rule sections, committed before any feature code (FND-01)"
  - "README.md skeleton with all 8 required headings in source-doc order (FND-02)"
  - "Next.js 16.3.4 App Router + TypeScript + shadcn (base/nova) + Tailwind v4 (CSS-first) + Biome 2.5.13, running under bun (FND-03)"
  - "Every core-window dependency installed at an exact pin, bun.lock tracked, package-lock.json/.env/prisma/generated gitignored (FND-04)"
  - "gsd/phase-1-foundation branch, renamed from master to main first, per D-26"
  - "package.json scripts dev/bolt/db:push/db:seed/check/postinstall as the only written-down run commands (D-19)"
affects: [01-02-config-schema-seed, 01-03-slack-round-trip, phase-2, phase-3, phase-4, phase-5, phase-6, phase-7]

# Actuals (#2632)
actuals:
  tokens: 53620
  tasks: 3
  commits: 2
plan_head_before: 8a6689e7aca034d9bcaad045e6dd25c4c0be4bed

# Tech tracking
tech-stack:
  added: [next@16.3.4, react@19.3.0, tailwindcss@4.3.3, "@tailwindcss/postcss@4.3.3", "shadcn@4.21.0 (base library, nova preset)", "@biomejs/biome@2.5.13", "@slack/bolt@5.1.0", "@slack/web-api@8.1.1", googleapis@180.0.0, "@langchain/langgraph@1.4.14", "@langchain/core@1.2.10", openai@7.15.0, zod@4.6.2, "@hookform/resolvers@5.9.1", react-hook-form@7.87.0, "@tanstack/react-query@5.102.8", zustand@5.0.15, "@prisma/client@7.10.0", "@prisma/adapter-pg@7.10.0", pg@8.23.0, "@trigger.dev/sdk@4.5.16", prisma@7.10.0 (dev), "@trigger.dev/build@4.5.16" (dev), "@types/pg@8.23.1" (dev), dotenv@17.4.2 (dev)]
  patterns: ["Scaffold-into-temp-dir-then-merge for create-next-app against a non-empty repo root", "Exact-pin package.json (no ^/~) re-synced into bun.lock via a second bun install", "biome.json files.includes negation for generated/vendored/pre-existing directories (components/ui, prisma/generated, public, connection_test)"]

key-files:
  created:
    - CLAUDE.md
    - README.md
    - package.json
    - bun.lock
    - biome.json
    - tsconfig.json
    - next.config.ts
    - postcss.config.mjs
    - components.json
    - app/layout.tsx
    - app/page.tsx
    - app/globals.css
    - lib/utils.ts
  modified:
    - .gitignore

key-decisions:
  - "Task 2's three [SUS]-flagged packages (@slack/web-api@8.1.1, @prisma/adapter-pg@7.10.0, @types/pg@8.23.1) were approved by the user (\"Continue. Execute the plans.\") without exclusion — all three verdicts were the legitimacy checker's too-new false positive on official, high-download packages."
  - "next.config.ts sets agentRules: false — Next.js 16's default dev-server behavior appends an \"agent rules\" block to CLAUDE.md on every `next dev` boot, which would corrupt the hand-authored, already-committed FND-01 file on every future dev session."
  - "biome.json excludes public/** and connection_test/** in addition to D-23's three named exclusions (components/ui, prisma/generated) — public/ holds the stock Next.js scaffold SVGs (a11y-lint noise on static assets, not app code) and connection_test/ is pre-existing, unrelated scratch code outside this plan's scope that must not be touched."

patterns-established:
  - "Package-manager scripts are the only written-down run commands (D-19): dev, bolt, db:push, db:seed, check, postinstall — no raw invocation from memory."
  - "Tailwind v4 is CSS-first: no tailwind.config.js/.ts anywhere; all theme tokens live in app/globals.css."

requirements-completed: [FND-01, FND-02, FND-03, FND-04]

coverage:
  - id: D1
    description: "Root CLAUDE.md exists with all 13 required rule-topic `## ` headings, each with a non-blank body, committed before any feature code"
    requirement: "FND-01"
    verification:
      - kind: automated_ui
        ref: "for-loop grep of 13 headings + awk empty-section check (Task 1 <verify>)"
        status: pass
    human_judgment: false
  - id: D2
    description: "README.md skeleton with all 8 required headings in source-doc order, none heading-only; \"What it is\" and \"Usage\" carry real prose"
    requirement: "FND-02"
    verification:
      - kind: automated_ui
        ref: "grep -n '^## ' README.md pipe-joined order check (Task 1 <verify>)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Next.js 16.3.4 App Router + TS + shadcn (base/nova) + Tailwind v4 (CSS-first, no config file) + Biome 2.5.13 run under bun; dev server serves HTTP 200"
    requirement: "FND-03"
    verification:
      - kind: other
        ref: "bunx --bun @biomejs/biome check . (exit 0)"
        status: pass
      - kind: other
        ref: "bun run dev + node fetch http://localhost:3000 -> 200"
        status: pass
      - kind: other
        ref: "test ! -f tailwind.config.js && test ! -f tailwind.config.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every dependency in package.json is an exact pin (no ^/~), bun.lock tracked, package-lock.json/.env/prisma/generated gitignored, all six scripts present"
    requirement: "FND-04"
    verification:
      - kind: other
        ref: "grep -cE '\": *\"[\\^~]' package.json -> 0"
        status: pass
      - kind: other
        ref: "git ls-files --error-unmatch bun.lock; git check-ignore package-lock.json/.env/prisma/generated"
        status: pass
      - kind: other
        ref: "node -e scripts-presence check -> SCRIPTS_OK"
        status: pass
    human_judgment: false

duration: ~35min (across two executor sessions, split by the Task 2 checkpoint)
completed: 2026-09-12
status: complete
---

# Phase 1 Plan 1: Repo Rules, README Skeleton, and Pinned Next.js/shadcn/Bun Scaffold Summary

**Root CLAUDE.md (13 rule sections) and README.md skeleton committed before any feature code, then a Next.js 16 + shadcn (base/nova) + Tailwind v4 + Biome 2.5.13 toolchain scaffolded under bun with every core-window dependency at an exact pin.**

## Performance

- **Duration:** ~35 min total (Task 1 + Task 3 work; Task 2 was a human checkpoint spanning a separate session boundary)
- **Started:** 2026-09-11T22:XX (Task 1, prior session)
- **Completed:** 2026-09-12T03:50:32Z
- **Tasks:** 3/3 (Task 1 auto, Task 2 checkpoint:human-verify, Task 3 auto)
- **Files modified:** 19 (13 created in Task 1/3 tracked artifacts + 6 supporting scaffold files: app/favicon.ico, public/*.svg ×5)

## Accomplishments
- `CLAUDE.md` and `README.md` landed on `gsd/phase-1-foundation` before any `app/`/`lib/`/`components/` file existed (FND-01, FND-02)
- Three flagged-but-legitimate packages (`@slack/web-api`, `@prisma/adapter-pg`, `@types/pg`) human-approved before the first install, per the Task 2 gate
- Full Next.js 16 + shadcn + Tailwind v4 (CSS-first) + Biome toolchain scaffolded under bun, with every core-window dependency pinned exactly and `bun.lock` tracked (FND-03, FND-04)
- `bun run dev` serves HTTP 200 and `bunx --bun @biomejs/biome check .` exits 0 on the scaffolded tree

## Task Commits

Each task was committed atomically:

1. **Task 1: Git baseline + CLAUDE.md (FND-01) + README skeleton (FND-02)** - `febbcaf` (docs)
2. **Task 2: Package legitimacy gate — three [SUS] packages before any install** - checkpoint, no commit (human approved all three via "Continue. Execute the plans.")
3. **Task 3: Next.js + shadcn + Tailwind v4 + Biome scaffold under bun, all deps pinned (FND-03, FND-04)** - `99937ab` (feat)

**Plan metadata:** committed after this SUMMARY (see below)

## Files Created/Modified
- `CLAUDE.md` - 13 repo-rule sections (folder structure, reuse, docs, single sources of truth, formatting, tests, Next.js conventions, state management, forms, naming, Prisma, run commands, processes)
- `README.md` - 8-heading open-source README skeleton; "What it is" and "Usage" filled in, rest one-line `TODO:`
- `package.json` - every core-window dependency at an exact pin; scripts `dev`/`bolt`/`db:push`/`db:seed`/`check`/`postinstall`
- `bun.lock` - tracked lockfile matching the exact-pinned `package.json`
- `biome.json` - schema bumped to 2.5.13; excludes `components/ui`, `prisma/generated`, `public`, `connection_test`; `css.parser.tailwindDirectives: true`
- `next.config.ts` - `agentRules: false` (see Deviations)
- `components.json`, `app/globals.css`, `lib/utils.ts` - shadcn init output (base library, nova preset)
- `app/layout.tsx`, `app/page.tsx` - scaffold defaults (Phase 1 does not touch these further; D-25's Prisma-count replacement is a later plan's job since this plan's file list excludes `lib/db.ts`/`prisma/`)
- `.gitignore` - merged scaffold's Next.js ignores with `package-lock.json`/`yarn.lock`/`pnpm-lock.yaml`, `.env`/`.env.*` with `!.env.local.example`/`!.env.cloud.example` negations, and `prisma/generated`

## Decisions Made
- User approved all three Task 2 [SUS]-flagged packages as-is (no exclusions) — the checker's "too-new" heuristic false-positived on Slack's own SDK monorepo, Prisma's own monorepo, and DefinitelyTyped, all multi-million-download official packages.
- Disabled Next.js 16's `agentRules` feature in `next.config.ts` (see Deviations — Rule 1).
- Excluded `public/**` and `connection_test/**` from `biome.json`'s scan in addition to D-23's three named exclusions (see Deviations — Rule 3).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Disabled Next.js 16's `agentRules` dev-server behavior**
- **Found during:** Task 3, first `bun run dev` verify run
- **Issue:** Next.js 16 appends a 10-line "agent rules" HTML-comment block to `CLAUDE.md` on every `next dev` boot (confirmed via `node_modules/next/dist/server/lib/generate-agent-files.js`), silently mutating the hand-authored, already-committed FND-01 deliverable every time the dev server starts.
- **Fix:** Reverted the appended block with `git checkout -- CLAUDE.md`, then set `agentRules: false` in `next.config.ts` and re-ran the dev-server verify to confirm the block no longer appears.
- **Files modified:** `next.config.ts`
- **Verification:** Second `bun run dev` run produced no "Generated CLAUDE.md" log line; `git diff --stat CLAUDE.md` was empty after the run.
- **Committed in:** `99937ab` (Task 3 commit)

**2. [Rule 3 - Blocking] Excluded `public/**` and `connection_test/**` from `biome.json`'s scan**
- **Found during:** Task 3, `bunx --bun @biomejs/biome check .` verify step
- **Issue:** The gate command must exit 0 on the whole tree. The stock Next.js scaffold SVGs in `public/` triggered `lint/a11y/noSvgWithoutTitle` (static assets, not application markup), and pre-existing, unrelated scratch files in `connection_test/` (out of this plan's scope, explicitly flagged as "leave alone" in the executor's sequential_execution instructions) triggered formatter errors.
- **Fix:** Added `!public` and `!connection_test` to `biome.json`'s `files.includes` negation list, alongside D-23's `!components/ui` and `!prisma/generated` (also corrected from the deprecated trailing-`/**` form per Biome 2.5's `useBiomeIgnoreFolder` fixable warning). Neither directory's content was modified.
- **Files modified:** `biome.json`
- **Verification:** `bunx --bun @biomejs/biome check .` exits 0 with only one deprecation `info` (unrelated, pre-existing `linter.rules.recommended` deprecation notice).
- **Committed in:** `99937ab` (Task 3 commit)

**3. [Rule 3 - Blocking] Fixed `.gitignore`'s `prisma/generated` pattern to match before the directory exists**
- **Found during:** Task 3, gitignore verify step
- **Issue:** `git check-ignore -q prisma/generated` returned a false negative against the trailing-slash directory-only pattern `prisma/generated/` when the directory does not yet exist on disk (this plan does not create `prisma/`; that lands in `01-02-PLAN.md`). The plan's own verify command would fail identically if run as written.
- **Fix:** Changed the pattern from `prisma/generated/` to `prisma/generated` (no trailing slash), confirmed to match both with and without the directory present.
- **Files modified:** `.gitignore`
- **Verification:** `git check-ignore -q prisma/generated && echo GENERATED_IGNORED` now prints `GENERATED_IGNORED` with no `prisma/` directory on disk.
- **Committed in:** `99937ab` (Task 3 commit)

**4. [Rule 3 - Blocking] Formatted `app/globals.css` and `lib/utils.ts` with Biome**
- **Found during:** Task 3, `bunx --bun @biomejs/biome check .` verify step
- **Issue:** shadcn's init output for these two files didn't match Biome's formatting rules (missing trailing semicolon in `lib/utils.ts`; minor CSS formatting in `app/globals.css`).
- **Fix:** Ran `bunx --bun @biomejs/biome check --write .` (scoped by the exclusions above, so it only touched in-scope files).
- **Files modified:** `app/globals.css`, `lib/utils.ts`
- **Verification:** `git status --short` confirmed only these two in-scope files changed; `connection_test/` timestamps were independently observed to shift during this window from what appears to be the user's own concurrent activity in that directory, not this command (Biome's exclusion list already omitted `connection_test` at the time `--write` ran).
- **Committed in:** `99937ab` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (1 bug, 3 blocking)
**Impact on plan:** All four were necessary for the plan's own acceptance gates to pass cleanly and for FND-01's already-committed `CLAUDE.md` to stay stable across future `next dev` sessions. No scope creep — `connection_test/` and `public/` content were excluded from tooling, not modified.

## Issues Encountered
- `create-next-app@16.3.4 --help` does not expose a `--no-src-dir`/`--turbopack` flag pair as CONTEXT.md's research flag anticipated; the CLI's actual flag set (confirmed via `--help`) omits `--src-dir` by default (equivalent to "no src dir") and has no separate Turbopack toggle in this version. Scaffolded with `--ts --tailwind --biome --app --import-alias "@/*" --use-bun --disable-git --yes`, which matched Pitfall 1's spirit exactly.
- `bunx shadcn@4.21.0 init -y` alone still opened interactive prompts for component library and preset despite `-y`; resolved by pre-supplying `-b base -p nova` per Pitfall 2's "run `--help` first" guidance.
- `bun add prisma @prisma/engines` lifecycle scripts were blocked by bun's default untrusted-postinstall policy; trusted explicitly via `bun pm trust prisma @prisma/engines` since both are the already-approved, official Prisma packages (not a new/unverified install per the Rule 3 package-install exclusion — no new package name was introduced, only lifecycle-script execution for an already-pinned, approved dependency).

## User Setup Required
None - no external service configuration required in this plan.

## Next Phase Readiness
- `01-02-PLAN.md` (data/config layer: `lib/config.ts`, `lib/db.ts`, `prisma/schema.prisma`, `docker-compose.yml`, stub modules, seed data) can now run against a working Next.js/Biome/bun toolchain with every dependency it needs already installed and pinned.
- `01-03-PLAN.md` (Slack round trip, the phase's tracer) is unblocked on the dependency side (`@slack/bolt`, `@slack/web-api` both installed at pinned versions).
- No blockers. `hooks/` and `stores/` remain absent per D-24, to be created on first use by a later phase.

## Self-Check: PASSED

All created files verified present on disk (`CLAUDE.md`, `README.md`, `package.json`, `bun.lock`, `biome.json`, `components.json`, `lib/utils.ts`); both task commits (`febbcaf`, `99937ab`) verified present in `git log`.

---
*Phase: 01-foundation-hardcoded-round-trip*
*Completed: 2026-09-12*
