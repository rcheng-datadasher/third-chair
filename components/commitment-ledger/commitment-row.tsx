"use client";

import type { LedgerCommitment } from "@/lib/agent/commitment-schema";
import { selectCommitmentComponent } from "@/lib/commitment-ledger/select-component";
import { Chase } from "./chase";
import { ClarifyCard } from "./clarify-card";
import { DeadlineChip } from "./deadline-chip";
import { DraftNudge } from "./draft-nudge";

/**
 * Fan-out seam between a raw commitment row and its presentational
 * component. Calls `selectCommitmentComponent` exactly once and switches on
 * the returned kind — the model never decides which component renders a
 * row (D-11). The switch is exhaustive over all four kinds — the `default`
 * arm exists only to make an unhandled fifth kind a loud, immediate error,
 * never a silent fallback.
 *
 * @param props - The row to render.
 * @param props.row - A single seeded commitment.
 * @returns The presentational component selected for this row's kind.
 * @throws Only if a future kind is added to `CommitmentComponentKind`
 *   without a matching arm here.
 */
export function CommitmentRow({ row }: { row: LedgerCommitment }) {
  const kind = selectCommitmentComponent(row);
  switch (kind) {
    case "chase":
      return <Chase row={row} />;
    case "deadline-chip":
      return <DeadlineChip row={row} />;
    case "draft-nudge":
      return <DraftNudge row={row} />;
    case "clarify":
      return <ClarifyCard row={row} />;
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unhandled commitment component kind: ${_exhaustive}`);
    }
  }
}
