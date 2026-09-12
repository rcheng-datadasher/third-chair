// graph/queries.cypher
//
// Paste-ready Neo4j Browser demo queries for Phase 9 (S1 — Graphiti
// preference memory). Run query 0 (the :param line) first, then queries in
// order. Query 3a (or 3b) is the SAME query run before and after ingesting a
// preference fact — that identical-query pair is the before/after proof
// (D-15). Browser runs one statement at a time; each query below is its own
// block.
//
// Per 09-01's SUMMARY, only `Episodic` nodes appeared after ingestion (no
// `Entity` nodes were extracted for a numeric/short-string preference
// value) — use query 3a for the demo. Query 3b is included for the case
// entity extraction does produce edges on a richer fact.

// 0. Parameter line — run this first. Replace with demo user A's real Slack
// id at demo time; never commit a real id here.
// (Browser 5 also accepts the map form: :param {user_id: '...'})
:param user_id => 'REPLACE_WITH_DEMO_USER_A_SLACK_ID';

// 1. What Graphiti actually wrote — run once after the first ingest.
CALL db.labels();
CALL db.relationshipTypes();

// 2. The whole small graph, rendered on the canvas.
MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100;

// 3a. THE BEFORE/AFTER QUERY (node-only, always shows the change even when
// only Episodic nodes exist — use this one for the demo per 09-01's
// SUMMARY).
MATCH (n {group_id: $user_id}) RETURN n;

// 3b. Richer before/after variant, with edges. Returns zero rows in both
// before and after states if entity extraction produced no edges for this
// fact — only use 3b instead of 3a if a later 09-01/09-02 run's SUMMARY
// recorded an `Entity` node beside `Episodic`.
MATCH (n {group_id: $user_id})-[r]->(m) RETURN n, r, m;

// 4. Schema overview.
CALL db.schema.visualization();

// 5. Deterministic read-back mirroring the service's own GET /preferences
// logic (Episodic.content, ordered by created_at ascending — later facts
// win on merge).
MATCH (e:Episodic {group_id: $user_id})
RETURN e.content AS content, e.created_at AS created_at
ORDER BY e.created_at ASC;

// 6. DESTRUCTIVE — per-user rehearsal reset. Scoped by $user_id only; never
// deletes the whole graph. Use this to restore an empty "before" state if a
// rehearsal run has already polluted the partition.
MATCH (n {group_id: $user_id}) DETACH DELETE n;
