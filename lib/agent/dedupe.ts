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
