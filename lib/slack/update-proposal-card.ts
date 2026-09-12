import { loadParticipantLabels } from "@/lib/slack/post-proposal-card";
import type { Proposal } from "../../prisma/generated/client";
import {
  buildAlreadyScheduledBlocks,
  buildApprovalBlocks,
  buildConfirmedBlocks,
  buildDismissedBlocks,
} from "./blocks";
import { slackClient } from "./client";

/** The proposal fields needed to re-render any status branch. */
type UpdateCardProposal = Pick<
  Proposal,
  "id" | "title" | "status" | "start" | "end" | "confidence"
>;

/**
 * Edits an existing Proposal card message in place. Never posts a new
 * message under any branch — callers must pass the channel/ts stored on the
 * Proposal row (never identifiers taken from a click payload, which can
 * drift, D-11). The blocks (and fallback text) are chosen from
 * `proposal.status`, so callers pass the row spread with its *new* status.
 *
 * @param channel - `Proposal.card_channel`. Widened to accept `null` since
 *   the column is nullable; a missing coordinate is a no-op, not a throw.
 * @param ts - `Proposal.card_ts`. Widened to accept `null` for the same reason.
 * @param proposal - The proposal to render, needing `id`, `title`, `status`,
 *   `start`, `end` and `confidence`.
 * @returns Resolves once the update completes, or immediately if the
 *   coordinates are missing or the status is unrecognised.
 * @throws When the Slack API call fails (network error, message not found, etc.)
 */
export async function updateProposalCard(
  channel: string | null,
  ts: string | null,
  proposal: UpdateCardProposal,
): Promise<void> {
  if (!channel || !ts) {
    console.log(`card coordinates missing proposal_id=${proposal.id}`);
    return;
  }

  const rendered = await renderCardForStatus(proposal);
  if (!rendered) {
    console.log(
      `card status unrecognized proposal_id=${proposal.id} status=${proposal.status}`,
    );
    return;
  }

  // Both text AND blocks, always — text-only silently deletes the blocks.
  await slackClient.chat.update({
    channel,
    ts,
    text: rendered.fallbackText,
    blocks: rendered.blocks,
  });
}

/**
 * Picks and builds the blocks + fallback text for a proposal's current
 * status. `pending` rebuilds the full approval card (loading fresh
 * participant labels); the terminal statuses each pick their chip.
 *
 * @param proposal - The proposal to render.
 * @returns The blocks/fallbackText pair, or `undefined` for an
 *   unrecognised status.
 */
async function renderCardForStatus(proposal: UpdateCardProposal) {
  switch (proposal.status) {
    case "pending": {
      const participants = await loadParticipantLabels(proposal.id);
      return {
        blocks: buildApprovalBlocks({
          id: proposal.id,
          title: proposal.title,
          start: proposal.start,
          end: proposal.end,
          confidence: proposal.confidence,
          participants,
        }),
        fallbackText: `${proposal.title} — awaiting approval`,
      };
    }
    case "confirmed":
      return {
        blocks: buildConfirmedBlocks(proposal),
        fallbackText: `${proposal.title} — confirmed`,
      };
    case "dismissed":
      return {
        blocks: buildDismissedBlocks(proposal),
        fallbackText: `${proposal.title} — dismissed`,
      };
    case "already_scheduled":
      return {
        blocks: buildAlreadyScheduledBlocks(proposal),
        fallbackText: `${proposal.title} — already scheduled`,
      };
    default:
      return undefined;
  }
}
