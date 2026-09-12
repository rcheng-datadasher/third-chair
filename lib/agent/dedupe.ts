import { createHash } from "node:crypto";

/** Separator joining the four dedupe-key parts. Never appears in a Slack ts or team/channel id. */
const SEPARATOR = "::";

/**
 * Computes a stable, collision-resistant dedupe key for a Proposal.
 *
 * Pure function, no I/O: the same four inputs always produce the same
 * digest, and a different `threadOrMessageTs` (i.e. a different mention)
 * always produces a different digest.
 *
 * @param teamId - Slack team id.
 * @param channelId - Slack channel id.
 * @param threadOrMessageTs - The mention's own Slack `ts` (or thread ts).
 * @param normalizedIntent - A normalized string describing the intent, used
 *   to distinguish multiple proposals that could arise from the same
 *   message/thread.
 * @returns A 64-character lowercase hex sha256 digest.
 */
export function computeDedupeKey(
  teamId: string,
  channelId: string,
  threadOrMessageTs: string,
  normalizedIntent: string,
): string {
  const material = [
    teamId,
    channelId,
    threadOrMessageTs,
    normalizedIntent,
  ].join(SEPARATOR);
  return createHash("sha256").update(material).digest("hex");
}

/** Milliseconds in a 5-minute bucket, for flooring `start_iso` (AGT-09). */
const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Normalizes an extracted intent into the fourth `computeDedupeKey` input:
 * a string stable across insignificant differences (a few minutes' drift in
 * the resolved start time, participant id order/duplicates) but distinct
 * across a genuinely different intent.
 *
 * Pure function, no I/O. `start_iso` is floored to its 5-minute bucket (so
 * 11:00 and 11:04 collapse, 11:05 does not); `participant_slack_ids` is
 * sorted and de-duplicated so id order/repeats never change the key.
 *
 * @param input - The intent's type, resolved `start_iso`, and participant
 *   Slack ids.
 * @returns A `type|flooredStartIso|sortedIds` string (D-20). No second hash
 *   helper — `computeDedupeKey` still owns the actual digest (D-21).
 */
export function normalizeIntent(input: {
  type: string;
  start_iso: string;
  participant_slack_ids: string[];
}): string {
  const startMs = new Date(input.start_iso).getTime();
  const flooredMs = Math.floor(startMs / FIVE_MINUTES_MS) * FIVE_MINUTES_MS;
  const flooredIso = new Date(flooredMs).toISOString();

  const ids = [...new Set(input.participant_slack_ids)].sort().join(",");

  return [input.type, flooredIso, ids].join("|");
}
