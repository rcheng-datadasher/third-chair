import type {
  AllMiddlewareArgs,
  BlockButtonAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";
import { prisma } from "../../db";
import { updateProposalCard } from "../update-proposal-card";

/**
 * Handles the "Approve" button click on a Proposal card: acknowledges
 * immediately, resolves the proposal from the button's own value, marks it
 * confirmed, and updates the card in place using the channel/ts stored on
 * the Proposal row (never the identifiers carried in the click payload,
 * which can drift — D-02).
 *
 * @throws never — every failure path returns quietly or is logged; Slack
 *   must not see a thrown error from an action handler.
 */
export async function handleApproveProposal({
  ack,
  body,
}: SlackActionMiddlewareArgs & AllMiddlewareArgs): Promise<void> {
  // ack() FIRST — before any DB/network call.
  await ack();

  const action = (body as BlockButtonAction).actions[0];
  const proposalId = action?.value;
  if (!proposalId) return;

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
  });
  if (!proposal) return;

  const updated = await prisma.proposal.update({
    where: { id: proposalId },
    data: { status: "confirmed" },
  });

  if (!updated.card_channel || !updated.card_ts) {
    console.error(
      `approve-proposal: proposal ${proposalId} has no stored card location`,
    );
    return;
  }

  // Use the STORED card location (D-02), never the click payload's own identifiers.
  await updateProposalCard(updated.card_channel, updated.card_ts, updated);
}
