import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { postProposalCard } from "@/lib/slack/post-proposal-card";

/**
 * Fixed placeholder start time for every nudge `Proposal`: the evening of
 * 12 September 2026, HKT. A nudge has no real meeting time, but Phase 7's
 * conflict detection (CFL-01) unions *every* pending Proposal with no kind
 * discriminator, so this constant deliberately quarantines nudge rows away
 * from the headline demo's conflict window (Friday 18 September 2026,
 * 10:30/11:00 HKT) — never the current time (08-RESEARCH Open Question 3).
 */
export const NUDGE_PLACEHOLDER_START = "2026-09-12T23:45:00+08:00";

/** Fixed placeholder end time paired with {@link NUDGE_PLACEHOLDER_START}. */
export const NUDGE_PLACEHOLDER_END = "2026-09-12T23:59:00+08:00";

/**
 * Creates a real `Proposal` row for a nudge and posts it through the
 * existing approval-card function — the only Slack write this phase makes
 * (D-12, D-13). Every field is decided from the stored `Commitment` row; the
 * caller supplies nothing but the id, so no title, recipient or channel
 * ever comes from the client (T-08-07).
 *
 * @param commitmentId - The id of a `Commitment` row.
 * @returns The created Proposal's id.
 * @throws When `commitmentId` matches no row, or when the Slack card post
 *   or any Prisma call fails.
 */
export async function createNudgeProposal(
  commitmentId: string,
): Promise<{ proposalId: string }> {
  const row = await prisma.commitment.findUniqueOrThrow({
    where: { id: commitmentId },
  });

  const proposal = await prisma.proposal.create({
    data: {
      team_id: config.slack.teamId,
      dedupe_key: `nudge:${commitmentId}:${Date.now()}`,
      title: `Nudge: ${row.who} — ${row.what}`,
      start: new Date(NUDGE_PLACEHOLDER_START),
      end: new Date(NUDGE_PLACEHOLDER_END),
      tz: "Asia/Hong_Kong",
      status: "pending",
      source_channel: row.source_channel,
      source_ts: row.source_ts,
      confidence: 1,
    },
  });

  const { channel, ts } = await postProposalCard(proposal);

  await prisma.proposal.update({
    where: { id: proposal.id },
    data: { card_channel: channel, card_ts: ts },
  });

  return { proposalId: proposal.id };
}
