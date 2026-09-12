import type { RunAgentInput, RunAgentResult } from "../../types/agent";
import { prisma } from "../db";
import { postProposalCard } from "../slack/post-proposal-card";
import { computeDedupeKey } from "./dedupe";

/** Phase 1 hardcoded proposal title. Phase 5 replaces this with real extraction. */
const HARDCODED_TITLE = "Team sync";
/** Phase 1 hardcoded proposal start (Fri 18 Sep 2026, 15:00 HKT). */
const HARDCODED_START = new Date("2026-09-18T15:00:00+08:00");
/** Phase 1 hardcoded proposal end (30 minutes later). */
const HARDCODED_END = new Date("2026-09-18T15:30:00+08:00");
/** Phase 1 hardcoded confidence score. */
const HARDCODED_CONFIDENCE = 0.75;
/** Fixed timezone for the hardcoded round trip (D-08). */
const HARDCODED_TZ = "Asia/Hong_Kong";

/**
 * Runs the (Phase 1 hardcoded) agent pipeline for one Slack message: creates
 * a Proposal keyed by a dedupe key derived from the mention's real `ts`,
 * attaches the mentioning user as a Participant, posts the approval card,
 * and stores the card's channel/ts back onto the Proposal row.
 *
 * Phase 1 body contains no model call and no calendar call. Phase 5
 * replaces this body with the real compiled LangGraph graph; the signature
 * does not change.
 *
 * @param input - Wraps the one Slack message to process.
 * @returns The new Proposal's id (decisionId is always null in Phase 1 — no
 *   Decision logging exists until Phase 5's classify node).
 */
export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const { message } = input;
  const dedupeKey = computeDedupeKey(
    message.teamId,
    message.channelId,
    message.ts,
    "meeting",
  );

  const existing = await prisma.proposal.findUnique({
    where: { dedupe_key: dedupeKey },
  });
  if (existing) {
    // Slack redelivered the same event (T-01-13) — converge on the existing row.
    return { proposalId: existing.id, decisionId: null };
  }

  const participantEmail = await resolveParticipantEmail(
    message.teamId,
    message.userId,
  );

  const proposal = await prisma.proposal.create({
    data: {
      team_id: message.teamId,
      dedupe_key: dedupeKey,
      title: HARDCODED_TITLE,
      start: HARDCODED_START,
      end: HARDCODED_END,
      tz: HARDCODED_TZ,
      status: "pending",
      source_channel: message.channelId,
      source_ts: message.ts,
      confidence: HARDCODED_CONFIDENCE,
      participants: {
        create: {
          slack_user_id: message.userId,
          email: participantEmail,
          role: "attendee",
        },
      },
    },
  });

  const { channel, ts } = await postProposalCard(proposal);

  await prisma.proposal.update({
    where: { id: proposal.id },
    data: { card_channel: channel, card_ts: ts },
  });

  return { proposalId: proposal.id, decisionId: null };
}

/**
 * Resolves an email address for a mentioning Slack user: the seeded User's
 * real email when one exists for this team, otherwise a deterministic
 * placeholder derived from their Slack id.
 *
 * @param teamId - Slack team id.
 * @param slackUserId - Slack user id of the mentioning user.
 * @returns An email address for the Participant row.
 */
async function resolveParticipantEmail(
  teamId: string,
  slackUserId: string,
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: {
      team_id_slack_user_id: { team_id: teamId, slack_user_id: slackUserId },
    },
  });
  return user?.email ?? `${slackUserId}@slack.local`;
}
