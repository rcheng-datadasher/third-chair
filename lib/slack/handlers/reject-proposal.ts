import type {
  AllMiddlewareArgs,
  BlockButtonAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";
import { rejectProposal } from "../reject";

/**
 * Handles the "Reject" button click on a Proposal card: acknowledges
 * immediately, then delegates to `rejectProposal` (shared with the
 * dashboard route) which transitions the row and edits the card in place.
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

  await rejectProposal(proposalId, clickAction.user.id);
}
