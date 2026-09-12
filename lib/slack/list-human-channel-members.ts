import { z } from "zod";
import { resolveParticipantEmail } from "@/lib/slack/resolve-email";
import { slackClient } from "./client";

/** Slack's own "Slackbot" pseudo-user id — never a human channel member. */
const SLACKBOT_USER_ID = "USLACKBOT";
/** How long a channel's member list is cached before a fresh lookup. */
const CACHE_TTL_MS = 60_000;

/** One human member of a Slack channel. */
export interface HumanChannelMember {
  slackUserId: string;
  /** From `resolveParticipantEmail` — `null` when the profile has none. */
  email: string | null;
  realName: string | null;
}

/** Validated shape read from a `users.info` response's `user` field. */
const UserInfoSchema = z.object({
  id: z.string(),
  is_bot: z.boolean().optional(),
  deleted: z.boolean().optional(),
  real_name: z.string().optional(),
  profile: z.object({ real_name: z.string().optional() }).optional(),
});

const memberCache = new Map<
  string,
  { expiresAt: number; members: HumanChannelMember[] }
>();

/**
 * Lists every human (non-bot, non-deleted) member of a Slack channel, with
 * their resolved email (via the shared `resolveParticipantEmail`, never a
 * second `users.info`-email wrapper) and display name. Paginates
 * `conversations.members` and caches the result per channel for
 * `CACHE_TTL_MS` — this is called once per Slack message once Phase 5's
 * graph is wired in, so a short per-process cache avoids a full
 * members+profiles round trip on every message.
 *
 * @param channelId - The Slack channel to list members for.
 * @returns One entry per human member, skipping bots, deleted users and
 *   Slackbot itself.
 * @throws When the underlying `conversations.members`/`users.info` calls
 *   fail (e.g. missing scope, invalid channel) — this helper does not
 *   degrade partial failures into an empty list.
 */
export async function listHumanChannelMembers(
  channelId: string,
): Promise<HumanChannelMember[]> {
  const cached = memberCache.get(channelId);
  if (cached && cached.expiresAt > Date.now()) return cached.members;

  const memberIds: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await slackClient.conversations.members({
      channel: channelId,
      cursor,
    });
    memberIds.push(...z.array(z.string()).parse(page.members ?? []));
    cursor = page.response_metadata?.next_cursor || undefined;
  } while (cursor);

  const members = await Promise.all(
    memberIds
      .filter((id) => id !== SLACKBOT_USER_ID)
      .map(async (id): Promise<HumanChannelMember | null> => {
        const result = await slackClient.users.info({ user: id });
        const user = UserInfoSchema.parse(result.user);
        if (user.is_bot || user.deleted) return null;

        const email = await resolveParticipantEmail(id);
        return {
          slackUserId: id,
          email: email ?? null,
          realName: user.profile?.real_name ?? user.real_name ?? null,
        };
      }),
  );
  const humanMembers = members.filter(
    (member): member is HumanChannelMember => member !== null,
  );

  memberCache.set(channelId, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    members: humanMembers,
  });
  return humanMembers;
}
