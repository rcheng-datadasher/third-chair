# Phase 9: [optional] S1 — Graphiti Preference Memory - Research

**Researched:** 2026-09-11
**Domain:** Self-hosted Graphiti (`graphiti-core` 0.30.2, Python) + Neo4j 5 community, FastAPI two-endpoint service, additive TS integration seam
**Confidence:** MEDIUM — exact API signatures and default-client behavior confirmed against `getzep/graphiti`'s own GitHub source and official Zep docs this session (HIGH-confidence for those); latency, APOC requirement, and Kilo Gateway structured-output behavior for the *specific* models this project will pick are cross-checked community evidence, not independently executed against this project's actual Kilo Gateway key (MEDIUM). Every claim below is tagged individually.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)
- `GET /graph?user_id=` + in-dashboard `react-force-graph-2d` render (STR-08, v2).
- Relationship and cadence brief (STR-06, v2).
- Batch-sweep agent that distills preference facts from Slack windows automatically (SCL-01, v2). Documented in README only.
- Neo4j Aura / FalkorDB Cloud during the window.
- Calling the graph service from a Trigger.dev task specifically. The transport follows whatever `runAgent` already uses.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STR-01 | Separate-repo FastAPI Graphiti service exposes `POST /episodes` + `GET /preferences?user_id=` against Neo4j (one driver per process, TLS via URI scheme) | §Architecture Patterns "FastAPI lifespan + driver pool"; §Code Examples "FastAPI service skeleton" |
| STR-02 | Distilled JSON preference facts from a closed vocabulary are ingested and read back deterministically | §Priority Q1/Q2/Q3 findings; §Code Examples "POST /episodes handler", "GET /preferences handler" |
| STR-03 | Same input visibly produces a different, better proposal after a preference is learned; `graph/queries.cypher` shows the graph before/after | §"Recommended demo lever"; §Code Examples "graph/queries.cypher"; §Architecture Patterns "additive lib/agent seam" |
</phase_requirements>

## Summary

This phase's real risk is not Neo4j or FastAPI — it is `graphiti-core`'s **default reliance on an LLM call inside `add_episode`, plus an embedder call inside every write path (including the "bypass extraction" one)**. Both defaults point at OpenAI directly; both must be repointed at OpenRouter through `OpenAIGenericClient`/`OpenAIEmbedder(base_url=...)` `[CITED: help.getzep.com/graphiti/configuration/llm-configuration]`, and OpenRouter now serves an OpenAI-compatible `/api/v1/embeddings` endpoint `[CITED: openrouter.ai/docs/api_reference/embeddings]` that satisfies the embedder half. Confirm structured-output support for whichever chat model id is chosen — this project already knows to distrust "every OpenRouter model supports `response_format: json_schema`" (STACK.md's own "What NOT to Use" entry), and Graphiti's `OpenAIGenericClient` leans on exactly that mechanism `[CITED: community DeepWiki summary of getzep/graphiti provider config]`.

D-11 ("JSON episodes are preferred over prose") already points this phase at `add_episode(source=EpisodeType.json, ...)` rather than `add_triplet`. That is also the lower-risk choice under the 30-minute abandon clock: `add_triplet` requires hand-constructing `EntityNode`/`EntityEdge` objects and *still* calls the embedder for dedup, so it doesn't actually remove an external-call failure surface, it just removes the LLM-extraction call — and the extraction quality doesn't matter for this phase's read-back path anyway (see below). Use `add_episode`.

The second load-bearing finding: **`GET /preferences` must not depend on Graphiti's entity/edge extraction being correct.** Graphiti persists the *raw* JSON you POST verbatim on the Episodic node's `content` property (`store_raw_episode_content=True` is the default) `[CITED: help.getzep.com/graphiti/core-concepts/adding-episodes + community source on EpisodicNode properties]`. Read that property back directly with Cypher, filtered by `group_id`, and `json.loads()` it yourself — this makes D-13's literal round-trip ("POST one fact, GET returns that fact") independent of whatever the LLM extracted into Entity/RELATES_TO nodes, which is exactly the failure mode this phase cannot afford to debug live. The Entity/RELATES_TO graph still gets built as a side effect (satisfying D-15's "new node/edge appears" requirement) — you get both properties for the price of one `add_episode` call, you just don't *read back* through the fragile path.

**Primary recommendation:** `add_episode(source=EpisodeType.json, group_id=user_id, ...)` to write; direct Cypher `MATCH (e:Episodic {group_id: $user_id}) RETURN e.content ORDER BY e.created_at DESC` to read, merging JSON keys across episodes server-side into the closed-vocabulary dict; `default_meeting_duration` as the primary before/after demo lever (touches the extraction/propose step directly, needs no LLM reasoning to be "correct" for the demo to visibly work), with `no_meeting_days` as the stretch lever if CFL-02's existing "known preferences" parameter is trivially reachable.

## Abandon Clock: Top Risks and Early-Detection Checks

D-03's 30-minute clock starts at the first `POST /episodes` attempt, not at `docker compose up`. Ordered by how much clock they can burn if hit blind:

1. **Kilo Gateway model doesn't support Graphiti's structured-output request shape.** `add_episode`'s entity-extraction LLM call uses `response_format` `[CITED, MEDIUM confidence — not verified against this project's actual chosen `MODEL_FAST` id]`. **Early-detection check (do this literally first, before writing FastAPI routes):** a five-line Python script constructing `OpenAIGenericClient` + one `add_episode` call against a throwaway `group_id`, run directly (`python -c` or a scratch `.py`), watched for a raw exception vs. a slow-but-successful response. If it 400s/500s on structured output, switch `GRAPHITI_LLM_MODEL` to a model with `structured_outputs` in `supported_parameters` per `api.kilo.ai/api/gateway/models` (same check this project's STACK.md already mandates for `MODEL_FAST`/`MODEL_SMART` — reuse that verified model id here rather than trusting a fresh one).
2. **Embedder misconfiguration silently no-ops.** If `OpenAIEmbedder`'s `base_url`/`embedding_model` is wrong, `add_episode` may still "succeed" (episode + content saved) while entity/edge writes silently fail deeper in the pipeline — this matters less here because the read-back path (Cypher on `Episodic.content`) doesn't depend on it, but it would break D-15's "new node/edge appears in Browser" demo requirement. **Early-detection check:** after the first successful `add_episode`, immediately run `MATCH (n) RETURN labels(n), count(*)` in Browser — if only `Episodic` appears and no `Entity`, the embedder or LLM path is broken even though the round trip "worked."
3. **Docker first-start time eats the 20–30 min sub-budget.** Neo4j 5 community's first container start (volume init, plugin load) plus a Python image `pip install graphiti-core` (pulls `pydantic`, `neo4j` driver, `openai`, `numpy`, `posthog`, `tenacity`) is not instant. **Early-detection check:** start `docker compose --profile graph up` and `docker build` for `graph-service` as the *very first action* of the phase, in parallel with writing the FastAPI route code — don't write code first and then wait on a cold build.
4. **`neo4j+community` doesn't ship APOC by default and Graphiti's own index/constraint setup may want it.** No official source found this session states unconditionally whether `graphiti-core`'s `build_indices_and_constraints()` requires APOC procedures on self-managed Neo4j `[no observation — search returned only AuraDB-specific and generic APOC-shipping-in-labs-folder information, not a Graphiti-specific requirement statement]`. Treat as `[ASSUMED: likely not required for the base index/constraint set, since Neo4j 5's core `db.schema.visualization()`/`db.labels()`/vector index creation are native procedures, not APOC]`, but if `build_indices_and_constraints()` throws a "procedure not found" error, add `NEO4J_PLUGINS: '["apoc"]'` to the compose env and restart — this is a known, five-minute-fixable failure mode, not a dead end.

## Priority Research Questions — Findings

### Q1 — Exact current graphiti-core API

Fetched verbatim from `github.com/getzep/graphiti/blob/main/graphiti_core/graphiti.py` (raw source, this session) `[VERIFIED: github.com/getzep/graphiti/blob/main/graphiti_core/graphiti.py]`:

```python
class Graphiti:
    def __init__(
        self,
        uri: str | None = None,
        user: str | None = None,
        password: str | None = None,
        llm_client: LLMClient | None = None,
        embedder: EmbedderClient | None = None,
        cross_encoder: CrossEncoderClient | None = None,
        store_raw_episode_content: bool = True,
        graph_driver: GraphDriver | None = None,
        max_coroutines: int | None = None,
        tracer: Tracer | None = None,
        trace_span_prefix: str = 'graphiti',
    ): ...

    async def add_episode(
        self,
        name: str,
        episode_body: str,
        source_description: str,
        reference_time: datetime,
        source: EpisodeType = EpisodeType.message,
        group_id: str | None = None,
        uuid: str | None = None,
        update_communities: bool = False,
        entity_types: dict[str, type[BaseModel]] | None = None,
        excluded_entity_types: list[str] | None = None,
        previous_episode_uuids: list[str] | None = None,
        edge_types: dict[str, type[BaseModel]] | None = None,
        edge_type_map: dict[tuple[str, str], list[str]] | None = None,
        custom_extraction_instructions: str | None = None,
        saga: str | SagaNode | None = None,
        saga_previous_episode_uuid: str | None = None,
    ) -> AddEpisodeResults: ...

    async def add_triplet(
        self, source_node: EntityNode, edge: EntityEdge, target_node: EntityNode
    ) -> AddTripletResults: ...

    async def build_indices_and_constraints(self, delete_existing: bool = False): ...

    async def close(self): ...

    async def search(
        self,
        query: str,
        center_node_uuid: str | None = None,
        group_ids: list[str] | None = None,
        num_results=DEFAULT_SEARCH_LIMIT,
        search_filter: SearchFilters | None = None,
        driver: GraphDriver | None = None,
    ) -> list[EntityEdge]: ...
```

- `episode_body` for a JSON episode is a **JSON string** (`json.dumps(payload)`), not a dict — confirmed by the official code example (Q3 below).
- **Defaults when `llm_client`/`embedder`/`cross_encoder` are not passed: `OpenAIClient()`, `OpenAIEmbedder()`, `OpenAIRerankerClient()`** `[VERIFIED: source fetch, same file]` — all three read `OPENAI_API_KEY` from env by default and point at `api.openai.com`, **not** Kilo Gateway. This must be overridden explicitly (Q2).
- `graph_driver` (not `driver`) is the constructor kwarg for supplying a pre-built driver — see Q5.
- `add_triplet` "bypasses extraction" in the sense of skipping the LLM entity/edge-extraction call, but its own deduplication step still needs vector similarity against existing nodes, which needs the embedder `[CITED: help.getzep.com/graphiti/graphiti/adding-fact-triples — "Graphiti will attempt to deduplicate your passed in nodes and edges with the already existing nodes and edges"]`. No source found this session states add_triplet skips embedding generation for the new node/edge — treat embedder-required as the safe assumption for **both** write paths `[ASSUMED, MEDIUM risk if wrong: worst case is a slightly slower add_triplet call, not a failure]`.

### Q2 — LLM + embedder requirements against Kilo Gateway

`[CITED: help.getzep.com/graphiti/configuration/llm-configuration]` — the documented pattern for any OpenAI-compatible non-OpenAI endpoint:

```python
from graphiti_core.llm_client.openai_generic_client import OpenAIGenericClient
from graphiti_core.llm_client.config import LLMConfig
from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig

llm_client = OpenAIGenericClient(config=LLMConfig(
    api_key=os.environ["AI_API_KEY"],
    model=os.environ["GRAPHITI_LLM_MODEL"],        # e.g. same id as this project's MODEL_FAST
    small_model=os.environ["GRAPHITI_LLM_MODEL"],
    base_url="https://api.kilo.ai/api/gateway",
))

embedder = OpenAIEmbedder(config=OpenAIEmbedderConfig(
    api_key=os.environ["AI_API_KEY"],
    embedding_model=os.environ["GRAPHITI_EMBEDDING_MODEL"],  # e.g. "openai/text-embedding-3-small"
    base_url="https://api.kilo.ai/api/gateway",
))
```

Use `OpenAIGenericClient`, **not** `OpenAIClient`, for Kilo Gateway — community documentation states the plain `OpenAIClient` does not reliably respect a custom `base_url` for non-OpenAI providers `[CITED: DeepWiki summary of getzep/graphiti provider configuration, cross-checked against the official llm-configuration doc's own use of `OpenAIGenericClient` for custom endpoints]`.

**OpenRouter does serve embeddings.** `openrouter.ai/docs/api_reference/embeddings` documents a dedicated `POST /api/v1/embeddings` endpoint that mirrors OpenAI's request/response schema `[CITED: openrouter.ai/docs/api_reference/embeddings]`; any OpenAI-SDK-shaped embedder client works against it by swapping `base_url`. This resolves the open question in the phase brief — no fallback to a direct `OPENAI_API_KEY` is required for embeddings, keeping the whole service on one provider and one env-only swap point, consistent with this project's `lib/ai/provider.ts` philosophy even though this is a separate Python process.

**Least-risk env-only config:** four new env vars in the sibling repo's own `.env` (never touching this repo's `lib/config.ts` beyond what Phase 1 already declared): `AI_API_KEY` (same value as this repo's), `GRAPHITI_LLM_MODEL`, `GRAPHITI_EMBEDDING_MODEL`, `AI_BASE_URL` (default `https://api.kilo.ai/api/gateway`). **No no-LLM path exists for `POST /episodes`** given the locked `add_episode`-with-JSON write path (D-11) — `add_episode` always calls the configured LLM client for extraction, full stop `[VERIFIED: signature + documented behavior, Q1]`. The only way to avoid the LLM call entirely is `add_triplet`, which D-11's own phrasing already steers away from.

### Q3 — Deterministic read-back for `GET /preferences`

`[CITED: help.getzep.com/graphiti/core-concepts/adding-episodes]` — exact JSON-episode write example:

```python
await graphiti.add_episode(
    name=f"preference-{key}",
    episode_body=json.dumps({key: value}),   # e.g. {"default_meeting_duration": 45}
    source=EpisodeType.json,
    source_description="distilled Slack preference fact",
    reference_time=datetime.now(timezone.utc),
    group_id=user_id,
)
```

Episodic nodes persist `content`, `group_id`, `source_description`, `name`, `uuid`, `created_at`, `valid_at` as direct properties `[CITED: community source cross-checked against official "episodic node holds the content from this episode" doc language]`. **Recommended read-back — bypass `graphiti.search()` entirely:**

```cypher
MATCH (e:Episodic {group_id: $user_id})
RETURN e.content AS content, e.created_at AS created_at
ORDER BY e.created_at ASC
```

Run this over the driver directly (not through Graphiti's Python object), `json.loads()` each `content` string, and merge the dicts in ascending `created_at` order so a later fact for the same key overwins an earlier one — this gives `GET /preferences?user_id=` a plain closed-vocabulary dict built entirely from what was actually POSTed, with zero dependency on LLM extraction quality, embedder correctness, or Graphiti's own `search()` ranking/dedup heuristics. This directly satisfies D-13's literal contract and is the only path in this phase whose correctness doesn't hinge on the LLM.

Reject-at-boundary validation for the closed vocabulary (D-12) belongs in the FastAPI request model (Pydantic), not in Graphiti at all — a `Literal["working_hours", "default_meeting_duration", "buffer_between_meetings", "no_meeting_days", "preferred_slot_of_day"]` key field on the `POST /episodes` request body rejects anything else with a 422 before Graphiti is ever called.

### Q4 — Neo4j 5 community docker specifics

- Env var names: `NEO4J_server_memory_heap_max__size`, `NEO4J_server_memory_pagecache_size` — **already used verbatim in Phase 1's compose skeleton** (`01-RESEARCH.md`, Assumption A1, tagged `[ASSUMED]` there). This session's search corroborates the double-underscore-escapes-a-literal-underscore convention and the default values (`512M`/`512M` when unset) via the official Neo4j Operations Manual Docker configuration page `[CITED: neo4j.com/docs/operations-manual/current/docker/configuration/]`, raising this from Phase 1's `[ASSUMED]` to `[CITED]` for this phase's purposes — reuse Phase 1's compose block unchanged.
- Healthcheck: Phase 1's skeleton uses `wget -q --spider http://localhost:7474`. `neo4j:5-community`'s base image is Debian-based and ships `wget` in the base OS layer commonly enough that this is the standard community pattern; no contradicting report found. Keep it — no change needed.
- APOC: see Abandon Clock risk #4 above — not confirmed required, treat as a five-minute fallback (`NEO4J_PLUGINS`) rather than a blocker.
- First-start time: not independently measured this session (no Docker available in this research sandbox). Budget it as part of D-02's 20–30 minute sub-window per the phase's own honest arithmetic, and start the pull/build as the literal first action (Abandon Clock risk #3).

### Q5 — FastAPI lifespan pattern, single driver, pool settings

`[CITED: community DeepWiki/GitHub issue on graphiti-fastmcp connection pooling, cross-checked against the `graph_driver` constructor param confirmed in Q1's source fetch]`. As of `graphiti-core` releases after 0.17.0, `Graphiti()` accepts a **pre-built driver** via the `graph_driver` kwarg, which is the only way to set `max_connection_pool_size`/`connection_acquisition_timeout` (D-08's locked requirement) — the bare `uri`/`user`/`password` constructor path does not expose pool tuning:

```python
from contextlib import asynccontextmanager
from neo4j import AsyncGraphDatabase
from graphiti_core import Graphiti
from graphiti_core.driver.neo4j_driver import Neo4jDriver

@asynccontextmanager
async def lifespan(app: FastAPI):
    async_driver = AsyncGraphDatabase.driver(
        os.environ["NEO4J_URI"],                 # bolt://neo4j:7687 in compose; scheme carries TLS (D-08)
        auth=(os.environ["NEO4J_USER"], os.environ["NEO4J_PASSWORD"]),
        max_connection_pool_size=20,
        connection_acquisition_timeout=10,
    )
    graph_driver = Neo4jDriver(driver=async_driver)
    graphiti = Graphiti(graph_driver=graph_driver, llm_client=llm_client, embedder=embedder)
    await graphiti.build_indices_and_constraints()
    app.state.graphiti = graphiti
    yield
    await graphiti.close()
```

TLS-by-URI-scheme is Neo4j Python driver native behavior (`bolt://` = plaintext, `bolt+s://`/`neo4j+s://` = TLS) and is unaffected by wrapping the driver for Graphiti — D-08's "never also `encrypted=`/`trust=`" rule applies to the `AsyncGraphDatabase.driver()` call shown above exactly as it would without Graphiti in the picture.

**Time-pressure fallback:** if wiring the pre-built-driver pattern above eats more than ~5 minutes, fall back to `Graphiti(uri=..., user=..., password=...)` directly (accepts the driver's own defaults, no explicit pool tuning) and note the D-08 deviation as a documented shortcut — this is a case where a locked decision should yield to the 30-minute abandon clock rather than the reverse, since D-03 (abandon) sits above D-08 (driver tuning) in the phase's own priority ordering.

### Q6 — Ingestion latency; await vs background

Each `add_episode` call triggers multiple sequential LLM calls (entity extraction, edge extraction, deduplication resolution) plus embedding calls; community-reported real-world latency is roughly 1–3 seconds per episode on a near-empty graph, rising as the graph grows (one report cited ~18s on a graph of several thousand nodes) `[CITED: community sources — theneuralmaze.substack.com, multiple GitHub issue threads; no official SLA published]`. For this phase's near-empty demo graph (a handful of episodes total), low-single-digit seconds is the realistic expectation, matching the phase brief's own "seconds per episode, not milliseconds" framing.

**Recommendation: `await` it inline inside `POST /episodes`**, do not background it. The demo sequence (D-15) requires the operator to know ingestion has *finished* before re-running the query in Neo4j Browser — a fire-and-forget background task reintroduces exactly the race the demo script is trying to avoid, for a feature whose entire budget is 60–90 minutes. FastAPI's default request-handling is already async; a single `await graphiti.add_episode(...)` inside the route handler, returning 200 only after it resolves, is the correct and simplest shape. No Trigger.dev involvement (per Deferred Ideas — this repo's `lib/agent/**` call is a direct HTTP `GET`/`POST`, not a queued job).

### Q7 — Best before/after demo lever + minimal `lib/agent/**` seam

Two real candidates, both technically sound:

- **`default_meeting_duration`** — overrides the proposal's duration at extraction/propose time. **Recommended primary.** It is deterministic (a plain value substitution, no LLM reasoning required for correctness), it demos on the *primary* proposal path (doesn't require the conflict path to be reached, so it demos even if CFL-02 wasn't rehearsed that day), and "the same 'next Friday 11am' message now proposes 45 minutes instead of the platform default" is a one-sentence, unambiguous narration for judges.
- **`no_meeting_days`** — feeds directly into CFL-02's *existing* "known preferences" parameter (already accepted by that call per Phase 7's own design, currently always empty/zero rows). This is the **most additive-safe** integration point of the two, since Phase 7 already built the parameter slot — Phase 9's job becomes "populate a previously-empty argument," not "add a new one." The tradeoff: it depends on `MODEL_SMART`'s conflict-reasoning call correctly avoiding the excluded day, which is LLM-judgment-dependent rather than a deterministic substitution, and only demos if the conflict path is exercised.

**Recommendation:** build `default_meeting_duration` first (primary, deterministic, always-reachable) as the phase's actual exit-criterion demo; treat `no_meeting_days` → CFL-02's preferences parameter as a stretch add-on only if time remains inside the 60–90 minute budget, since it is genuinely lower engineering risk to wire (one populated argument, zero new logic) even though its *demo* outcome depends on the LLM.

**Minimal `lib/agent/**` seam (additive-only, per D-16/D-19):**

```typescript
// lib/agent/graph-preferences.ts — new file, additive only
/**
 * Fetches learned scheduling preferences from the optional Graphiti service.
 * @param userId - the Slack/User id used as Graphiti's group_id
 * @returns the closed-vocabulary preference dict, or null if the service is
 *   unset, unreachable, or times out — callers must treat null as "no preferences known"
 *   and fall through to Phase 7's existing zero-Preference-rows behavior.
 */
export async function fetchGraphPreferences(userId: string): Promise<Record<string, unknown> | null> {
  if (!config.graph.serviceUrl) return null;
  try {
    const res = await fetch(`${config.graph.serviceUrl}/preferences?user_id=${encodeURIComponent(userId)}`, {
      signal: AbortSignal.timeout(2000), // short timeout — never block the demo path on a dead service
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // network error, timeout, DNS failure — all treated identically
  }
}
```

Call site: wherever Phase 5/7 already resolves the proposal's duration / builds CFL-02's preferences argument, add one `const graphPrefs = await fetchGraphPreferences(userId);` and merge `graphPrefs?.default_meeting_duration` (or `no_meeting_days`) into the existing value with a `??`/fallback — this is additive by construction (a new optional data source feeding an existing parameter), matching D-16/D-19's "never restructures Phase 5/7 code" constraint.

**On D-17's "reads Preference rows once written back":** given the budget, recommend the app call `GET /preferences` directly at proposal time (as above) rather than building a Postgres write-back sync job — a sync mechanism is new plumbing this phase's clock cannot afford, and D-17's phrasing ("once written back") reads as describing a *future* state, not a requirement this specific throwaway phase must build. Document this simplification explicitly as a Phase 9 scoping decision, not a silent deviation.

### Q8 — Python/Docker friction

`graphiti-core`'s required dependencies: `pydantic>=2.11.5`, `neo4j>=5.26.0`, `openai>=1.91.0`, `tenacity>=9.0.0`, `numpy>=1.0.0`, `python-dotenv>=1.0.1`, `posthog>=3.0.0` `[CITED: github.com/getzep/graphiti pyproject.toml, via search-engine-surfaced summary — not independently re-fetched verbatim this session; treat the exact version floors as MEDIUM confidence, the dependency *names* as HIGH]`. No `pandas`; `numpy` is present but is a standard, fast-installing wheel on Linux (no compilation needed for a stock manylinux wheel) — no unusual install friction expected on WSL Ubuntu. Python `>=3.10,<4` — recommend **3.12** (`python:3.12-slim` base image) for a modern, well-supported interpreter with prebuilt wheels for every dependency above.

`posthog` is a **required** dependency and is Graphiti's own anonymous telemetry client — worth a one-line README/known-shortcuts mention (`GRAPHITI_TELEMETRY_ENABLED=false` is the documented opt-out env var for this exact library, standard practice for this ecosystem) `[ASSUMED — env var name not independently re-verified this session, but this is the standard PostHog-telemetry-opt-out pattern used across many similarly-instrumented Python libraries]`.

**pip vs uv:** recommend plain `pip install -r requirements.txt` in the Dockerfile. `uv` is faster but is not confirmed pre-installed per PROJECT.md's "Pre-setup confirmed" list (which enumerates bun, Docker, Trigger.dev CLI, etc. but not `uv`), and this is explicitly a **no-new-setup** build — adding a Dockerfile step that installs `uv` first costs more than it saves for a two-dependency-file build with a 30-minute abandon clock. If `uv` is confirmed already on the machine, swapping it in is a Dockerfile one-liner and safe to do opportunistically, but don't gate the plan on it.

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```
# requirements.txt
fastapi==0.141.1
uvicorn[standard]
graphiti-core==0.30.2
```
(`neo4j` driver and `openai` SDK come in transitively via `graphiti-core`'s own dependency floors — no need to pin them separately unless a specific driver feature is needed beyond what `graphiti-core>=5.26.0`'s floor already satisfies, per STACK.md's own note "don't hand-pin lower.")

Health endpoint for compose gating and the `lib/agent/**` gate check — a plain FastAPI route requiring no extra packages:

```python
@app.get("/health")
async def health():
    return {"status": "ok"}
```
Compose healthcheck avoids adding `curl`/`wget` to the image by using Python itself, already present:
```yaml
healthcheck:
  test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
  interval: 5s
  timeout: 5s
  retries: 5
```

### Q9 — `graph/queries.cypher` contents

Tailored to the labels/relationship types Graphiti actually writes (`Episodic`, `Entity` nodes; `MENTIONS` from episode to entity; `RELATES_TO` between entities) `[CITED, cross-checked across two independent community write-ups plus the official "episode ... related to via MENTIONS edges" doc line]`:

```cypher
// graph/queries.cypher — one paste away mid-demo (D-15)

// 1. Confirm what Graphiti actually wrote — run once after the very first ingest
CALL db.labels();
CALL db.relationshipTypes();

// 2. The whole small graph, rendered on the canvas
MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100;

// 3. Per-user filter — what the agent knows about one person
MATCH (n {group_id: $user_id})-[r]->(m)
RETURN n, r, m;

// 4. Schema overview
CALL db.schema.visualization();

// 5. Deterministic preference read-back (matches the service's own GET /preferences logic —
//    useful to sanity-check the API response against the raw graph during rehearsal)
MATCH (e:Episodic {group_id: $user_id})
RETURN e.content AS content, e.created_at AS created_at
ORDER BY e.created_at ASC;
```

Set `:param user_id => 'A';` (or the seeded Slack user id) once in Browser before running queries 3/5, per Neo4j Browser's standard `:param` syntax.

## Standard Stack

### Core (sibling Python repo)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `graphiti-core` | 0.30.2 `[VERIFIED: STACK.md / PyPI JSON API, 2026-09-11]` | Temporal knowledge graph library | Already pinned project-wide; requires Python `>=3.10,<4` |
| `neo4j` (Python driver) | 6.3.0 `[VERIFIED: STACK.md / PyPI JSON API, 2026-09-11]` | Graph DB client, transitively required by `graphiti-core>=5.26.0` floor | Already pinned project-wide |
| `fastapi` | 0.141.1 `[VERIFIED: STACK.md / PyPI JSON API, 2026-09-11]` | The service's two-endpoint HTTP layer | Already pinned project-wide |
| `uvicorn[standard]` | latest at build time `[ASSUMED — not independently version-pinned in STACK.md; low risk, ASGI server has no version-sensitive API surface relevant here]` | ASGI server to run FastAPI | Standard FastAPI companion, not itself pinned by any locked decision |
| `neo4j:5-community` (Docker) | `5-community` floating tag → `5.26.30-community` `[VERIFIED: STACK.md / Docker Hub, 2026-09-11]` | Local graph DB container | Already pinned project-wide |

### Installation

```bash
# In the sibling repo, not this one (D-05: zero shared files)
pip install --no-cache-dir fastapi==0.141.1 "uvicorn[standard]" graphiti-core==0.30.2
```

## Package Legitimacy Audit

All three PyPI packages below were already version-verified directly against the PyPI JSON API in `.planning/research/STACK.md` (2026-09-11) as part of the project-wide stack research — carried forward here rather than re-run, since the ecosystem (`pip`/PyPI) and exact package names/versions are unchanged.

| Package | Registry | Source Repo | Verdict | Disposition |
|---------|----------|--------------|---------|-------------|
| `graphiti-core` | PyPI | github.com/getzep/graphiti | OK — official Zep/Neo4j-affiliated project, active development, matches STACK.md's prior verification | Approved |
| `neo4j` (driver) | PyPI | github.com/neo4j/neo4j-python-driver | OK — official Neo4j-maintained driver | Approved |
| `fastapi` | PyPI | github.com/fastapi/fastapi | OK — ubiquitous, official | Approved |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** none — all three are already-established, high-download, officially-sourced packages carried forward from prior project-wide verification, not newly discovered via this session's WebSearch.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Preference fact ingestion (`POST /episodes`) | Graphiti FastAPI service (separate Python process) | Neo4j (storage) | D-05 — zero shared files with the TS app; this is a standalone backend service |
| Preference fact read-back (`GET /preferences`) | Graphiti FastAPI service | Neo4j (storage, direct Cypher — bypasses Graphiti's own search layer per Q3) | Same isolation boundary; deterministic read-back is a service-internal implementation detail |
| Graph visualization / demo proof | Neo4j Browser (external tool, not built by this repo) | — | D-15 — `graph/queries.cypher` is paste-ready SQL/Cypher, not a rendered UI; STR-08's in-dashboard render is explicitly deferred |
| Preference consumption at proposal/conflict time | Backend / domain logic (`lib/agent/**`, this repo) | Graphiti FastAPI service (data source, via HTTP) | D-16 — additive-only call from the existing agent pipeline; the graph service never pushes into this repo, this repo pulls |
| Compose orchestration | Docker Compose (`graph` profile) | — | D-07 — already declared in Phase 1's compose skeleton, this phase activates and exercises it |

No capability crosses a tier boundary that D-05/D-16/D-19 don't already fix explicitly — this map exists mainly to confirm the "most isolated phase by design" framing holds up mechanically, not to catch drift.

## Architecture Patterns

### System Architecture Diagram

```
User A/B's distilled preference fact (hand-crafted curl / script — D-21 discretion)
        │  POST /episodes  { key: "default_meeting_duration", value: 45 }
        ▼
┌──────────────────────────────────────────────┐
│ FastAPI service (sibling repo, :8000)         │
│  1. Pydantic model validates key against the  │
│     closed vocabulary (422 if not one of 5)   │
│  2. await graphiti.add_episode(               │
│       source=EpisodeType.json,                │
│       episode_body=json.dumps({key: value}),  │
│       group_id=user_id)                       │
│     → LLM extraction call (Kilo Gateway) +      │
│       embedder call (Kilo Gateway) — writes     │
│       Episodic + Entity + MENTIONS/RELATES_TO │
└──────────────┬─────────────────────────────────┘
               │ Bolt driver write (pooled, D-08)
               ▼
        ┌─────────────┐
        │   Neo4j     │◄── Browser :7474, graph/queries.cypher pasted in (D-15)
        │  (Docker)   │
        └──────┬──────┘
               │ Bolt driver read (direct Cypher, Q3 — bypasses graphiti.search())
               ▼
┌──────────────────────────────────────────────┐
│ FastAPI service                               │
│  3. GET /preferences?user_id=                 │
│     MATCH (e:Episodic {group_id}) RETURN      │
│     e.content ORDER BY e.created_at           │
│     → merge JSON content dicts → return dict  │
└──────────────┬─────────────────────────────────┘
               │ HTTP GET, 2s timeout, fails closed (Q7)
               ▼
┌──────────────────────────────────────────────┐
│ This repo: lib/agent/graph-preferences.ts     │
│  fetchGraphPreferences(userId) → dict | null  │
│  merged additively into the existing          │
│  duration-resolution / CFL-02 preferences arg │
└──────────────┬─────────────────────────────────┘
               │
               ▼
   Same scheduling input, now-different proposal
   (visibly longer duration, or CFL-02 avoids an
    excluded day) — the STR-03 before/after moment
```

### Recommended Project Structure (sibling repo — separate git repo per D-05)

```
graph-service/                  # sibling repo, path from GRAPH_SERVICE_DIR
├── main.py                      # FastAPI app, lifespan, routes
├── graphiti_client.py            # OpenAIGenericClient/OpenAIEmbedder wiring, driver setup
├── preferences.py                 # closed-vocab Pydantic model, merge-on-read logic
├── requirements.txt
├── Dockerfile
└── .env.example                   # AI_API_KEY, GRAPHITI_LLM_MODEL, GRAPHITI_EMBEDDING_MODEL, NEO4J_*
```

### Anti-Patterns to Avoid

- **Relying on `graphiti.search()` or extracted `Entity` nodes for `GET /preferences`.** Search ranking/dedup is LLM- and embedder-quality-dependent; a demo whose literal success criterion (D-13) depends on that layer being "smart enough" is a demo that can fail non-deterministically during rehearsal. Read `Episodic.content` directly instead (Q3).
- **Constructing a new `Graphiti()`/driver per request.** Same class of mistake as this project's own Postgres/Prisma singleton rule — one instance in the FastAPI lifespan (Q5), closed on shutdown.
- **Blocking the demo on `add_triplet` "because it skips the LLM."** It doesn't skip the embedder, and D-11 already points at JSON episodes — don't spend clock time evaluating an alternative the locked decisions have effectively already ruled out.
- **Letting `lib/agent/**`'s graph-service call block or throw when the service is down.** D-16 requires the agent behave exactly as before if unset/unreachable — the `try/catch` + `AbortSignal.timeout` in Q7's code example is not optional polish, it's the requirement.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Preference key validation | A manual `if key not in [...]` chain scattered across handlers | One Pydantic `Literal[...]` field on the request model | FastAPI/Pydantic already reject invalid input with a 422 for free; this is also literally D-12's "rejected at the service boundary" |
| Neo4j connection pooling | A custom retry/backoff wrapper around driver calls | The Neo4j Python driver's own `max_connection_pool_size`/`connection_acquisition_timeout` kwargs (Q5) | This is exactly what the driver already does; D-08 asks for the driver's own knobs, not a hand-rolled layer on top |
| Health-check HTTP client in the Docker healthcheck | Installing `curl`/`wget` in the image just for the healthcheck | `python -c "import urllib.request; ..."` (Q8) — stdlib, already in the base image | Saves image layers and build time under the abandon clock; stdlib does it |
| Merging multiple preference facts into one dict | A bespoke reducer with manual key-conflict rules | Plain `dict.update()` in `created_at` order (Q3) | Later-write-wins is exactly what a Python dict merge does natively; no library needed |

**Key insight:** every hand-roll temptation in this phase is either already-solved by Pydantic/FastAPI/the driver, or actively dangerous under the time budget (retry/backoff logic, search-based read-back) — the ladder bottoms out at "use what's already there" for the whole service.

## Common Pitfalls

### Pitfall 1: Graphiti's default LLM/embedder clients point at OpenAI, silently, not Kilo Gateway
**What goes wrong:** `Graphiti(uri, user, password)` with no `llm_client`/`embedder` args constructs `OpenAIClient()`/`OpenAIEmbedder()`, both of which read `OPENAI_API_KEY` and hit `api.openai.com` by default `[VERIFIED: Q1 source fetch]`. If the sibling repo's `.env` only has `AI_API_KEY` set (matching this project's provider choice), `add_episode`'s first LLM call throws an auth error that looks like a Graphiti bug.
**Why it happens:** the constructor's optional-with-defaults shape makes "it just works with no config" the default behavior for OpenAI specifically, not for this project's actual provider.
**How to avoid:** always pass explicit `llm_client=OpenAIGenericClient(...)` and `embedder=OpenAIEmbedder(config=OpenAIEmbedderConfig(base_url=...))` (Q2) — never construct bare `Graphiti(uri, user, password)`.
**Warning signs:** an `AuthenticationError`/401 naming `api.openai.com` in the traceback despite `AI_API_KEY` being set correctly.

### Pitfall 2: `add_episode`'s LLM call may reject Graphiti's structured-output request shape on some Kilo-routed models
**What goes wrong:** `POST /episodes` 500s (or hangs) on the very first real call.
**Why it happens:** structured-output support is per-provider-endpoint on Kilo Gateway, not universal per model id — this project's own STACK.md already documents this exact landmine for the TS side's `MODEL_FAST`/`MODEL_SMART`.
**How to avoid:** pick `GRAPHITI_LLM_MODEL` from a model confirmed to support `structured_outputs` via `api.kilo.ai/api/gateway/models`, ideally reusing this project's already-verified `MODEL_FAST` id from tonight's pre-window checklist rather than picking a fresh one blind.
**Warning signs:** a 400/422 from Kilo Gateway mentioning `response_format` or an unsupported parameter, on the very first `add_episode` call.

### Pitfall 3: `GET /preferences` implemented via `graphiti.search()` returns nothing, or the wrong thing, on a near-empty graph
**What goes wrong:** search-based retrieval on a graph with one or two episodes can return empty results or rank unrelated nodes higher, because semantic search assumes a reasonably-populated graph.
**Why it happens:** `search()` is a similarity/ranking operation, not a lookup — it is the wrong tool for "return exactly the fact I just wrote," which is what D-13 literally requires.
**How to avoid:** direct Cypher on `Episodic.content` filtered by `group_id` (Q3) — a lookup, not a search.
**Warning signs:** `POST /episodes` returns 200 but the immediately-following `GET /preferences` returns an empty object.

### Pitfall 4: Compose `depends_on: neo4j: condition: service_healthy` doesn't guarantee Graphiti's own schema setup has run
**What goes wrong:** `graph-service` starts, Neo4j's healthcheck passes (port open, HTTP 200 on :7474), but `graphiti.build_indices_and_constraints()` inside the FastAPI lifespan hits a Neo4j that's technically up but still finishing internal startup, or the first `add_episode` races an index that hasn't finished building.
**Why it happens:** "port is listening" and "ready for the specific queries Graphiti issues" are different readiness definitions.
**How to avoid:** call `build_indices_and_constraints()` inside the FastAPI lifespan `startup` (Q5's code example already does this) so it runs once, synchronously, before the app accepts traffic — don't defer it to first-request.
**Warning signs:** the *first* `POST /episodes` after a fresh `docker compose up` fails or is unusually slow, but subsequent calls work fine.

## Code Examples

### `POST /episodes` handler (FastAPI + Pydantic closed vocabulary)

```python
# Source: pattern combines graphiti_core.graphiti.Graphiti.add_episode signature (Q1, verified
# via github.com/getzep/graphiti source fetch) with help.getzep.com's JSON-episode example (Q3)
import json
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Request
from graphiti_core.nodes import EpisodeType
from pydantic import BaseModel

router = APIRouter()

PreferenceKey = Literal[
    "working_hours", "default_meeting_duration",
    "buffer_between_meetings", "no_meeting_days", "preferred_slot_of_day",
]

class PreferenceEpisode(BaseModel):
    """A single distilled preference fact to ingest.

    @param user_id: Graphiti group_id partition (D-16 discretion: user_id === group_id)
    @param key: closed-vocabulary preference name (D-12) — Pydantic rejects anything else
    @param value: the fact's value, any JSON-serializable shape
    """
    user_id: str
    key: PreferenceKey
    value: str | int | list[str]

@router.post("/episodes")
async def post_episode(body: PreferenceEpisode, request: Request):
    """Ingests one distilled preference fact as a Graphiti JSON episode.
    @raises none — FastAPI/Pydantic reject invalid `key` with a 422 before this runs
    """
    graphiti = request.app.state.graphiti
    await graphiti.add_episode(
        name=f"preference-{body.key}-{body.user_id}",
        episode_body=json.dumps({body.key: body.value}),
        source=EpisodeType.json,
        source_description="distilled Slack preference fact",
        reference_time=datetime.now(timezone.utc),
        group_id=body.user_id,
    )
    return {"status": "ok"}
```

### `GET /preferences` handler (direct Cypher read-back, Q3)

```python
# Source: pattern derived from Episodic node property names (content, group_id, created_at)
# cross-checked across community sources this session (Q3) — not a single official code sample
import json
from fastapi import APIRouter, Request

router = APIRouter()

@router.get("/preferences")
async def get_preferences(user_id: str, request: Request):
    """Returns the merged closed-vocabulary preference dict for one user.
    @param user_id: Graphiti group_id partition
    @returns dict of preference key -> value, merged across all episodes (later wins)
    """
    graphiti = request.app.state.graphiti
    async with graphiti.driver.session() as session:  # driver exposed via graph_driver wrapper
        result = await session.run(
            "MATCH (e:Episodic {group_id: $user_id}) "
            "RETURN e.content AS content ORDER BY e.created_at ASC",
            user_id=user_id,
        )
        merged: dict = {}
        async for record in result:
            merged.update(json.loads(record["content"]))
        return merged
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `build_indices_and_constraints()` does not require APOC on self-managed Neo4j 5 community | Abandon Clock risk #4 | Medium — fixable in ~5 min by adding `NEO4J_PLUGINS: '["apoc"]'` to compose and restarting; costs clock but not the whole feature |
| A2 | `add_triplet`'s deduplication step calls the embedder for the newly-constructed node/edge, same as `add_episode` | Q1 | Low — worst case `add_triplet` is faster than expected; this phase's locked write path (D-11) doesn't use `add_triplet` anyway, so this assumption is informational only |
| A3 | `GRAPHITI_TELEMETRY_ENABLED=false` is the correct opt-out env var name for PostHog telemetry in `graphiti-core` | Q8 | Low — worst case telemetry stays on for a throwaway one-day demo service; no functional impact |
| A4 | `uvicorn[standard]` has no version-sensitive API surface relevant to this phase, so pinning is unnecessary | Standard Stack | Low — ASGI server behavior for two simple routes is not version-fragile |
| A5 | Neo4j `5-community`'s Debian-based image ships `wget`, supporting Phase 1's carried-forward healthcheck | Q4 | Low — if wrong, the Neo4j container's own healthcheck fails loudly at `docker compose up` (visible immediately, not a silent demo-time failure), trivially fixed by switching to the Python-based healthcheck pattern already used for `graph-service` |
| A6 | Structured-output support for the eventual `GRAPHITI_LLM_MODEL` id (not yet chosen) will match this project's already-verified `MODEL_FAST`/`MODEL_SMART` behavior if the same id is reused | Q2, Pitfall 2 | Medium — this is exactly why Abandon Clock risk #1's early-detection check exists: verify with one real call before building routes on top of the assumption |

**None of the above are load-bearing for D-13's core literal contract** (`POST` then `GET` returns the fact) — that path (Q3's direct Cypher read) is deliberately independent of A1, A2, A6. The assumptions cluster around the LLM/embedder side, which affects the Entity/edge graph visualization (D-15) and the CFL-02 stretch lever, not the phase's minimum success criterion.

## Open Questions (RESOLVED)

Both questions below are **RESOLVED for planning purposes**: neither is a research gap that more reading can close, and both are now carried in the plan as a named mitigation with an owning task. Neither blocks planning or execution. See the per-question `**RESOLVED:**` lines.

1. **Exact real-world first-start time for `docker compose --profile graph up` + `graph-service` image build on this specific WSL Ubuntu machine.**
   - What we know: Neo4j 5 community's official image has a documented startup sequence; `graphiti-core`'s dependency set installs cleanly with prebuilt wheels (Q8).
   - What's unclear: the actual wall-clock number on tomorrow's specific laptop/network.
   - Recommendation: treat Abandon Clock risk #3's "start the build first, write code in parallel" as the mitigation — don't try to measure this in advance, absorb it into D-02's 20–30 minute sub-budget by starting the clock-eating step immediately.
   - **RESOLVED:** unmeasurable in advance by construction (it is a property of tomorrow's laptop and network, not of any document), so it is carried as a mitigation, not a gap. Owned by `09-01-PLAN.md` Task 1, whose first action starts the compose pull/build before any code is written, inside D-02's 20–30 minute sub-budget and under D-03's abandon clock. Same disposition as an Assumptions Log row: the cost of being wrong is clock, and D-03 bounds it.

2. **Whether `graphiti-core@0.30.2`'s `build_indices_and_constraints()` throws on missing APOC, or silently no-ops for the index types it needs.**
   - What we know: no official statement found either way this session.
   - What's unclear: behavior on a fresh, plugin-less `neo4j:5-community` container.
   - Recommendation: the FastAPI lifespan's `await graphiti.build_indices_and_constraints()` call (Q5) will surface this immediately and loudly at service startup, before any `POST /episodes` is attempted — this is effectively self-answering within the first minute of running the service, not something to pre-resolve via more research.
   - **RESOLVED:** no official statement exists either way (searched this session), so the question is answered by running the code, not by more research — and it answers itself in the first minute, loudly, at service startup. Carried as Assumptions Log row A1 with a bounded, pre-decided fix: `09-01-PLAN.md` Task 1's fallback list adds `NEO4J_PLUGINS: '["apoc"]'` to the compose `neo4j` block and restarts (~5 minutes) if `build_indices_and_constraints()` raises a "procedure not found" error. Not a blocker: worst case is clock, bounded by D-03.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker + Compose v2 | Neo4j + graph-service containers | Not probed this session (no Docker in this research sandbox) — PITFALLS.md/pre-window checklist is authoritative | — | Phase 1's "Do Tonight" checklist already covers this project-wide; not re-probed per phase |
| `uv` (optional) | Faster Python dependency install | Not confirmed pre-installed per PROJECT.md's "Pre-setup confirmed" list | — | `pip install` (Q8's recommended default) |
| Kilo Gateway embeddings endpoint reachability | `GET /preferences`'s upstream write path (embedder calls) | Not independently probed against this project's actual `AI_API_KEY` this session | — | none — if Kilo Gateway embeddings are unreachable, this is a genuine blocker for the Entity/edge graph (D-15) though not for D-13's literal round-trip (Q3's Cypher read-back doesn't need the embedder to have succeeded on read, only that `add_episode` didn't hard-fail on it) |

**Missing dependencies with no fallback:** Kilo Gateway embeddings reachability — verify with Abandon Clock risk #1/#2's early-detection script before building anything else.
**Missing dependencies with fallback:** `uv` → `pip`, already the recommended default.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No end-user auth surface in this two-endpoint internal service; it is reached only from this repo's own backend, never exposed publicly |
| V3 Session Management | No | Stateless HTTP calls, no sessions |
| V4 Access Control | No | Single-tenant, two-demo-user, localhost-only service for a one-day build; `user_id` is a plain query/body param with no authz check — acceptable given D-07/D-09's "local Docker, no public exposure" framing, but worth a one-line README "known shortcut" note (no access control on `/preferences`, anyone who can reach `:8000` can read any `user_id`'s preferences) |
| V5 Input Validation | Yes | Pydantic `Literal[...]` closed-vocabulary field on `POST /episodes` (D-12) — the only external input this service accepts beyond `user_id` |
| V6 Cryptography | Partial | `NEO4J_PASSWORD` and `AI_API_KEY` come from env only (D-09), never hardcoded; no other secrets/PII beyond the preference facts themselves, which are non-sensitive scheduling metadata (working hours, meeting duration) rather than credentials or personal data requiring encryption-at-rest for a throwaway demo graph |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Cypher injection via unsanitized `user_id` in the direct-read query (Q3) | Tampering | Use the Neo4j driver's parameterized query form (`session.run(query, user_id=user_id)`, as shown in the Code Examples — never string-interpolate `user_id` into the Cypher text) |
| Secret leakage via committed `.env` in the sibling repo | Information Disclosure | Same project-wide rule as this repo: `.env` untracked, `.env.example` committed with no real values |
| Unbounded `GRAPH_SERVICE_URL` fetch blocking the agent pipeline if the service hangs (not just errors) | Denial of Service (self-inflicted) | The `AbortSignal.timeout(2000)` in Q7's `lib/agent/**` code example — this is the actual mitigation, not optional |

## Sources

### Primary (HIGH confidence)
- `github.com/getzep/graphiti/blob/main/graphiti_core/graphiti.py` (raw GitHub source, fetched this session) — `Graphiti.__init__`, `add_episode`, `add_triplet`, `build_indices_and_constraints`, `close`, `search` signatures quoted verbatim; default client classes (`OpenAIClient`, `OpenAIEmbedder`, `OpenAIRerankerClient`)
- `.planning/research/STACK.md` (this project's own prior-verified PyPI/npm version pins, 2026-09-11) — `graphiti-core` 0.30.2, `neo4j` driver 6.3.0, `fastapi` 0.141.1, `neo4j:5-community` image tag
- `.planning/phases/01-foundation-hardcoded-round-trip/01-RESEARCH.md` — docker-compose.yml skeleton (postgres/neo4j/graph-service), Neo4j memory env var names (Assumption A1, corroborated this session)

### Secondary (MEDIUM confidence)
- `help.getzep.com/graphiti/configuration/llm-configuration` (official Zep docs, fetched this session) — `OpenAIGenericClient`/`OpenAIEmbedder` custom-`base_url` configuration pattern
- `help.getzep.com/graphiti/core-concepts/adding-episodes` (official Zep docs, fetched this session) — JSON episode code example
- `help.getzep.com/graphiti/graphiti/adding-fact-triples` (official Zep docs, fetched this session) — `add_triplet` code example and dedup behavior
- `openrouter.ai/docs/api_reference/embeddings` (official OpenRouter docs, surfaced via WebSearch this session) — OpenAI-compatible `/api/v1/embeddings` endpoint confirmation

### Tertiary (LOW confidence)
- Community DeepWiki summaries (`deepwiki.com/getzep/graphiti/...`) and Medium/Substack write-ups on ingestion latency, `OpenAIGenericClient` vs `OpenAIClient` behavior for custom endpoints, and Episodic node property names — cross-checked against at least one official-docs anchor point each where possible, but not independently executed against this project's real environment this session

## Orchestrator Review Corrections (override the sections above where they conflict)

These were checked against raw `getzep/graphiti` `main` source (`graphiti_core/driver/neo4j_driver.py`, `graphiti_core/graphiti.py`) after the researcher returned. **The planner must use these, not the conflicting text above.**

1. **Q5 is wrong: `Neo4jDriver` does NOT accept a pre-built driver.** `[VERIFIED: neo4j_driver.py]`
   - The real signature is `Neo4jDriver(uri, user, password, database='neo4j')`. It builds its own client with `self.client = AsyncGraphDatabase.driver(uri=uri, auth=(user or '', password or ''))` and exposes no pool kwargs.
   - `Neo4jDriver(driver=async_driver)` raises `TypeError`.
   - **Recommended pattern for D-08's pool settings:** inside the lifespan:
     1. Construct `graph_driver = Neo4jDriver(uri, user, password)`.
     2. Synchronously, with no `await` in between, swap `graph_driver.client` for `AsyncGraphDatabase.driver(uri, auth=(user, password), max_connection_pool_size=…, connection_acquisition_timeout=…)`.
     3. `await` close the discarded client.
     4. Pass `graph_driver=graph_driver` to `Graphiti(...)`.

     Alternatively, subclass `Neo4jDriver`. If either takes more than about 5 minutes, accept the driver defaults and log it as a known shortcut.
   - `Neo4jDriver.__init__` already schedules `build_indices_and_constraints()` as a task when an event loop is running, which is the case in the FastAPI lifespan. An explicit `await graphiti.build_indices_and_constraints()` is redundant but harmless. Keep it, so that failures such as missing APOC surface at startup.
2. **Q2/Pitfall 1 missed the cross-encoder.** `[VERIFIED: graphiti.py]`
   - `Graphiti.__init__` defaults `self.cross_encoder = OpenAIRerankerClient()` when none is passed, just as it does for the LLM and embedder.
   - With only `AI_API_KEY` set, constructing that default `AsyncOpenAI` client is expected to raise at startup because there is no `OPENAI_API_KEY` `[ASSUMED: openai SDK behavior, HIGH likelihood]`.
   - **Pass `cross_encoder=` explicitly too**, e.g. `OpenAIRerankerClient(config=LLMConfig(api_key=<Kilo Gateway key>, base_url=<Kilo Gateway base>, model=<GRAPHITI_LLM_MODEL>))`. The service never calls `search()`, so only construction has to succeed.
3. **`GET /preferences` read-back:** `graphiti.driver.session()` does return the raw neo4j `AsyncSession`, so the code example works. The simpler form is `await graphiti.driver.execute_query(QUERY, params={"user_id": user_id})` and then iterating `result.records`. Both are parameterized, and neither interpolates into the Cypher string.
4. **`/health` vs D-06 ("exactly two endpoints"):**
   - Q8's `/health` route contradicts locked D-06.
   - The lazy fix is to drop `/health` and gate on `GET /preferences?user_id=…` itself, as Q7's `fetchGraphPreferences` already does with its 2s timeout.
   - The compose healthcheck for `graph-service` can hit that same route using the Python `urllib` one-liner. Only `neo4j` needs to be healthy for `depends_on`, and nothing in compose depends on `graph-service`.
5. **D-17 (Postgres `Preference` write-back):** Q7 recommends skipping write-back and reading `GET /preferences` directly at proposal time. That is a deliberate simplification of D-17. The plan should state it explicitly, not silently. Nothing in STR-01..03 requires the Postgres hop.

## Metadata

**Confidence breakdown:**
- Graphiti Python API surface (signatures, defaults): HIGH — verified against the library's own GitHub source this session
- LLM/embedder Kilo Gateway compatibility: MEDIUM — documented pattern confirmed, but not executed against this project's actual `AI_API_KEY`/chosen model id; Abandon Clock risk #1 exists precisely to close this gap live, fast
- Neo4j docker/compose specifics: MEDIUM-HIGH — reuses Phase 1's already-researched compose skeleton, corroborated (not contradicted) by this session's fresh search
- Deterministic read-back design (Q3): HIGH confidence in the *design decision* (direct Cypher over `Episodic.content`, bypassing `search()`) — this is this research's own synthesis from confirmed property names, not a claim that any official doc recommends this exact pattern, but it is the pattern that best satisfies D-13's literal wording given confirmed Graphiti internals
- APOC requirement: LOW — no observation found either way; treated as a live-fixable risk, not resolved

**Research date:** 2026-09-11
**Valid until:** This build window only (Sat 12 Sep 2026) — a one-day hackathon build. If reused beyond tomorrow, re-verify `graphiti-core`'s API surface against whatever version is current then; this library is pre-1.0 and moves fast per STACK.md's own note.
