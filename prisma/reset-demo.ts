// Purpose: DMO-01 idempotent demo reset. Run from the repo root as
// `bun prisma/reset-demo.ts`. It deletes every Google Calendar event tagged
// `extendedProperties.private.demo = "true"` on organizer A's primary
// calendar, then every ActionItem, Participant, Decision and Proposal row
// scoped to `config.slack.teamId`. User, Installation and Preference rows
// are never touched.
//
// Never run `prisma/seed.ts` after this script — that would restore the
// Thu 17 Sep 2026 fixture Proposal onto the dashboard, which this script
// just cleared.

import type { calendar_v3 } from "googleapis";
import { getCalendarClient } from "../lib/calendar/google-client";
import { config } from "../lib/config";
import { prisma } from "../lib/db";

/**
 * Normalizes the HTTP status off a caught error without assuming its shape.
 * gaxios/googleapis errors carry the status on `status`, on
 * `response.status`, or (rarely) as a numeric string on `code`.
 *
 * @param err - The caught error, of unknown shape.
 * @returns The numeric HTTP status if one of the known fields carries it,
 *   otherwise `undefined`.
 */
export function statusOf(err: unknown): number | undefined {
  const e = err as {
    status?: number;
    response?: { status?: number };
    code?: string | number;
  };
  if (typeof e?.status === "number") return e.status;
  if (typeof e?.response?.status === "number") return e.response.status;
  const fromCode = Number(e?.code);
  return Number.isFinite(fromCode) ? fromCode : undefined;
}

/**
 * Lists every event id on A's primary calendar tagged as a demo event.
 *
 * @param calendar - An authenticated Calendar v3 client for organizer A.
 * @returns Every matching event id, paginated across the full result set.
 */
export async function listDemoEventIds(
  calendar: calendar_v3.Calendar,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await calendar.events.list({
      calendarId: "primary",
      privateExtendedProperty: ["demo=true"],
      showDeleted: false,
      pageToken,
    });
    for (const item of res.data.items ?? []) {
      if (item.id) ids.push(item.id);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return ids;
}

/**
 * Deletes the given Calendar events one at a time, tolerating events that
 * are already gone.
 *
 * @param calendar - An authenticated Calendar v3 client for organizer A.
 * @param ids - Event ids to delete. The only ids ever passed here are the
 *   ones {@link listDemoEventIds} returned.
 * @returns The count actually deleted and the count that were already gone
 *   (HTTP 404 or 410).
 * @throws Any error whose status is not 404 or 410.
 */
export async function deleteEvents(
  calendar: calendar_v3.Calendar,
  ids: string[],
): Promise<{ deleted: number; alreadyGone: number }> {
  let deleted = 0;
  let alreadyGone = 0;
  for (const eventId of ids) {
    try {
      await calendar.events.delete({
        calendarId: "primary",
        eventId,
        sendUpdates: "none",
      });
      deleted++;
    } catch (err) {
      const status = statusOf(err);
      if (status === 404 || status === 410) {
        alreadyGone++;
        continue;
      }
      throw err;
    }
  }
  return { deleted, alreadyGone };
}

/**
 * Deletes every demo-scoped row for a team: ActionItem and Participant
 * children of the team's Proposals, the team's Decisions, then the
 * Proposals themselves. Runs as one interactive transaction so a partial
 * failure leaves the database untouched.
 *
 * @param teamId - The Slack team id scoping every delete.
 * @returns The number of rows deleted per model.
 */
export async function resetDatabase(teamId: string): Promise<{
  actionItems: number;
  participants: number;
  decisions: number;
  proposals: number;
}> {
  return prisma.$transaction(async (tx) => {
    const proposals = await tx.proposal.findMany({
      where: { team_id: teamId },
      select: { id: true },
    });
    const ids = proposals.map((p) => p.id);

    const actionItems = await tx.actionItem.deleteMany({
      where: { proposal_id: { in: ids } },
    });
    const participants = await tx.participant.deleteMany({
      where: { proposal_id: { in: ids } },
    });
    const decisions = await tx.decision.deleteMany({
      where: { team_id: teamId },
    });
    const deletedProposals = await tx.proposal.deleteMany({
      where: { id: { in: ids } },
    });

    return {
      actionItems: actionItems.count,
      participants: participants.count,
      decisions: decisions.count,
      proposals: deletedProposals.count,
    };
  });
}

/**
 * Runs the full reset: resolves organizer A, clears her tagged demo events
 * on Google Calendar, then clears the team's demo database rows, printing
 * a stdout contract line after each step and a final summary line.
 *
 * @returns Resolves once both steps complete and counts are printed.
 * @throws Whatever the calendar or database step throws; the caller's
 *   `.catch` reports it and sets a non-zero exit code.
 */
async function main(): Promise<void> {
  const organizer = await prisma.user.findFirstOrThrow({
    where: {
      team_id: config.slack.teamId,
      google_refresh_token: { not: null },
    },
    select: { id: true },
  });

  const calendar = await getCalendarClient(organizer.id);
  const ids = await listDemoEventIds(calendar);
  const { deleted, alreadyGone } = await deleteEvents(calendar, ids);
  console.log(
    `reset-demo: calendar tagged=${ids.length} deleted=${deleted} alreadyGone=${alreadyGone}`,
  );

  const dbCounts = await resetDatabase(config.slack.teamId);
  console.log(
    `reset-demo: db actionItems=${dbCounts.actionItems} participants=${dbCounts.participants} decisions=${dbCounts.decisions} proposals=${dbCounts.proposals}`,
  );

  console.log(
    `reset-demo: summary events=${ids.length} actionItems=${dbCounts.actionItems} participants=${dbCounts.participants} decisions=${dbCounts.decisions} proposals=${dbCounts.proposals}`,
  );
}

main()
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    const status = statusOf(err);
    const suffix = typeof status === "number" ? ` (HTTP ${status})` : "";
    console.error(`reset-demo failed: ${message}${suffix}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
