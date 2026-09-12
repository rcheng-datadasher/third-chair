import { Badge } from "@/components/ui/badge";

/** Token class plus a non-colour symbol so status reads without colour. */
const CHIPS: Record<string, { className: string; symbol: string }> = {
  pending: { className: "bg-primary text-primary-foreground", symbol: "●" },
  confirmed: { className: "bg-success text-success-foreground", symbol: "✓" },
  dismissed: {
    className: "border-border bg-muted text-muted-foreground",
    symbol: "✕",
  },
  already_scheduled: {
    className: "bg-secondary text-secondary-foreground",
    symbol: "→",
  },
  acted: { className: "bg-success text-success-foreground", symbol: "✓" },
  ignored: {
    className: "border-border bg-muted text-muted-foreground",
    symbol: "—",
  },
};

const UNKNOWN = {
  className: "border-border bg-muted text-muted-foreground",
  symbol: "?",
};

/**
 * Renders a ProposalStatus or DecisionVerdict as a filled chip with a symbol.
 * Unknown values fall back to a muted chip showing the raw value.
 *
 * @param props - Chip props.
 * @param props.status - The raw enum value from the row.
 * @returns The chip.
 */
export function StatusChip({ status }: { status: string }) {
  const chip = CHIPS[status] ?? UNKNOWN;
  return (
    <Badge
      className={`h-6 rounded-sm px-2 font-mono text-xs font-semibold uppercase tracking-wider ${chip.className}`}
    >
      <span aria-hidden="true">{chip.symbol}</span>
      {status.replace("_", " ")}
    </Badge>
  );
}
