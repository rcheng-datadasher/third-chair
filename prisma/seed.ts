import { config } from "../lib/config";
import { prisma } from "../lib/db";

/**
 * Idempotent Phase 1 seed. Upserts a fixed row set so repeated runs converge
 * rather than duplicate: one Installation, User A (with Google refresh token
 * + HKT tz), User B (no token), one pending Proposal at a non-demo slot with
 * B as a Participant, and one `acted` + one `ignored` Decision.
 *
 * Every identity and secret is read through `lib/config.ts` — the refresh
 * token value is never a literal in this file.
 */
async function main() {
  await prisma.installation.upsert({
    where: { team_id: config.slack.teamId },
    update: {},
    create: {
      team_id: config.slack.teamId,
      payload: {},
      installed_by: config.seed.userA.slackId,
    },
  });

  const userA = await prisma.user.upsert({
    where: {
      team_id_slack_user_id: {
        team_id: config.slack.teamId,
        slack_user_id: config.seed.userA.slackId,
      },
    },
    update: {
      email: config.seed.userA.email,
      google_refresh_token: config.seed.userA.googleRefreshToken,
      tz: "Asia/Hong_Kong",
    },
    create: {
      team_id: config.slack.teamId,
      slack_user_id: config.seed.userA.slackId,
      email: config.seed.userA.email,
      google_refresh_token: config.seed.userA.googleRefreshToken,
      tz: "Asia/Hong_Kong",
    },
  });

  const userB = await prisma.user.upsert({
    where: {
      team_id_slack_user_id: {
        team_id: config.slack.teamId,
        slack_user_id: config.seed.userB.slackId,
      },
    },
    update: {
      email: config.seed.userB.email,
    },
    create: {
      team_id: config.slack.teamId,
      slack_user_id: config.seed.userB.slackId,
      email: config.seed.userB.email,
      tz: "Asia/Hong_Kong",
    },
  });

  // Thu 17 Sep 2026 15:00 HKT (+08:00) — deliberately not either demo slot (D-14)
  const proposal = await prisma.proposal.upsert({
    where: { dedupe_key: "phase1-seed-proposal" },
    update: {
      status: "pending",
      start: new Date("2026-09-17T15:00:00+08:00"),
      end: new Date("2026-09-17T16:00:00+08:00"),
    },
    create: {
      team_id: config.slack.teamId,
      dedupe_key: "phase1-seed-proposal",
      title: "Seeded planning sync",
      start: new Date("2026-09-17T15:00:00+08:00"),
      end: new Date("2026-09-17T16:00:00+08:00"),
      tz: "Asia/Hong_Kong",
      status: "pending",
      organizer_user_id: userA.id,
      source_channel: "C00000001",
      source_ts: "1700000000.000001",
      confidence: 0.9,
    },
  });

  await prisma.participant.upsert({
    where: {
      proposal_id_email: { proposal_id: proposal.id, email: userB.email },
    },
    update: {},
    create: {
      proposal_id: proposal.id,
      user_id: userB.id,
      slack_user_id: userB.slack_user_id,
      email: userB.email,
      role: "invitee",
    },
  });

  await prisma.decision.upsert({
    where: { id: "phase1-seed-decision-acted" },
    update: {},
    create: {
      id: "phase1-seed-decision-acted",
      team_id: config.slack.teamId,
      source_ts: "1700000000.000002",
      verdict: "acted",
      confidence: 0.95,
      reason: "Message proposed a meeting time; a Proposal was created.",
      source_channel: "C00000001",
      message_text: "Let's meet Thursday at 3pm HKT.",
      proposal_id: proposal.id,
    },
  });

  await prisma.decision.upsert({
    where: { id: "phase1-seed-decision-ignored" },
    update: {},
    create: {
      id: "phase1-seed-decision-ignored",
      team_id: config.slack.teamId,
      source_ts: "1700000000.000003",
      verdict: "ignored",
      confidence: 0.85,
      reason: "Message was small talk, no scheduling intent.",
      source_channel: "C00000001",
      message_text: "Good morning everyone!",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
