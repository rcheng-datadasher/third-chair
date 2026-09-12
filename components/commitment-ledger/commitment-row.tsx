"use client";

import type { SeedCommitment } from "@/lib/commitment-ledger/seed-rows";
import { selectCommitmentComponent } from "@/lib/commitment-ledger/select-component";
import { Chase } from "./chase";

/**
 * Fan-out seam between a raw commitment row and its presentational
 * component. Calls `selectCommitmentComponent` exactly once and switches on
 * the returned kind — the model never decides which component renders a
 * row (D-11). Only the `chase` arm renders a real component so far; Task 2
 * wires `DeadlineChip`, `DraftNudge` and `ClarifyCard` for the remaining
 * three arms, which for now mirror 08-01's plain-text render-prop line. The
 * switch is exhaustive over all four kinds — the `default` arm exists only
 * to make an unhandled fifth kind a loud, immediate error, never a silent
 * fallback.
 *
 * @param props - The row to render.
 * @param props.row - A single seeded commitment.
 * @returns The presentational component (or interim text) for this row's kind.
 * @throws Only if a future kind is added to `CommitmentComponentKind`
 *   without a matching arm here.
 */
export function CommitmentRow({ row }: { row: SeedCommitment }) {
  const kind = selectCommitmentComponent(row);
  switch (kind) {
    case "chase":
      return <Chase row={row} />;
    case "deadline-chip":
    case "draft-nudge":
    case "clarify":
      return (
        <p className="text-sm">
          {row.what} — {row.who} ({kind})
        </p>
      );
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unhandled commitment component kind: ${_exhaustive}`);
    }
  }
}
