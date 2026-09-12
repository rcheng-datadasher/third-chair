import type { ReactNode } from "react";
import { TableCell, TableRow } from "@/components/ui/table";

/** Header cell: sticky micro-label that survives vertical scroll. */
export const GRID_HEAD =
  "sticky top-0 z-10 h-11 border-b bg-card px-4 text-left align-middle font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground whitespace-nowrap";

/** Body cell: projector-sized text with a stable rhythm. */
export const GRID_CELL = "px-4 py-3.5 align-top whitespace-normal break-words";

/**
 * Bordered panel that scrolls on both axes and fills the remaining height of
 * the scene, so a long table never clips and the header stays visible.
 *
 * @param props - Frame props.
 * @param props.children - A `<table>` (typically with a `min-w-*` floor).
 * @returns The scroll frame.
 */
export function GridFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card shadow-retro">
      {children}
    </div>
  );
}

/**
 * The single full-width row shown when a grid has no data.
 *
 * @param props - Row props.
 * @param props.colSpan - Number of columns in the grid.
 * @param props.children - The empty-state label.
 * @returns The empty-state row.
 */
export function EmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        colSpan={colSpan}
        className={`${GRID_CELL} py-16 text-center font-mono text-sm uppercase tracking-widest text-muted-foreground`}
      >
        {children}
      </TableCell>
    </TableRow>
  );
}

/**
 * Micro-label that flags a row which arrived since the previous poll.
 *
 * @returns The label.
 */
export function NewMarker() {
  return (
    <span className="ml-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-primary">
      New
    </span>
  );
}
