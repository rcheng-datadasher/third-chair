import type { LedgerCommitment } from "@/lib/agent/commitment-schema";

/**
 * The ambiguous row: no due date, done, or dropped. Structurally different
 * from the other three — it leads with a question rather than data, and
 * shows the extractor's own uncertainty reason plus a traceable source link
 * back to the originating message. No action button; there is nothing
 * actionable to offer until a human resolves the ambiguity.
 *
 * @param props - The row to render.
 * @param props.row - The ambiguous commitment.
 * @returns A card leading with a clarifying question.
 */
export function ClarifyCard({ row }: { row: LedgerCommitment }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-border bg-card p-3 text-card-foreground">
      <p className="text-sm font-medium">
        What is actually being promised between {row.who} and you, and by when —
        &quot;{row.what}&quot;?
      </p>
      {row.reason != null ? (
        <p className="text-xs text-muted-foreground">{row.reason}</p>
      ) : null}
      {row.source_link != null ? (
        <p className="text-xs text-muted-foreground">
          Source: {row.source_link}
        </p>
      ) : null}
    </div>
  );
}
