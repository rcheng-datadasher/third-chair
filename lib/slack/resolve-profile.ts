import { slackClient } from "@/lib/slack/client";

/** The profile fields the graph view attaches to a user node. */
export interface SlackProfile {
  name: string;
  nickname: string;
}

// ponytail: in-process cache, cleared on restart — same shape as
// resolve-email.ts; a shared cache only matters if this outlives a demo.
const profileCache = new Map<string, SlackProfile | undefined>();

/**
 * Resolves a Slack user's display identity via `users.info` (`users:read`
 * scope): full name and nickname (Slack's display name). Sibling of
 * `resolveParticipantEmail`, which reads the email field of the same call.
 *
 * @param slackUserId - Slack user id (e.g. `U12345`).
 * @returns The profile, or `undefined` when the id is not a Slack user
 *   (test fixtures, deleted accounts) or the API call fails — the caller
 *   falls back to showing the raw id.
 */
export async function resolveProfile(
  slackUserId: string,
): Promise<SlackProfile | undefined> {
  if (profileCache.has(slackUserId)) return profileCache.get(slackUserId);
  let profile: SlackProfile | undefined;
  try {
    const { user } = await slackClient.users.info({ user: slackUserId });
    const name = user?.real_name ?? user?.name;
    if (name) {
      profile = {
        name,
        nickname: user?.profile?.display_name || user?.name || "",
      };
    }
  } catch {
    // user_not_found / missing_scope: leave undefined, caller shows the id.
  }
  profileCache.set(slackUserId, profile);
  return profile;
}
