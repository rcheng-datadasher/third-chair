import { z } from "zod";
import { config } from "@/lib/config";

/** One node of the Graphiti graph as rendered by the dashboard. */
export type GraphNode = { id: string; label: string; name: string };

/** One directed edge of the Graphiti graph. */
export type GraphEdge = { source: string; target: string; type: string };

/** Nodes plus edges, ready for the SVG view. */
export type GraphSnapshot = { nodes: GraphNode[]; edges: GraphEdge[] };

/** Shape of one Neo4j Query API v2 response we care about. */
const QueryResponse = z.object({
  data: z.object({
    values: z.array(z.tuple([z.string(), z.array(z.string()), z.string()])),
  }),
});

/** Cypher: every node with its first label and a display name. */
const NODES = `MATCH (n) RETURN elementId(n), labels(n),
  coalesce(n.name, n.key, left(n.content, 40), '') LIMIT 200`;

/** Cypher: every relationship as source id, [type], target id (tuple-shaped like NODES). */
const EDGES = `MATCH (a)-[r]->(b) RETURN elementId(a), [type(r)], elementId(b) LIMIT 400`;

/**
 * Runs one Cypher statement through Neo4j's HTTP Query API (v2), so the
 * dashboard needs no bolt driver. The HTTP host is derived from
 * `NEO4J_URI`; the Query API always listens on :7474.
 *
 * @param statement - A read-only Cypher statement returning three columns.
 * @returns The raw `[string, string[], string]` rows.
 * @throws If `NEO4J_URI` is unset or Neo4j answers with a non-2xx status.
 */
async function runCypher(
  statement: string,
): Promise<[string, string[], string][]> {
  const { neo4jUri, neo4jUser, neo4jPassword } = config.graph;
  if (!neo4jUri) throw new Error("NEO4J_URI is not set");
  const url = `http://${new URL(neo4jUri).hostname}:7474/db/neo4j/query/v2`;
  const auth = btoa(`${neo4jUser ?? "neo4j"}:${neo4jPassword ?? ""}`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({ statement }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Neo4j query failed: ${res.status}`);
  return QueryResponse.parse(await res.json()).data.values;
}

/**
 * Reads the whole Graphiti graph (bounded to 200 nodes / 400 edges) for the
 * dashboard's graph view.
 *
 * @returns Nodes and edges; both empty when Neo4j holds nothing yet.
 * @throws Propagates {@link runCypher} failures.
 */
export async function readGraph(): Promise<GraphSnapshot> {
  const [nodeRows, edgeRows] = await Promise.all([
    runCypher(NODES),
    runCypher(EDGES),
  ]);
  return {
    nodes: nodeRows.map(([id, labels, name]) => ({
      id,
      label: labels[0] ?? "Node",
      name,
    })),
    edges: edgeRows.map(([source, [type], target]) => ({
      source,
      target,
      type: type ?? "",
    })),
  };
}
