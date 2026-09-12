import { createCalendarEvent } from "@/lib/calendar/create-event";
import { prisma } from "@/lib/db";
import { updateProposalCard } from "@/lib/slack/update-proposal-card";

/**
 * The outcome of one `approveProposal` call. `confirmed` is the only branch
 * that writes a real Calendar event; every other member is a UI state, not
 * an error (APR-02) — the caller renders ephemeral feedback from this union,
 * never a thrown exception.
 */
export type ApproveOutcome =
  | "confirmed"
  | "not_found"
  | "not_pending"
  | "not_organizer"
  | "already_scheduled";

/**
 * Approves a Proposal on behalf of the Slack user who clicked the button.
 *
 * Plain backend code (D-04): no Bolt import, no Next.js route, no
 * Trigger.dev task and no graph resume anywhere in this function — Phase 7's
 * `choose_alt` handler calls this directly after rewriting `start`/`end`
 * from the stored alternatives.
 *
 * Sequence (D-06): read row -> pending check -> clicker lookup -> token
 * guard (D-08) -> locked organizer claim (D-07) -> real Calendar event
 * (D-09's idempotent wrapper) -> persist -> update the stored card (D-10).
 *
 * @param proposalId - The Proposal id carried in the clicked button's value.
 * @param clickerSlackUserId - The Slack user id of whoever clicked Approve
 *   (`body.user.id`). The team id is read off the Proposal row itself, so
 *   this function takes exactly two parameters.
 * @returns The outcome of the click; `confirmed` is the only branch that
 *   writes to Google Calendar.
 * @throws Only what `createCalendarEvent` itself throws (a missing
 *   organizer or a cancelled-event 409 reuse) — every other path returns an
 *   outcome instead of throwing.
 */
export async function approveProposal(
  proposalId: string,
  clickerSlackUserId: string,
): Promise<ApproveOutcome> {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
  });
  if (!proposal) return "not_found";

  if (proposal.status !== "pending") {
    await updateProposalCard(proposal.card_channel, proposal.card_ts, proposal);
    return "not_pending";
  }

  const clicker = await prisma.user.findUnique({
    where: {
      team_id_slack_user_id: {
        team_id: proposal.team_id,
        slack_user_id: clickerSlackUserId,
      },
    },
  });

  // D-08: token guard runs BEFORE the claim, as a pre-read rather than an
  // extra SQL condition, so the claim SQL below stays byte-identical to
  // CONTEXT.md D-07. No write and no Google call on this path.
  if (!clicker?.google_refresh_token) {
    return "not_organizer";
  }

  // D-07: the locked conditional claim. Never extend this WHERE clause,
  // never switch to the unsafe raw variant, never fold the status
  // transition in here — the status change happens in the ordinary
  // Prisma update below.
  const claimed = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "Proposal" SET organizer_user_id = ${clicker.id}
    WHERE id = ${proposalId} AND organizer_user_id IS NULL
    RETURNING id
  `;

  if (claimed.length === 0) {
    const current = await prisma.proposal.findUnique({
      where: { id: proposalId },
    });
    if (current?.organizer_user_id !== clicker.id) {
      // Someone else already owns this row. No write of any kind here —
      // writing a terminal status onto a still-pending Proposal would lock
      // out a pre-set organizer who has not clicked yet.
      return "already_scheduled";
    }
    // Same user's own retry (a lost claim on a self-owned row) — fall
    // through into the create path below.
  }

  const { eventId, meetLink, htmlLink } = await createCalendarEvent(
    proposal,
    clicker.id,
  );
  const updated = await prisma.proposal.update({
    where: { id: proposalId },
    data: {
      calendar_event_id: eventId,
      calendar_html_link: htmlLink,
      meet_link: meetLink,
      organizer_user_id: clicker.id,
      status: "confirmed",
    },
  });

  if (!updated.card_channel || !updated.card_ts) {
    console.log(
      `[approve] no stored card; skipping update proposal=${updated.id}`,
    );
  } else {
    await updateProposalCard(updated.card_channel, updated.card_ts, updated);
  }

  return "confirmed";
}
