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
 * One meeting/commitment intent extracted from a batch of Slack messages by
 * `extractIntents`. `messageIndex` maps back to the position of the source
 * message in the array passed in, which the caller maps back to a real
 * Slack `ts`.
 */
export interface ExtractedIntent {
  messageIndex: number;
  type: "meeting" | "commitment";
  title: string;
  startIso: string | null;
  durationMinutes: number;
  participantSlackIds: string[];
  confidence: number;
  isActionable: boolean;
  reason?: string;
}

/**
 * One busy interval returned by `checkConflicts`, unioned from calendar
 * free/busy data and pending Proposals.
 */
export interface ConflictSlot {
  startIso: string;
  endIso: string;
  reason: string;
}
