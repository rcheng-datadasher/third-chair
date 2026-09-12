import type { Proposal } from "../../prisma/generated/client";

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
