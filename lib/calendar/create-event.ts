import { randomUUID } from "node:crypto";
import type { calendar_v3 } from "googleapis";
import type { Proposal } from "../../prisma/generated/client";
import { prisma } from "../db";
import { deriveEventId } from "./event-id";
import { getCalendarClient } from "./google-client";
import { toHktRfc3339 } from "./hkt-rfc3339";

/**
 * Checks whether a caught Calendar API error is a 409 conflict (an
 * "identifier already exists" response on `events.insert`).
 *
 * `GaxiosError` carries the HTTP status on both `status` and
 * `response.status`; checking both is one comparison, not an
 * error-classification module (Don't Hand-Roll).
 *
 * @param err - The caught error, of unknown shape.
 * @returns `true` if the error's status is 409.
 */
function isConflict(err: unknown): boolean {
  const e = err as { status?: number; response?: { status?: number } };
  return e?.status === 409 || e?.response?.status === 409;
}

/**
 * Reads the Meet URI from an inserted/fetched Calendar event, tolerating an
 * empty value.
 *
 * Conference data generation is asynchronous (Pitfall C), so the Meet URI
 * may not be populated on the synchronous `events.insert` response. This
 * reads whichever field is populated and returns an empty string rather
 * than throwing — the human check in this plan's `<verify>` is the actual
 * safety net for a missing link, not this function.
 *
 * @param event - The event resource from `events.insert` or `events.get`.
 * @returns The Meet URI, or an empty string if not (yet) present.
 */
function extractMeetLink(event: calendar_v3.Schema$Event): string {
  return (
    event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")
      ?.uri ??
    event.hangoutLink ??
    ""
  );
}

/**
 * Creates a Google Calendar event for a confirmed Proposal, with a Meet
 * link, participant invites and a demo cleanup tag.
 *
 * Uses a deterministic event id derived from the Proposal id
 * ({@link deriveEventId}), so a repeat call for the same Proposal targets
 * the same Calendar event id (idempotency groundwork; the 409 fallback
 * itself lands in 03-02 Task 2). Reads Participant emails from Postgres
 * (read-only, D-14) and never writes back to Postgres.
 *
 * @param proposal - The confirmed proposal to create an event for. Its
 *   Prisma-generated type and this export's name are Phase 1's stub
 *   contract; the signature is extended additively here.
 * @param organizerUserId - The user to authenticate the Calendar write as.
 *   Defaults to `proposal.organizer_user_id`, since Phase 4's Approve
 *   handler calls this with one argument after already setting that column.
 * @returns The created (or, once 03-02 Task 2 lands, reused) event's id,
 *   Meet link and Calendar `htmlLink`.
 * @throws `MissingOrganizerError` if neither `organizerUserId` nor
 *   `proposal.organizer_user_id` resolves to a user id — before any Google
 *   or database call (D-15: never a silent no-op).
 * @throws `CancelledEventError` if a repeat call's deterministic id 409s
 *   and the existing event's status is `cancelled` — never returned as a
 *   reused success (Pitfall D).
 */
export async function createCalendarEvent(
  proposal: Proposal,
  organizerUserId?: string,
): Promise<{ eventId: string; meetLink: string; htmlLink: string }> {
  const organizer = organizerUserId ?? proposal.organizer_user_id;
  if (!organizer) {
    const err = new Error(
      `createCalendarEvent: proposal ${proposal.id} has no organizer; pass organizerUserId or set organizer_user_id`,
    );
    err.name = "MissingOrganizerError";
    throw err;
  }

  const calendar = await getCalendarClient(organizer);
  const eventId = deriveEventId(proposal.id);

  const participants = await prisma.participant.findMany({
    where: { proposal_id: proposal.id },
    select: { email: true },
  });
  const attendeeEmails = [
    ...new Set(
      participants
        .map((p) => p.email.trim().toLowerCase())
        .filter((email) => email.length > 0),
    ),
  ].sort();
  if (attendeeEmails.length === 0) {
    console.log("[create-event] no attendees; no invite sent");
  }
  const attendees = attendeeEmails.map((email) => ({ email }));

  const requestBody = {
    id: eventId,
    summary: proposal.title,
    start: {
      dateTime: toHktRfc3339(proposal.start),
      timeZone: "Asia/Hong_Kong",
    },
    end: { dateTime: toHktRfc3339(proposal.end), timeZone: "Asia/Hong_Kong" },
    attendees,
    conferenceData: {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    extendedProperties: { private: { demo: "true" } },
  };

  try {
    const res = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody,
    });
    const meetLink = extractMeetLink(res.data);
    console.log(
      `[create-event] inserted id=${res.data.id ?? eventId} conferenceStatus=${res.data.conferenceData?.createRequest?.status?.statusCode} meetLink=${meetLink}`,
    );
    return {
      eventId: res.data.id ?? eventId,
      meetLink,
      htmlLink: res.data.htmlLink ?? "",
    };
  } catch (err) {
    if (!isConflict(err)) throw err;

    // D-12: 409 -> events.get with the same deterministic id, treat as success.
    // Never re-insert or update here — that is exactly what would send a
    // second invitation email or create a second conference.
    console.log(`[create-event] 409 -> events.get id=${eventId}`);
    const existing = await calendar.events.get({
      calendarId: "primary",
      eventId,
    });
    if (existing.data.status === "cancelled") {
      // Pitfall D: undocumented edge case — fail loudly, never fake success.
      const cancelledErr = new Error(
        `createCalendarEvent: event ${eventId} for proposal ${proposal.id} exists but is cancelled; cannot reuse it`,
      );
      cancelledErr.name = "CancelledEventError";
      throw cancelledErr;
    }
    return {
      eventId: existing.data.id ?? eventId,
      meetLink: extractMeetLink(existing.data),
      htmlLink: existing.data.htmlLink ?? "",
    };
  }
}
