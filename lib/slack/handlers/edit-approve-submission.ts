import type {
  AllMiddlewareArgs,
  SlackViewMiddlewareArgs,
  ViewOutput,
  ViewSubmitAction,
} from "@slack/bolt";
import { z } from "zod";
import { config } from "../../config";
import { prisma } from "../../db";
import { buildApprovalBlocks } from "../blocks";
import { slackClient } from "../client";

/**
 * Untrusted-input boundary (ASVS V5, D-28) for the four values submitted
 * from the edit-proposal modal. Every value comes straight from the Slack
 * client, so nothing here is trusted before this schema validates it.
 */
export const EditModalFieldsSchema = z.object({
  title: z.string().trim().min(1).max(150),
  selectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  selectedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.coerce.number().int().min(1).max(1440),
});

/**
 * Reads the four modal field values out of a submitted view's
 * `state.values`, keyed by the block/action ids `buildEditProposalModal`
 * built them with.
 *
 * @param view - The submitted view.
 * @returns The four raw (unvalidated) field values.
 */
function readModalFields(view: ViewOutput) {
  const values = view.state.values;
  return {
    title: values.title_block?.title_input?.value ?? "",
    selectedDate: values.date_block?.date_input?.selected_date ?? "",
    selectedTime: values.time_block?.time_input?.selected_time ?? "",
    durationMinutes: values.duration_block?.duration_input?.value ?? "",
  };
}

/**
 * Handles the edit-proposal modal's `view_submission`: validates the four
 * fields, acks (closing the modal or returning a field-level error),
 * re-reads the Proposal by the id carried in `private_metadata`, updates
 * it, and re-renders the same Slack message as the approvable card.
 *
 * Order matters (AGT-05/ordering, 05-RESEARCH "re-derive, don't resume"):
 * validate first, `ack()` is the first *awaited* statement either way, and
 * only after acking does this handler touch Postgres or Slack again.
 *
 * @throws never — every failure path acks and returns after one log line;
 *   Slack must not see a thrown error from a view handler.
 */
export async function handleEditApproveSubmission({
  ack,
  view,
  logger,
}: SlackViewMiddlewareArgs<ViewSubmitAction> &
  AllMiddlewareArgs): Promise<void> {
  const raw = readModalFields(view);
  const parsed = EditModalFieldsSchema.safeParse(raw);

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      const blockId =
        field === "title"
          ? "title_block"
          : field === "selectedDate"
            ? "date_block"
            : field === "selectedTime"
              ? "time_block"
              : "duration_block";
      errors[blockId] = issue.message;
    }
    await ack({ response_action: "errors", errors });
    return;
  }

  await ack();

  let proposalId: string;
  try {
    ({ proposalId } = z
      .object({ proposalId: z.string().min(1) })
      .parse(JSON.parse(view.private_metadata)));
  } catch {
    logger.warn(
      "edit-approve-submission: private_metadata missing a proposalId",
    );
    return;
  }

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
  });
  if (!proposal || proposal.team_id !== config.slack.teamId) {
    logger.warn(
      `edit-approve-submission: no proposal for this team at id ${proposalId}`,
    );
    return;
  }

  const { title, selectedDate, selectedTime, durationMinutes } = parsed.data;
  const start = new Date(`${selectedDate}T${selectedTime}:00+08:00`);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const updated = await prisma.proposal.update({
    where: { id: proposalId },
    data: { title, start, end },
  });

  // Re-render the same message in place — never post a second one. Phase
  // 2's updateProposalCard always renders the confirmed chip (it has no
  // `pending` branch in this branch's version), so this handler calls
  // chat.update itself with buildApprovalBlocks (the fallback route the
  // plan anticipated). Recorded in 05-03-SUMMARY.md.
  if (updated.card_channel && updated.card_ts) {
    await slackClient.chat.update({
      channel: updated.card_channel,
      ts: updated.card_ts,
      text: updated.title,
      blocks: buildApprovalBlocks(updated),
    });
  } else {
    logger.warn(
      `edit-approve-submission: proposal ${proposalId} has no stored card location`,
    );
  }
}
