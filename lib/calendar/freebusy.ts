import type { ConflictSlot } from "../../types/agent";
import { getCalendarClient } from "./google-client";
import { toHktRfc3339 } from "./hkt-rfc3339";

/**
 * Checks a user's primary Google Calendar for busy blocks in a time window.
 *
 * Real `freebusy.query` lookup (CAL-01). Every request is normalized to an
 * explicit `+08:00` window via {@link toHktRfc3339} regardless of the
 * caller's input offset, and the response is re-rendered through the same
 * helper before logging — Google's own offset format on `busy[]` is
 * undocumented, so the request half (under our control) is what proves the
 * timezone handling. No pending-Proposal union here: that is CFL-01
 * (Phase 7). No writes, no Postgres access, no retry.
 *
 * @param userId - The user whose primary calendar to check.
 * @param startIso - Window start, any parseable ISO 8601 string.
 * @param endIso - Window end, any parseable ISO 8601 string.
 * @returns The user's busy blocks in the window, as `ConflictSlot[]`.
 * @throws If `startIso`/`endIso` don't parse to a valid Date, if the user
 *   has no Google refresh token, or if the freebusy response has no entry
 *   for the primary calendar or that entry carries `errors` — a failed
 *   lookup must never read as free.
 */
export async function checkConflicts(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<ConflictSlot[]> {
  const timeMin = toHktRfc3339(new Date(startIso));
  const timeMax = toHktRfc3339(new Date(endIso));

  const calendar = await getCalendarClient(userId);
  const requestBody = {
    timeMin,
    timeMax,
    timeZone: "Asia/Hong_Kong",
    items: [{ id: "primary" }],
  };
  console.log("[freebusy] request", JSON.stringify(requestBody));

  const res = await calendar.freebusy.query({ requestBody });
  const entry = Object.values(res.data.calendars ?? {})[0];

  if (!entry || (entry.errors && entry.errors.length > 0)) {
    throw new Error(
      `checkConflicts: freebusy lookup failed for user ${userId}: ${JSON.stringify(entry?.errors ?? "no calendar entry in response")}`,
    );
  }

  const busy = entry.busy ?? [];
  console.log("[freebusy] response raw", JSON.stringify(busy));

  const slots: ConflictSlot[] = busy
    .filter((b) => b.start && b.end)
    .map((b) => ({
      startIso: toHktRfc3339(new Date(b.start as string)),
      endIso: toHktRfc3339(new Date(b.end as string)),
      reason: "Busy on calendar",
    }));
  console.log("[freebusy] response hkt", JSON.stringify(slots));

  return slots;
}
