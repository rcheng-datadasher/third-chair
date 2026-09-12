import type { ConflictSlot } from "../../types/agent";
import { hktDateParts } from "../../utils/time";
import { toHktRfc3339 } from "../calendar/hkt-rfc3339";

/** `HH:MM-HH:MM`, the stored shape of `working_hours`. */
const HOURS_RANGE = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/;

/**
 * Builds a `Date` for a clock time on the requested day in HKT (UTC+8, no
 * DST): the UTC instant at `hour - 8`.
 *
 * @param isoDate - `YYYY-MM-DD` of the day in HKT.
 * @param hour - Hour of day, 0-24.
 * @param minute - Minute of hour.
 * @returns The instant.
 */
function hktInstant(isoDate: string, hour: number, minute = 0): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour - 8, minute));
}

/**
 * Turns a user's learned scheduling preferences into busy blocks for the
 * requested day, so `findClash` treats "never on Saturday" or "not after
 * 8pm" exactly like a calendar clash and the conflict card carries the
 * reason (Phase 9, S1 → scheduler wiring).
 *
 * Only `no_meeting_days` and `working_hours` shape a slot; the other three
 * vocabulary keys are duration/slot hints, not blocks.
 *
 * @param prefs - The record from `fetchGraphPreferences`, or `null`.
 * @param requestedStart - Start of the requested meeting.
 * @returns Zero or more blocks, each carrying a human-readable reason.
 */
export function preferenceBlocks(
  prefs: Record<string, unknown> | null,
  requestedStart: Date,
): ConflictSlot[] {
  if (prefs == null) return [];
  const { isoDate, weekday } = hktDateParts(requestedStart);
  const blocks: ConflictSlot[] = [];

  const days = prefs.no_meeting_days;
  if (Array.isArray(days) && days.includes(weekday)) {
    blocks.push({
      startIso: toHktRfc3339(hktInstant(isoDate, 0)),
      endIso: toHktRfc3339(hktInstant(isoDate, 24)),
      reason: `no meetings on ${weekday} (your preference)`,
    });
  }

  const hours =
    typeof prefs.working_hours === "string"
      ? prefs.working_hours.match(HOURS_RANGE)
      : null;
  if (hours) {
    const [, h1, m1, h2, m2] = hours.map(Number);
    blocks.push(
      {
        startIso: toHktRfc3339(hktInstant(isoDate, 0)),
        endIso: toHktRfc3339(hktInstant(isoDate, h1, m1)),
        reason: `outside your working hours ${prefs.working_hours}`,
      },
      {
        startIso: toHktRfc3339(hktInstant(isoDate, h2, m2)),
        endIso: toHktRfc3339(hktInstant(isoDate, 24)),
        reason: `outside your working hours ${prefs.working_hours}`,
      },
    );
  }
  return blocks;
}
