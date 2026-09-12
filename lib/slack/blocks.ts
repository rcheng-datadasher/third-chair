import type { Proposal } from "../../prisma/generated/client";
import type { ModalView } from "@slack/types";
import type { Participant } from "../../prisma/generated/client";
import { hktDateParts } from "../../utils/time";

/**
 * Builds the Block Kit body for a pending Proposal's approval card.
 *
 * Phase 1 hardcoded layout: one section with the title, and one actions
 * block with a single primary "Approve" button. The `approve_proposal`
 * action id and "button value = proposal id" conventions are fixed here for
 * the rest of the milestone. Phase 2 replaces the copy/layout; Phase 2 also
 * adds the paired "Reject" button (not present in Phase 1).
 *
 * @param p - The proposal to render, needing only `id` and `title`.
 * @returns Block Kit blocks array for `chat.postMessage`/`chat.update`.
 */
export function buildApprovalBlocks(p: Pick<Proposal, "id" | "title">) {
  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${p.title}*\n(hardcoded Phase 1 card)` },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          action_id: "approve_proposal",
          text: { type: "plain_text", text: "Approve" },
          style: "primary",
          value: p.id,
        },
      ],
    },
  ];
}

/**
 * Builds the Block Kit body for a medium-confidence Proposal's card
 * (D-15): the same body `buildApprovalBlocks` renders, with its one-click
 * "Approve" button swapped for "Edit & approve" (`edit_approve_proposal`)
 * plus a "Reject" button. A medium-band proposal is never a single click
 * from the calendar — the human corrects it in the modal first (AGT-05).
 *
 * Consumes `buildApprovalBlocks` rather than duplicating its layout, so any
 * later change to the card's field set lands in both variants for free.
 *
 * @param p - The proposal to render, needing only `id` and `title`.
 * @returns Block Kit blocks array for `chat.postMessage`.
 */
export function buildEditApproveBlocks(p: Pick<Proposal, "id" | "title">) {
  const blocks = buildApprovalBlocks(p);
  const hasActions = blocks.some((block) => block.type === "actions");
  const editApproveActions = {
    type: "actions",
    elements: [
      {
        type: "button",
        action_id: "edit_approve_proposal",
        text: { type: "plain_text", text: "Edit & approve" },
        style: "primary",
        value: p.id,
      },
      {
        type: "button",
        action_id: "reject_proposal",
        text: { type: "plain_text", text: "Reject" },
        style: "danger",
        value: p.id,
      },
    ],
  };
  return hasActions
    ? blocks.map((block) => (block.type === "actions" ? editApproveActions : block))
    : [...blocks, editApproveActions];
}

/** `view_submission` callback id for the edit-proposal modal (D-15). */
export const EDIT_APPROVE_MODAL_CALLBACK_ID = "edit_approve_proposal_modal";

/**
 * Builds the Block Kit `view` for the Edit & approve modal, prefilled from
 * the live Proposal row (never from anything round-tripped through Slack).
 *
 * `private_metadata` carries exactly one key, `proposalId` (05-RESEARCH
 * Pitfall C, "re-derive, don't resume") — the submission handler re-reads
 * everything else from Postgres. Participants are shown read-only (Slack
 * user ids only, never an email) — editing them is out of this plan's
 * scope (Flagged assumptions).
 *
 * @param p - The proposal to render, with `participants` included.
 * @returns A Block Kit `view` object for `client.views.open`.
 */
export function buildEditProposalModal(
  p: Proposal & { participants: Participant[] },
): ModalView {
  const { isoDate, time } = hktDateParts(p.start);
  const durationMinutes = Math.round(
    (p.end.getTime() - p.start.getTime()) / 60_000,
  );
  // Slack user ids only — never an email, token or stored profile field
  // (T-05-16). A participant with no Slack id (shouldn't happen in this
  // demo's two-user path) is simply omitted rather than falling back to
  // anything identifying.
  const participantLabels = p.participants
    .filter((participant) => participant.slack_user_id != null)
    .map((participant) => `<@${participant.slack_user_id}>`);

  return {
    type: "modal",
    callback_id: EDIT_APPROVE_MODAL_CALLBACK_ID,
    private_metadata: JSON.stringify({ proposalId: p.id }),
    title: { type: "plain_text", text: "Edit proposal" },
    submit: { type: "plain_text", text: "Save & show approval" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "title_block",
        label: { type: "plain_text", text: "Title" },
        element: {
          type: "plain_text_input",
          action_id: "title_input",
          initial_value: p.title,
        },
      },
      {
        type: "input",
        block_id: "date_block",
        label: { type: "plain_text", text: "Date (HKT)" },
        element: {
          type: "datepicker",
          action_id: "date_input",
          initial_date: isoDate,
        },
      },
      {
        type: "input",
        block_id: "time_block",
        label: { type: "plain_text", text: "Time (HKT)" },
        element: {
          type: "timepicker",
          action_id: "time_input",
          initial_time: time.slice(0, 5),
        },
      },
      {
        type: "input",
        block_id: "duration_block",
        label: { type: "plain_text", text: "Duration (minutes)" },
        element: {
          type: "plain_text_input",
          action_id: "duration_input",
          initial_value: String(durationMinutes),
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Participants: ${participantLabels.join(", ") || "none"}`,
          },
        ],
      },
    ],
  };
}

/**
 * Builds the Block Kit body for a confirmed Proposal's card — the same
 * section plus a static confirmed status chip, and no actions block.
 *
 * @param p - The proposal to render, needing only `title`.
 * @returns Block Kit blocks array for `chat.update`.
 */
export function buildConfirmedBlocks(p: Pick<Proposal, "title">) {
  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${p.title}*\n(hardcoded Phase 1 card)` },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: "✅ Confirmed" }],
    },
  ];
}
