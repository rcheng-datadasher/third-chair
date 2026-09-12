import { getDecisionRows } from "@/lib/dashboard/queries";

/**
 * Parameterless poll endpoint for the Decision log.
 *
 * @returns The current `DecisionRow[]` as JSON.
 */
export async function GET() {
  return Response.json(await getDecisionRows());
}
