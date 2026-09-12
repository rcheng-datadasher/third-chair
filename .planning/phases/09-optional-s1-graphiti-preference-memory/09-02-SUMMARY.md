---
phase: 09-optional-s1-graphiti-preference-memory
plan: 02
subsystem: agent
tags: [graphiti, neo4j, fastapi, fetch, zod, before-after-demo]

requires:
  - phase: 09-optional-s1-graphiti-preference-memory
    provides: "09-01's live graph-service at http://localhost:8000, proven POST/GET round trip, group_id=tracer"
provides:
  - "fetchGraphPreferences(userId) — fails-closed HTTP read of the graph service's GET /preferences, additive in lib/agent/**"
  - "graph/queries.cypher — paste-ready Neo4j Browser demo queries, including the before/after query run identically before and after ingestion"
  - "One additive call site in lib/agent/graph.ts's proposeNode where a learned default_meeting_duration overrides the platform default"
  - "Observed and recorded before/after proof of STR-03: same scheduling text, 30-minute proposal before ingestion, 45-minute proposal after"
affects: [11-freeze-and-record]

actuals:
  tokens: 1548
  tasks: 3
  commits: 1
  plan_head_before: e4f0bf4

tech-stack:
  added: []
  patterns:
    - "Additive optional-preference seam: fetchGraphPreferences merged into an existing ?? chain (stated duration -> learned graph default -> platform default), never restructuring the function it's called from"
    - "Direct agent-pipeline invocation (runAgent) used as the demo driver in place of Bolt, since starting a second Bolt process is forbidden for this session — exercises the identical duration-resolution code path a real Slack message would"

key-files:
  created:
    - "graph/queries.cypher"
    - "lib/agent/graph-preferences.ts"
  modified:
    - "lib/agent/graph.ts (proposeNode: one additive await + narrow + one changed `??` expression)"

key-decisions:
  - "Call-site grep resolved to lib/agent/graph.ts's proposeNode, exactly the 'expected' path named in the plan (Phase 5's propose step, LangGraph was not ripped out by Phase 7 in this repo state) — no ambiguity, only one site matched."
  - "Task 3 (no_meeting_days stretch) skipped: grep for `preferences`/`proposeAlternatives`/`MODEL_SMART` in lib/agent/ and lib/ai/ found nothing, and no .planning/phases/07-integrate-conflict-counter-proposal/*-SUMMARY.md exists — Phase 7's counter-proposal call was never built in this repo/branch state, so there is no known-preferences argument to populate. Recorded per the plan's own instruction, not a deviation."
  - "D-01/D-03 time and abandon-clock gates waived per explicit user override (same override already recorded in 09-01's SUMMARY) — the system clock read ~14:10-14:33 HKT across this plan's execution, straddling and then passing the plan's own 14:10 (Task 1) and 14:25 (Task 3) gate lines and the phase's 14:40 demo-ready deadline. Waived, not silently ignored: recorded here for the Phase 11 README exactly as 09-01 did for its own gate waiver."
  - "Demo driven by directly invoking `runAgent` with a synthetic SlackMessage (not through Bolt/Slack) — the environment forbids starting a second Bolt process this session (Socket Mode event-stealing risk) and no interactive human was available to type into Slack live. This exercises the exact same `proposeNode` code path (including the new `fetchGraphPreferences` call) a real Slack message would, and posts a real proposal card to the actual watched Slack channel via the existing `postProposalCard`/`postEditApproveCard` functions — only the message-ingestion hop (Bolt) was bypassed, not the pipeline itself."
  - "Before/after Neo4j Browser check run via `docker exec ... cypher-shell` against the shared `third-chair-neo4j-1` container instead of an interactive Browser session, mirroring 09-01's own precedent (no GUI browser reachable in this execution environment). `http://localhost:7474` remains available for a human to repeat the identical query visually with `NEO4J_USER`/`NEO4J_PASSWORD` — this is called out explicitly in Next Phase Readiness below as the recommended human-verify step."
  - "graph/queries.cypher's demo query is 3a (node-only), per 09-01's finding that only `Episodic` nodes appear (no `Entity` nodes) — confirmed again in this plan's own before/after run (0 rows before, 1 Episodic row after)."

patterns-established:
  - "Any future optional-preference source follows the same shape: config-gated, 2s AbortSignal.timeout, safeParse against a closed-vocabulary Zod schema, single catch-all returning null, merged into an existing value via `??` rather than replacing it."

requirements-completed: [STR-03]

coverage:
  - id: D1
    description: "fetchGraphPreferences(userId) fails closed on every failure mode: unset service URL, non-ok response, failed Zod validation, and any thrown error (network/DNS/timeout/malformed JSON)"
    requirement: STR-03
    verification:
      - kind: unit
        ref: "bunx biome check lib/agent/graph-preferences.ts && bunx tsc --noEmit -> passes (only a pre-existing, unrelated app/layout.tsx error remains)"
        status: pass
      - kind: integration
        ref: "GRAPH_SERVICE_URL=http://192.0.2.1:8000 (TEST-NET-1, unroutable) timeout 6 bun -e '...fetchGraphPreferences(\"timeout-probe\")...' -> prints `null` in 2.19s, well under the 2s abort budget plus process overhead and the 5s kill window"
        status: pass
    human_judgment: false
  - id: D2
    description: "The same scheduling text, posted as two separate messages, produces a 30-minute proposal before ingestion and a 45-minute proposal after — STR-03's literal exit criterion"
    requirement: STR-03
    verification:
      - kind: integration
        ref: "docker exec third-chair-postgres-1 psql -U postgres -d secretary -c 'SELECT id, round(extract(epoch from (\"end\"-start))/60) AS mins, source_ts FROM \"Proposal\" ORDER BY source_ts DESC LIMIT 2;' -> 45 (source_ts 1789194595.605000), 30 (source_ts 1789194537.365000) — two distinct rows, two distinct source_ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The same Neo4j query (3a, node-only per-user filter) returns zero rows for demo user A's partition before ingestion and at least one row (a new Episodic node) after — D-15's before/after graph proof"
    requirement: STR-03
    verification:
      - kind: manual_procedural
        ref: "docker exec third-chair-neo4j-1 cypher-shell -u neo4j -p **** \"MATCH (n {group_id: 'U0C0LJ5JDU4'}) RETURN labels(n), count(n);\" -> before: 0 rows; after: [\"Episodic\"], 1"
        status: pass
    human_judgment: true
    rationale: "Proven deterministically via cypher-shell inside the shared Neo4j container (no GUI browser reachable in this execution environment, same limitation 09-01 recorded), but D-15 asks for a human to see this in Neo4j Browser at :7474 — recommended as the actual demo/UAT step, see Next Phase Readiness."
  - id: D4
    description: "With the graph service stopped, a third posting of the same scheduling text still produces a proposal at the platform default (30 min), with no error and no unbounded delay — D-16's fails-closed contract end to end"
    requirement: STR-03
    verification:
      - kind: integration
        ref: "docker compose --profile graph stop graph-service; runAgent(...) -> proposal duration 30min, whole run (LLM extraction + failed fetchGraphPreferences + DB write) completed in 4108ms"
        status: pass
    human_judgment: false
  - id: D5
    description: "Task 3 stretch (no_meeting_days populating Phase 7's known-preferences argument) — deliberately skipped, not built"
    verification: []
    human_judgment: true
    rationale: "Grep for preferences/proposeAlternatives/MODEL_SMART in lib/agent/ and lib/ai/ found no matches, and no Phase 7 SUMMARY exists in this repo state — Phase 7's counter-proposal call was never built, so there is no existing argument to populate. A human should confirm this reasoning still holds if Phase 7 lands later before assuming Task 3 is permanently out of scope."

duration: 22min
completed: 2026-09-12
status: complete
---

# Phase 9 Plan 02: Before/after proposal change + demo queries Summary

**The same "let's talk next Friday at 11am" message proposes 30 minutes before one Graphiti fact is ingested and 45 minutes after, via a new additive `fetchGraphPreferences` seam in `lib/agent/graph.ts`, with the identical Neo4j Cypher query showing the partition go from 0 rows to 1 `Episodic` node.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-09-12T06:11Z (~14:11 HKT)
- **Completed:** 2026-09-12T06:33Z (~14:33 HKT)
- **Tasks:** 2 executed, 1 deliberately skipped (Task 3, stretch)
- **Files modified:** 3 (2 new, 1 modified)

## Gate Waiver (D-01/D-03, user override — carried forward from 09-01)

Per the same explicit user override already recorded in `09-01-SUMMARY.md`, D-01's start/deadline gate and D-03's abandon clock were waived for this plan too. The system clock crossed 14:10 (Task 1's precondition line), 14:25 (Task 3's precondition line) and the phase's 14:40 demo-ready deadline during this plan's execution — none of these blocked the work, per the explicit override in this dispatch's `<user_overrides>`. Recorded here, not silently ignored, per D-01/D-04's own framing.

## Accomplishments

- `graph/queries.cypher` (new): 7 paste-ready Neo4j Browser queries (labels/relationship types, whole-graph render, before/after query 3a, richer 3b, schema visualization, deterministic `Episodic.content` read-back, per-user destructive reset), with a placeholder `:param user_id` line — never a real Slack id.
- `lib/agent/graph-preferences.ts` (new): `fetchGraphPreferences(userId)` — the only export, fails closed on unset config, non-ok response, failed Zod validation, and any thrown error, via `AbortSignal.timeout(2000)` and a single catch-all.
- `lib/agent/graph.ts`, `proposeNode` (one additive call site): the duration expression is now `validated.duration_minutes ?? graphDefaultDuration ?? DEFAULT_DURATION_MINUTES` — an explicitly stated duration still wins; the learned graph value only replaces the platform default.
- **STR-03 demonstrated live, end to end:**
  - Before ingestion: `GET /preferences?user_id=U0C0LJ5JDU4` → `{}`; Neo4j query 3a → 0 rows; synthetic "let's talk next Friday at 11am" message → **30-minute** proposal (`Proposal.id=cmty08fci...`, `source_ts=1789194537.365000`).
  - Ingested one fact: `POST /episodes {"user_id":"U0C0LJ5JDU4","key":"default_meeting_duration","value":45}` → `{"status":"ok"}`.
  - After ingestion: `GET /preferences` → `{"default_meeting_duration":45}`; Neo4j query 3a → 1 row, labeled `Episodic` (no `Entity`, consistent with 09-01's finding); same message text posted as a **new** Slack message (new `ts`) → **45-minute** proposal (`Proposal.id=cmty09o8k...`, `source_ts=1789194595.605000`).
  - **Fails-closed run performed:** stopped `graph-service`, posted the same text a third time (new `ts`) → proposal reverted to **30 minutes**, no error, whole run (LLM call + failed `fetchGraphPreferences` + DB write) completed in **4108ms**. Restarted the service afterward; `GET /preferences` still returned the ingested fact (Neo4j volume persisted it).

## Task Commits

1. **Task 1: graph/queries.cypher, fetchGraphPreferences, additive duration call site** - `048f7fb` (feat)
2. **Task 2: run the before/after demo** - no commit (task changes no file by design; the observation above is the deliverable). `git status --porcelain` was empty both before and after this task, confirming no repo file changed.
3. **Task 3: no_meeting_days stretch** - skipped, no commit. See Deviations.

**Plan metadata:** this SUMMARY's own commit (see final commit in this repo).

## Files Created/Modified

- `graph/queries.cypher` - 7 paste-ready Neo4j Browser demo queries, before/after query 3a marked explicitly
- `lib/agent/graph-preferences.ts` - `fetchGraphPreferences(userId)`, the fails-closed HTTP read
- `lib/agent/graph.ts` - `proposeNode`'s duration resolution: one additive `fetchGraphPreferences` call, one narrowing line, one changed `??` expression

## Decisions Made

See `key-decisions` in frontmatter for full detail. Summary:
- Call-site grep resolved unambiguously to `lib/agent/graph.ts`'s `proposeNode` — the exact "expected" path.
- Task 3 skipped because Phase 7's counter-proposal call does not exist yet in this repo (no SUMMARY, no `MODEL_SMART`/`proposeAlternatives`/`preferences`-argument code anywhere in `lib/agent/` or `lib/ai/`).
- Demo driven by direct `runAgent` invocation (a synthetic `SlackMessage`) rather than a live Slack post, because starting a second Bolt process is forbidden this session and no interactive human was available to post live — this still posts a real proposal card to the real watched channel and exercises the identical code path.
- Neo4j before/after check run via `cypher-shell` inside the container rather than an interactive Browser session (no GUI reachable here), matching 09-01's own precedent.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing-critical-functionality, or blocking issues were found in the code written for this plan. `fetchGraphPreferences` and the `proposeNode` edit both worked on the first attempt against the live service.

### Recorded Deviations (not auto-fixes, but worth flagging)

**1. [Scope-boundary, cosmetic] The call-site diff is larger than the plan's literal "at most four added lines and one changed line"**
- **Found during:** Task 1, step 3 (the additive call site)
- **Issue:** The plan's action text describes "two added lines and one changed expression" and its acceptance criteria say "`git diff -U0` on that file shows at most four added lines and one changed line." The actual diff (after `bunx biome check --write`, mandatory per CLAUDE.md) is 1 import line + 6 lines for the `fetchGraphPreferences` call/narrow (including a blank line) + a 3-line wrapped `??` expression replacing what was a 1-line expression — Biome's 80-column wrap turns the single narrowing ternary and the three-way `??` chain into multi-line statements.
- **Why not fixed further:** Shortening variable names or collapsing the ternary to fit under 80 columns would trade readability and the plan's own literal instruction ("one narrowing line reading `default_meeting_duration`... keeping it only when `typeof` says it is a number") for a smaller diff count — not worth it. The functional/architectural intent behind the acceptance criterion — additive only, no restructuring, one call site, no Phase 5/7 signature change — is fully met and independently verified (`git diff e4f0bf4 HEAD` touches exactly the three expected files; the edited function's signature is unchanged).
- **Files affected:** `lib/agent/graph.ts`
- **Verification:** `git diff -U0 lib/agent/graph.ts` reviewed by hand; no Phase 5/7 function renamed or resignatured; `bunx tsc --noEmit` and `bunx biome check` both clean on this file.
- **Committed in:** `048f7fb`

**2. [Scope-boundary, documented not fixed] Phase-level `bunx biome check lib/agent/` reports 3 pre-existing errors in untouched files**
- **Found during:** final plan-level verification pass
- **Issue:** `bunx biome check lib/agent/` (the plan's own `<verification>` line) exits non-zero, but the 3 reported errors are all CRLF-vs-LF formatting diffs in `lib/agent/dedupe.ts`, `lib/agent/dispatch.ts` and `lib/agent/extract-intents.ts` — none of which this plan touches. `bunx biome check` scoped to only the two files this plan actually edits/creates (`graph-preferences.ts`, `graph.ts`) passes cleanly with zero issues, matching Task 1's own `<verify>` line exactly.
- **Why not fixed:** Scope boundary — these are pre-existing checkout/line-ending artifacts unrelated to this plan's changes (Windows `core.autocrlf` interaction), not introduced by Task 1/2/3. Fixing them would touch files this phase's D-19 explicitly forbids touching.
- **Files affected:** none (no fix applied)
- **Verification:** `bunx biome check lib/agent/graph-preferences.ts lib/agent/graph.ts` → clean, 0 issues.

**3. [Scope-boundary, documented not fixed] Full-repo `bun run check` and the plan's `git diff --name-only main` check both report far more than this plan's files**
- **Found during:** final plan-level verification pass
- **Issue:** `bun run check` (== `biome check --write .`) reports 42 pre-existing errors across the whole repo (mostly the same CRLF issue, in files as unrelated as `tsconfig.json` and `next.config.ts`), and `git diff --name-only main` lists ~35 files — because this branch (`gsd/phase-9-s1-graphiti`) already has several other phases' work merged into it ahead of `main` (Phases 02/04/10/11 SUMMARYs and code are already on this branch's history), not because this plan touched them.
- **Why not fixed:** Running `bun run check` with `--write` across the whole repo was deliberately NOT done — it would reformat 40+ unrelated files, a direct D-19 scope violation for the most isolated phase in the roadmap. The correct, precise measure of this plan's footprint is `git diff --name-only e4f0bf4 HEAD` (09-01's own recorded HEAD, i.e. this plan's actual starting point) — that returns exactly `graph/queries.cypher`, `lib/agent/graph-preferences.ts`, `lib/agent/graph.ts`, matching D-18/D-19 precisely.
- **Files affected:** none (no fix applied, none needed)
- **Verification:** `git diff --name-only e4f0bf4 HEAD` → exactly the three expected paths.

---

**Total deviations:** 0 auto-fixed. 3 recorded/documented (1 cosmetic diff-size note, 2 scope-boundary clarifications about pre-existing, unrelated issues surfaced by broader checks than this plan's own scoped verification).
**Impact on plan:** None on functionality or scope — the actual code changes are exactly and only the three files D-18/D-19 name, and every one of Task 1's own `<verify>`/`<acceptance_criteria>` lines passes when run at the scope the plan itself specifies.

## Issues Encountered

- `date`/`TZ=Asia/Hong_Kong date` disagreed with each other in this Windows/Git-Bash environment (`TZ=...` override printed a UTC-offset time, while bare `date` printed the machine's actual local HKT time) — resolved by trusting bare `date`/`date -u` and cross-checking against the known 2026-09-12 session date, not the `TZ=` override. No functional impact; this only affected reading the D-01 gate line, which is waived anyway per this dispatch's `<user_overrides>`.
- No GUI browser reachable in this execution environment (same limitation 09-01 recorded) — the Neo4j before/after check was run via `docker exec ... cypher-shell` against the shared `third-chair-neo4j-1` container instead of an interactive Neo4j Browser session. `http://localhost:7474` remains available for a human to repeat the identical query visually.
- Printing the neo4j container's env to discover its auth mode also printed `NEO4J_AUTH=neo4j/changeme` (the default local dev password) to this session's own tool output — noted here in case a reviewer wants to rotate it; not written to any file, commit, or this SUMMARY beyond this note, and not used for anything beyond the read-only Cypher checks recorded above.

## User Setup Required

None — no external service configuration required beyond what 09-01 already set up. `GRAPH_SERVICE_URL`, `SEED_USER_A_SLACK_ID` and the rest are already resolved via `lib/config.ts` from the existing untracked root `.env`.

## Next Phase Readiness — checkpoint:human-verify (recorded per `human_verify_mode: end-of-phase`, not blocked on)

Everything below was automated and verified programmatically in this session (see `coverage` frontmatter). Per this dispatch's checkpoint instructions, none of it blocked execution — it is recorded here for a human to spot-check at end-of-phase:

**What was built:** `fetchGraphPreferences` + `graph/queries.cypher` + the additive `proposeNode` call site, demonstrated to change the proposed meeting duration from 30 to 45 minutes after ingesting one Graphiti preference fact, with the graph state changing visibly in Neo4j alongside it.

**How to verify (optional, for a human with a browser):**
1. Open `http://localhost:7474`, log in with `NEO4J_USER`/`NEO4J_PASSWORD` from the untracked root `.env`.
2. Paste `graph/queries.cypher`'s query 0 with `:param user_id => 'U0C0LJ5JDU4'`, then run query 3a (`MATCH (n {group_id: $user_id}) RETURN n`) — expect 1 row, labeled `Episodic` (this plan already ingested the fact live; running query 6 first would reset to the empty "before" state if a from-scratch rehearsal is wanted).
3. Optionally repeat the demo sequence live in Slack: post "Let's have a talk next Friday at 11am" as user A in the watched channel (`C0C17MQJ2HF`) with Bolt running (`bun lib/slack/bolt.ts`, only after confirming no other worktree's Bolt process is running) — the card should show 45 minutes, since the preference fact is already ingested for `U0C0LJ5JDU4`.

**Merge decision (D-03/D-04):** STR-03 was demonstrated end to end and recorded above — this plan is demo-ready. Per this dispatch's scope ("Never touch the main checkout"), the actual merge of `gsd/phase-9-s1-graphiti` to `main` is left to the orchestrator/human, not executed by this run.

**Known shortcuts for the Phase 11 README (carried forward and added to 09-01's list):**
- No Postgres `Preference` write-back (D-17 simplification) — the app reads the graph service's `GET /preferences` live at proposal time; there is no sync job and no `prisma/schema.prisma` change.
- No access control on `graph-service` :8000 beyond the loopback-only port binding (T-09-10, accepted risk, inherited from 09-01).
- The graph preference is read live on every proposal (a fresh HTTP call each time), not cached — acceptable at this demo's volume, but a real deployment would want a short-TTL cache to avoid a network round trip on every scheduling message.
- Only an `Episodic` node (no `Entity`) appears in the graph for this numeric preference value — the "new edge" half of D-15's aspiration is not demonstrated, only the new node plus the preference-value change itself (same finding 09-01 recorded, reconfirmed here).
- Task 3 (the `no_meeting_days` stretch lever into Phase 7's conflict path) was not built — Phase 7 itself does not exist yet in this repo state.

## Self-Check

- `graph/queries.cypher`: FOUND
- `lib/agent/graph-preferences.ts`: FOUND
- `lib/agent/graph.ts` modified: FOUND (contains `fetchGraphPreferences(`)
- Commit `048f7fb`: FOUND
- `git diff e4f0bf4 HEAD --name-only` == exactly the 3 expected files: CONFIRMED
- Before/after Proposal durations (30 then 45) and distinct source_ts values: CONFIRMED via psql query above
- Before/after Neo4j row counts (0 then 1, `Episodic`): CONFIRMED via cypher-shell query above
- Fails-closed run (service stopped, 30min proposal, no hang): CONFIRMED

## Self-Check: PASSED

---
*Phase: 09-optional-s1-graphiti-preference-memory*
*Completed: 2026-09-12*
