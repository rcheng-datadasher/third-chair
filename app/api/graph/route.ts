import { readGraph } from "@/lib/graph/read-graph";

/**
 * Parameterless poll endpoint for the graph view.
 *
 * @returns The current `GraphSnapshot` as JSON.
 */
export async function GET() {
  return Response.json(await readGraph());
}
