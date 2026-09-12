import { z } from "zod";
import { WEEKDAYS } from "../../utils/time";
import { complete } from "../ai/provider";

/** `HH:MM-HH:MM`, 24-hour, the shape `working_hours` is stored in. */
const HOURS_RANGE = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

/**
 * One distilled scheduling-preference fact, in exactly the closed vocabulary
 * the Graphiti service accepts on `POST /episodes` (STR-02, service D-12).
 * The discriminated union is the allowlist: any other key fails parsing
 * here, before the HTTP boundary ever sees it.
 */
export const PreferenceFactSchema = z.discriminatedUnion("key", [
  z.object({
    key: z.literal("working_hours"),
    value: z.string().regex(HOURS_RANGE),
  }),
  z.object({
    key: z.literal("default_meeting_duration"),
    value: z.number().int().positive().max(480),
  }),
  z.object({
    key: z.literal("buffer_between_meetings"),
    value: z.number().int().nonnegative().max(240),
  }),
  z.object({
    key: z.literal("no_meeting_days"),
    value: z.array(z.enum(WEEKDAYS)).min(1),
  }),
  z.object({
    key: z.literal("preferred_slot_of_day"),
    value: z.enum(["morning", "afternoon", "evening"]),
  }),
]);

/** The Zod-inferred fact — the same JSON the service ingests, minus `user_id`. */
export type PreferenceFact = z.infer<typeof PreferenceFactSchema>;

/** Object-root wrapper the model must return (never a bare array). */
const PreferenceExtractionSchema = z.object({
  facts: z.array(PreferenceFactSchema),
});

const SYSTEM_PROMPT = `You read one Slack message and extract the author's standing scheduling preferences, if any.

Return facts only when the message states a preference about the author's own availability — a rule that should apply to future meetings. Anything else (a one-off request, banter, a preference about someone else, a meeting that already happened) yields an empty facts list.

Allowed facts, and nothing else:
- working_hours: "HH:MM-HH:MM" 24-hour. "No meetings after 8pm" → "09:00-20:00" (assume 09:00 start when only an end is stated; 18:00 end when only a start is stated).
- default_meeting_duration: minutes, an integer.
- buffer_between_meetings: minutes, an integer.
- no_meeting_days: lowercase full weekday names, e.g. ["saturday","sunday"]. "Weekends" means both.
- preferred_slot_of_day: "morning", "afternoon" or "evening".

One message may yield several facts. Never invent a value the message does not support.`;

/**
 * Distils a Slack message into zero or more closed-vocabulary preference
 * facts via `MODEL_FAST` structured output. The prompt sees message text
 * only — no ids, emails or calendar data.
 *
 * @param text - Raw Slack message text.
 * @returns The facts the message states; `[]` when it states none or is blank.
 */
export async function extractPreferences(
  text: string,
): Promise<PreferenceFact[]> {
  if (text.trim() === "") {
    return [];
  }
  const { facts } = await complete({
    tier: "fast",
    system: SYSTEM_PROMPT,
    prompt: text,
    schema: PreferenceExtractionSchema,
    schemaName: "preference_extraction",
  });
  return facts;
}
