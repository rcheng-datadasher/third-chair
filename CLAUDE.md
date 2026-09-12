# CLAUDE.md — Repo Rules

These are the non-negotiable rules for this repo. Every phase, every parallel worktree, and every
agent working in this codebase inherits them. This file is written before any feature code exists.

## Folder structure

Folder structure is not negotiable: `app/`, `components/`, `components/ui/`, `hooks/`, `stores/`,
`lib/` with `lib/slack/`, `lib/calendar/`, `lib/ai/`, `lib/agent/`, `utils/`, `types/`, `prisma/`.
A file goes in exactly one of these; if it's unclear which, the module is doing two things.

`hooks/` and `stores/` carry no placeholder file — they appear when first used, not before.

`lib/utils.ts` is the one exception to "domain logic in `lib/<area>/`": it is shadcn-owned and
holds `cn`. Do not move it and do not add unrelated helpers to it.

## Reuse before writing

Search `lib/` and `utils/` before adding a helper. Never add a second helper that does an
existing job under a different name — this is the main way parallel agents corrupt a codebase.

## Documentation

Every function carries TSDoc: a summary, `@param` for each parameter, `@returns`, and `@throws`
where applicable. This applies to internal helpers too, not just exported APIs. No ponytail pass
may remove a doc comment. If a cleanup pass and a comment conflict, the comment wins.

## Single sources of truth

- All model calls go through `lib/ai/provider.ts`. No other file imports an AI SDK client directly.
- All colours go through shadcn CSS variables declared in `app/globals.css`. No colour literals in
  components, and no `tailwind.config.js`/`tailwind.config.ts` file (Tailwind v4 is CSS-first).
- All environment access goes through the one typed config module, `lib/config.ts`. No scattered
  direct reads of `process.env` anywhere else in the repo.

## Formatting and linting

Biome is the only formatter and linter in this repo. Run `bun run check` before considering a
phase done. No Prettier, no ESLint, and no competing formatter/linter configuration.

## Tests

No test files and no test framework. This is a repo rule, not an oversight — this build does not
ship tests of any kind.

## Next.js conventions

Server Components by default; add `"use client"` only where interactivity actually demands it.
No secrets in client components. Route handlers stay thin, with logic living in `lib/`. Use
TanStack Query for client-side fetching rather than ad-hoc `useEffect`-based fetching.

## State management

Zustand, never React Context, for shared client state. Stores live in `stores/`, one store per
domain, with narrow selectors so components only re-render on the slice they read. Context is
reserved for static injection only (e.g. a theme provider or the Copilot provider) — never for
app state that changes.

## Forms

React Hook Form with a Zod resolver, always. The same Zod schema that validates a form also
validates the equivalent server boundary — one schema, both sides.

## Naming and style

kebab-case files, PascalCase components, camelCase functions. Prefer named exports over default
exports. No `any`. Validate every external boundary with Zod.

## Prisma

One shared Prisma client per process, constructed once in `lib/db.ts` behind a `globalThis`
singleton. Never construct a client inside a request handler, a Bolt listener, or a background
task body. Use `bunx prisma db push` during the build window — never `prisma migrate dev`. A
track merges the latest `develop` before it pushes a schema change.

## Run commands

Per-process run commands (this supersedes any earlier generated guidance suggesting Bolt runs
under plain Node):

- **Next.js:** `bun run dev` (script wraps `next dev`).
- **Bolt:** `bunx tsx lib/slack/bolt.ts` (Phase 2 Task 1 smoke test: bun's Socket Mode
  WebSocket ping handling misbehaved — `undici_1.ping is not a function` — so tsx is the
  winning runtime, not the fallback).
- **Prisma:** `bunx prisma …` (e.g. `bunx prisma db push`, `bunx prisma generate`).
- **Package manager:** bun only — never npm, npx, yarn, or pnpm.
- Never pass `--bun` to any of the above commands.

## Processes

Exactly one Bolt process runs at a time across all worktrees. Socket Mode load-balances events
across every open connection on the same app token, so a second Bolt process anywhere else steals
events from the first. Kill any other worktree's Bolt process before starting a new one.
