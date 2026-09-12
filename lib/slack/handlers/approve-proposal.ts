import type {
  AllMiddlewareArgs,
  BlockButtonAction,
  SlackActionMiddlewareArgs,
} from "@slack/bolt";
import { approveProposal } from "@/lib/slack/approve";

/**
 * Handles the "Approve" button click on a Proposal card: acknowledges
 * immediately, then delegates entirely to `approveProposal` (the token
 * guard, the organizer claim, the real Calendar write and the stored-card
 * update all live there). This listener holds no database call, no status
 * write and no Calendar call of its own — it only reads the button value
 * and the clicking user's id, and renders ephemeral feedback from the
 * returned outcome.
 *
 * @param args - Bolt's block-action middleware args.
 * @param args.ack - Bolt's ack function; must be called first.
 * @param args.body - The raw block_actions payload.
 * @param args.respond - Bolt's response_url helper, used only for ephemeral
 *   feedback — never for the confirmed-card transition itself.
 * @returns Resolves once `approveProposal` has run and any ephemeral
 *   feedback has been sent.
 * @throws never — every outcome is handled; Slack must not see a thrown
 *   error from an action handler.
 */
export async function handleApproveProposal({
  ack,
  body,
  respond,
}: SlackActionMiddlewareArgs & AllMiddlewareArgs): Promise<void> {
  // ack() FIRST — before any DB/network call.
  await ack();

  const clickAction = body as BlockButtonAction;
  const proposalId = clickAction.actions[0]?.value;
  if (!proposalId) return;

  const outcome = await approveProposal(proposalId, clickAction.user.id);

  switch (outcome) {
    case "confirmed":
      // The card itself is the feedback — no ephemeral message.
      break;
    case "not_organizer":
      await respond({
        response_type: "ephemeral",
        text: "Only the connected calendar owner can approve this proposal. Nothing was written to Google Calendar.",
      });
      break;
    case "already_scheduled":
      await respond({
        response_type: "ephemeral",
        text: "Another user already claimed this proposal.",
      });
      break;
    case "not_pending":
      await respond({
        response_type: "ephemeral",
        text: "This proposal was already handled — the card has been refreshed.",
      });
      break;
    case "not_found":
      await respond({
        response_type: "ephemeral",
        text: "That proposal no longer exists.",
      });
      break;
  }
}
