import { z } from "zod";
import { config } from "@/lib/config";
import { resolveProfile } from "@/lib/slack/resolve-profile";

/** One node of the Graphiti graph as rendered by the dashboard; `detail` is an optional second line (a user's nickname and id). */
export type GraphNode = {
  id: string;
  label: string;
  name: string;
  detail?: string;
};

/** One directed edge of the Graphiti graph. */
export type GraphEdge = { source: string; target: string; type: string };

/** Nodes plus edges, ready for the SVG view. */
export type GraphSnapshot = { nodes: GraphNode[]; edges: GraphEdge[] };

/** Shape of one Neo4j Query API v2 response we care about: 3-string rows. */
const QueryResponse = z.object({
  data: z.object({ values: z.array(z.array(z.string().nullable())) }),
});

/** Cypher: every episode as [id, group_id (Slack user), content JSON]. */
const EPISODES = `MATCH (e:Episodic) RETURN elementId(e), e.group_id, e.content
  ORDER BY e.created_at LIMIT 200`;

/** Cypher: every non-episode node as [id, first label, name]. */
const OTHER_NODES = `MATCH (n) WHERE NOT n:Episodic
  RETURN elementId(n), labels(n)[0], coalesce(n.name, '') LIMIT 200`;

/** Cypher: every relationship as [source id, type, target id]. */
const EDGES = `MATCH (a)-[r]->(b) RETURN elementId(a), type(r), elementId(b) LIMIT 400`;

/**
 * Runs one Cypher statement through Neo4j's HTTP Query API (v2), so the
 * dashboard needs no bolt driver. The HTTP host is derived from
 * `NEO4J_URI`; the Query API always listens on :7474.
 *
 * @param statement - A read-only Cypher statement returning three columns.
 * @returns The raw `[string, string, string]` rows (nulls become "").
 * @throws If `NEO4J_URI` is unset or Neo4j answers with a non-2xx status.
 */
async function runCypher(statement: string): Promise<string[][]> {
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
  return QueryResponse.parse(await res.json()).data.values.map((row) =>
    row.map((v) => v ?? ""),
  );
}

/**
 * Renders an episode's JSON body (`{"key": value}`) as `key = value`; falls
 * back to the first 40 characters when it isn't the distilled-fact shape.
 *
 * @param content - The episode's `content` property.
 * @returns A one-line display name.
 */
function factName(content: string): string {
  try {
    const [key, value] = Object.entries(JSON.parse(content))[0] ?? [];
    if (typeof key === "string") {
      return `${key} = ${Array.isArray(value) ? value.join(", ") : String(value)}`;
    }
  } catch {
    // not JSON — fall through to the raw prefix
  }
  return content.slice(0, 40);
}

/**
 * Reads the whole Graphiti graph for the dashboard's graph view. Each Slack
 * user (Graphiti `group_id`) becomes a hub node — named from their Slack
 * profile (full name, with nickname and id as the detail line) when the id
 * resolves, else the raw id — with a `STATED` edge to every preference
 * episode they own, so the preference memory reads as a graph even before
 * Graphiti has extracted entities from the facts; any real Entity/Community
 * nodes and relationships are drawn as well.
 *
 * @returns Nodes and edges; both empty when Neo4j holds nothing yet.
 * @throws Propagates {@link runCypher} failures.
 */
export async function readGraph(): Promise<GraphSnapshot> {
  const [episodes, others, rels] = await Promise.all([
    runCypher(EPISODES),
    runCypher(OTHER_NODES),
    runCypher(EDGES),
  ]);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const userIds = [...new Set(episodes.map(([, userId]) => userId))];
  const profiles = await Promise.all(userIds.map(resolveProfile));
  userIds.forEach((userId, i) => {
    const p = profiles[i];
    nodes.push({
      id: `user:${userId}`,
      label: "User",
      name: p?.name ?? userId,
      detail: p
        ? [p.nickname && `@${p.nickname}`, userId].filter(Boolean).join(" · ")
        : undefined,
    });
  });
  for (const [id, userId, content] of episodes) {
    nodes.push({ id, label: "Episodic", name: factName(content) });
    edges.push({ source: `user:${userId}`, target: id, type: "STATED" });
  }
  for (const [id, label, name] of others) {
    nodes.push({ id, label: label || "Node", name });
  }
  for (const [source, type, target] of rels) {
    edges.push({ source, target, type });
  }
  return { nodes, edges };
}
