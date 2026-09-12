/**
 * Trigger.dev task wrapper around `runAgent` (D-12, AGT-11).
 *
 * Holds no logic of its own: the run body is a single call, so the
 * `inline` transport in `dispatchAgentRun` and this `trigger` transport can
 * never drift into two implementations of the same behavior. Never import
 * the Bolt registration module under `lib/slack` (nor its underlying SDK
 * package) here, or anywhere reachable from `runAgent` — a Bolt `App`
 * constructed inside this worker would open a second Socket Mode connection
 * that can silently steal Approve/Reject clicks meant for the real listener.
 */
import { task } from "@trigger.dev/sdk";
import { runAgent } from "@/lib/agent/graph";
import type { RunAgentInput } from "@/types/agent";

export const runAgentTask = task({
  id: "run-agent",
  run: (input: RunAgentInput) => runAgent(input),
});
