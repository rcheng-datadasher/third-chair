import type { ConflictSlot } from "../../types/agent";

/**
 * Checks a user's calendar for conflicts in a time window.
 *
 * Phase 1 stub: resolves to an empty array with no network call. Phase 3
 * (CAL-01) replaces this with the real busy-block lookup unioned with
 * pending Proposals; Phase 7 (CFL-01) is its second caller.
 *
 * @param userId - The user to check.
 * @param startIso - Window start, ISO 8601.
 * @param endIso - Window end, ISO 8601.
 * @returns An empty array in Phase 1.
 */
export async function checkConflicts(
  _userId: string,
  _startIso: string,
  _endIso: string,
): Promise<ConflictSlot[]> {
  return [];
}
