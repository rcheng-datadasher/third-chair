# Project Research Summary

**Project:** AI Secretary
**Domain:** Approval-gated AI Slack scheduling agent (multi-process hackathon build: Bolt + Next.js + LangGraph + Trigger.dev + Prisma + Google Calendar)
**Researched:** 2026-09-11
**Confidence:** HIGH-MEDIUM

## Executive Summary

This is a solo, 4h15m hackathon build of a Slack agent that watches an allowlisted channel, silently classifies whether a message needs action, and — only after human approval on a Block Kit card — writes a Google Calendar event. Experts building this class of product (approval-gated agent over three long-lived processes: Bolt Socket Mode, Next.js dashboard, Trigger.dev worker, sharing one Postgres) succeed by fixing interfaces before implementation, never resuming a paused agent (re-derive state from the DB instead), and treating idempotency as a first-class design constraint at every write boundary (Slack, DB, Calendar) rather than an afterthought. The competitive landscape check is good news for the pitch: no surveyed competitor (Slack AI, Reclaim/Motion, Fireflies/Otter/Spinach, n8n/Zapier) does unprompted, calendar-aware, reasoned conflict resolution from ordinary chat — but two named competitors (Clockwise, Relay.app) have shut down since the source doc was written and the README must not cite them as live.

The recommended approach: build the trigger→card→button→`chat.update` round trip on hardcoded data first (before any LLM or Calendar code), fix all stub signatures on `main` in one serial scaffold phase, then run two genuinely independent tracks in parallel (Slack surface vs. Calendar integration; later, Extraction vs. Dashboard) that never touch the same files, bridging with a serial integration phase between waves. Stack is fixed (bun/Next.js/LangGraph JS/Prisma/Trigger.dev/googleapis) and well-supported at current versions, with one deliberate resolved conflict: bun is the package manager and script runner everywhere, but the Bolt process launches under `node --experimental-strip-types` (not bun's runtime) because bun's WebSocket layer has a documented, unresolved-but-unconfirmed history of dropping Slack Socket Mode frames — a 5-minute smoke test tonight settles it either way, with the one-line fallback ready either direction.

The dominant risk category isn't the stack, it's process discipline under time pressure: two Bolt processes sharing one Slack token across worktrees, `prisma db push` racing across tracks, hand-merged `bun.lock` conflicts, rehearsal runs polluting the demo calendar via the very dedupe/idempotency logic that's supposed to prevent double-booking, and Trigger.dev's dev CLI needing live internet even for "local" task execution. None of these are hard to prevent — each has a one-line mitigation — but every one of them is invisible until it bites, and several (confidence-score calibration, Kilo Gateway structured-output support per model, Google's calendar event-id charset) must be verified **tonight** because there is no time to debug them live tomorrow. PITFALLS.md's "Do Tonight" list and PROJECT.md's own pre-setup checklist should be treated as one merged pre-window checklist, not duplicated work.

## Key Findings

### Recommended Stack

The stack is fixed by the user (bun, Next.js 16, LangGraph JS, Prisma 7, Trigger.dev, googleapis, shadcn/Tailwind v4, Biome, Zod v4) and every package resolves cleanly at current versions with no breaking peer conflicts, with two named exceptions requiring explicit pins: `prisma@7.10.0` (npm's bare `latest` tag currently resolves to an unreleased `8.0.0-rc.13`) and exact, non-range versions for LangGraph/LangChain/Trigger.dev packages so a stray reinstall mid-build doesn't pull a breaking minor.

**Core technologies:**
- bun 1.4.2 — package manager/script runner everywhere (`bun install`, `bun add`, `bunx`), TS runtime for most processes — fixed by project decision, officially supported on WSL Ubuntu
- Next.js 16.3.4 + React 19.3.0 + Tailwind v4.3.3 (CSS-first, no config file) + shadcn CLI 4.21.0 — dashboard, current-stable and peer-compatible across the board
- @langchain/langgraph 1.4.14, compiled **with no checkpointer argument at all** — every invocation completes in one pass, nothing to resume, matches the "re-derive don't resume" approval design exactly
- Prisma 7.10.0 (pinned) + @prisma/adapter-pg — Prisma 7's engine-free client requires a driver adapter (`new PrismaClient({ adapter })`); `db push` for the whole window, never `migrate dev`
- @trigger.dev/sdk 4.5.16, Node runtime for task execution (not `runtime: "bun"` — OpenTelemetry/workspace-deploy gaps documented)
- googleapis 180.0.0 — `events.insert({conferenceDataVersion:1})` + `freebusy.query`, long-stable surface
- openai 7.15.0 SDK against Kilo Gateway's OpenAI-compatible endpoint + zod 4.6.2 — the plain SDK, not a LangChain chat-model wrapper, per the project's own `lib/ai/provider.ts` single-source-of-truth rule

**Resolved runtime conflict (Bolt under bun vs. Node):** STACK.md rates bun Socket Mode support MEDIUM confidence (two GitHub issues, both closed/stale, filed against bun 1.0–1.1.8, three-plus majors behind current 1.4.2 — plausibly fixed, not confirmed). PITFALLS.md independently recommends launching Bolt under Node as a documented, still-open risk. **Resolution for this build: install everything with bun; launch the Bolt process specifically with `node --experimental-strip-types src/bolt/index.ts` by default (Node ≥22.6 strips TS types natively, no `tsx` needed); do a 5-minute smoke test (post one message, confirm `app.message` fires) as the literal first task of the Slack-surface phase; only switch that one script to `bun run` if the smoke test passes cleanly.** This is a one-line, trivially reversible decision either direction — treat it as decided-until-disproven-by-the-smoke-test, not an open question for the roadmap.

**PROJECT.md correction flag for the roadmapper:** PROJECT.md's stack table currently states "The Bolt TS process runs directly under `bun` (no tsx)." Per the resolution above and both STACK.md and PITFALLS.md's independent analysis, this line should be corrected to reflect Node-by-default-with-a-tonight-smoke-test. Flag this for the user/roadmapper to update in PROJECT.md; do not silently contradict it in the roadmap without surfacing the correction.

**Trigger.dev CLI runtime (exact command):** Both STACK.md and PITFALLS.md agree the `trigger.dev` CLI process itself does not run under bun and must be invoked via Node — PITFALLS.md gives the exact command: `npx trigger.dev@latest dev` (or `node node_modules/.bin/trigger dev` if installed via `bun add -d trigger.dev`). This is separate from task *execution*, which stays on Trigger.dev's Node runtime per `trigger.config.ts` (no `runtime: "bun"` flag). A secondary, easy-to-miss trap: Trigger.dev's own bundling falls back to npm internally when it detects a bun lockfile, which can materialize a stray `package-lock.json` — gitignore it proactively and check `git status` after the first `trigger dev` run.

### Expected Features

The confidence gate and conflict-aware counter-proposal are both correctly scoped as P1/must-have — they're the entire product thesis, not optional polish. Table stakes fill in the "obviously a real product, not a toy" gaps a judge probes first.

**Must have (table stakes):**
- Approval card with visible Approve **and** Reject/dismiss buttons (Reject is a gap in PROJECT.md's Active list — cheap to add alongside Approve, same effort, should not be sequenced separately)
- Approve → `chat.update` in place to a confirmed state with event link + Meet link surfaced
- Idempotent approve (safe to click twice, safe on Slack's automatic retries) and an "already scheduled" no-op state
- Ignored-message / Decision log visible in the dashboard ("considered and ignored" is a demo asset, not just data hygiene)

**Should have (differentiators):**
- Confidence gate (`is_actionable` + `confidence`) sequenced first — this is the product's credibility mechanism; no surveyed competitor gates unprompted proposals on a confidence threshold
- Conflict-aware counter-proposal: two alternative slots with stated reasons — the headline demo moment, and nothing surveyed does calendar-aware reasoned alternatives from chat-detected intent

**Defer (v2+, explicitly out of Saturday's scope):**
- Autoreply (roadmap-only line in README, never built — breaks the entire approval-gate thesis if reintroduced under any name, including S2 nudges)
- Recurring events, multi-timezone handling, account-linking UI, public OAuth distribution
- Batch sweep / scheduled detection (document as the production design; per-message detection is what's built)

**README correction required (date-reconciled):** The source doc names six competitors; two need edits before judging. Clockwise shut down 27 Mar 2026 — cite it only past-tense ("Reclaim and Motion" as the live pair, Clockwise footnoted as folded in). Relay.app wound down starting 16 Jul 2026, free accounts deleted 15 Aug 2026, and **paying customers lost access 14 Sep 2026 — two days after this hackathon (12 Sep 2026), not "the day before" as the source doc states.** The corrected framing: Relay.app is already effectively dead by demo day (free tier gone a month prior, paid access lapsing within 48 hours) — do not present it as a going concern; lead the generic-HITL comparison with n8n and Zapier instead. The core differentiation claim ("nothing surveyed watches ordinary conversation and decides, unprompted") is unweakened by either correction — if anything it's stronger, since a judge who knows the space is more likely to check exactly these currently-dead names.

### Architecture Approach

Three long-lived processes (Bolt/Socket Mode, Next.js, `trigger.dev dev`) share one `bun.lock`/one repo — not a monorepo/workspaces split, which would be pure overhead for a 4h build. The critical architectural discipline is fixing stub signatures (types, `lib/config.ts`, `lib/agent/graph.ts`'s `runAgent()`, `lib/slack/postProposalCard.ts`, etc.) on `main` in the scaffold phase with hardcoded bodies, so two parallel tracks build against a proven interface rather than a negotiated one — and so the scaffold's own exit criterion is proving the full hardcoded round trip (`dispatchAgentRun` → stub task → hardcoded card → button → `chat.update`) once, centrally, before either Wave A track starts.

**Major components:**
1. **Bolt process (Node)** — holds the Socket Mode WebSocket, receives allowlisted-channel messages/shortcuts/slash commands/`block_actions`, acks within 3 seconds, hands off slow work via `tasks.trigger()`. This is also the *only* process that ever receives `block_actions` — Trigger.dev has no path back into it, which is why approval must re-derive from the DB rather than resume a paused graph.
2. **Trigger.dev task (thin wrapper around `lib/agent/graph.ts`)** — all real logic lives in `lib/agent/`, not the task file, so an `AGENT_TRANSPORT=trigger|inline` env-flag fallback (calling `runAgent()` directly from Bolt, bypassing Trigger.dev entirely) costs one `if`, not a parallel implementation — recommended as a proven escape hatch wired during the bridge phase, given Trigger.dev's dev CLI keeps a live dependency on its hosted control plane even for "local" execution.
3. **LangGraph (5 nodes, no checkpointer)** — extract → classify (writes `Decision` on non-actionable, before the conditional edge) → resolveTime → checkConflicts → propose (writes `Proposal`/`Participant`/`ActionItem`, posts the card). Confirmed fallback: because there's no checkpointer, ripping the graph out for plain sequential function calls is a genuine ten-minute change if LangGraph is fighting the time budget at the fixed decision point.
4. **Next.js dashboard** — Server Component first paint reading Prisma directly (no route-handler layer needed for that), thin route handlers + TanStack Query with a 3-5s poll for live updates during the demo; read-only on the critical path (approval happens via the Slack card, not a dashboard button).
5. **Postgres (shared)** — one `PrismaClient` singleton per process, `db push` only, serialized through `develop` across tracks.

### Critical Pitfalls

1. **Two Bolt processes on one Slack app token across worktrees silently steal each other's events** (Socket Mode load-balances up to 10 connections with no defined routing) — enforce "only one Bolt process running at any time, across all worktrees" as a literal habit, not just a written rule; kill before starting a new one.
2. **Bolt Socket Mode under bun risks silent WebSocket JSON-parse errors and a reconnect loop** — resolved above: Node by default, smoke-tested tonight, one-line reversible.
3. **Repo under `/mnt/c` breaks file-watch silently** (WSL2 inotify doesn't propagate reliably across the DrvFs mount) — move the repo to the native Linux filesystem (`~/...`) tonight, before any real feature code; this is the one pitfall that must be right on the very first commit since moving mid-build costs a re-clone across every open worktree.
4. **Deterministic `dedupe_key` + idempotent Calendar writes make a second rehearsal a silent no-op, and rehearsal runs pollute the target calendar slot the live demo's conflict moment depends on** — write a `scripts/reset-demo.ts` (truncate demo rows + delete calendar events tagged `extendedProperties.private.demo=true`) as an explicit seed-and-rehearse deliverable, not an afterthought.
5. **Confidence scores cluster uncalibrated (~0.85-0.95 for everything plausible)** unless the extraction prompt carries an explicit rubric tying score bands to concrete signals (explicit time+participant vs. implied vs. banter) — must be smoke-tested tonight with 4-5 representative messages, since there's no time to iterate on prompt wording live; if scores are still bunched in the window, narrow the demo script to only pre-verified messages rather than trusting the model live.

## Implications for Roadmap

Based on research, the user's own suggested shape in PROJECT.md is architecturally correct and should be the roadmap's spine, with one refinement ARCHITECTURE.md makes explicit: split scaffold's tail into a dedicated harness step so the hardcoded round trip is proven once, centrally, before Wave A starts.

### Phase 1: Scaffold + CLAUDE.md/README + Schema (serial, `main`)
**Rationale:** Every later phase and parallel worktree depends on the folder structure, typed config, stub signatures, and docker-compose being fixed first; getting this wrong is expensive to unwind mid-build (PITFALLS.md's repo-location and Prisma-generator-output pitfalls are both "get it right once, here").
**Delivers:** Repo init on native WSL filesystem; Next.js + shadcn + Biome configured; `prisma/schema.prisma` + `db push`; `docker-compose.yml` (postgres default, neo4j/graph-service behind `graph` profile); `lib/config.ts` with every env key (including unused S1 keys); every stub signature from ARCHITECTURE.md's interface table with hardcoded bodies; `CLAUDE.md` and README skeleton. Ends with the hardcoded trigger→card→button→`chat.update` round trip working end to end — this is scaffold's own exit criterion, not deferred to the Slack track.
**Addresses:** Build-order requirement (hardcoded round trip before any LLM/Calendar code); folder-structure and single-source-of-truth repo rules.
**Avoids:** Pitfall 2 (repo on `/mnt/c`), Pitfall 6 (Prisma generate hangs under bun), Prisma generator-output-path mismatch, shadcn v3-style scaffold on v4, Biome Tailwind-v4 at-rule warnings, Docker/WSL memory pressure — all scaffold-phase pitfalls per PITFALLS.md's mapping table.

### Phase 2 (Wave A, cap 2, parallel): Slack Surface ∥ Calendar Integration
**Rationale:** Zero file overlap (`lib/slack/**`+`bolt.ts` vs. `lib/calendar/**`); both only consume the schema/types scaffold fixed, so they can build fully independently against hand-seeded data.
**Delivers:** Real Block Kit listeners/actions (still calling the stub `runAgent`) with the Node-launch smoke test done as literally its first task; real `freebusy.query`/`events.insert` (Meet link + deterministic base32hex event id + 409 fallback) against hand-seeded `Proposal` rows.
**Uses:** @slack/bolt 5.1.0 (Node runtime), googleapis 180.0.0.
**Implements:** Bolt process component; Calendar component (freebusy + createEvent stubs from ARCHITECTURE.md's table).
**Avoids:** Pitfall 5 (bun WebSocket parse errors), Pitfall 10 (3-second ack violated), Pitfall 8/9 (missing Meet link, invalid event-id charset), the bot-reprocesses-own-messages moderate pitfall, `users:read.email` scope verification.

### Phase 3: Bridge (serial, `main`)
**Rationale:** Wires the real `approve.ts` handler using both Wave A tracks' real code — this is the natural integration point, and the moment to validate the `AGENT_TRANSPORT=inline` fallback while Trigger.dev's actual venue-wifi behavior is fresh information.
**Delivers:** Conditional-claim organizer UPDATE, real Calendar write on approve, `chat.update` to confirmed state; `AGENT_TRANSPORT` escape hatch wired and tested once.
**Avoids:** `block_actions`-has-no-in-memory-link pitfall (proposalId must be embedded in block value/private_metadata); `chat.update` wrong-channel/ts pitfall (persist `channel`+`ts` on the Proposal row at post time, not recovered from the click payload).

### Phase 4 (Wave B, cap 2, parallel): Extraction ∥ Dashboard
**Rationale:** Zero file overlap (`lib/agent/**`+`lib/ai/**` vs. `app/**`+`components/**`); Dashboard can build against hand-seeded Proposal/Decision rows without waiting on real extraction.
**Delivers:** Real LangGraph graph (5 nodes, no checkpointer) replacing the stub `runAgent`, with the confidence-gate rubric already smoke-tested tonight baked into the prompt; dashboard action-item queue + Decision log in the retro theme, Server-Component first paint + TanStack Query polling.
**Uses:** @langchain/langgraph 1.4.14, openai SDK against Kilo Gateway, zod 4.6.2; @tanstack/react-query, zustand.
**Implements:** LangGraph component; Dashboard component.
**Avoids:** Pitfall 11 (uncalibrated confidence scores — rubric must exist before this phase, not discovered during it), Pitfall 12 (Kilo Gateway structured-output support gaps — model ids already smoke-tested tonight), "next Friday" resolved wrong (pass current date/day-of-week/tz explicitly, resolve deterministically in code), LangGraph reducer-overwrite-by-default surprise on array/object state fields, Pitfall 14 (bun-forced Next.js dev server thrashing — no `--bun` flag on the dev script).

### Phase 5: Integrate (serial)
**Rationale:** Swap the stub `runAgent` for the real graph inside the Trigger.dev task; confirm the dashboard shows real extracted rows end to end. This is the first point both AI features and the full data path are live together.
**Delivers:** End-to-end demo path minus conflict counter-proposal (confidence gate → card/modal/silent → approve → real calendar write → dashboard reflects it).
**Addresses:** The full "must work on stage" demo path requirement except the conflict headline moment.

### Phase 6 (Wave C, cap 2, parallel): Conflict Reasoning ∥ `/secretary scan`
**Rationale:** Conflict reasoning extends existing nodes/blocks (minor additive overlap on `AgentState`/`ExtractedIntent`, resolved by keeping additions additive); `/secretary scan` is isolated to one new listener file exercising the already-built `extractIntents(messages[])` array signature — genuinely optional, build only if core is done.
**Delivers:** Two-slot alternative-slot rendering with stated reasons (the headline demo moment); optional `/secretary scan` over ~50 messages.
**Addresses:** Conflict-aware counter-proposal (P1, headline differentiator); `/secretary scan` (P2, optional).
**Avoids:** `freebusy.query` timezone mishandling (explicit `+08:00` offsets, never naive UTC) — this is the pitfall most likely to make the headline conflict moment silently fail to detect the conflict at all.

### Phase 7: Integrate + Cut-Line Check (serial)
**Rationale:** Final wiring; this is where PROJECT.md's fixed 14:15 cut-line decision applies — if conflict work hasn't started by then, degrade to a static conflict warning and lean the demo on the confidence gate instead.
**Delivers:** Fully integrated demo path, with the cut-line decision explicitly checked and acted on, not silently missed.

### Phase 8 (optional, off critical path): Stretch — S1 and/or S2
**Rationale:** Both are designed to be fully separable (S1 in a separate repo/process; S2 reuses the existing approval-card action path) so their absence changes nothing else. Start/no-start decided after core is built and rehearsed.
**Delivers:** S1 (Graphiti/Neo4j preference memory, viewable graph, before/after demo) and/or S2 (CopilotKit commitment ledger) if time remains, each with its own hard abandon criterion.

### Phase 9: Seed-and-Rehearse (serial, `main` only, no new branches)
**Rationale:** Must exist as its own phase, not squeezed into freeze, because rehearsal itself is destructive against the idempotent design (Pitfall 4) unless a reset script exists first.
**Delivers:** Seeded demo conversation, flow run three times, `scripts/reset-demo.ts` (DB truncation + tagged-calendar-event cleanup) as an explicit deliverable.
**Avoids:** Pitfall 4 (dedupe/calendar pollution silently breaking the second rehearsal).

### Phase 10: Freeze-and-Record (serial, no new code)
**Rationale:** No new code; this phase's entire output is the insurance policy against Pitfall 3 (venue wifi killing Trigger.dev's live dependency mid-demo) and against any other live failure.
**Delivers:** One clean screen-recorded run treated as a true fallback video (ready to play, not just "nice to have"); finalized README (with the two competitive-landscape corrections from FEATURES.md applied).

### Phase Ordering Rationale

- **Interfaces-before-implementation is the load-bearing decision**: every wave's independence depends on scaffold fixing stub signatures with hardcoded bodies first, proven via one centrally-run hardcoded round trip — this is why scaffold is serial and comes before any wave, not just "phase 1 because it's setup."
- **Confidence gate must land before conflict reasoning is demoable** — it gates which intents even reach the expensive conflict-check call, and it's the cheaper of the two AI differentiators (~20 min vs ~45 min), which is why extraction (wave B) precedes conflict reasoning (wave C) rather than being parallel with it.
- **Schema/type changes are the one named cross-track overlap point** — resolved procedurally (merge `develop` before every push) rather than architecturally, so every phase touching `prisma/schema.prisma` or shared `types/` files must explicitly restate this rule at its kickoff, not just rely on it being written once in CLAUDE.md.
- **The 14:15 cut-line and the tonight-only setup items are the two hard temporal constraints the roadmap must encode explicitly** — the cut-line as an explicit check inside Phase 7, and the pre-window checklist as work that happens before Phase 1, never as a phase itself (no phase may be "install/configure X").

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 6 (Conflict Reasoning):** the two-alternative-slot prompt design and `freebusy.query`+pending-Proposal union logic are novel enough (no surveyed competitor does this) that the exact prompt structure and slot-scoring heuristic may need a short focused research/design pass during planning, not just implementation.
- **Phase 8 (S1, if attempted):** Graphiti/Neo4j is the least-trodden part of the stack (pre-1.0 library, FalkorDB fallback has documented defects) — if S1 is greenlit after core is rehearsed, a fast research pass on Graphiti's episode-ingestion API shape is warranted before writing real logic, per PITFALLS/STACK's own hedging language.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Scaffold):** every sub-decision (Next.js+shadcn+Tailwind v4 setup, Prisma+driver-adapter, docker-compose profiles) is fully pinned with exact versions and install commands in STACK.md already — no further research needed, just execution against the pitfalls checklist.
- **Phase 2 (Slack ∥ Calendar):** Block Kit patterns (button payloads, `chat.update` state transitions, modal `trigger_id`/`private_metadata`) and Calendar gotchas (Meet link params, event-id charset) are fully documented with exact code shapes in FEATURES.md and PITFALLS.md.
- **Phase 4 (Extraction ∥ Dashboard):** LangGraph's minimal-graph pattern and the dashboard's Server-Component-first-paint + TanStack-Query-poll pattern are both confirmed HIGH confidence with exact code shapes in ARCHITECTURE.md.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH for exact versions (verified directly against npm/PyPI registries 2026-09-11); MEDIUM for the bun-Bolt runtime question specifically (historical bug, not independently reproduced this week — mitigated by a mandatory tonight/first-task smoke test either way) |
| Features | MEDIUM-HIGH (competitive landscape independently verified against Sep 2026 sources, two corrections applied above; Block Kit UX patterns HIGH — official Slack docs) |
| Architecture | HIGH (LangGraph checkpointer-optional compile, Trigger.dev trigger/idempotency API, Slack Bolt/web-api relationship all verified against current docs/source); MEDIUM only on Trigger.dev's exact venue-wifi latency under bad conditions (architecture confirmed, no first-party latency number found) |
| Pitfalls | HIGH for Slack/Google/Trigger.dev/Biome facts and the documented bun compatibility issues (verified against current docs/issue trackers); MEDIUM for Kilo Gateway per-model structured-output behavior and confidence-score calibration (empirical, model-dependent, not centrally documented — this is exactly why both are on the tonight smoke-test list) |

**Overall confidence:** HIGH — the stack, architecture, and pitfall set are unusually well-verified for a hackathon build (direct registry queries, official docs, reproducible GitHub issues). The remaining uncertainty is concentrated in a small, already-identified set of empirical unknowns (bun+Bolt WebSocket behavior at current version, Kilo Gateway model-specific structured-output support, LLM confidence-score calibration) that all have the same mitigation: a cheap, already-specified smoke test done tonight, before the window opens.

### Gaps to Address

- **Bun-Bolt runtime decision is provisional pending tonight's smoke test** — roadmap should encode "smoke test, then decide" as the literal first task of the Slack-surface phase, not assume the Node-by-default recommendation is final before it's actually run.
- **PROJECT.md's stack table currently contradicts the resolved runtime decision** ("Bolt runs under bun") — flag explicitly for the user to correct PROJECT.md alongside or before roadmap creation, so downstream phase plans don't inherit the stale line.
- **Kilo Gateway model ids for `MODEL_FAST`/`MODEL_SMART` are not yet chosen-and-verified for structured-output support** in this research pass — PROJECT.md says model ids are already chosen; the verification call (one real structured-output request per model, Zod-parsed) is a tonight action item, not a roadmap phase, per the "no phase spent on setup/tooling" rule — but its *failure* would change which models the Extraction phase can assume, so the roadmapper should note this as a pre-flight dependency of Phase 4, not silently assume it's resolved.
- **Confidence-rubric wording is not yet drafted** — PITFALLS.md gives the rubric shape (explicit score bands tied to concrete signals) but not the final prompt text; this is appropriately a tonight action item feeding into Phase 4's extraction prompt, not a roadmap phase itself.
- **README competitive-landscape edits (Clockwise, Relay.app date correction) are not yet applied to any file** — should land in the Phase 1 README skeleton and be finalized in Phase 10 (freeze), per FEATURES.md's and this document's reconciled dates.

## Sources

### Primary (HIGH confidence)
- npm registry direct queries (registry.npmjs.org) — all exact package versions and peer-dependency ranges, 2026-09-11
- PyPI JSON API direct queries — graphiti-core, neo4j driver, fastapi versions, 2026-09-11
- Slack Developer Docs — Socket Mode connection behavior, interactive messages, modals, `views.open`, Block Kit reference
- Google Calendar API reference (`events.insert`, custom event id base32hex rule)
- Trigger.dev official docs — idempotency, how-it-works/local-development, prismaExtension, Bun guide

### Secondary (MEDIUM confidence)
- GitHub issues: `oven-sh/bun#4663`, `slackapi/bolt-js#2118` (bun Socket Mode WebSocket parsing, closed/stale, filed against bun 1.0.0-1.1.8), `oven-sh/bun#4828` and `prisma/prisma#24678`/`#25730` (Prisma+bun generate hangs), `vercel/next.js#89530` (Turbopack+bun Fast Refresh), `biomejs/biome#7223`/`#7899` (Tailwind v4 at-rule warnings), `triggerdotdev/trigger.dev#1191`/`#1480` (npm fallback, prismaExtension version detection)
- Competitive landscape: Reclaim.ai blog (Clockwise shutdown date), tooldirectory.ai / Automation Atlas (Relay.app wind-down timeline, cross-checked across two sources), get-alfred.ai / Vellum.ai (Motion does not scan Slack), Spinach.ai blog (owner-tagged routing), n8n docs + triggerworkflow.com (Slack HITL node)
- DeepWiki (LangGraph StateGraph/checkpointer internals) — cross-checked against official API reference

### Tertiary (LOW-MEDIUM confidence, flagged for tonight verification)
- Kilo Gateway per-model structured-output support — provider-dependent, changes over time, not centrally documented; mitigated by a required tonight smoke-test call per chosen model id
- LLM confidence-score calibration behavior — empirical and model-dependent; mitigated by a required tonight smoke-test with 4-5 representative sample messages
- WSL2 `/mnt/c` inotify limitations and Google OAuth Testing-mode 7-day refresh-token expiry — well-established platform behavior, not re-verified against one canonical doc this pass but consistent across independent long-standing reports

---
*Research completed: 2026-09-11*
*Ready for roadmap: yes*
