import { z } from "zod";
import type { SlackMessage } from "../../types/slack";
import { hktDateParts, WEEKDAYS } from "../../utils/time";
import { complete } from "../ai/provider";

/**
 * The user-defined 0-10 confidence rubric (D-10 replacement). Pasted
 * verbatim into the extraction prompt — the score is the sum of four
 * per-dimension point values the model must also report, never a single
 * freehand 0-1 guess. `SHOW_FROM`/`HIGH_FROM` in `lib/agent/graph.ts` are
 * the only places the resulting score is thresholded.
 */
export const CONFIDENCE_RUBRIC = `Score each candidate action item 0-10 as the SUM of four dimensions:
• Intent (0-3): 3 = explicit request or commitment to schedule ("let's meet", "can we sync", "book a call"); 2 = strong implication ("we should talk about X this week"); 1 = vague or hypothetical ("maybe catch up sometime"); 0 = no scheduling intent (status update, joke, chit-chat).
• Time (0-3): 3 = concrete or resolvable date/time ("next Friday 11am", "tomorrow 3pm"); 2 = day known but time missing ("on Thursday"); 1 = only a window ("next week", "this month"); 0 = none.
• Participants (0-2): 2 = people named or mentioned, or clearly "you and me"; 1 = implied group (the channel/team); 0 = unclear who.
• Fitness (0-2): 2 = creating a calendar event with these people is the right action and the message is current; 1 = partial (e.g. only asking availability); 0 = the action would be wrong (already scheduled, past or cancelled, sarcasm, quoting someone else).
Report the four point values, the total score, and a one-sentence reason citing each dimension.`;

/** One extracted meeting/scheduling intent, in the LLM's own snake_case field names (Orchestrator correction #1). */
export const ExtractedIntentSchema = z.object({
  message_index: z.number().int().min(0),
  type: z.literal("meeting"),
  title: z.string().max(150),
  is_actionable: z.boolean(),
  /** Intent dimension of the rubric (0-3). */
  intent_points: z.number().int().min(0).max(3),
  /** Time dimension of the rubric (0-3). */
  time_points: z.number().int().min(0).max(3),
  /** Participants dimension of the rubric (0-2). */
  participant_points: z.number().int().min(0).max(2),
  /** Fitness dimension of the rubric (0-2). */
  fitness_points: z.number().int().min(0).max(2),
  /** Total rubric score (0-10). The model reports it as the sum of the four
   * point fields above; `reconcileScore` recomputes and overwrites it in
   * code if the model's sum is off. */
  score: z.number().int().min(0).max(10),
  /**
   * 0-1 mirror of `score` (`score / 10`). Requested from the model only so
   * strict structured output has a value to fill in — `reconcileScore`
   * always overwrites it with the derived value afterward, never trusting
   * the model's own arithmetic.
   */
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  duration_minutes: z.number().int().min(1).nullable(),
  participant_slack_ids: z.array(z.string()),
  weekday: z.enum(WEEKDAYS).nullable(),
  day_offset: z.number().int().min(0).nullable(),
  time_of_day: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  start_iso: z.string().nullable(),
});

/** The Zod-inferred shape of one extracted intent — the only `ExtractedIntent` definition in the repo (D-25). */
export type ExtractedIntent = z.infer<typeof ExtractedIntentSchema>;

/** The object-root wrapper the model must return (Orchestrator correction #2): an `intents` array, never a bare array. */
export const ExtractionResultSchema = z.object({
  intents: z.array(ExtractedIntentSchema),
});

/** One extracted intent plus the real Slack `ts` of the message it came from, resolved from `message_index`. */
export type LocatedIntent = ExtractedIntent & { ts: string };

/** Context passed to `extractIntents` alongside the message batch. */
export interface ExtractContext {
  now: Date;
}

/**
 * Renders a batch of Slack messages as numbered lines for the extraction
 * prompt: `[index] <@userId>: text`, with the message text passed through
 * unmodified (mention markup included, no trimming).
 *
 * @param messages - The Slack messages to render, in order.
 * @returns One line per message, joined by newlines.
 */
export function renderNumberedLines(messages: SlackMessage[]): string {
  return messages.map((m, i) => `[${i}] <@${m.userId}>: ${m.text}`).join("\n");
}

/**
 * Builds the extraction system prompt: today's HKT date/weekday/time, the
 * verified confidence rubric, and the extraction rules the model must
 * follow (never a calendar date, weekday/day_offset/time_of_day hints only).
 *
 * @param now - The instant the run started, used only to state today's HKT date.
 * @returns The full system prompt string.
 */
export function buildExtractionSystemPrompt(now: Date): string {
  const { isoDate, weekday, time } = hktDateParts(now);
  return `Today is ${weekday}, ${isoDate}, ${time} in Asia/Hong_Kong.

${CONFIDENCE_RUBRIC}

Rules:
- Produce exactly one intent object per numbered message. message_index is the message's bracketed number.
- type is always "meeting".
- is_actionable is true only for a request to schedule a meeting, call or talk.
- score is the sum of intent_points + time_points + participant_points + fitness_points. confidence is score / 10.
- reason is one sentence citing each dimension's point value, e.g. "Intent 3 (explicit 'let's meet'), Time 3 (next Friday 11am), Participants 2 (@A and @B), Fitness 2 -> 10/10". Never comment on anyone's mood, tone or character.
- Never output a calendar date. A named weekday goes in weekday. "Today", "tomorrow" or "in N days" go in day_offset as 0, 1 or N. A clock time goes in time_of_day as 24-hour HH:MM. Anything not stated is null.
- start_iso is always null; it is filled in later by code, not by you.
- duration_minutes is set only when the message states a length.
- participant_slack_ids includes only ids written as <@ID> inside that specific message.
- title is at most eight words.`;
}

/**
 * Recomputes an intent's `score` from its four rubric point fields and
 * derives `confidence` from that score — the model's own `score`/
 * `confidence` values are never trusted as-is.
 *
 * Guards against the model's arithmetic drifting from the rubric (its sum
 * of the four point fields not matching the `score` it reported): when that
 * happens, the point fields win, a warning is logged, and the corrected
 * score is what `confidence` is derived from. `is_actionable` is forced
 * `false` whenever the (corrected) score is 6 or below — the show-gate
 * (`SHOW_FROM` in `lib/agent/graph.ts`) never sees an actionable intent at
 * or below that line, regardless of what the model set.
 *
 * @param intent - One model-returned intent, schema-validated but not yet
 *   reconciled.
 * @returns The same intent with `score`, `confidence` and `is_actionable`
 *   corrected in place (new object; input is not mutated).
 */
export function reconcileScore(intent: ExtractedIntent): ExtractedIntent {
  const summedScore =
    intent.intent_points +
    intent.time_points +
    intent.participant_points +
    intent.fitness_points;

  if (summedScore !== intent.score) {
    console.warn(
      `[extract-intents] score ${intent.score} != sum of points ${summedScore} for message_index=${intent.message_index}; using ${summedScore}`,
    );
  }

  return {
    ...intent,
    score: summedScore,
    confidence: summedScore / 10,
    is_actionable: summedScore <= 6 ? false : intent.is_actionable,
  };
}

/**
 * Extracts one scheduling intent per Slack message via `MODEL_FAST`
 * structured output (AGT-02).
 *
 * The prompt receives only message text, Slack user ids and today's HKT
 * date — no emails, tokens or calendar data (T-05-03). An empty message
 * array short-circuits to `[]` with no model call. Every returned intent is
 * passed through `reconcileScore` before being located, so `score` and
 * `confidence` are always code-derived, never the model's raw output.
 *
 * @param messages - The Slack messages to extract from, in order.
 * @param ctx - Extraction context (currently just `now`, the run's start time).
 * @returns One `LocatedIntent` per message the model returned an intent
 *   for, with `message_index` resolved back to that message's real Slack
 *   `ts`. Out-of-range indexes are dropped.
 */
export async function extractIntents(
  messages: SlackMessage[],
  ctx: ExtractContext,
): Promise<LocatedIntent[]> {
  if (messages.length === 0) {
    return [];
  }

  const { intents } = await complete({
    tier: "fast",
    system: buildExtractionSystemPrompt(ctx.now),
    prompt: renderNumberedLines(messages),
    schema: ExtractionResultSchema,
    schemaName: "extraction_result",
  });

  const located: LocatedIntent[] = [];
  for (const rawIntent of intents) {
    const message = messages[rawIntent.message_index];
    if (message == null) {
      continue;
    }
    const intent = reconcileScore(rawIntent);
    located.push({ ...intent, ts: message.ts });
  }
  return located;
}
