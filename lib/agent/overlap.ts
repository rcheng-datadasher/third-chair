import type { ConflictSlot } from "../../types/agent";

/**
 * Returns true if two half-open time ranges `[aStart, aEnd)` and
 * `[bStart, bEnd)` overlap.
 *
 * Half-open, end-exclusive: a range that merely touches another at a
 * boundary (one ends exactly when the other starts) does NOT overlap. This
 * is required, not a nicety — without it, approving one meeting would make
 * every back-to-back adjacent meeting on a busy day look conflicted,
 * including its own just-approved neighbour.
 *
 * This is the single overlap comparison in the repo: both clash detection
 * (`findClash`) and the model-slot re-validation in `lib/agent/conflict.ts`
 * import this function rather than writing a second comparison.
 *
 * @param aStart - Start of the first range.
 * @param aEnd - End of the first range (exclusive).
 * @param bStart - Start of the second range.
 * @param bEnd - End of the second range (exclusive).
 * @returns `true` when the two ranges overlap by more than a boundary touch.
 */
export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Finds the first busy block that overlaps a requested time range.
 *
 * Builds `Date` objects from each block's ISO strings before comparing —
 * `freebusy.query` responses are UTC (`Z`) while the request/intent side
 * carries an explicit `+08:00`; comparing raw strings would be eight hours
 * wrong (07-RESEARCH Pitfall 3). Returning the block itself (not a boolean)
 * is what lets the warning card name which block clashed.
 *
 * @param requestedStart - Start of the requested range.
 * @param requestedEnd - End of the requested range.
 * @param busy - The day's busy blocks to check against (freebusy ∪ pending Proposals).
 * @returns The first overlapping block, or `null` when none overlaps.
 */
export function findClash(
  requestedStart: Date,
  requestedEnd: Date,
  busy: ConflictSlot[],
): ConflictSlot | null {
  for (const block of busy) {
    const blockStart = new Date(block.startIso);
    const blockEnd = new Date(block.endIso);
    if (rangesOverlap(requestedStart, requestedEnd, blockStart, blockEnd)) {
      return block;
    }
  }
  return null;
}
