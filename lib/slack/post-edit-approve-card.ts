import { buildEditApproveBlocks, buildFallbackText } from "./blocks";
import { slackClient } from "./client";
import { loadCardInput, type UpdateCardProposal } from "./update-proposal-card";

/**
 * Posts a new Edit & approve card for a medium-confidence Proposal as a
 * thread reply under its source message. Same parameter and return shape as
 * `postProposalCard` (D-15) — `proposeNode` selects between the two by
 * confidence band with no other branching. Renders the same rich card body
 * (addressee, facts table, participants, why, action) with the Edit & approve
 * actions row swapped in.
 *
 * @param proposal - The proposal to post (same fields `updateProposalCard` needs).
 * @returns The channel and message timestamp of the posted card, to be
 *   stored on the Proposal row for a later `chat.update`.
 * @throws When the Slack API call fails (network error, invalid channel, etc.)
 */
export async function postEditApproveCard(
  proposal: UpdateCardProposal,
): Promise<{ channel: string; ts: string }> {
  const cardInput = await loadCardInput(proposal);
  const result = await slackClient.chat.postMessage({
    channel: proposal.source_channel,
    thread_ts: proposal.source_ts,
    text: buildFallbackText("pending", cardInput),
    blocks: buildEditApproveBlocks(cardInput),
  });

  return { channel: result.channel as string, ts: result.ts as string };
}
