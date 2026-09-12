import { configure, idempotencyKeys, tasks } from "@trigger.dev/sdk";
import type { RunAgentInput } from "../../types/agent";
import { config } from "../config";
import { runAgent } from "./graph";
import type { runAgentTask } from "./tasks/run-agent";

/**
 * Dispatches one agent run, branching on the configured transport
 * (`config.agent.transport`) — the Phase 1 seam, unchanged in shape.
 *
 * `inline` awaits `runAgent` directly in the calling (Bolt) process; this is
 * Phase 1's original body. `trigger` derives an idempotency key from the
 * message's team id, channel id and timestamp — so a Slack redelivery of the
 * same event resolves to the same key and therefore one run, not two — and
 * triggers the `run-agent` Trigger.dev task by id. The task is imported
 * type-only so its code (and its transitive `runAgent` chain) never enters
 * this process's bundle; only the payload type-checks against it. Switching
 * transports is `AGENT_TRANSPORT` plus a restart — no code edit.
 *
 * @param input - Wraps the one Slack message to process.
 */
export async function dispatchAgentRun(input: RunAgentInput): Promise<void> {
  if (config.agent.transport === "inline") {
    await runAgent(input);
    return;
  }

  // Route the secret through the config module rather than letting the SDK
  // read `TRIGGER_SECRET_KEY` off `process.env` itself (D-22).
  configure({ accessToken: config.trigger.secretKey });

  // AGT-11: keyed on the message's own identity, not remembered anywhere —
  // a redelivery of the same Slack event derives the same key.
  const idempotencyKey = await idempotencyKeys.create([
    input.message.teamId,
    input.message.channelId,
    input.message.ts,
  ]);

  await tasks.trigger<typeof runAgentTask>("run-agent", input, {
    idempotencyKey,
  });
}
