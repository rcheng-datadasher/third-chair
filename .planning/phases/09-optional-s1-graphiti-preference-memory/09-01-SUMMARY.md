---
phase: 09-optional-s1-graphiti-preference-memory
plan: 01
subsystem: infra
tags: [graphiti, neo4j, fastapi, python, kilo-gateway, docker-compose]

requires:
  - phase: 01-foundation-hardcoded-round-trip
    provides: docker-compose.yml skeleton (postgres, neo4j, graph-service profiles), lib/config.ts optional NEO4J_*/GRAPH_SERVICE_URL keys
provides:
  - Separate-repo FastAPI Graphiti service (graph-service) exposing exactly POST /episodes and GET /preferences?user_id=
  - Proven POST -> GET round trip against local Neo4j, group_id="tracer"
  - Additive graph-service environment/port/healthcheck block in this repo's docker-compose.yml
affects: [09-02-before-after-demo]

actuals:
  tokens: 3059
  tasks: 3
  commits: 2
  plan_head_before: 8c0e488d862be9c8043b63bf002fd9700adc0fa9

tech-stack:
  added: [graphiti-core==0.30.2, "fastapi[standard]==0.141.1", python:3.12-slim]
  patterns:
    - "Direct Cypher read-back on Episodic.content, bypassing graphiti.search() (deterministic round trip independent of LLM extraction quality)"
    - "One Graphiti + one tuned Neo4j driver built in FastAPI lifespan, closed on shutdown"
    - "Nested compose interpolation (${GRAPHITI_LLM_MODEL:-${MODEL_FAST:-}}) to reuse an already-verified model id without duplicating it into a new env var"

key-files:
  created:
    - "graph-service/requirements.txt (sibling repo)"
    - "graph-service/Dockerfile (sibling repo)"
    - "graph-service/probe.py (sibling repo)"
    - "graph-service/main.py (sibling repo)"
    - "graph-service/.gitignore (sibling repo)"
    - "graph-service/.env.example (sibling repo)"
  modified:
    - "docker-compose.yml (graph-service block: env passthrough, loopback port, healthcheck)"

key-decisions:
  - "Never read .env/.env.local contents (harness secret-read guard blocks even wc -l on these paths in this sandbox, stricter than the prompt anticipated) — resolved by relying entirely on docker compose's own automatic .env interpolation to pass secrets into the graph-service container's environment block, exactly as the plan's own T-09-02 threat mitigation already specifies (no .env file is ever created in the sibling repo)."
  - "GRAPHITI_LLM_MODEL reuses MODEL_FAST via nested compose interpolation (${GRAPHITI_LLM_MODEL:-${MODEL_FAST:-}}) instead of copying the model id into a new env var — avoids ever needing to read the value, and the nested default resolved correctly (verified: anthropic/claude-haiku-4.5)."
  - "docker compose run/up used COMPOSE_PROJECT_NAME=third-chair so the worktree's compose invocation joins the already-running shared project (third-chair-neo4j-1) instead of creating a second neo4j container that collides on host ports 7474/7687 (the worktree directory name 'phase-9' would otherwise become the default project name)."
  - "D-01 start gate (Phase 7 dry run passed, HKT clock <= 13:15, Phase 8 skipped) was explicitly overridden by user decision at ~13:57 on 2026-09-12. Actual state at execution time: no Phase 7 SUMMARY exists yet, and a gsd/phase-8-s2-commitment-ledger branch exists (Phase 8 not skipped) — both gate conditions genuinely fail, and both are waived per the user's explicit instruction."
  - "D-03's 30-minute abandon clock was relaxed per user override to 'keep going while progress is being made'. Not exercised as a real constraint: the round trip passed on the first attempt, well under any reasonable time box."
  - "Browser label check (Task 3) done via a direct Cypher query through the neo4j Python driver run inside the graph-service container (same MATCH (n) RETURN labels(n), count(*) query Neo4j Browser would run), not through an actual browser session — no GUI browser is reachable from this execution environment. localhost:7474 remains available for a human to repeat the same check visually."

patterns-established:
  - "Sibling-repo Python service reached only via docker-compose build context + runtime env passthrough, zero shared files with the TypeScript app (D-05)."

requirements-completed: [STR-01, STR-02]

coverage:
  - id: D1
    description: "POST /episodes with one closed-vocabulary JSON fact, then GET /preferences?user_id= returns exactly that fact"
    requirement: STR-02
    verification:
      - kind: integration
        ref: "curl -sf -X POST http://localhost:8000/episodes -d '{\"user_id\":\"tracer\",\"key\":\"default_meeting_duration\",\"value\":45}' && curl -sf 'http://localhost:8000/preferences?user_id=tracer' => {\"default_meeting_duration\":45}"
        status: pass
    human_judgment: false
  - id: D2
    description: "Closed-vocabulary rejection: a key outside the five allowed values gets HTTP 422 before Graphiti is called"
    requirement: STR-02
    verification:
      - kind: integration
        ref: "curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:8000/episodes -d '{\"user_id\":\"tracer\",\"key\":\"favourite_colour\",\"value\":\"red\"}' => 422"
        status: pass
    human_judgment: false
  - id: D3
    description: "Separate-repo FastAPI service with exactly two routes, one Neo4j driver per process (tuned pool), TLS from URI scheme only"
    requirement: STR-01
    verification:
      - kind: integration
        ref: "grep -cE '^@app\\.' graph-service/main.py == 2; grep max_connection_pool_size graph-service/main.py; grep -v '^\\s*#' graph-service/main.py | grep -cE 'encrypted=|trust=' == 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Entity/edge graph visualization side effect (Browser label check) for the 09-02 before/after demo"
    verification:
      - kind: manual_procedural
        ref: "Direct Cypher MATCH (n) RETURN labels(n), count(*) run via the neo4j driver — result: only Episodic (3 nodes), no Entity nodes"
        status: pass
    human_judgment: true
    rationale: "Whether the demo needs a visible new Entity/edge (D-15) beyond the new Episodic node is a judgment call for 09-02's planner/human, not something this plan's automated check can decide."

duration: 25min
completed: 2026-09-12
status: complete
---

# Phase 9 Plan 01: Graphiti preference service round trip Summary

**Separate-repo FastAPI service (graphiti-core 0.30.2 + Neo4j 5 community) proves a literal POST /episodes -> GET /preferences round trip for closed-vocabulary scheduling preferences, Kilo Gateway-pointed throughout.**

## Performance

- **Duration:** ~25 min wall clock from first file write to final verified commit
- **Started:** 2026-09-12T06:03Z (~14:03 HKT)
- **Completed:** 2026-09-12T06:19Z (~14:19 HKT)
- **Tasks:** 3/3 completed
- **Files modified:** 7 (6 new in sibling repo, 1 modified in this repo)

## Gate Waiver (D-01, user override)

The plan's Task 1 precondition (Phase 7 full dry run passed on `main`, HKT clock <= 13:15, Phase 8 skipped) was checked and genuinely does **not** hold at execution time:
- No `07-*-SUMMARY.md` exists yet under `.planning/phases/07-integrate-conflict-counter-proposal/` (only PLAN/CONTEXT/RESEARCH/PATTERNS files).
- `git branch --list 'gsd/phase-8-*'` prints `gsd/phase-8-s2-commitment-ledger` — Phase 8 is not skipped.
- System clock read ~06:03 UTC / ~14:03 HKT at start (past the 13:15 latest-start line).

Per explicit user instruction, this gate is waived. The user's stated decision time was ~13:57 on 2026-09-12. Recorded here for the Phase 11 README per D-01/D-04's own framing of "abandoned or waived work is noted, never silently finished."

The D-03 30-minute abandon clock was likewise relaxed by the user to "keep going while progress is being made." It was never actually tested as a constraint — the round trip passed on the first real attempt.

## Accomplishments

- Sibling repo `graph-service` (separate git repo at `C:\coding_proj\hackathon\graph-service`, zero shared files with this repo, D-05) with a two-endpoint FastAPI service.
- `probe.py` proved, before any route existed, that a Kilo Gateway-pointed `OpenAIGenericClient` + `OpenAIEmbedder` + `OpenAIRerankerClient` triple can write a Graphiti JSON episode into local Neo4j with no exception (D-07, D-09, D-11).
- `main.py`: `POST /episodes` ingests one closed-vocabulary fact as a Graphiti JSON episode; `GET /preferences?user_id=` reads it back deterministically via a parameterized Cypher query on `Episodic.content`, independent of Graphiti's own entity-extraction/search quality (D-13, RESEARCH Q3).
- Round trip proven live: `POST {"user_id":"tracer","key":"default_meeting_duration","value":45}` then `GET /preferences?user_id=tracer` returns `{"default_meeting_duration":45}`.
- Closed-vocabulary enforcement proven live: an unknown key (`favourite_colour`) returns HTTP 422 before Graphiti is ever called.
- D-08 pool tuning applied: `Neo4jDriver`'s internal client swapped (no `await` in between) for one built with `max_connection_pool_size=10`, `connection_acquisition_timeout=10.0`; verified the round trip still passes after a full rebuild/restart, so the tuned lifespan is confirmed live and the ingested fact survived the restart in the Neo4j volume.
- `docker-compose.yml` `graph-service` block extended additively: env passthrough for all Graphiti/Kilo/Neo4j vars, loopback-only port `127.0.0.1:8000:8000`, and a healthcheck against the real `GET /preferences?user_id=healthcheck` route (no synthetic `/health` route, per D-06 "exactly two endpoints").

## Runtime Facts for the SUMMARY (per plan's `<output>` contract)

- **HKT clock start (first file write):** ~14:03 (2026-09-12)
- **Round-trip pass time:** ~14:16 (2026-09-12) — well inside any reasonable time box; D-03's 30-minute rule was not binding.
- **`GRAPHITI_LLM_MODEL` that worked:** `anthropic/claude-haiku-4.5` (resolved via nested compose interpolation from `MODEL_FAST`, verified by printing the resolved env var from inside the running container — no secret values were read or printed).
- **`GRAPHITI_EMBEDDING_MODEL` that worked:** `openai/text-embedding-3-small`.
- **Browser label result:** `MATCH (n) RETURN labels(n), count(*)` returns only `{'labels': ['Episodic'], 'n': 3}` — **no `Entity` nodes appeared** across the probe (`group_id="probe"`, 2 episodes) and tracer (`group_id="tracer"`, 1 episode) writes. Checked via a direct Cypher query through the neo4j Python driver from inside the graph-service container (no GUI browser reachable in this execution environment); `http://localhost:7474` remains available for a human to repeat the same query visually with `NEO4J_USER`/`NEO4J_PASSWORD`. Per RESEARCH's own framing, this affects only D-15's "new edge" demo aspiration, not D-13's literal round trip, which does not depend on entity extraction.
- **D-08 pool status:** tuned. `main.py` contains `AsyncGraphDatabase.driver(...)` with explicit `max_connection_pool_size=10` and `connection_acquisition_timeout=10.0`, swapped into `Neo4jDriver.client` with no `await` between construction and swap (per RESEARCH's Orchestrator Review Correction 1). No `# ponytail:` shortcut was needed — the swap worked cleanly within the time box.
- **Port binding used:** `127.0.0.1:8000:8000` (loopback only, as specified — not reachable from venue wifi, mitigating T-09-04).
- **Sibling-repo commit hashes:**
  - `38c225e` — `feat: abandon-clock probe proves Kilo-pointed Graphiti write to Neo4j`
  - `b876d05` — `feat: graphiti preference service round trip`
  - `4c7dc06` — `feat: tune neo4j pool and document env`
- **Known shortcuts for the Phase 11 README:**
  - No `Entity`/edge appeared in the graph after 3 episodes (numeric/short-string preference values may not give the LLM extraction step a named entity to find) — 09-02's before/after demo should lean on the new `Episodic` node and the D-13 preference-value change itself, not on a new visible edge, unless this is revisited with a richer fact value.
  - The unauthenticated `:8000` service is reachable by any local process that can resolve `localhost`; mitigated only by the loopback-only port binding (T-09-04, accepted risk per the plan's own threat register).

## Task Commits

Each task was committed atomically, split across the two repos per D-05/D-18:

1. **Task 1: Abandon-clock probe** —
   sibling repo `38c225e` (feat: probe + requirements.txt + Dockerfile),
   this repo `e0d8c21` (feat(09-01): graph-service env passthrough for Kilo-pointed Graphiti (T1))
2. **Task 2 (tracer): POST/GET round trip** —
   sibling repo `b876d05` (feat: graphiti preference service round trip),
   this repo `4f7dbc5` (feat(09-01): loopback port + preferences-route healthcheck for graph-service (T2))
3. **Task 3: Tune driver pool, document env, Browser label check** —
   sibling repo `4c7dc06` (feat: tune neo4j pool and document env) — no change to this repo, per plan.

**Plan metadata:** this SUMMARY's own commit (see final commit in this repo).

## Files Created/Modified

- `graph-service/requirements.txt` (sibling repo) - exactly `fastapi[standard]==0.141.1` and `graphiti-core==0.30.2`
- `graph-service/Dockerfile` (sibling repo) - `python:3.12-slim`, layered pip install, uvicorn entrypoint
- `graph-service/probe.py` (sibling repo) - abandon-clock probe, one JSON episode write + label read-back
- `graph-service/main.py` (sibling repo) - FastAPI app: lifespan (tuned Neo4j driver + Graphiti), `POST /episodes`, `GET /preferences`
- `graph-service/.gitignore` (sibling repo) - `.env`, `__pycache__/`
- `graph-service/.env.example` (sibling repo) - documents all 8 env keys, empty secret/model slots
- `docker-compose.yml` (this repo) - `graph-service` block: environment passthrough, loopback port, preferences-route healthcheck

## Decisions Made

See `key-decisions` in frontmatter for full detail. Summary:
- Relied on docker compose's own `.env` interpolation instead of creating a `graph-service/.env` file, consistent with the plan's own no-secrets-in-sibling-repo design (T-09-02) and required because this sandbox's secret-read guard blocks any Bash command that so much as names `.env`/`.env.local` as an argument, even for a non-printing `wc -l`.
- Reused `MODEL_FAST` for `GRAPHITI_LLM_MODEL` via nested compose interpolation rather than copying its value into a new env var, so the model id never had to be read into this session's context.
- Set `COMPOSE_PROJECT_NAME=third-chair` for every `docker compose` invocation from the worktree, so it joins the already-running shared `neo4j` container instead of creating a colliding second one under the worktree directory's default project name (`phase-9`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Docker Compose project-name collision on first `run`**
- **Found during:** Task 1, first `docker compose --profile graph run --rm graph-service python probe.py`
- **Issue:** The worktree's default Compose project name (`phase-9`, derived from the worktree directory) tried to create a second `neo4j` container, which failed to bind ports 7474/7687 already held by the shared `third-chair-neo4j-1`.
- **Fix:** Removed the accidentally-created `phase-9-neo4j-1` container/network/volume, then re-ran every `docker compose` command with `COMPOSE_PROJECT_NAME=third-chair` so the worktree joins the existing shared project instead of spinning up a duplicate.
- **Files modified:** none (operational fix only, no code/config change)
- **Verification:** subsequent `docker compose ... run`/`up` calls attached to `third-chair-neo4j-1` and `third-chair-graph-service-1`, no port conflicts.
- **Committed in:** n/a (no file change)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope creep — a pure operational fix required to run in a shared-Docker-project worktree environment, not a code or design change.

## Issues Encountered

- **Secret-read guard stricter than the outer prompt anticipated.** The prompt's suggested pattern (`grep -E '...' .env.local > .../graph-service/.env`) is blocked outright by this sandbox's secret-read guard, which intercepts any Bash command that references `.env`/`.env.local` by name at all, including pure-metadata commands (`wc -l`) and redirected-output commands. Resolved by never creating a `graph-service/.env` file at all — the plan already specifies compose-passthrough-only for secrets (no `.env` in the sibling repo, T-09-02), so this constraint and the plan's own design pointed the same direction. `.env` (this repo's root file, not `.env.local`) was only ever *appended to* (never read) to add `GRAPHITI_EMBEDDING_MODEL` and `GRAPH_SERVICE_DIR`, which the guard permits since it targets reads, not writes.
- **Graphiti's own scheduled index-build task logged "EquivalentSchemaRuleAlreadyExists" warnings on the first probe run** — these are non-fatal (Graphiti catches and logs them, per its `Neo4jDriver.__init__`-scheduled background task), and are expected because this shared Neo4j instance already had Graphiti's indices from an earlier concurrent session using the same shared container (per the environment note that Neo4j is shared across worktrees). No functional impact: the probe's own explicit `await graphiti.build_indices_and_constraints()` call and the final `add_episode` both completed successfully.

## User Setup Required

None - no external service configuration required. The service runs entirely through `docker compose --profile graph up -d --build graph-service` from this repo's root, with `COMPOSE_PROJECT_NAME=third-chair` and `GRAPH_SERVICE_DIR=C:/coding_proj/hackathon/graph-service` set (or already present in the untracked root `.env`, which now has `GRAPH_SERVICE_DIR` appended).

## Next Phase Readiness

- 09-02 (before/after demo wiring in `lib/agent/**` + `graph/queries.cypher`) can proceed: the service is live at `http://localhost:8000`, `GET /preferences?user_id=tracer` returns real data, and the `fetchGraphPreferences` seam described in RESEARCH Q7 has a real, proven backend to call.
- Known gap for 09-02: no `Entity` node appeared yet in the graph, so the "new edge" half of D-15's before/after Browser demo is not yet demonstrated — only a new `Episodic` node. 09-02's planner should decide whether to accept this (lean on the preference-value change itself as the visible "different, better proposal") or spend time on a richer fact value to trigger entity extraction.
- To restart the service after this session: from this repo's root, `COMPOSE_PROJECT_NAME=third-chair GRAPH_SERVICE_DIR=C:/coding_proj/hackathon/graph-service docker compose --profile graph up -d --build graph-service` (or set `GRAPH_SERVICE_DIR` once in the untracked root `.env`, already done, and drop the inline env var).

## Self-Check

- `graph-service/main.py`: FOUND
- `graph-service/probe.py`: FOUND
- `graph-service/requirements.txt`: FOUND
- `graph-service/Dockerfile`: FOUND
- `graph-service/.gitignore`: FOUND
- `graph-service/.env.example`: FOUND
- `docker-compose.yml` (this repo, modified): FOUND
- Sibling repo commit `38c225e`: FOUND
- Sibling repo commit `b876d05`: FOUND
- Sibling repo commit `4c7dc06`: FOUND
- This repo commit `e0d8c21`: FOUND
- This repo commit `4f7dbc5`: FOUND

## Self-Check: PASSED

---
*Phase: 09-optional-s1-graphiti-preference-memory*
*Completed: 2026-09-12*
