import { slackClient } from "@/lib/slack/client";

// ponytail: in-process cache, cleared on restart — correct for a process
// that runs once per demo window; upgrade to a shared cache if Bolt ever
// needs to survive a restart mid-run.
const emailCache = new Map<string, string | undefined>();

/**
 * Resolves a Slack user's email via `users.info`. Requires BOTH the
 * `users:read` and `users:read.email` scopes on the installed app (not just
 * listed in the manifest) — 02-02 Task 1's scope probe already proved both
 * are present before this wrapper's real body was written.
 *
 * @param slackUserId - Slack user id (e.g. `U12345`).
 * @returns The user's email, or `undefined` when the profile has none
 *   (normal for bot users and humans who never set one — not an error).
 * @throws When the Slack API call itself errors (e.g. `missing_scope`,
 *   `user_not_found`); the caller decides the fallback.
 */
export async function resolveParticipantEmail(
  slackUserId: string,
): Promise<string | undefined> {
  if (emailCache.has(slackUserId)) return emailCache.get(slackUserId);
  const result = await slackClient.users.info({ user: slackUserId });
  const email = result.user?.profile?.email;
  emailCache.set(slackUserId, email);
  return email;
}
