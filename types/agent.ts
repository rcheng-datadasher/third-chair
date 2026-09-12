import type { ExtractedIntent } from "../lib/agent/extract-intents";
import type { SlackMessage } from "./slack";

/**
 * Input to `runAgent` / `dispatchAgentRun`: one Slack message to process.
 */
export interface RunAgentInput {
  message: SlackMessage;
}

/**
 * Result of one `runAgent` invocation. Either id may be null when the
 * message produced no proposal or no logged decision.
 */
export interface RunAgentResult {
  proposalId: string | null;
  decisionId: string | null;
}

/**
 * One meeting intent extracted from a batch of Slack messages. Re-exported
 * from `lib/agent/extract-intents.ts` — the Zod-inferred schema type is the
 * only `ExtractedIntent` definition in the repo (D-25); this file never
 * forks it.
 */
export type { ExtractedIntent };

/**
 * One busy interval returned by `checkConflicts`, unioned from calendar
 * free/busy data and pending Proposals.
 */
export interface ConflictSlot {
  startIso: string;
  endIso: string;
  reason: string;
}
