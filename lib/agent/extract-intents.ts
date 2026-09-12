import type { ExtractedIntent } from "../../types/agent";
import type { SlackMessage } from "../../types/slack";

/** Context passed to `extractIntents` alongside the message batch. */
export type ExtractIntentsContext = Record<string, unknown>;

/**
 * Extracts meeting/commitment intents from a batch of Slack messages.
 *
 * Phase 1 stub: resolves to an empty array without calling a model. Phase 5
 * (AGT-02) replaces this with the real numbered-line rendering and
 * Zod-validated parse. Batch-first signature: a single-message call passes
 * an array of one.
 *
 * @param messages - The Slack messages to scan, in order.
 * @param ctx - Extraction context (e.g. reference time, participants).
 * @returns An empty array in Phase 1.
 */
export async function extractIntents(
  _messages: SlackMessage[],
  _ctx: ExtractIntentsContext,
): Promise<ExtractedIntent[]> {
  return [];
}
