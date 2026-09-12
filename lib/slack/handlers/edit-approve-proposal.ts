import type {
  AllMiddlewareArgs,
  BlockButtonAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";
import { config } from "../../config";
import { prisma } from "../../db";
import { buildEditProposalModal } from "../blocks";

/**
 * Handles the "Edit & approve" button click on a medium-confidence
 * Proposal card: acknowledges immediately, re-reads the Proposal from
 * Postgres by the id carried in the button's own `value`, and opens a
 * modal prefilled from that live row (D-15) — never from anything in the
 * click payload beyond the id.
 *
 * `await ack()` is the first awaited statement (AGT-05/ordering) — the
 * `trigger_id` this handler spends on `views.open` is only valid for a few
 * seconds, so nothing may be awaited before the ack.
 *
 * @throws never — every failure path returns quietly after one log line;
 *   Slack must not see a thrown error from an action handler.
 */
export async function handleEditApproveProposal({
  ack,
  body,
  client,
  logger,
}: SlackActionMiddlewareArgs & AllMiddlewareArgs): Promise<void> {
  await ack();

  const action = (body as BlockButtonAction).actions[0];
  const proposalId = action?.value;
  if (!proposalId) {
    logger.warn("edit-approve-proposal: button value missing a proposal id");
    return;
  }

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { participants: true },
  });
  if (!proposal || proposal.team_id !== config.slack.teamId) {
    logger.warn(
      `edit-approve-proposal: no proposal for this team at id ${proposalId}`,
    );
    return;
  }

  const triggerId = (body as BlockButtonAction).trigger_id;
  await client.views.open({
    trigger_id: triggerId,
    view: buildEditProposalModal(proposal),
  });
}
