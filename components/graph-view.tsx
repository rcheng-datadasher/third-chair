import type { GraphSnapshot } from "@/lib/graph/read-graph";

/** Node-label → chart token. Unknown labels fall back to chart-5. */
const LABEL_CLASS: Record<string, string> = {
  Episodic: "fill-chart-1",
  Entity: "fill-chart-2",
  Community: "fill-chart-3",
};

const SIZE = 640;
const RADIUS = 260;

/**
 * Places nodes evenly on a circle. Deterministic and dependency-free; fine up
 * to a few dozen nodes, which is all a demo graph holds.
 * ponytail: circle layout, swap for a force layout if node count outgrows it.
 *
 * @param n - Node count.
 * @returns One `{x, y}` per node, centred in a `SIZE`×`SIZE` box.
 */
function circle(n: number): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2;
    return {
      x: SIZE / 2 + RADIUS * Math.cos(a),
      y: SIZE / 2 + RADIUS * Math.sin(a),
    };
  });
}

/**
 * Inline-SVG view of the Graphiti graph: edges as lines with their type,
 * nodes as discs coloured by label, names beneath.
 *
 * @param props - View props.
 * @param props.graph - The snapshot from {@link readGraph}.
 * @returns The SVG, or a placeholder when the graph is empty.
 */
export function GraphView({ graph }: { graph: GraphSnapshot }) {
  if (graph.nodes.length === 0) {
    return (
      <p className="font-mono text-sm text-muted-foreground">
        No nodes yet — POST an episode to the graph service.
      </p>
    );
  }
  const pos = new Map(
    circle(graph.nodes.length).map((p, i) => [graph.nodes[i].id, p]),
  );
  return (
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
          <g key={`${e.source}-${e.type}-${e.target}`} className="stroke-border">
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
              r={14}
              className={`${LABEL_CLASS[n.label] ?? "fill-chart-5"} stroke-foreground`}
              strokeWidth={1.5}
            >
              <title>{`${n.label}: ${n.name}`}</title>
            </circle>
            <text
              x={p.x}
              y={p.y + 28}
              className="fill-foreground font-mono text-[10px]"
              textAnchor="middle"
            >
              {n.name.length > 24 ? `${n.name.slice(0, 22)}…` : n.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
