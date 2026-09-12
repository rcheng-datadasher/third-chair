import type { Proposal } from "../../prisma/generated/client";
import { buildEditApproveBlocks } from "./blocks";
import { slackClient } from "./client";

/**
 * Posts a new Edit & approve card for a medium-confidence Proposal to its
 * source channel. Byte-identical parameter and return shape to
 * `postProposalCard` (D-15) — `proposeNode` selects between the two by
 * confidence band with no other branching.
 *
 * @param proposal - The proposal to post, needing `id`, `title` and
 *   `source_channel`.
 * @returns The channel and message timestamp of the posted card, to be
 *   stored on the Proposal row for a later `chat.update`.
 * @throws When the Slack API call fails (network error, invalid channel, etc.)
 */
export async function postEditApproveCard(
  proposal: Pick<Proposal, "id" | "title" | "source_channel">,
): Promise<{ channel: string; ts: string }> {
  const result = await slackClient.chat.postMessage({
    channel: proposal.source_channel,
    text: proposal.title,
    blocks: buildEditApproveBlocks(proposal),
  });

  return { channel: result.channel as string, ts: result.ts as string };
}
