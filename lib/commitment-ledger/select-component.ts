import type { CommitmentIntent } from "@/lib/agent/commitment-schema";

/** The four component kinds a commitment row can render as. */
export type CommitmentComponentKind =
  | "deadline-chip"
  | "draft-nudge"
  | "chase"
  | "clarify";

/**
 * Picks which component kind renders a commitment row. Pure function — no
 * I/O, no model call — deliberately never delegated to the model, so
 * D-10's exit criterion (two questions render two visibly different
 * components) is guaranteed by data shape, not by LLM behaviour on the
 * day (D-11, 08-RESEARCH "Deterministic component selection").
 *
 * @param row - A single commitment-shaped record.
 * @returns The component kind to render for `row`.
 */
export function selectCommitmentComponent(
  row: CommitmentIntent,
): CommitmentComponentKind {
  if (
    row.status === "open" &&
    row.direction === "owed_by_me" &&
    row.due_iso != null
  ) {
    return "deadline-chip"; // a dated promise I owe
  }
  if (row.status === "overdue" && row.direction === "owed_by_me") {
    return "draft-nudge"; // overdue on my side
  }
  if (
    row.direction === "owed_to_me" &&
    (row.status === "open" || row.status === "overdue")
  ) {
    return "chase"; // owed to me — draft the message
  }
  return "clarify"; // no due date, done, dropped, or otherwise ambiguous
}
