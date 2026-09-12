import type {
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from "@slack/bolt";

/**
 * Handles the `/secretary` slash command. Per the Phase 2 pre-applied scope
 * cut (02-CONTEXT.md, decided before the build window) and Research
 * Orchestrator Note 5 (a slash command carries no message `ts`, so it
 * cannot build a `SlackMessage`/dedupe key), this is an ack-and-log stub
 * this phase — it dispatches nothing.
 *
 * @param args - Bolt's command middleware args.
 * @param args.command - The slash-command payload.
 * @param args.ack - Bolt's ack function; must be called first (D-07).
 * @param args.logger - The Bolt-provided logger for this listener invocation.
 * @returns Resolves once the command has been acked and logged.
 * @throws never — this stub performs no fallible work after `ack()`.
 */
export async function handleSecretaryCommand({
  command,
  ack,
  logger,
}: AllMiddlewareArgs & SlackCommandMiddlewareArgs): Promise<void> {
  await ack(); // FIRST STATEMENT — D-07, no response body.

  logger.info(
    `/secretary reached handler trigger_id=${command.trigger_id} user=${command.user_id} channel=${command.channel_id}`,
  );
  logger.info("/secretary: not implemented in this build");
  // Branch point: Phase 7 adds a `scan` subcommand branch inside this
  // handler (parsed from `command.text`). Nothing is dispatched this phase.
}
