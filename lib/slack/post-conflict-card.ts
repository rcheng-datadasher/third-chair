import { buildFallbackText } from "./blocks";
import { slackClient } from "./client";
import { buildConflictWarningBlocks } from "./conflict-blocks";
import { loadCardInput, type UpdateCardProposal } from "./update-proposal-card";

/**
 * The conflict card's degraded, static-warning form (CFL-05): names the
 * clashing block, no alternatives. Shipped in full by Task 1 — this is the
 * card the 14:15 cut line stops at, not a contingency.
 */
export interface ConflictWarningVariant {
  kind: "warning";
  /** The clashing block's HKT range, from `summarizeClash`. */
  clashSummary: string;
}

/**
 * The conflict card's variant discriminant. Task 2 (CFL-02/03) adds an
 * `"alternatives"` member here carrying the two model-generated slots;
 * Task 1 ships only `"warning"`.
 */
export type ConflictCardVariant = ConflictWarningVariant;

/**
 * Posts a new conflict card for a clashing Proposal, as a thread reply
 * under its source message — same call shape as `postProposalCard`/
 * `postEditApproveCard` (D-15's "one call site" precedent).
 *
 * Imports nothing from Bolt: this file is reachable from `runAgent`, which
 * runs inside the Trigger.dev worker, and a Bolt import there would open a
 * second Socket Mode connection that can silently steal button clicks
 * (T-07-16).
 *
 * @param proposal - The proposal to post (same fields `postEditApproveCard` needs).
 * @param variant - Which conflict-card body to render.
 * @returns The channel and message timestamp of the posted card, to be
 *   stored on the Proposal row for a later `chat.update`.
 * @throws When the Slack API call fails (network error, invalid channel, etc.)
 */
export async function postConflictCard(
  proposal: UpdateCardProposal,
  variant: ConflictCardVariant,
): Promise<{ channel: string; ts: string }> {
  const cardInput = await loadCardInput(proposal);
  const blocks = buildConflictWarningBlocks(cardInput, variant.clashSummary);

  const result = await slackClient.chat.postMessage({
    channel: proposal.source_channel,
    thread_ts: proposal.source_ts,
    text: buildFallbackText("pending", cardInput),
    blocks,
  });

  return { channel: result.channel as string, ts: result.ts as string };
}
