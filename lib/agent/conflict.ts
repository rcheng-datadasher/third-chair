import type { ConflictSlot } from "../../types/agent";
import { formatHkt, hktDateParts } from "../../utils/time";
import { checkConflicts } from "../calendar/freebusy";
import { toHktRfc3339 } from "../calendar/hkt-rfc3339";
import { prisma } from "../db";

/** HKT working-day boundaries queried for every conflict check (07-RESEARCH Pitfall 5). */
const WORKING_DAY_START_HOUR = 9;
const WORKING_DAY_END_HOUR = 19;

/**
 * Builds the requested day's HKT working-hours window (09:00-19:00),
 * widened to cover the requested range itself when it falls outside those
 * hours.
 *
 * Querying the whole working day rather than just the requested slot is
 * what lets `proposeAlternatives` (Task 2) see the rest of the calendar
 * owner's day — a slot-sized window would let the model propose a time the
 * owner is already busy at (07-RESEARCH Pitfall 5).
 *
 * @param requestedStart - Start of the requested meeting range.
 * @param requestedEnd - End of the requested meeting range.
 * @returns `timeMin`/`timeMax` as RFC 3339 strings carrying an explicit `+08:00`.
 */
export function hktWorkingDayWindow(
  requestedStart: Date,
  requestedEnd: Date,
): { timeMin: string; timeMax: string } {
  const { isoDate } = hktDateParts(requestedStart);
  const [year, month, day] = isoDate.split("-").map(Number);

  // Build the day's working-hours boundaries as HKT instants: a UTC Date
  // constructed at (hour - 8) is the same instant as HKT hour:00 (HKT is
  // UTC+8 with no DST).
  const dayStart = new Date(
    Date.UTC(year, month - 1, day, WORKING_DAY_START_HOUR - 8, 0, 0),
  );
  const dayEnd = new Date(
    Date.UTC(year, month - 1, day, WORKING_DAY_END_HOUR - 8, 0, 0),
  );

  const windowStart = requestedStart < dayStart ? requestedStart : dayStart;
  const windowEnd = requestedEnd > dayEnd ? requestedEnd : dayEnd;

  return {
    timeMin: toHktRfc3339(windowStart),
    timeMax: toHktRfc3339(windowEnd),
  };
}

/**
 * Collects the whole HKT working day's busy set: the calendar owner's real
 * free/busy blocks (via `checkConflicts`, read-only) unioned with pending
 * Proposals in the same window (CFL-01, D-09).
 *
 * Never throws: a missing calendar-connected user or a failed `freebusy`
 * lookup is logged loudly and treated as an empty calendar half so the run
 * continues on whatever busy data is available (FA-2, FA-3).
 *
 * @param args - The team to scope the pending-Proposal query to, and the
 *   requested meeting range that anchors the day window.
 * @returns The unioned busy set for the day, plus the exact `timeMin`/
 *   `timeMax` sent to `freebusy.query` (D-10, success criterion 3).
 */
export async function collectBusyBlocks(args: {
  teamId: string;
  requestedStart: Date;
  requestedEnd: Date;
}): Promise<{ busy: ConflictSlot[]; timeMin: string; timeMax: string }> {
  const { teamId, requestedStart, requestedEnd } = args;
  const { timeMin, timeMax } = hktWorkingDayWindow(
    requestedStart,
    requestedEnd,
  );
  console.log(`[conflict] window timeMin=${timeMin} timeMax=${timeMax}`);

  let freebusyBlocks: ConflictSlot[] = [];

  // ponytail: the calendar owner is resolved as the team's single user with
  // a non-null google_refresh_token — a two-user-demo assumption. Multi-
  // organizer resolution is a later change.
  const owner = await prisma.user.findFirst({
    where: { team_id: teamId, google_refresh_token: { not: null } },
  });

  if (owner == null) {
    console.log("[conflict] no calendar-connected user");
  } else {
    try {
      freebusyBlocks = await checkConflicts(owner.id, timeMin, timeMax);
    } catch (err) {
      // ponytail: a failed freebusy lookup is treated as an empty calendar
      // so the demo path cannot die on a calendar outage; the loud log line
      // is the compensating control.
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[conflict] freebusy FAILED ${message}`);
    }
  }

  const windowStart = new Date(timeMin);
  const windowEnd = new Date(timeMax);
  const pendingRows = await prisma.proposal.findMany({
    where: {
      team_id: teamId,
      status: "pending",
      start: { lt: windowEnd },
      end: { gt: windowStart },
    },
  });

  // Drop rows already carrying alternatives — those are conflict cards
  // awaiting a Choose click, and counting them as busy would make every
  // later check on that day see a phantom busy block (07-RESEARCH Pitfall
  // 5 / FA-4).
  const pendingBlocks: ConflictSlot[] = pendingRows
    .filter((row) => row.alternatives == null)
    .map((row) => ({
      startIso: toHktRfc3339(row.start),
      endIso: toHktRfc3339(row.end),
      reason: `pending proposal: ${row.title}`,
    }));

  const busy = [...freebusyBlocks, ...pendingBlocks];
  console.log(`[conflict] busy=${busy.length}`);

  return { busy, timeMin, timeMax };
}

/**
 * Renders one short human line naming a clashing busy block, in HKT.
 *
 * @param slot - The clashing block, as returned by `findClash`.
 * @returns A one-line summary, e.g. "the existing 11:00 HKT event".
 */
export function summarizeClash(slot: ConflictSlot): string {
  return `${formatHkt(slot.startIso)} - ${formatHkt(slot.endIso)}`;
}
