import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { config } from "@/lib/config";
import { buildSlackMessage } from "../build-slack-message";
import { dispatchSlackMessage } from "../dispatch-slack-message";

/**
 * Handles a `message.channels` event. This is SLK-02's primary trigger: an
 * ordinary message in a watched channel reaches the agent unprompted. No
 * `ack` here — Bolt 5.1.0 acknowledges Events API envelopes itself before
 * invoking any listener.
 *
 * The first statement is a drop guard (D-03) that silently returns, with no
 * log line at all, for anything outside the allowlist, any message subtype
 * (edits, deletes, joins, bot posts, thread broadcasts), a bot-authored
 * message, or empty/whitespace-only text.
 *
 * @param args - Bolt's event middleware args for a `message` listener.
 * @param args.event - The narrowed `MessageEvent` union member for this event.
 * @param args.body - The raw Slack event envelope (used for its `event_id`).
 * @param args.logger - The Bolt-provided logger for this listener invocation.
 * @returns Resolves once the message has been dropped or dispatched.
 * @throws Rethrows any non-dedupe error from `dispatchSlackMessage`.
 */
export async function handleWatchedChannelMessage({
  event,
  body,
  logger,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"message">): Promise<void> {
  if (!config.slack.watchChannelIds.includes(event.channel)) return;
  if (event.subtype !== undefined) return;
  // Narrowed to the plain message shape now that subtype is undefined.
  if (event.bot_id) return;
  if (!event.text?.trim()) return;

  logger.info(
    `watched-channel reached handler event_id=${body.event_id} channel=${event.channel} ts=${event.ts} user=${event.user}`,
  );

  const message = buildSlackMessage({
    teamId: config.slack.teamId,
    channelId: event.channel,
    ts: event.ts,
    threadTs: event.thread_ts,
    userId: event.user,
    text: event.text,
  });
  await dispatchSlackMessage(message, logger);
}
