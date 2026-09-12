import type {
  AllMiddlewareArgs,
  MessageShortcut,
  SlackShortcutMiddlewareArgs,
} from "@slack/bolt";

/**
 * Handles the "Extract action items" message shortcut. Per the Phase 2
 * pre-applied scope cut (02-CONTEXT.md, decided before the build window),
 * this is an ack-and-log stub this phase: it does not dispatch and does not
 * implement shortcut extraction. The registration and dispatch-seam layout
 * exist now so Phases 4/5/7 append without restructuring (D-17); a future
 * phase gives this handler a real body.
 *
 * @param args - Bolt's shortcut middleware args, narrowed to `MessageShortcut`.
 * @param args.shortcut - The message-shortcut payload.
 * @param args.ack - Bolt's ack function; must be called first (D-07).
 * @param args.logger - The Bolt-provided logger for this listener invocation.
 * @returns Resolves once the shortcut has been acked and logged.
 * @throws never — this stub performs no fallible work after `ack()`.
 */
export async function handleExtractShortcut({
  shortcut,
  ack,
  logger,
}: AllMiddlewareArgs &
  SlackShortcutMiddlewareArgs<MessageShortcut>): Promise<void> {
  await ack(); // FIRST STATEMENT — D-07.

  logger.info(
    `shortcut reached handler trigger_id=${shortcut.trigger_id} channel=${shortcut.channel.id} ts=${shortcut.message.ts}`,
  );
  logger.info("shortcut: not implemented in this build");
}
