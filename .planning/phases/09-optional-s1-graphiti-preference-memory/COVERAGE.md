# API Coverage — graphiti-core 0.30.2 (Python), used by the Phase 9 graph service

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Surface sourced from `09-RESEARCH.md` §Q1 (verified `graphiti_core/graphiti.py`) and §"Orchestrator Review Corrections" (verified `graphiti_core/driver/neo4j_driver.py`). The service lives in the sibling repo `${GRAPH_SERVICE_DIR:-../graph-service}`. Plans: 09-01 (service), 09-02 (app-side consumer).

| capability | decision | reason |
|---|---|---|
| Graphiti constructor with explicit llm_client, embedder, cross_encoder | INTEGRATE | 09-01 T1 probe.py and T2 lifespan; all three pointed at Kilo Gateway via env |
| graph_driver constructor kwarg | INTEGRATE | 09-01 T2/T3 lifespan passes one Neo4jDriver whose client carries the D-08 pool settings |
| store_raw_episode_content (default True) | INTEGRATE | GET /preferences reads Episodic.content; the default must stay True |
| add_episode | INTEGRATE | 09-01 T2 POST /episodes, awaited inline, group_id = user_id |
| EpisodeType.json | INTEGRATE | D-11 distilled JSON preference facts |
| build_indices_and_constraints | INTEGRATE | awaited in the lifespan so index or APOC failures surface at startup |
| close | INTEGRATE | lifespan shutdown closes the single driver (D-08) |
| driver.execute_query | INTEGRATE | 09-01 T2 parameterized Cypher read-back of Episodic.content, filtered by group_id |
| Neo4jDriver | INTEGRATE | constructed once per process; its client attribute is swapped for the tuned AsyncGraphDatabase driver |
| OpenAIGenericClient | INTEGRATE | LLM extraction through Kilo Gateway's OpenAI-compatible chat endpoint |
| OpenAIEmbedder | INTEGRATE | embeddings through Kilo Gateway's OpenAI-compatible embeddings endpoint |
| OpenAIRerankerClient | INTEGRATE | constructed explicitly so the default OpenAI-keyed reranker never initializes; search is never called |
| add_triplet | OPT-OUT | D-11 locks JSON episodes; it still needs the embedder, so it removes no failure surface under the abandon clock |
| search | OPT-OUT | similarity ranking is not a lookup and misbehaves on a near-empty graph; D-13 needs the deterministic Cypher read-back |
| add_episode_bulk | OPT-OUT | one fact per POST; bulk distillation is the SCL-01 batch sweep, deferred to v2 |
| remove_episode | OPT-OUT | not needed for the demo; the rehearsal reset is one parameterized DETACH DELETE in graph/queries.cypher |
| build_communities | OPT-OUT | community summaries are unused by a five-key preference read |
| update_communities | OPT-OUT | add_episode keeps update_communities at its default False for the same reason |
| retrieve_episodes | OPT-OUT | read-back is a direct Cypher query on Episodic nodes filtered by group_id |
| get_nodes_and_edges_by_episode | OPT-OUT | graph inspection happens in Neo4j Browser via graph/queries.cypher (D-15) |
| EpisodeType.message and EpisodeType.text | OPT-OUT | D-11: distilled JSON facts only, never raw Slack prose |
| custom entity_types, excluded_entity_types, edge_types, edge_type_map | OPT-OUT | extraction quality is not on the read path; five closed-vocabulary keys need no custom ontology |
| custom_extraction_instructions | OPT-OUT | read-back bypasses extraction, so tuning it buys nothing for D-13 |
| saga and previous_episode_uuids sequencing | OPT-OUT | preference facts are independent; later-wins merge happens in the read-back |
| OpenAIClient (non-generic LLM client) | OPT-OUT | does not reliably honour a custom base_url for Kilo Gateway (RESEARCH Q2) |
| FalkorDB driver | OPT-OUT | D-07: Neo4j 5 community is primary; FalkorDB only as a low-RAM fallback after verifying add_triplet (#1001) |
| tracer and trace_span_prefix | OPT-OUT | no tracing backend in a one-day local demo |
| max_coroutines | OPT-OUT | default concurrency is fine at one episode per request |
| GET /graph in-dashboard render (STR-08) | OPT-OUT | explicitly deferred to v2 in 09-CONTEXT Deferred Ideas; D-06 allows exactly two endpoints |
