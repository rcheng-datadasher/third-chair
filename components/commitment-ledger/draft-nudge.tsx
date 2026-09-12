"use client";

import type { SeedCommitment } from "@/lib/commitment-ledger/seed-rows";
import { getStatusLabel } from "@/lib/commitment-ledger/status-label";
import { formatHkt } from "@/utils/time";

/**
 * Drafts a plain self-facing follow-up for a promise the user made that is
 * now overdue. States the fact and the next action; it does not editorialise
 * about the user's own slippage. Pure string template, no model call (D-11).
 *
 * @param row - The overdue commitment owed by the user.
 * @returns A short follow-up sentence.
 */
function draftFollowUp(row: SeedCommitment): string {
  const promisedPart =
    row.when_promised_iso != null
      ? `, promised ${formatHkt(row.when_promised_iso)}`
      : "";
  return `Send "${row.what}" to ${row.who}${promisedPart}.`;
}

/**
 * Overdue on the user's own side. A card with an overdue micro-label
 * carrying its own symbol (status is never colour-coded alone, D-20) and a
 * drafted next-action sentence.
 *
 * @param props - The row to render.
 * @param props.row - The overdue commitment owed by the user.
 * @returns A bordered card presenting the overdue promise and next action.
 */
export function DraftNudge({ row }: { row: SeedCommitment }) {
  const status = getStatusLabel(row.status);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 text-card-foreground">
      <span className="font-mono text-xs uppercase text-muted-foreground">
        {status.symbol} {status.label} — owed by me
      </span>
      <p className="text-sm">{draftFollowUp(row)}</p>
    </div>
  );
}
