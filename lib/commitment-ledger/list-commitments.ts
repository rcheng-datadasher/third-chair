import { z } from "zod";
import type { LedgerCommitment } from "@/lib/agent/commitment-schema";
import { toHktRfc3339 } from "@/lib/calendar/hkt-rfc3339";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import type { Commitment } from "../../prisma/generated/client";

/**
 * The filter the `queryCommitments` chat action may pass, as query-string
 * values. Both optional; an absent field matches everything. Shared by the
 * `/api/commitments` route (server boundary) and the client action.
 */
export const CommitmentFilterSchema = z.object({
  direction: z.enum(["owed_by_me", "owed_to_me"]).optional(),
  status: z.enum(["open", "done", "overdue", "dropped"]).optional(),
});

/** The Zod-inferred commitment filter. */
export type CommitmentFilter = z.infer<typeof CommitmentFilterSchema>;

/**
 * Projects a `Commitment` row to the ledger's `LedgerCommitment` shape,
 * deriving `overdue` for an open row whose `due` is in the past so the
 * model's `status: "overdue"` filter needs no stored state. Timestamps are
 * serialised with the +08:00 offset so the chat model narrates HKT times,
 * matching what the cards render.
 *
 * @param row - The Prisma row.
 * @param now - The instant to judge `due` against.
 * @returns The row in the shape the ledger's card components render.
 */
function toRow(row: Commitment, now: Date): LedgerCommitment {
  const overdue =
    row.status === "open" &&
    row.due != null &&
    row.due.getTime() < now.getTime();
  return {
    id: row.id,
    type: "commitment",
    message_index: 0,
    direction: row.direction,
    what: row.what,
    who: row.who,
    when_promised_iso: row.when_promised
      ? toHktRfc3339(row.when_promised)
      : null,
    due_iso: row.due ? toHktRfc3339(row.due) : null,
    source_link: `slack://channel/${row.source_channel}/${row.source_ts}`,
    status: overdue ? "overdue" : row.status,
    confidence: row.confidence,
    is_actionable: row.is_actionable,
    reason: row.reason,
  };
}

/**
 * Lists the demo persona's commitments from the database, newest first.
 * "Me" is `config.seed.userA` — the dashboard has no login, so the ledger
 * reads every row that Slack user authored and answers `direction`
 * relative to them.
 *
 * @param filter - Optional `direction` / `status` narrowing.
 * @param now - The instant used to derive `overdue`; defaults to now.
 * @returns The matching rows in ledger shape.
 */
export async function listCommitments(
  filter: CommitmentFilter,
  now: Date = new Date(),
): Promise<LedgerCommitment[]> {
  // ponytail: "me" = seed user A by authorship only. A colleague's
  // "can you review the PR?" (their owed_to_me) is something A owes but is
  // not attributed to A; resolve `who` against Slack identities to close that.
  const rows = await prisma.commitment.findMany({
    where: {
      author_slack_user_id: config.seed.userA.slackId,
      direction: filter.direction,
    },
    orderBy: { created_at: "desc" },
  });
  return rows
    .map((row) => toRow(row, now))
    .filter((row) => filter.status == null || row.status === filter.status);
}
