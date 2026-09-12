import { slackClient } from "./client";

/** Permalinks never change, so one lookup per message is enough per process. */
const cache = new Map<string, string>();

/**
 * Resolves the web permalink for a Slack message, cached per process so a
 * polling reader costs one API call per message, not one per poll.
 *
 * @param channel - The channel id the message lives in.
 * @param ts - The message timestamp.
 * @returns The `https://…slack.com/archives/…` permalink, or null when Slack
 *   cannot resolve it (deleted message, missing scope).
 */
export async function getMessagePermalink(
  channel: string,
  ts: string,
): Promise<string | null> {
  const key = `${channel}:${ts}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const res = await slackClient.chat.getPermalink({
      channel,
      message_ts: ts,
    });
    if (!res.permalink) return null;
    cache.set(key, res.permalink);
    return res.permalink;
  } catch (err) {
    console.log(`permalink lookup failed ${key}: ${String(err)}`);
    return null;
  }
}
