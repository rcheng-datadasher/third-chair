import type { KnownBlock } from "@slack/types";
import {
  type ApprovalCardInput,
  buildApprovalBlocks,
  escapeMrkdwn,
} from "./blocks";

/**
 * Phase 7's conflict-card block builders (CFL-03/CFL-05).
 *
 * Deviation from 07-02-PLAN.md (orchestrator reality-adjustment, recorded in
 * 07-02-SUMMARY.md): these builders live in this sibling file rather than
 * inside `lib/slack/blocks.ts` because 04-01 owns `blocks.ts` concurrently
 * this round and a parallel edit there would guarantee a merge conflict.
 * Both builders import `buildApprovalBlocks` from `blocks.ts` (read-only)
 * so the Approve/Reject buttons and their existing handlers are reused
 * verbatim — D-25's "extend, never restructure" intent is unchanged, it
 * just lives one file over.
 */

/**
 * Builds the degraded static conflict-warning card (CFL-05): a section
 * naming the clashing block, followed by Phase 2's ordinary approval blocks
 * so Approve and Reject stay on the card and their existing handlers are
 * reused verbatim. This is the card the 14:15 cut line stops at — shipped
 * code, not a contingency.
 *
 * @param p - The full card input (same shape as the approve/reject card).
 * @param clashSummary - The clashing block's HKT range, from `summarizeClash`.
 * @returns Block Kit blocks array for `chat.postMessage`.
 */
export function buildConflictWarningBlocks(
  p: ApprovalCardInput,
  clashSummary: string,
): KnownBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⚠️ *${escapeMrkdwn(p.title.trim() || "(untitled proposal)")}* clashes with: ${escapeMrkdwn(clashSummary)}\n_Automatic alternatives are not available — please reschedule manually._`,
      },
    },
    { type: "divider" },
    ...buildApprovalBlocks(p),
  ];
}
