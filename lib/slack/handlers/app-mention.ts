import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { config } from "@/lib/config";
import type { SlackMessage } from "@/types/slack";
import { dispatchSlackMessage } from "../dispatch-slack-message";

/**
 * Handles an `app_mention` event — SLK-03's diagnostic-fallback trigger. No
 * `ack` here — Bolt 5.1.0 acknowledges Events API envelopes itself before
 * invoking any listener.
 *
 * @param args - Bolt's event middleware args for an `app_mention` listener.
 * @param args.event - The `AppMentionEvent` payload.
 * @param args.body - The raw Slack event envelope (used for its `event_id`).
 * @param args.logger - The Bolt-provided logger for this listener invocation.
 * @returns Resolves once the mention has been dropped or dispatched.
 * @throws Rethrows any non-dedupe error from `dispatchSlackMessage`.
 */
export async function handleAppMention({
  event,
  body,
  logger,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_mention">): Promise<void> {
  logger.info(
    `app_mention reached handler event_id=${body.event_id} channel=${event.channel} ts=${event.ts} user=${event.user}`,
  );

  if (!event.user || event.bot_id) return;

  const message: SlackMessage = {
    teamId: config.slack.teamId,
    channelId: event.channel,
    ts: event.ts,
    threadTs: event.thread_ts,
    // Raw text, mention token included — Phase 5's extraction strips it.
    userId: event.user,
    text: event.text,
  };
  await dispatchSlackMessage(message, logger);
}
