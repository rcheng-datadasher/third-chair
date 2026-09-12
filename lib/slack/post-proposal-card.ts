import type { Proposal } from "../../prisma/generated/client";
import { buildApprovalBlocks } from "./blocks";
import { slackClient } from "./client";

/**
 * Posts a new approval card for a Proposal to its source channel.
 *
 * @param proposal - The proposal to post, needing `id`, `title` and
 *   `source_channel`.
 * @returns The channel and message timestamp of the posted card, to be
 *   stored on the Proposal row for a later `chat.update`.
 * @throws When the Slack API call fails (network error, invalid channel, etc.)
 */
export async function postProposalCard(
  proposal: Pick<Proposal, "id" | "title" | "source_channel">,
): Promise<{ channel: string; ts: string }> {
  const result = await slackClient.chat.postMessage({
    channel: proposal.source_channel,
    text: proposal.title,
    blocks: buildApprovalBlocks(proposal),
  });

  return { channel: result.channel as string, ts: result.ts as string };
}
