"use client";

import { useQuery } from "@tanstack/react-query";
import type { GraphNode, GraphSnapshot } from "@/lib/graph/read-graph";

/** Node-label → chart token. Unknown labels fall back to chart-5. */
const LABEL_CLASS: Record<string, string> = {
  User: "fill-primary",
  Episodic: "fill-chart-1",
  Entity: "fill-chart-2",
  Community: "fill-chart-3",
};

const SIZE = 640;
const INNER = 90;
const OUTER = 270;

/**
 * Fetches the graph snapshot from the poll endpoint.
 *
 * @returns The current nodes and edges.
 * @throws When the endpoint responds with a non-2xx status.
 */
async function fetchGraph(): Promise<GraphSnapshot> {
  const res = await fetch("/api/graph");
  if (!res.ok) throw new Error(`graph ${res.status}`);
  return res.json();
}

/**
 * Places `n` nodes evenly on a circle of radius `r`, starting at 12 o'clock.
 * ponytail: ring layout, swap for a force layout if node count outgrows it.
 *
 * @param n - Node count.
 * @param r - Ring radius.
 * @returns One `{x, y}` per node, centred in a `SIZE`×`SIZE` box.
 */
function ring(n: number, r: number): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2;
    return {
      x: SIZE / 2 + r * Math.cos(a),
      y: SIZE / 2 + r * Math.sin(a),
    };
  });
}

/**
 * Positions every node: users on an inner ring (dead centre when there is
 * one), everything else on the outer ring.
 *
 * @param nodes - All nodes in the snapshot.
 * @returns Node id → position.
 */
function layout(nodes: GraphNode[]): Map<string, { x: number; y: number }> {
  const users = nodes.filter((n) => n.label === "User");
  const rest = nodes.filter((n) => n.label !== "User");
  const inner = ring(users.length, users.length === 1 ? 0 : INNER);
  const outer = ring(rest.length, OUTER);
  return new Map([
    ...users.map((n, i) => [n.id, inner[i]] as const),
    ...rest.map((n, i) => [n.id, outer[i]] as const),
  ]);
}

/**
 * Inline-SVG view of the Graphiti graph, polled every 4 s so a preference
 * posted in Slack appears without a reload. Edges as lines with their
 * type, nodes as discs coloured by label, names beneath.
 *
 * @param props - View props.
 * @param props.initialData - Server-rendered snapshot for the first paint.
 * @returns The SVG, or a placeholder when the graph is empty.
 */
export function GraphView({ initialData }: { initialData: GraphSnapshot }) {
  const { data: graph, isError } = useQuery({
    queryKey: ["graph"],
    queryFn: fetchGraph,
    initialData,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });
  if (graph.nodes.length === 0) {
    return (
      <p className="font-mono text-sm text-muted-foreground">
        No nodes yet — post a preference in the watched Slack channel.
      </p>
    );
  }
  const pos = layout(graph.nodes);
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {graph.nodes.length} nodes · {graph.edges.length} edges ·{" "}
        {isError ? "poll failed" : "live, 4s"}
      </p>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="max-h-[80vh] w-full max-w-3xl"
        role="img"
        aria-label={`${graph.nodes.length} nodes, ${graph.edges.length} edges`}
      >
        {graph.edges.map((e) => {
          const a = pos.get(e.source);
          const b = pos.get(e.target);
          if (!a || !b) return null;
          return (
            <g
              key={`${e.source}-${e.type}-${e.target}`}
              className="stroke-border"
            >
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={1.5} />
              <text
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2}
                className="fill-muted-foreground stroke-none font-mono text-[9px] uppercase"
                textAnchor="middle"
              >
                {e.type}
              </text>
            </g>
          );
        })}
        {graph.nodes.map((n) => {
          const p = pos.get(n.id);
          if (!p) return null;
          return (
            <g key={n.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={n.label === "User" ? 18 : 12}
                className={`${LABEL_CLASS[n.label] ?? "fill-chart-5"} stroke-foreground`}
                strokeWidth={1.5}
              >
                <title>{`${n.label}: ${n.name}`}</title>
              </circle>
              <text
                x={p.x}
                y={p.y + 26}
                className="fill-foreground font-mono text-[10px]"
                textAnchor="middle"
              >
                {n.name.length > 30 ? `${n.name.slice(0, 28)}…` : n.name}
              </text>
              {n.detail && (
                <text
                  x={p.x}
                  y={p.y + 38}
                  className="fill-muted-foreground font-mono text-[8px]"
                  textAnchor="middle"
                >
                  {n.detail}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
