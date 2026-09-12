import type { CommitmentIntent } from "@/lib/agent/commitment-schema";

/** A status's leading symbol paired with its uppercase micro-label. */
export interface StatusLabel {
  symbol: string;
  label: string;
}

/**
 * The symbol + uppercase label for every commitment status. A colour-blind
 * viewer must still be able to read a row's status (D-20), so every
 * commitment-ledger component reads this instead of colour-coding status.
 */
const STATUS_LABELS: Record<CommitmentIntent["status"], StatusLabel> = {
  open: { symbol: "○", label: "OPEN" },
  done: { symbol: "✓", label: "DONE" },
  overdue: { symbol: "⚠", label: "OVERDUE" },
  dropped: { symbol: "✕", label: "DROPPED" },
};

/**
 * Looks up the symbol + uppercase label pair for a commitment status. Pure,
 * no I/O — the single source of truth every commitment-ledger component
 * reads instead of re-deriving its own status text (CLAUDE.md "Reuse before
 * writing").
 *
 * @param status - A commitment row's status.
 * @returns The symbol and uppercase label for `status`.
 */
export function getStatusLabel(
  status: CommitmentIntent["status"],
): StatusLabel {
  return STATUS_LABELS[status];
}
