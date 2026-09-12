# Stack Research

**Domain:** Slack agent + Next.js dashboard + LangGraph + Trigger.dev + Prisma (hackathon build)
**Researched:** 2026-09-11
**Confidence:** HIGH for exact versions (verified against npm/PyPI registries directly, 2026-09-11) and MEDIUM-HIGH for compatibility claims (cross-checked GitHub issues/changelogs); bun-runtime-per-process recommendations are MEDIUM (historical incompatibility confirmed, current-version behavior not independently reproduced tonight — budget a 5-minute smoke test as step 1).

The stack itself is fixed by the user (see PROJECT.md). This file pins exact versions, install commands, and the compatibility landmines between them, so the scaffold phase doesn't burn window time discovering them live.

## Recommended Stack

### Core Technologies

| Technology | Version (npm `latest`, verified 2026-09-11) | Purpose | Why this exact version |
|------------|---------|---------|-----------------|
| bun | 1.4.2 (current stable; use whatever `bun upgrade` gives you tonight) | Package manager, script runner, TS runtime for the Bolt process | Fixed by project decision. Well past the 1.0–1.1 era where the WebSocket bugs below were filed; WSL Ubuntu is an officially supported platform. |
| next | 16.3.4 | Web app + dashboard, App Router | Current stable; App Router is the default and only mode worth using at this version. |
| react / react-dom | 19.3.0 | UI runtime | Required peer of Next 16 and shadcn's current CLI. |
| tailwindcss | 4.3.3 | Styling | CSS-first v4, no `tailwind.config.js` per project rule. |
| @tailwindcss/postcss | 4.3.3 (pin to match `tailwindcss`) | Required PostCSS plugin for v4 | v4 dropped the old `tailwindcss` PostCSS plugin package split; this is the correct package name, not `tailwindcss` itself, in `postcss.config.mjs`. |
| postcss | 8.5.28 | Required by `@tailwindcss/postcss` | Peer requirement, install alongside. |
| shadcn (CLI) | 4.21.0 | Component scaffolding | Current CLI major fully supports Tailwind v4 + React 19 + Next 16 App Router; run via `bunx shadcn@latest init`, not npx. |
| @biomejs/biome | 2.5.13 | Format + lint (only tool) | Current stable 2.x; run via `bunx --bun @biomejs/biome check --write` (see bun note below — `bunx` alone can silently misbehave). |
| @slack/bolt | 5.1.0 | Slack Socket Mode process | Current stable major. **Run this process under Node, not bun** — see Bun Compatibility Matrix below. |
| googleapis | 180.0.0 | Google Calendar client | Current stable; `events.insert({ conferenceDataVersion: 1 })` and `freebusy.query` are long-stable API surface, no version-specific gotchas found. |
| @langchain/langgraph | 1.4.14 | Agent graph | Current stable 1.x. Peer-requires `zod ^3.25.32 || ^4.2.0` and `@langchain/core ^1.1.48` — both satisfied by the pins below. |
| @langchain/core | 1.2.10 | LangGraph's model/message plumbing | Satisfies langgraph's `^1.1.48` peer range. Only install this if you actually call a LangChain chat-model wrapper or a LangChain-specific structured-output helper; per PROJECT.md, plain OpenAI-SDK-against-Kilo Gateway is the default path and this may not be needed at all — see "What NOT to Use". |
| openai | 7.15.0 | SDK used against Kilo Gateway's OpenAI-compatible endpoint | Current stable. Zod v4 support (`zodResponseFormat`/`zodTextFormat`) landed at `openai@5.23.2` (fixed the vendored `zod-to-json-schema` incompatibility with Zod v4's removed `ZodFirstPartyTypeKind` export) — 7.15.0 is well past that fix. `zod` is an **optional peer** (`^3.25 \|\| ^4.0`), not a hard dependency: install it explicitly. |
| zod | 4.6.2 | Validation, one schema per LLM output + form + DB boundary | Zod v4 is current and now supported end-to-end across every library in this stack (see Version Compatibility table) — no reason to pin v3. |
| @hookform/resolvers | 5.9.1 | Zod resolver for RHF | Zod v4 support shipped at `5.1.0`; the resolver auto-detects v3 vs v4 at runtime, so no config flag needed. |
| react-hook-form | 7.87.0 | Forms | Current stable 7.x, pairs with the resolver above. |
| @tanstack/react-query | 5.102.8 | Server state (dashboard fetching) | Current stable v5. |
| zustand | 5.0.15 | Client state | Current stable v5, works with React 19 out of the box. |
| prisma (CLI) | **pin to 7.10.0**, NOT the npm `latest` tag | Migrations/`db push` CLI | **npm's `latest` dist-tag for `prisma` currently resolves to `8.0.0-rc.13`, an unreleased-stable candidate** — see Version Compatibility. Pin the CLI explicitly to `7.10.0` to match `@prisma/client`. |
| @prisma/client | 7.10.0 | Prisma runtime | This package's `latest` tag correctly points at 7.10.0 (no premature RC here) — the mismatch is CLI-only. |
| @trigger.dev/sdk | 4.5.16 | Background jobs, task definitions | Current stable v4 (GA). |
| trigger.dev / @trigger.dev/build | 4.5.16 | CLI / build extensions (Prisma bundling) | Match the SDK version exactly; the build extension's `prismaExtension` officially supports up to Prisma 7 in "modern mode" — another reason to stay on Prisma 7, not 8-rc. |
| @copilotkit/react-core, @copilotkit/react-ui | 1.71.0 | Generative UI (S2 stretch only) | Current stable; peer-compatible with React 19 and zod `>=3.25` (covers 4.6.2). Per project decision, do not install until S2 actually starts. |

### Supporting Libraries (Python side, S1 stretch only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| graphiti-core | 0.30.2 (PyPI, requires Python `>=3.10,<4`) | Temporal knowledge graph | Only if S1 is started. Pins its own `neo4j>=5.26.0` driver requirement internally. |
| neo4j (Python driver) | 6.3.0 | Graph DB client for the FastAPI service | Satisfies graphiti-core's `>=5.26.0` floor; use whatever `pip install neo4j` gives you, don't hand-pin lower. |
| fastapi | 0.141.1 | S1's two-endpoint service | Only needed for S1; no gotchas found. |
| neo4j:5-community (Docker) | current patch `5.26.30-community` (image tag `5-community` floats to this) | Local graph DB container | Actively maintained as of Aug 2026; the `5-community` floating tag is fine for a one-day build — no need to pin a patch. |

## Bun Compatibility Matrix (the part most likely to eat window time)

The user's decision fixes bun as package manager/script runner everywhere, with the Bolt TS process running "directly under bun." Verified findings, with a recommended runtime **per process**:

| Process | Recommended runtime | Confidence | Why |
|---|---|---|---|
| **Bolt (`@slack/bolt` Socket Mode)** | **Node** (invoke with `node --experimental-strip-types src/bolt/index.ts`, no `tsx`/`ts-node` install needed — Node 22.6+ strips TS types natively) | MEDIUM — historical bug, not independently reproduced tonight | Two GitHub issues (`oven-sh/bun#4663`, `slackapi/bolt-js#2118`) document bun's WebSocket client failing to parse or dispatch incoming Socket Mode frames ("Unable to parse an incoming WebSocket message: JSON Parse error", and `app.message()` listeners never firing). **Both are closed as "not planned"/stale, filed against bun 1.0.0–1.1.8** — three-plus major bun releases behind the current 1.4.2. It is plausible this is fixed, but no report of it working was found either. **Do a 5-minute smoke test as literally the first task of the Slack-surface phase**: post one message, confirm `app.message` fires under `bun run`. If it doesn't fire or you see WebSocket parse errors, fall back to Node immediately — this is a live-socket process, and a silent failure here (ack succeeds, listener never runs) is the worst possible failure mode to discover at 15:00. Package management (`bun install`, `bun add`) is unaffected either way — only the process invocation changes. |
| **Next.js dev/build** | `bun --bun next dev` / `bun --bun next build` (not bare `bun run dev`, which uses Node by default) | HIGH | `bun run <script>` invokes Node.js for the underlying command unless `--bun` is passed; Next.js's own guidance and the Bun docs both confirm App Router runs under the Bun runtime when invoked this way. If anything looks subtly wrong (Turbopack + bun interactions are less battle-tested than plain Node), drop the `--bun` flag — package management is still bun, only the dev-server process reverts to Node. |
| **Trigger.dev tasks** | Keep **Node** runtime in `trigger.config.ts` (do not set `runtime: "bun"`) | MEDIUM-HIGH | `runtime: "bun"` is a real, documented option (Trigger.dev states Bun 1.2.18 dev / 1.3.3 deployed are supported), but known limitations exist: OpenTelemetry instrumentation that relies on Node's module register hook doesn't work under Bun, and there's an open bug where projects with `package.json` workspaces fail to deploy under the Bun runtime. Tasks are also exactly the layer that calls LangGraph and Prisma — the two places you most want boring, well-trodden behavior during a 4h15m window. Bun still runs `bunx trigger.dev dev` fine as the CLI/tooling layer; this recommendation is about the *task execution* runtime only. |
| **Prisma generate / db push** | Either bun or Node works for the CLI invocation (`bunx prisma db push`, `bunx prisma generate`) | HIGH | Confirmed working via Prisma's own Bun guide and community writeups. The real risk with Prisma is version (8.0.0-rc), not runtime — see below. |
| **Biome** | `bunx --bun @biomejs/biome check --write` (the `--bun` flag matters) | MEDIUM-HIGH | Biome's own guidance recommends `bunx --bun @biomejs/biome ...` explicitly; there are Windows-specific reports of bare `bunx biome` producing no output after certain bun upgrades. You're on WSL Ubuntu, not native Windows, so this specific report likely doesn't apply, but the `--bun` flag costs nothing and matches upstream guidance. |
| **bun on WSL Ubuntu generally** | Fine | HIGH | Officially supported platform; only prerequisite historically flagged is having `unzip` available (WSL Ubuntu images ship it by default). |

**Net recommendation:** bun is the package manager and the general script runner everywhere (`bun install`, `bun add`, `bunx <cli>`), matching the fixed decision. The one place to deviate from "run everything under bun's own runtime" is **the Bolt process itself** — invoke its entry file with `node --experimental-strip-types`, which needs no new dependency (Node ≥22.6 strips TypeScript types natively, no `tsx` install). This costs one line in a `package.json` script and removes the single biggest known-unknown in the stack. If the smoke test shows bun's Socket Mode handling is actually fine now, switching that one script back to `bun run` is a one-line change, not a rewrite.

## Installation

```bash
# Core web app
bun add next@16.3.4 react@19.3.0 react-dom@19.3.0

# Tailwind v4 (CSS-first, no config file)
bun add tailwindcss@4.3.3 @tailwindcss/postcss@4.3.3 postcss@8.5.28
# then hand-write postcss.config.mjs with the @tailwindcss/postcss plugin,
# and `@import "tailwindcss";` at the top of app/globals.css

# shadcn/ui CLI (run per-component as needed, not a dependency install)
bunx shadcn@latest init
bunx shadcn@latest add button card dialog form input badge

# Lint/format (dev dependency)
bun add -D @biomejs/biome@2.5.13
bunx --bun biome init   # generates biome.json; then hand-edit, skip useSortedClasses

# Slack
bun add @slack/bolt@5.1.0

# Google Calendar
bun add googleapis@180.0.0

# Agent framework
bun add @langchain/langgraph@1.4.14
# only add @langchain/core if you actually use a LangChain wrapper:
bun add @langchain/core@1.2.10

# AI provider SDK + validation
bun add openai@7.15.0 zod@4.6.2

# Forms
bun add react-hook-form@7.87.0 @hookform/resolvers@5.9.1

# Client data/state
bun add @tanstack/react-query@5.102.8 zustand@5.0.15

# Data layer — pin Prisma CLI explicitly, do NOT let it resolve to `latest`
bun add prisma@7.10.0 @prisma/client@7.10.0
# Prisma 7's new engine-free client requires a driver adapter — see Version Compatibility
bun add @prisma/adapter-pg pg

# Background jobs
bun add @trigger.dev/sdk@4.5.16
bun add -D @trigger.dev/build@4.5.16
bunx trigger.dev@4.5.16 dev

# CopilotKit — ONLY when S2 stretch actually starts, not in the scaffold phase
bun add @copilotkit/react-core@1.71.0 @copilotkit/react-ui@1.71.0
```

```bash
# Python side (S1 stretch, separate repo, its own venv — not bun's concern)
pip install "graphiti-core" "fastapi" "uvicorn" "neo4j"
# graphiti-core pulls in neo4j>=5.26.0 and openai>=1.91.0 itself; don't hand-pin lower
```

## Alternatives Considered

None — the stack is fixed by the user and not open for substitution. The only place this file makes an active substitution call is the **Bolt process runtime** (Node instead of bun) and the **Prisma CLI version** (7.10.0 instead of npm's `latest`/8.0.0-rc.13), both justified above and both trivially reversible.

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `prisma@latest` / `npx prisma@latest` (resolves to `8.0.0-rc.13`) | npm's `latest` dist-tag for the `prisma` CLI package is currently an unreleased-stable release candidate, one major ahead of `@prisma/client@latest` (7.10.0) and ahead of what Trigger.dev's `prismaExtension` officially documents support for ("modern mode" targets Prisma 6.16+/7). Prisma 8-rc also changes `.take()/.skip()` to `.limit()/.offset()` and removes the flat `prisma-next.config.ts` shape — silent behavior changes you do not want mid-build. | Pin `prisma@7.10.0` and `@prisma/client@7.10.0` explicitly in `package.json`, never bare `@latest`. |
| `prisma-client-js` generator provider | Deprecated in Prisma 7 in favor of the Rust-free `prisma-client` provider; still works but is being phased out and the docs guide you off it. | `generator client { provider = "prisma-client" output = "./generated/prisma" }` — output path is **required** now, client no longer lands in `node_modules/@prisma/client`, so the import path changes to wherever `output` points. |
| `new PrismaClient()` with no arguments (Prisma 7) | Throws `PrismaClient needs to be constructed with a non-empty, valid PrismaClientOptions` — the new engine-free client has no default connection path. | Construct with a driver adapter: `new PrismaPg({ connectionString })` from `@prisma/adapter-pg`, passed as `new PrismaClient({ adapter })`. This is still one client at module scope behind the `globalThis` singleton per the repo rule — just with one extra constructor argument. |
| `prisma migrate dev` | Explicitly forbidden by the project's parallelism rules — timestamped migration files create non-linear history across two concurrent worktree tracks and Prisma will offer to reset the dev database. | `prisma db push` for the entire window, exactly as decided. |
| `tsx` or `ts-node` for the Bolt process | Not needed. Node ≥22.6 strips TypeScript types natively via `--experimental-strip-types`; bun itself also runs `.ts` directly. Adding a transpiler is one more moving part for zero benefit here. | `node --experimental-strip-types src/bolt/index.ts` (recommended, see Bun Compatibility Matrix) or `bun run src/bolt/index.ts` if the socket-mode smoke test passes. |
| `runtime: "bun"` in `trigger.config.ts` | Documented gaps: OpenTelemetry instrumentation relying on Node's register hook doesn't work, and an open bug breaks deploys when `package.json` has workspaces. Tasks in this build call LangGraph and Prisma — not where you want an edge-case runtime. | Leave Trigger.dev's default Node runtime in `trigger.config.ts`; keep using `bunx trigger.dev dev`/`bunx trigger.dev deploy` for the CLI itself, which is unaffected. |
| Zod v3 "for safety" | Every library actually in this stack now supports Zod v4 (`openai@7.15.0`, `@hookform/resolvers@5.9.1`, `@langchain/langgraph@1.4.14`'s peer range, `@copilotkit@1.71.0`'s peer range). Downgrading to v3 buys nothing and forecloses `.toJSONSchema()`, Zod v4's faster parsing, and its cleaner error format. | `zod@4.6.2` everywhere, one version across the whole repo. |
| A LangChain chat-model wrapper as the default path to Kilo Gateway | PROJECT.md's own decision: "all model calls go through a single `lib/ai/provider.ts`... No other file imports an SDK client directly," and structured output against Kilo Gateway is already covered by the OpenAI SDK + Zod. `@langchain/core` is a real dependency cost (more surface, another abstraction over the same HTTP call) for something the plain SDK already does. | Call the Kilo-pointed `openai` client directly from `lib/ai/provider.ts`, using Zod schemas for structured output (see next section for the exact mechanism). Only reach for `@langchain/core` if a specific LangGraph node demonstrably needs a LangChain-specific helper — install it then, not up front. |
| Assuming every Kilo Gateway model supports `response_format: json_schema` / `.chat.completions.parse` | Support is per **provider endpoint**, not per model name, and changes over time — the same model id can be served by multiple upstream providers with different capability. | Before wiring `MODEL_FAST`/`MODEL_SMART`, check `https://api.kilo.ai/api/gateway/models` for the chosen model ids, and set `require_parameters: true` in the Kilo Gateway provider routing object so a request fails loudly instead of silently downgrading to a provider without schema support. Fallback if a chosen fast model lacks it: ask for JSON via a strict system prompt + `response_format: { type: "json_object" }`, then `schema.parse()` the result yourself and retry once on failure — cheap, and it's what you'd need as a safety net either way. |
| Prettier, ESLint, or any competing formatter/linter | Explicit project rule; Biome is the only formatter/linter. | `bunx --bun biome check --write` before every phase is considered done. |
| A durable/Postgres/Redis LangGraph checkpointer | Explicit project decision — every graph invocation runs to completion in one pass, nothing is resumed across invocations. | LangGraph's default in-memory behavior (compile the graph with no `checkpointer` argument at all — checkpointing is simply disabled). Don't even reach for `MemorySaver` unless you specifically need same-process replay for debugging; the project doesn't need cross-invocation memory. |
| CopilotKit installed in the scaffold phase | It only serves the S2 stretch surface; installing and wiring its provider now spends core-window minutes on a feature that may never be reached. | Add `@copilotkit/react-core`/`react-ui` only when S2 actually starts. |

## Stack Patterns by Variant

**If the S1 (Graphiti) stretch is attempted:**
- Keep it a fully separate Python repo/process as decided — zero shared files with the TS app.
- Pin `graphiti-core` to whatever `pip install graphiti-core` resolves to today (0.30.2 at research time) rather than hand-pinning a specific patch; it's pre-1.0 and moves fast, but its `neo4j>=5.26.0` floor is loose enough not to fight your Docker image.
- Because Neo4j 5-community is the primary path and FalkorDB is only the RAM-constrained fallback, don't install `falkordb` up front — it's an `extra` in graphiti-core's own dependency spec (`pip install "graphiti-core[falkordb]"`), so it costs nothing to add later if you actually need the fallback.

**If the conflict-counter-proposal AI feature needs a "smarter" Kilo Gateway model that turns out not to support structured outputs:**
- Don't reach for LangChain's structured-output abstraction as the fix — it hits the exact same upstream provider capability. Switch `MODEL_SMART` to a different Kilo Gateway model id (env change only, per the provider-swap design) or fall back to the JSON-mode + manual `zod.parse()` pattern noted above.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `prisma@7.10.0` (CLI) | `@prisma/client@7.10.0` | **Must match majors.** npm's `latest` tag for the `prisma` CLI package currently points at `8.0.0-rc.13` while `@prisma/client@latest` correctly resolves to `7.10.0` — an unusual asymmetry. Installing both as bare `@latest` gives you a CLI one major ahead of the client it's generating for. Pin both explicitly to `7.10.0`. |
| `prisma@7.x` (`prisma-client` provider) | `@prisma/adapter-pg` + `pg` | Prisma 7's Rust-free client has no default engine/connection path; `new PrismaClient()` throws without an `adapter`. This changes the shared-singleton snippet in PROJECT.md's "Postgres" rule: still one client per process behind a `globalThis` guard, but constructed with `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`. |
| `@trigger.dev/build@4.5.16` `prismaExtension` | `prisma@6.16+` through `prisma@7.x` via `mode: "modern"` | This is another reason to stay on Prisma 7, not the 8.0.0-rc: the build extension's documented modern-mode support tops out at 7. In modern mode, `prisma generate` is a manual step you run yourself (build extension does not run it for you) — remember this in the scaffold/CI script. |
| `zod@4.6.2` | `openai@7.15.0` | Fixed at `openai@5.23.2`+ (vendored `zod-to-json-schema` previously depended on Zod v3-only `ZodFirstPartyTypeKind`). `zod` is an optional peer of `openai`, not bundled — must be installed explicitly, which you're already doing for form/DB validation. |
| `zod@4.6.2` | `@hookform/resolvers@5.9.1` | Zod v4 (and v4-mini) support shipped at resolver `5.1.0`; auto-detects schema version at runtime, no separate import path needed (`zodResolver` from `@hookform/resolvers/zod` works for both v3 and v4 schemas). |
| `zod@4.6.2` | `@langchain/langgraph@1.4.14` | Peer range is `^3.25.32 \|\| ^4.2.0` — 4.6.2 satisfies this. Also requires `@langchain/core@^1.1.48`; pin `@langchain/core@1.2.10`. |
| `zod@4.6.2` | `@copilotkit/react-core@1.71.0` | Peer range `>=3.25`, satisfied. |
| `react@19.3.0` | `next@16.3.4`, `shadcn@4.21.0`, `zustand@5.0.15`, `@copilotkit/react-core@1.71.0` | All current majors target React 19 as primary; no shims needed. |
| `@tailwindcss/postcss@4.3.3` | `postcss@8.5.28` | Must be installed together — v4 requires the dedicated PostCSS plugin package, not the old `tailwindcss` package used directly as a PostCSS plugin. |
| `neo4j` (Python driver) `6.3.0` | `neo4j:5-community` (server) | Driver majors are not required to match server majors; graphiti-core's own floor (`neo4j>=5.26.0`) is what actually matters here, and 6.3.0 clears it. |
| `graphiti-core@0.30.2` | Python `>=3.10,<4` | Matches the project's Python 3.10+ requirement already stated in PROJECT.md. |

## Sources

- npm registry (`registry.npmjs.org/<pkg>/latest` and `/<pkg>` for dist-tags) — direct queries, 2026-09-11, for all exact npm version numbers and peer-dependency ranges above. Primary source, highest confidence available.
- PyPI JSON API (`pypi.org/pypi/<pkg>/json`) — direct queries, 2026-09-11, for `graphiti-core`, `neo4j` (driver), `fastapi` versions and `requires_dist`/`requires_python`.
- `trigger.dev/docs/config/extensions/prismaExtension` — fetched 2026-09-11, exact `trigger.config.ts` shape for Prisma 7 "modern mode."
- GitHub: `oven-sh/bun#4663`, `slackapi/bolt-js#2118` (both closed/stale, filed against bun 1.0.0–1.1.8) — bun Socket Mode WebSocket parsing history.
- GitHub: `prisma/prisma#28665` — Prisma 7 driver-adapter-required error message and fix.
- Web search (aggregated, not single-sourced): Prisma 7/8-rc changelogs, Zod v4 breaking-changes surveys, `@hookform/resolvers` Zod v4 support announcement, Kilo Gateway structured-outputs docs, Trigger.dev Bun-runtime changelog. Treated as MEDIUM confidence pending the registry/official-doc cross-checks noted per claim above.

---
*Stack research for: AI Secretary hackathon build (Slack → LangGraph → Google Calendar)*
*Researched: 2026-09-11*
