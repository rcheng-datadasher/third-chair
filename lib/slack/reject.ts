import { prisma } from "@/lib/db";
import { updateProposalCard } from "@/lib/slack/update-proposal-card";

/**
 * The outcome of one `rejectProposal` call. Every member is a UI state, not
 * an error — callers render feedback from this union, never a thrown
 * exception (mirrors `ApproveOutcome`).
 */
export type RejectOutcome = "dismissed" | "not_found" | "not_pending";

/**
 * Rejects a Proposal on behalf of a Slack user. Plain backend code with no
 * Bolt import, so the Slack button handler and the dashboard route share it.
 *
 * Conditionally marks the row dismissed (only from `pending`, so a double
 * click or a race with Approve is a no-op) and updates the card in place
 * using the channel/ts stored on the Proposal row (never identifiers
 * carried in a click payload, which can drift — D-11).
 *
 * @param proposalId - The Proposal id to reject.
 * @param clickerSlackUserId - The Slack user id shown as the decider on the
 *   dismissed card. Ephemeral — never persisted.
 * @returns The outcome; `dismissed` is the only branch that writes.
 * @throws When the Slack card update fails after the row was transitioned.
 */
export async function rejectProposal(
  proposalId: string,
  clickerSlackUserId: string,
): Promise<RejectOutcome> {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
  });
  if (!proposal) return "not_found";

  const { count } = await prisma.proposal.updateMany({
    where: { id: proposalId, status: "pending" },
    data: { status: "dismissed" },
  });
  if (count === 0) {
    console.log(
      `already decided proposal_id=${proposalId} status=${proposal.status}`,
    );
    return "not_pending";
  }

  console.log(`proposal rejected proposal_id=${proposalId} status=dismissed`);
  // Spread the pre-update row with its NEW status — passing the row as read
  // (still `pending`) would re-render the approval card with buttons intact.
  await updateProposalCard(proposal.card_channel, proposal.card_ts, {
    ...proposal,
    status: "dismissed",
    decidedByUserId: clickerSlackUserId,
    decidedAt: new Date(),
  });
  return "dismissed";
}
