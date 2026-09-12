import { prisma } from "@/lib/db";
import type { Proposal } from "../../prisma/generated/client";
import { buildApprovalBlocks } from "./blocks";
import { slackClient } from "./client";

/**
 * Loads one display label per Participant row for a proposal, for
 * rendering into the card's Participants field. Labels are Slack mentions
 * built from `slack_user_id` — never an email address (SLK-08 privacy:
 * addresses must never reach a Slack-visible surface).
 *
 * @param proposalId - The Proposal id to load participants for.
 * @returns One label per Participant row, in query order. A row with no
 *   `slack_user_id` renders as the literal `"unknown participant"`.
 */
export async function loadParticipantLabels(
  proposalId: string,
): Promise<string[]> {
  const participants = await prisma.participant.findMany({
    where: { proposal_id: proposalId },
  });
  return participants.map((participant) =>
    participant.slack_user_id
      ? `<@${participant.slack_user_id}>`
      : "unknown participant",
  );
}

/**
 * Posts a new approval card for a Proposal to its source channel.
 *
 * @param proposal - The proposal to post, needing `id`, `title`,
 *   `source_channel`, `start`, `end` and `confidence`.
 * @returns The channel and message timestamp of the posted card, to be
 *   stored on the Proposal row for a later `chat.update`.
 * @throws When the Slack API call fails (network error, invalid channel, etc.)
 */
export async function postProposalCard(
  proposal: Pick<
    Proposal,
    "id" | "title" | "source_channel" | "start" | "end" | "confidence"
  >,
): Promise<{ channel: string; ts: string }> {
  const participants = await loadParticipantLabels(proposal.id);
  const blocks = buildApprovalBlocks({
    id: proposal.id,
    title: proposal.title,
    start: proposal.start,
    end: proposal.end,
    confidence: proposal.confidence,
    participants,
  });

  const result = await slackClient.chat.postMessage({
    channel: proposal.source_channel,
    text: `${proposal.title} — awaiting approval`,
    blocks,
  });

  const channel = result.channel as string;
  const ts = result.ts as string;
  console.log(`posted proposal card proposal_id=${proposal.id} ts=${ts}`);
  return { channel, ts };
}
