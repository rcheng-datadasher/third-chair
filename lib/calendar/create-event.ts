import type { Proposal } from "../../prisma/generated/client";

/**
 * Creates a Google Calendar event for a confirmed Proposal.
 *
 * Phase 1 stub: not implemented. Never returns a fabricated id — a fake
 * success here would look exactly like a real calendar write in a phase
 * whose whole point is that no calendar write happens.
 *
 * @param proposal - The confirmed proposal to create an event for.
 * @throws Always, in Phase 1 — Phase 3 (CAL-02) implements this.
 */
export async function createCalendarEvent(
  _proposal: Proposal,
): Promise<{ eventId: string; meetLink: string }> {
  throw new Error(
    "createCalendarEvent: not implemented until Phase 3 (CAL-02)",
  );
}
