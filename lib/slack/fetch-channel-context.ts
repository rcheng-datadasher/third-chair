import { z } from "zod";
import { config } from "@/lib/config";
import type { SlackMessage } from "@/types/slack";
import { buildSlackMessage } from "./build-slack-message";
import { slackClient } from "./client";

/** Default number of preceding messages to fetch for context. */
const DEFAULT_LIMIT = 20;

/** Validated shape read from one `conversations.history` message entry. */
const HistoryMessageSchema = z.object({
  ts: z.string(),
  text: z.string().optional(),
  user: z.string().optional(),
  thread_ts: z.string().optional(),
  subtype: z.string().optional(),
  bot_id: z.string().optional(),
});

/**
 * Fetches the messages immediately preceding a given message in a channel,
 * for extraction context (Phase 5's graph consumes this). Bot messages and
 * any subtype (edits, joins, etc.) are dropped, matching the watched-channel
 * handler's own filter. Results are normalized through the same
 * `buildSlackMessage` mapper every other Slack trigger uses — no second
 * mapper — and returned oldest-first, even though `conversations.history`
 * itself returns newest-first.
 *
 * @param channelId - The channel to fetch history from.
 * @param beforeTs - Only messages strictly before this timestamp are returned.
 * @param limit - Maximum number of messages to fetch (before filtering). Defaults to 20.
 * @returns Up to `limit` prior messages, oldest-first, bot/subtype messages dropped.
 * @throws When the Slack API call fails (e.g. missing `channels:history` scope).
 */
export async function fetchChannelContext(
  channelId: string,
  beforeTs: string,
  limit = DEFAULT_LIMIT,
): Promise<SlackMessage[]> {
  const history = await slackClient.conversations.history({
    channel: channelId,
    latest: beforeTs,
    inclusive: false,
    limit,
  });

  const messages = z
    .array(HistoryMessageSchema)
    .parse(history.messages ?? [])
    .filter((message) => !message.bot_id && message.subtype === undefined)
    .reverse(); // conversations.history is newest-first; we want oldest-first.

  return messages.map((message) =>
    buildSlackMessage({
      teamId: config.slack.teamId,
      channelId,
      ts: message.ts,
      threadTs: message.thread_ts,
      userId: message.user,
      text: message.text,
    }),
  );
}
