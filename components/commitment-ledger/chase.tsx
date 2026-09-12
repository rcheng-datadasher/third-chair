"use client";

import type { SeedCommitment } from "@/lib/commitment-ledger/seed-rows";
import { getStatusLabel } from "@/lib/commitment-ledger/status-label";
import { formatHkt } from "@/utils/time";

/**
 * Drafts a short, neutral, sendable chase message for a commitment owed to
 * the user. States the promise, the person, and the date(s) and asks where
 * it stands — never shaming, accusatory, guilt-tripping or loss-aversion
 * framing toward `row.who` (this plan's prohibition: a passive-aggressive
 * draft is a worse outcome than no draft at all). Pure string template, no
 * model call — there is no second agent loop in this component (D-11).
 *
 * @param row - The commitment owed to the user.
 * @returns A plain-text message the user could paste verbatim into Slack.
 */
function draftChaseMessage(row: SeedCommitment): string {
  const promisedPart =
    row.when_promised_iso != null
      ? ` (promised ${formatHkt(row.when_promised_iso)})`
      : "";
  const duePart = row.due_iso != null ? `, due ${formatHkt(row.due_iso)}` : "";
  return `Hey ${row.who} — checking in on "${row.what}"${promisedPart}${duePart}. Where does this stand?`;
}

/**
 * "Owed to me" row: shows the promise as data, a status micro-label with a
 * leading symbol (status is never colour-coded alone, D-20), a drafted
 * chase message the user could send verbatim, and a `Nudge` button.
 *
 * @param props - The row to render.
 * @param props.row - The commitment owed to the user.
 * @returns A bordered card presenting the chase.
 */
export function Chase({ row }: { row: SeedCommitment }) {
  const status = getStatusLabel(row.status);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 text-card-foreground">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {row.what} — {row.who}
        </span>
        <span className="font-mono text-xs uppercase text-muted-foreground">
          {status.symbol} {status.label}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        Promised{" "}
        {row.when_promised_iso != null
          ? formatHkt(row.when_promised_iso)
          : "unknown date"}
        {row.due_iso != null ? ` · Due ${formatHkt(row.due_iso)}` : ""}
      </div>
      <pre className="whitespace-pre-wrap rounded border border-border bg-muted p-2 font-mono text-xs text-foreground">
        {draftChaseMessage(row)}
      </pre>
      <button
        type="button"
        disabled
        className="self-start rounded border border-border bg-secondary px-3 py-1 text-xs text-secondary-foreground disabled:opacity-50"
      >
        Nudge
      </button>
    </div>
  );
}
