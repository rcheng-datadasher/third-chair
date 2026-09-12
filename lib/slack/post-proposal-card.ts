import { WebAPIPlatformError } from "@slack/web-api";
import { prisma } from "@/lib/db";
import { resolveParticipantEmail } from "@/lib/slack/resolve-email";
import type { Proposal } from "../../prisma/generated/client";
import {
  buildApprovalBlocks,
  buildFallbackText,
  type ParticipantEntry,
} from "./blocks";
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
 * Loads one `ParticipantEntry` per Participant row for a proposal, for
 * rendering into the card's Participants rich-text list. A row with no
 * `slack_user_id` is skipped entirely — a `user` rich-text element needs a
 * real id to mention. Never an email address (SLK-08 privacy: addresses
 * must never reach a Slack-visible surface). For every participant
 * carrying a `slack_user_id`, also resolves and logs their email via
 * `resolveParticipantEmail` (SLK-08), writing it onto the row when the row
 * had none — a resolution failure never blocks the card.
 *
 * @param proposal - The proposal to load participants for, needing `id`
 *   and `organizer_user_id` (drives the "organizer" state label).
 * @returns One `ParticipantEntry` per Participant row carrying a
 *   `slack_user_id`, in query order.
 */
export async function loadCardParticipants(
  proposal: Pick<Proposal, "id" | "organizer_user_id">,
): Promise<ParticipantEntry[]> {
  const participants = await prisma.participant.findMany({
    where: { proposal_id: proposal.id },
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

  return participants
    .filter((participant) => participant.slack_user_id)
    .map((participant) => ({
      slackUserId: participant.slack_user_id as string,
      state:
        participant.slack_user_id === proposal.organizer_user_id
          ? "organizer"
          : (participant.response ?? "pending invite"),
    }));
}

/**
 * Resolves the Slack user id of a message's author, given where it was
 * posted. Used only as a last resort when `Proposal.organizer_user_id`
 * isn't set yet (Phase 4 concept) — never faked; a failure or a message
 * that can't be found returns `undefined` rather than throwing, so the "On
 * behalf of" field is simply omitted.
 *
 * @param channel - The channel the source message was posted in.
 * @param ts - The source message's own timestamp.
 * @returns The author's Slack user id, or `undefined` when unresolvable.
 */
async function resolveSourceAuthorUserId(
  channel: string,
  ts: string,
): Promise<string | undefined> {
  try {
    const history = await slackClient.conversations.history({
      channel,
      latest: ts,
      inclusive: true,
      limit: 1,
    });
    const message = history.messages?.[0];
    return message?.ts === ts ? message.user : undefined;
  } catch (error) {
    console.log(
      `source author resolution failed channel=${channel} ts=${ts} code=${slackErrorCode(error)}`,
    );
    return undefined;
  }
}

/**
 * Loads the extra card-context fields shared by every render of a
 * proposal's card: the latest linked Decision's `reason` (Phase 5's
 * extraction; absent until that phase runs, or on this branch), and who
 * this proposal is "on behalf of" — the claimed organizer when set,
 * otherwise the source message's own author.
 *
 * @param proposal - The proposal to load context for.
 * @returns `reason` (undefined when no Decision row exists) and
 *   `onBehalfOfUserId` (undefined when unresolvable — never faked).
 */
export async function loadApprovalCardExtras(
  proposal: Pick<
    Proposal,
    "id" | "organizer_user_id" | "source_channel" | "source_ts"
  >,
): Promise<{ reason?: string; onBehalfOfUserId?: string }> {
  // No `created_at` column on Decision; `id` (cuid, roughly time-ordered)
  // is the best available recency proxy for "the latest linked Decision".
  // ponytail: good enough for one Decision-per-Proposal in this phase;
  // revisit if Phase 5 ever links more than one.
  const decision = await prisma.decision.findFirst({
    where: { proposal_id: proposal.id },
    orderBy: { id: "desc" },
  });

  const onBehalfOfUserId =
    proposal.organizer_user_id ??
    (await resolveSourceAuthorUserId(
      proposal.source_channel,
      proposal.source_ts,
    ));

  return { reason: decision?.reason, onBehalfOfUserId };
}

/**
 * Posts a new approval card for a Proposal, as a threaded reply to its
 * source message (never a top-level post — the reply keeps the card
 * anchored to the request that created it).
 *
 * @param proposal - The proposal to post, needing `id`, `title`,
 *   `source_channel`, `source_ts`, `start`, `end`, `confidence`,
 *   `created_at` and `organizer_user_id`.
 * @returns The channel and message timestamp of the posted card, to be
 *   stored on the Proposal row for a later `chat.update`.
 * @throws When the Slack API call fails (network error, invalid channel, etc.)
 */
export async function postProposalCard(
  proposal: Pick<
    Proposal,
    | "id"
    | "title"
    | "source_channel"
    | "source_ts"
    | "start"
    | "end"
    | "confidence"
    | "created_at"
    | "organizer_user_id"
  >,
): Promise<{ channel: string; ts: string }> {
  const [participants, extras] = await Promise.all([
    loadCardParticipants(proposal),
    loadApprovalCardExtras(proposal),
  ]);
  const cardInput = {
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
  const blocks = buildApprovalBlocks(cardInput);

  const result = await slackClient.chat.postMessage({
    channel: proposal.source_channel,
    thread_ts: proposal.source_ts,
    text: buildFallbackText("pending", cardInput),
    blocks,
  });

  const channel = result.channel as string;
  const ts = result.ts as string;
  console.log(`posted proposal card proposal_id=${proposal.id} ts=${ts}`);
  return { channel, ts };
}
