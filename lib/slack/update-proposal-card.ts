import {
  loadApprovalCardExtras,
  loadParticipantLabels,
} from "@/lib/slack/post-proposal-card";
import type { Proposal } from "../../prisma/generated/client";
import {
  type ApprovalCardInput,
  buildAlreadyScheduledBlocks,
  buildApprovalBlocks,
  buildConfirmedBlocks,
  buildDismissedBlocks,
  buildFallbackText,
  type DecisionInfo,
} from "./blocks";
import { slackClient } from "./client";

/**
 * The proposal fields needed to re-render any status branch, plus the
 * ephemeral decision info (`DecisionInfo`) a caller may spread onto the row
 * after transitioning it — never persisted (no schema change this phase).
 */
type UpdateCardProposal = Pick<
  Proposal,
  | "id"
  | "title"
  | "status"
  | "start"
  | "end"
  | "confidence"
  | "created_at"
  | "organizer_user_id"
  | "source_channel"
  | "source_ts"
> &
  Partial<DecisionInfo>;

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
 * @param proposal - The proposal to render, plus optional `decidedByUserId`/
 *   `decidedAt` for a decided card's closing line.
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
 * Loads the shared `ApprovalCardInput` (participants, created-at, reason,
 * addressee) every status variant renders from.
 *
 * @param proposal - The proposal to build card input for.
 * @returns The full card input, ready for any `build*Blocks` function.
 */
async function loadCardInput(
  proposal: UpdateCardProposal,
): Promise<ApprovalCardInput> {
  const [participants, extras] = await Promise.all([
    loadParticipantLabels(proposal.id),
    loadApprovalCardExtras(proposal),
  ]);
  return {
    id: proposal.id,
    title: proposal.title,
    start: proposal.start,
    end: proposal.end,
    confidence: proposal.confidence,
    participants,
    createdAt: proposal.created_at,
    reason: extras.reason,
    onBehalfOfUserId: extras.onBehalfOfUserId,
  };
}

/**
 * Picks and builds the blocks + fallback text for a proposal's current
 * status. Every status shares the same card input (title, addressee,
 * fields survive into the decided state); only the closing block differs.
 *
 * @param proposal - The proposal to render.
 * @returns The blocks/fallbackText pair, or `undefined` for an
 *   unrecognised status.
 */
async function renderCardForStatus(proposal: UpdateCardProposal) {
  const cardInput = await loadCardInput(proposal);
  const decisionInfo: DecisionInfo = {
    decidedByUserId: proposal.decidedByUserId,
    decidedAt: proposal.decidedAt,
  };

  switch (proposal.status) {
    case "pending":
      return {
        blocks: buildApprovalBlocks(cardInput),
        fallbackText: buildFallbackText("pending", cardInput),
      };
    case "confirmed":
      return {
        blocks: buildConfirmedBlocks(cardInput, decisionInfo),
        fallbackText: buildFallbackText("confirmed", cardInput),
      };
    case "dismissed":
      return {
        blocks: buildDismissedBlocks(cardInput, decisionInfo),
        fallbackText: buildFallbackText("dismissed", cardInput),
      };
    case "already_scheduled":
      return {
        blocks: buildAlreadyScheduledBlocks(cardInput),
        fallbackText: buildFallbackText("already_scheduled", cardInput),
      };
    default:
      return undefined;
  }
}
