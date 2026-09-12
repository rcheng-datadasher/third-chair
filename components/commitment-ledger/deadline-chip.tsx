"use client";

import type { SeedCommitment } from "@/lib/commitment-ledger/seed-rows";
import { getStatusLabel } from "@/lib/commitment-ledger/status-label";
import { formatHkt } from "@/utils/time";

/**
 * A dated promise the user owes, rendered as the most compact of the four
 * shapes — a single inline chip, not a card. Real block-time booking needs a
 * calendar write, and `lib/calendar/**` is off-limits to this phase (D-16),
 * so `Block time` renders as a visibly disabled control with an adjacent
 * note instead of faking a success state (FA-10).
 *
 * @param props - The row to render.
 * @param props.row - A dated promise owed by the user.
 * @returns An inline chip showing the due date, the promise, and a disabled
 *   `Block time` affordance.
 */
export function DeadlineChip({ row }: { row: SeedCommitment }) {
  const status = getStatusLabel(row.status);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs">
      <span aria-hidden="true">{status.symbol}</span>
      <span className="font-mono text-muted-foreground">
        {row.due_iso != null ? formatHkt(row.due_iso) : "no due date"}
      </span>
      <span className="truncate">{row.what}</span>
      <button
        type="button"
        disabled
        className="rounded border border-border bg-muted px-2 py-0.5 text-muted-foreground disabled:opacity-50"
      >
        Block time
      </button>
      <span className="text-muted-foreground">(not wired)</span>
    </div>
  );
}
