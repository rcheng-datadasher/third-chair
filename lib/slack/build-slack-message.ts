import type { SlackMessage } from "@/types/slack";

/**
 * Builds a normalized `SlackMessage` from any raw Slack message-shaped
 * payload (a Bolt event, a `conversations.history` entry, etc.). The one
 * shared mapper every Slack-message-producing path uses, so every trigger
 * builds an identical shape (and therefore an identical dedupe key) for the
 * same message — extracted out of `watched-channel-message.ts` so
 * `fetch-channel-context.ts` doesn't need a second mapper.
 *
 * @param input - The raw fields to normalize. `userId`/`text` default to
 *   `""` when absent (e.g. a message subtype with no author or body).
 * @returns A `SlackMessage` ready for `dispatchSlackMessage`/`RunAgentInput`.
 */
export function buildSlackMessage(input: {
  teamId: string;
  channelId: string;
  ts: string;
  threadTs?: string;
  userId?: string;
  text?: string;
}): SlackMessage {
  return {
    teamId: input.teamId,
    channelId: input.channelId,
    ts: input.ts,
    threadTs: input.threadTs,
    userId: input.userId ?? "",
    text: input.text ?? "",
  };
}
