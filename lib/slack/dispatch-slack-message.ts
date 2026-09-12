import type { Logger } from "@slack/bolt";
import { dispatchAgentRun } from "@/lib/agent/dispatch";
import type { SlackMessage } from "@/types/slack";

/** Prisma's unique-constraint-violation error code. */
const PRISMA_UNIQUE_VIOLATION_CODE = "P2002";

/**
 * Narrows an unknown error to Prisma's known-request-error shape without
 * importing the generated Prisma client (D-14/D-16: `lib/slack/**` stays
 * independent of `lib/agent/**`'s Prisma dependency graph).
 *
 * @param error - The unknown value caught from `dispatchAgentRun`.
 * @returns True when `error` carries a `code` property equal to `"P2002"`.
 */
function isUniqueViolation(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === PRISMA_UNIQUE_VIOLATION_CODE
  );
}

/**
 * Shared dispatch seam every Slack trigger (watched-channel message,
 * app_mention, message shortcut) calls to reach Phase 1's `dispatchAgentRun`.
 * Converges the duplicate-dispatch case (a Slack redelivery, or two triggers
 * firing for the same message) into a single logged no-op instead of a
 * second Proposal/card, using the unique `Proposal.dedupe_key` constraint
 * as the only dedupe mechanism (no in-memory event-id set).
 *
 * @param message - The normalized Slack message to dispatch.
 * @param logger - The Bolt-provided logger for this listener invocation.
 * @returns Resolves once the dispatch (or the logged duplicate no-op) completes.
 * @throws Rethrows any error from `dispatchAgentRun` that is not a Prisma
 *   unique-violation (P2002), so Bolt's error handler logs it.
 */
export async function dispatchSlackMessage(
  message: SlackMessage,
  logger: Logger,
): Promise<void> {
  try {
    await dispatchAgentRun({ message });
  } catch (error) {
    if (isUniqueViolation(error)) {
      logger.info(`duplicate dispatch skipped ts=${message.ts}`);
      return;
    }
    throw error;
  }
}
