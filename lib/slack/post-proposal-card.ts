import { WebAPIPlatformError } from "@slack/web-api";
import { prisma } from "@/lib/db";
import { resolveParticipantEmail } from "@/lib/slack/resolve-email";
import type { Proposal } from "../../prisma/generated/client";
import { buildApprovalBlocks } from "./blocks";
import { slackClient } from "./client";

/**
 * Extracts the Slack-specific error code from a `users.info` failure, for
 * logging. Falls back to the error's own message when it isn't a Slack
 * platform error (e.g. a network failure).
 *
 * @param error - The unknown value caught from `resolveParticipantEmail`.
 * @returns The Slack error string (e.g. `missing_scope`), or a best-effort
 *   fallback description.
 */
function slackErrorCode(error: unknown): string {
  if (error instanceof WebAPIPlatformError) return error.data.error;
  if (error instanceof Error) return error.message;
  return "unknown";
}

/**
 * Loads one display label per Participant row for a proposal, for
 * rendering into the card's Participants field. Labels are Slack mentions
 * built from `slack_user_id` — never an email address (SLK-08 privacy:
 * addresses must never reach a Slack-visible surface). For every
 * participant carrying a `slack_user_id`, also resolves and logs their
 * email via `resolveParticipantEmail` (SLK-08), writing it onto the row
 * when the row had none — a resolution failure never blocks the card.
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

  await Promise.all(
    participants.map(async (participant) => {
      if (!participant.slack_user_id) return; // no slack_user_id — skip entirely, no call.

      let email: string | undefined;
      try {
        email = await resolveParticipantEmail(participant.slack_user_id);
        console.log(
          `participant email resolved slack_user_id=${participant.slack_user_id} email=${email ?? "none"}`,
        );
      } catch (error) {
        console.log(
          `email resolution failed slack_user_id=${participant.slack_user_id} code=${slackErrorCode(error)}`,
        );
        return; // resolution failure never blocks the card.
      }

      if (email && !participant.email) {
        await prisma.participant.update({
          where: { id: participant.id },
          data: { email },
        });
      }
    }),
  );

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
