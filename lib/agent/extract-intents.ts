import { z } from "zod";
import type { SlackMessage } from "../../types/slack";
import { hktDateParts, WEEKDAYS } from "../../utils/time";
import { complete } from "../ai/provider";

/**
 * The verified confidence rubric (D-10). Pasted verbatim from the
 * developer's Pre-Window Checklist output — never rewritten in code; only
 * `HIGH_FROM`/`LOW_BELOW` in `lib/agent/graph.ts` are tuned against it.
 */
export const CONFIDENCE_RUBRIC = `Score how confident you are (0.00 to 1.00) that this message is a genuine, actionable request to schedule a meeting, call or talk with a specific person or group — not a vague aspiration, a joke, or unrelated chatter.

High confidence (0.75+): a clear ask to meet, with at least a day/weekday and a time hint (e.g. "let's talk Friday at 11am", "can we sync tomorrow 3pm?").
Medium confidence (0.40-0.74): a real scheduling intent, but missing a day or a time (e.g. "we should catch up sometime this week", "let's meet tomorrow" with no time).
Low confidence (below 0.40): no scheduling intent at all — banter, reactions, status updates, or a mention of a meeting that already happened.`;

/** One extracted meeting/scheduling intent, in the LLM's own snake_case field names (Orchestrator correction #1). */
export const ExtractedIntentSchema = z.object({
  message_index: z.number().int().min(0),
  type: z.literal("meeting"),
  title: z.string().max(150),
  is_actionable: z.boolean(),
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
- reason is one factual sentence about the scheduling signal itself. Never comment on anyone's mood, tone or character.
- Never output a calendar date. A named weekday goes in weekday. "Today", "tomorrow" or "in N days" go in day_offset as 0, 1 or N. A clock time goes in time_of_day as 24-hour HH:MM. Anything not stated is null.
- start_iso is always null; it is filled in later by code, not by you.
- duration_minutes is set only when the message states a length.
- participant_slack_ids includes only ids written as <@ID> inside that specific message.
- title is at most eight words.`;
}

/**
 * Extracts one scheduling intent per Slack message via `MODEL_FAST`
 * structured output (AGT-02).
 *
 * The prompt receives only message text, Slack user ids and today's HKT
 * date — no emails, tokens or calendar data (T-05-03). An empty message
 * array short-circuits to `[]` with no model call.
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
  for (const intent of intents) {
    const message = messages[intent.message_index];
    if (message == null) {
      continue;
    }
    located.push({ ...intent, ts: message.ts });
  }
  return located;
}
