# Phase 9: [optional] S1 — Graphiti Preference Memory - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning
**Source:** PRD Express Path (.planning/ROADMAP.md, Phase 9 section only) + STR-01..03 in .planning/REQUIREMENTS.md + PROJECT.md constraints

<domain>
## Phase Boundary

Optional, throwaway, time-gated stretch. A self-hosted Graphiti service (Python, FastAPI, sibling repo) backed by local Neo4j 5 community learns one per-user scheduling preference, and the same scheduling input then visibly produces a different, better proposal. The graph is shown before and after in Neo4j Browser.

On schedule this phase is **README-only**: Neo4j and `graph-service` stay declared in compose but unexercised. It is attempted only if Phase 7's full dry run has passed, the build is at least 60 minutes ahead, and Phase 8 is skipped in favour of this one.

Requirements: STR-01, STR-02, STR-03. Nothing else. The in-dashboard graph render (STR-08), relationship brief (STR-06) and batch-sweep distillation (SCL-01) are not part of this phase.

</domain>

<decisions>
## Implementation Decisions

### Gate, time box, abandon rule
- **D-01:** Start only if Phase 7's full dry run on `main` has passed. Latest start **13:15**. Must be demo-ready by **14:40**. Never runs alongside Phase 8 or Phase 10.
- **D-02:** Budget ~60–90 min, of which 20–30 min is just the first Graphiti round trip.
- **D-03 (abandon, hard):** If the first `POST /episodes` → `GET /preferences` round trip hasn't succeeded within **30 minutes** of starting, abandon. Do not attempt the before/after demo. If the round trip works but the before/after proposal change can't be shown, cut S1 as well.
- **D-04:** Branch `gsd/phase-9-s1-graphiti`, labelled [throwaway]. Nothing merges to `main` unless demo-ready. Abandoned work is noted for the Phase 11 README, not finished late.

### Service shape (STR-01)
- **D-05:** The Graphiti service is a **separate Python repo** (Python 3.10+, `graphiti-core`, FastAPI) reached from this repo only via `GRAPH_SERVICE_DIR` (compose build context) and `GRAPH_SERVICE_URL` (HTTP). No Python code lives in this repo. There are zero shared files with the TypeScript app.
- **D-06:** Exactly two endpoints: `POST /episodes` and `GET /preferences?user_id=`. `GET /graph` is out (see Deferred).
- **D-07:** Graph backend is **Neo4j 5 community in local Docker**, behind the `graph` compose profile: `docker compose --profile graph up` brings up `neo4j` (:7474 Browser, :7687 bolt) and `graph-service` (:8000, depends on a healthy `neo4j`). No cloud graph DB during the window, and no Zep Cloud. FalkorDB is only a low-RAM fallback, and only after verifying `add_triplet` endpoints (getzep/graphiti #1001).
- **D-08:** One Neo4j driver per process, created in the FastAPI lifespan and closed on shutdown. Short-lived sessions; explicit `max_connection_pool_size` and `connection_acquisition_timeout`. TLS comes from the URI scheme only (`bolt://` local, `neo4j+s://` Aura), never also `encrypted=`/`trust=`.
- **D-09:** Every host, port and credential comes from env (`NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `GRAPH_SERVICE_URL`). Inside compose the service reaches `neo4j:7687`; from WSL, `localhost:7687`/`:7474`. Neo4j memory stays capped (heap ≈512m, page cache ≈256m).
- **D-10:** Python code carries docstrings of the same shape as TSDoc: summary, params, returns, raises.

### Preference facts (STR-02)
- **D-11:** Ingest **distilled JSON preference facts, not raw Slack text**. JSON episodes are preferred over prose so Graphiti has less to infer.
- **D-12:** Closed vocabulary. Exactly these five keys: `working_hours`, `default_meeting_duration`, `buffer_between_meetings`, `no_meeting_days`, `preferred_slot_of_day`. Anything else is rejected at the service boundary.
- **D-13:** Success is literal: `POST /episodes` with one distilled fact, then `GET /preferences?user_id=`, returns that fact.

### Before/after demo (STR-03)
- **D-14:** The same scheduling input must visibly produce a **different, better** proposal after one preference fact is ingested.
- **D-15:** `graph/queries.cypher` (in this repo) holds the demo queries, one paste away:
  - `CALL db.labels()` and `CALL db.relationshipTypes()`
  - `MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100`
  - a per-user filter
  - `CALL db.schema.visualization()`

  The **same query is run before and after** ingestion in Neo4j Browser, and a new node/edge appears.
- **D-16:** The app-side call to `GRAPH_SERVICE_URL` is **additive in `lib/agent/**`** and **gated behind the service actually responding**. If the service is down or unset, the agent behaves exactly as Phase 7 left it. Preferences feed the existing "known preferences" input of the conflict/proposal path (CFL-02 already works with zero `Preference` rows).
- **D-17:** Postgres :5432 is shared. Per the roadmap, the app reads `Preference` rows once they are written back.

### File ownership (this repo)
- **D-18:** Owned: `graph/queries.cypher` (new), activating the existing `docker-compose.yml` `graph` profile, and an additive `lib/agent/**` call to `GRAPH_SERVICE_URL`.
- **D-19:** Must not touch anything else in Wave A/B's owned directories (`lib/slack/**`, `lib/calendar/**`, `app/**`, `components/**`, `lib/ai/**`). This is the most isolated phase by design. `lib/agent/**` changes are additive only, never restructuring Phase 5/7 code. `lib/config.ts` already declares the optional `NEO4J_*`/`GRAPH_SERVICE_URL` keys (Phase 1). Extend it, don't duplicate it.
- **D-20:** No tests of any kind. Exit checks are hand checks under a minute. Biome runs on any TS change. `/ponytail-review` runs before any merge to `main`.

### Plans (suggested, only if attempted)
- **D-21:** Two plans:
  - 09-01: FastAPI service (separate repo) with `/episodes` + `/preferences` and the Neo4j round trip.
  - 09-02: before/after demo wiring in `lib/agent/**` + `graph/queries.cypher`.

  Mode is mvp: 09-01's round trip is the tracer, and the abandon clock (D-03) runs against it.

### Claude's Discretion
- Which Graphiti write path to use: `add_episode` with a JSON episode (`EpisodeType.json`), or a direct triplet/fact-triple write. Also whether the direct path really bypasses LLM extraction.
- How `GET /preferences` reads back: Graphiti search, or a direct Cypher read against Graphiti's nodes/edges. Also how the closed-vocabulary key/value is recovered deterministically.
- The per-user partition scheme (`group_id` or equivalent) mapping `user_id` to the graph.
- Which LLM and embedder Graphiti uses: Kilo Gateway via the OpenAI-compatible client, OpenAI directly, or another option. This must stay env-only.
- Which preference key makes the clearest before/after on stage (e.g. `preferred_slot_of_day` or `no_meeting_days` changing the alternatives, or `default_meeting_duration` changing the duration). Also where in `lib/agent/**` it takes effect.
- Where the hop happens: the app calls `GET /preferences` directly at proposal time, or preferences are written back to Postgres `Preference` rows first.
- How the demo fact is produced: a hand-crafted `curl`/script POST is acceptable. Automated distillation from Slack messages is not required by STR-02.
- Contents of the sibling repo's Dockerfile and dependency file, the Python version, and the service's health endpoint used for gating.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` — Phase 9 section (goal, time box, honest arithmetic, abandon criterion, files owned, ports, success criteria); Cut-Line Table row 9; File Ownership Matrix (`lib/agent/**` row); Process & Port Map row 9
- `.planning/REQUIREMENTS.md` — STR-01, STR-02, STR-03; STR-08 (deferred graph render)
- `.planning/PROJECT.md` — Constraints; "Services, connections, environments" (Neo4j driver-as-pool, compose, env-only swap); "Stretch detail → S1"; Key Decisions (Neo4j over FalkorDB, S1 separate repo)

### Source detail
- `gsd-prompt-ai-secretary.md` §"S1. Per-user preference memory via a temporal knowledge graph (Graphiti)" (lines ~276–296) — distilled JSON episodes, `add_fact_triple` open question, FalkorDB #1001, viewable-graph queries, demo requirement
- `gsd-prompt-ai-secretary.md` connections section (lines ~115–150) — `NEO4J_URI` local/cloud values, driver-per-process rule, compose profile

### Stack and prior research
- `.planning/research/STACK.md` — graphiti-core 0.30.2 (Python >=3.10,<4), neo4j driver 6.3.0, fastapi 0.141.1, neo4j:5-community
- `.planning/research/FEATURES.md` — S1 dependency notes (conflict counter-proposal must work with zero Preference rows)
- `.planning/phases/01-foundation-hardcoded-round-trip/01-RESEARCH.md` §"docker-compose.yml skeleton" and Assumption A1 (Neo4j memory env var names) — the compose services this phase activates
- `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md` — optional `NEO4J_*`/`GRAPH_SERVICE_URL` config keys

</canonical_refs>

<specifics>
## Specific Ideas

- Demo sequence: run `graph/queries.cypher` query in Browser (empty/before) → run scheduling input → note proposal → `POST /episodes` one fact → same query shows new node/edge → same scheduling input → visibly different, better proposal.
- Closed vocabulary keys verbatim: `working_hours`, `default_meeting_duration`, `buffer_between_meetings`, `no_meeting_days`, `preferred_slot_of_day`.
- Ingestion is seconds per episode, not milliseconds — the demo must wait for ingestion before querying.
- The roadmap's "Files must not touch: anything in Wave A/B's owned directories" coexists with "additive `lib/agent/**` call": resolved as additive-only in `lib/agent/**` (D-19).

</specifics>

<deferred>
## Deferred Ideas

- `GET /graph?user_id=` + in-dashboard `react-force-graph-2d` render (STR-08, v2).
- Relationship and cadence brief (STR-06, v2).
- Batch-sweep agent that distills preference facts from Slack windows automatically (SCL-01, v2). Documented in README only.
- Neo4j Aura / FalkorDB Cloud during the window.
- Calling the graph service from a Trigger.dev task specifically (source doc says "called from Trigger.dev"). The roadmap grants only an additive `lib/agent/**` call, so the transport follows whatever `runAgent` already uses.

</deferred>

---

*Phase: 09-optional-s1-graphiti-preference-memory*
*Context gathered: 2026-09-11 via PRD Express Path*
