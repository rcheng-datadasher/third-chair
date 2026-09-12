import { getProposalRows } from "@/lib/dashboard/queries";

/**
 * Parameterless poll endpoint for the proposal queue.
 *
 * @returns The current `ProposalRow[]` as JSON.
 */
export async function GET() {
  return Response.json(await getProposalRows());
}
