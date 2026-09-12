import type { Proposal } from "../../prisma/generated/client";
import { buildConfirmedBlocks } from "./blocks";
import { slackClient } from "./client";

/**
 * Edits an existing Proposal card message in place. Never posts a new
 * message — callers must pass the channel/ts stored on the Proposal row
 * (never identifiers taken from a click payload, which can drift).
 *
 * @param channel - The channel the original card was posted in.
 * @param ts - The original card message's timestamp.
 * @param proposal - The proposal to render, needing `title`.
 * @throws When the Slack API call fails (network error, message not found, etc.)
 */
export async function updateProposalCard(
  channel: string,
  ts: string,
  proposal: Pick<Proposal, "title">,
): Promise<void> {
  await slackClient.chat.update({
    channel,
    ts,
    text: proposal.title,
    blocks: buildConfirmedBlocks(proposal),
  });
}
