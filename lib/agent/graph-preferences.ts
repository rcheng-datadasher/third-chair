import { z } from "zod";
import { config } from "../config";

/**
 * The five closed-vocabulary preference keys the Graphiti service will ever
 * return (D-12). Every key is optional, and unknown keys are stripped by
 * Zod's default object behavior — that stripping IS the closed-vocabulary
 * allowlist on this side of the HTTP boundary (T-09-08).
 */
const GraphPreferencesSchema = z.object({
  working_hours: z.string().optional(),
  default_meeting_duration: z.coerce
    .number()
    .int()
    .positive()
    .max(480)
    .optional(),
  buffer_between_meetings: z.coerce
    .number()
    .int()
    .nonnegative()
    .max(240)
    .optional(),
  no_meeting_days: z.array(z.string()).optional(),
  preferred_slot_of_day: z.string().optional(),
});

/**
 * Fetches learned scheduling preferences from the optional Graphiti
 * preference-memory service (Phase 9, S1). Fails closed on every failure
 * mode — unset config, unreachable/slow/non-ok service, or a response body
 * that fails validation — so a caller can always treat `null` as "no
 * preferences known" and fall through to Phase 7's existing behavior
 * unchanged (D-16).
 *
 * @param userId - The Slack user id used as Graphiti's `group_id`
 *   partition key (the message author's id, per the phase's `group_id`
 *   decision — not `organizer_user_id`, which is null at this call site).
 * @returns The closed-vocabulary preference record, or `null` when
 *   `config.graph.serviceUrl` is unset, the service does not respond ok
 *   within 2 seconds, or the response body fails schema validation.
 */
export async function fetchGraphPreferences(
  userId: string,
): Promise<Record<string, unknown> | null> {
  if (!config.graph.serviceUrl) {
    return null;
  }
  try {
    const res = await fetch(
      `${config.graph.serviceUrl}/preferences?user_id=${encodeURIComponent(userId)}`,
      { signal: AbortSignal.timeout(2000) },
    );
    if (!res.ok) {
      return null;
    }
    const body = await res.json();
    const parsed = GraphPreferencesSchema.safeParse(body);
    if (!parsed.success) {
      return null;
    }
    return parsed.data;
  } catch {
    // Network error, DNS failure, abort/timeout, and malformed JSON are all
    // treated identically (D-16) — every failure mode returns null.
    return null;
  }
}
