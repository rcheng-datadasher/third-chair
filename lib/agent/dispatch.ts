import type { RunAgentInput } from "../../types/agent";
import { runAgent } from "./graph";

/**
 * Dispatches one agent run. Phase 1 body is an inline call only — no
 * transport branching, no background-job wrapper. Phase 4 adds the
 * transport-selection config switch and the Trigger.dev task; this
 * signature does not change.
 *
 * @param input - Wraps the one Slack message to process.
 */
export async function dispatchAgentRun(input: RunAgentInput): Promise<void> {
  await runAgent(input);
}
