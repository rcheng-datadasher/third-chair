import type {
  AllMiddlewareArgs,
  BlockButtonAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";
import { prisma } from "../../db";
import { updateProposalCard } from "../update-proposal-card";

/**
 * Handles the "Reject" button click on a Proposal card: acknowledges
 * immediately, resolves the proposal from the button's own value,
 * conditionally marks it dismissed (only from `pending`, so a double click
 * or a race with Approve is a no-op), and updates the card in place using
 * the channel/ts stored on the Proposal row (never the identifiers carried
 * in the click payload, which can drift — D-11).
 *
 * @param args - Bolt's block-action middleware args.
 * @param args.ack - Bolt's ack function; must be called first (D-07).
 * @param args.body - The raw block_actions payload.
 * @returns Resolves once the proposal is transitioned (or found already
 *   decided) and, when transitioned, the card is updated.
 * @throws never — every failure path returns quietly or is logged; Slack
 *   must not see a thrown error from an action handler.
 */
export async function handleRejectProposal({
  ack,
  body,
}: SlackActionMiddlewareArgs & AllMiddlewareArgs): Promise<void> {
  // ack() FIRST — before any DB/network call.
  await ack();

  const clickAction = body as BlockButtonAction;
  const proposalId = clickAction.actions[0]?.value;
  if (!proposalId) return;

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
  });
  if (!proposal) return;

  // Conditional transition: only a proposal still `pending` can be rejected,
  // so a double click or a race with Approve leaves the first chip in place.
  const { count } = await prisma.proposal.updateMany({
    where: { id: proposalId, status: "pending" },
    data: { status: "dismissed" },
  });
  if (count === 0) {
    console.log(
      `already decided proposal_id=${proposalId} status=${proposal.status}`,
    );
    return;
  }

  console.log(`proposal rejected proposal_id=${proposalId} status=dismissed`);
  // Spread the pre-update row with its NEW status — passing the row as read
  // (still `pending`) would re-render the approval card with buttons intact.
  // decidedByUserId/decidedAt are ephemeral (click-time only, never
  // persisted — no schema change this phase).
  await updateProposalCard(proposal.card_channel, proposal.card_ts, {
    ...proposal,
    status: "dismissed",
    decidedByUserId: clickAction.user.id,
    decidedAt: new Date(),
  });
}
