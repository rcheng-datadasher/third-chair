import type { Metadata } from "next";
import { connection } from "next/server";
import { GraphView } from "@/components/graph-view";
import { readGraph } from "@/lib/graph/read-graph";

export const metadata: Metadata = { title: "Graph" };

/**
 * Preference-memory graph scene: the live Graphiti/Neo4j graph, read fresh
 * on every request so a before/after demo shows the new node on reload.
 *
 * @returns The graph page.
 */
export default async function GraphPage() {
  await connection();
  const graph = await readGraph();
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-col gap-1 border-b px-4 py-5 md:px-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Preference memory
        </h1>
        <p className="max-w-prose text-base text-muted-foreground">
          What Graphiti has learned, straight from Neo4j. {graph.nodes.length}{" "}
          nodes, {graph.edges.length} edges. Updates live as preferences are
          learned from Slack.
        </p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-6 md:px-6">
        <GraphView initialData={graph} />
      </div>
    </main>
  );
}
