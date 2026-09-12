import type { SlackMessage } from "../../types/slack";
import { hktDateParts } from "../../utils/time";
import { complete } from "../ai/provider";
import {
  CommitmentExtractionSchema,
  type CommitmentIntent,
} from "./commitment-schema";
import {
  type ExtractContext,
  extractIntents,
  type LocatedIntent,
  renderNumberedLines,
} from "./extract-intents";

/**
 * Builds the commitment-extraction system prompt. Asks only for promises
 * with an owner, an action and a time — who owes what to whom, when it was
 * promised, when it is due. States today's HKT date first so "by Wednesday"
 * resolves relative to now rather than to the model's training era. Never
 * asks for an opinion about a person (this plan's prohibition).
 *
 * @param now - The instant the run started, used only to state today's HKT date.
 * @returns The full system prompt string.
 */
function buildCommitmentSystemPrompt(now: Date): string {
  const { isoDate, weekday, time } = hktDateParts(now);
  return `Today is ${weekday}, ${isoDate}, ${time} in Asia/Hong_Kong.

You extract commitments (promises) from Slack messages: who owes what to whom, when it was promised, and when it is due.

Rules:
- Produce one commitment object only for messages that state or imply a promise to DO or DELIVER something (e.g. "I'll send the deck by Friday", "can you review the PR today?", "I'll look into it after lunch").
- A message that only proposes or requests a MEETING, CALL or TALK at some time (e.g. "let's have a talk next Friday at 11am", "can we sync tomorrow?") is NOT a commitment — do not produce a commitment object for it, even though it names a date or time. That is a scheduling request, a separate concern handled elsewhere.
- message_index is the message's bracketed number.
- direction is "owed_by_me" when the message author is promising something, "owed_to_me" when the author is asking someone else for something owed to the author.
- what is the promised action, in a short phrase. who is the person the promise is between (not the author's own name unless direction is owed_to_me and the promise is on someone else's plate).
- when_promised_iso is left null unless a specific date/time is stated in the message itself; do not guess one.
- due_iso is left null when no due date is stated — never guess one. When one is stated, resolve relative terms ("Wednesday", "tomorrow", "end of week") against today's date above and write a full ISO 8601 timestamp with the +08:00 offset; if no clock time is given use 18:00.
- status is "open" unless the message itself states the promise is done, overdue, or dropped.
- reason is left null unless there is a specific factual note about the promise itself. Never comment on anyone's mood, tone or character, and never rate or judge a person.
- source_link is always null; it is filled in later by code, not by you.
- confidence is 0 to 1, how confident you are this message states a genuine commitment.
- is_actionable is true only when the commitment implies a concrete next step.`;
}

/**
 * Extracts commitment intents from a batch of Slack messages via
 * `MODEL_FAST` structured output, additive beside `extractIntents`'s
 * meeting extraction (D-05, STR-04). An empty message array short-circuits
 * to `[]` with no model call.
 *
 * @param messages - The Slack messages to extract from, in order.
 * @param ctx - Extraction context; `now` anchors relative due dates.
 * @returns One `CommitmentIntent` per message the model returned a
 *   commitment for, with `source_link` resolved from that message's real
 *   channel and `ts`. Out-of-range `message_index` values are dropped.
 */
export async function extractCommitments(
  messages: SlackMessage[],
  ctx: ExtractContext,
): Promise<CommitmentIntent[]> {
  if (messages.length === 0) {
    return [];
  }

  const { commitments } = await complete({
    tier: "fast",
    system: buildCommitmentSystemPrompt(ctx.now),
    prompt: renderNumberedLines(messages),
    schema: CommitmentExtractionSchema,
    schemaName: "commitment_extraction_result",
  });

  const located: CommitmentIntent[] = [];
  for (const commitment of commitments) {
    const message = messages[commitment.message_index];
    if (message == null) {
      continue;
    }
    located.push({
      ...commitment,
      source_link: `slack://channel/${message.channelId}/${message.ts}`,
    });
  }
  return located;
}

/**
 * Calls the existing `extractIntents` (meeting extraction, untouched) and
 * this file's `extractCommitments` over the same message batch, without
 * wiring either into `runAgent` or the graph. This is what makes success
 * criterion 1 observable: a commitment intent appears alongside a meeting
 * intent extracted from the same messages.
 *
 * @param messages - The Slack messages to extract from, in order.
 * @param ctx - Extraction context shared by both extractors.
 * @returns The meeting intents from `extractIntents` (byte-identical to
 *   calling it alone) and the commitment intents from `extractCommitments`.
 */
export async function extractAllIntents(
  messages: SlackMessage[],
  ctx: ExtractContext,
): Promise<{ meetings: LocatedIntent[]; commitments: CommitmentIntent[] }> {
  const [meetings, commitments] = await Promise.all([
    extractIntents(messages, ctx),
    extractCommitments(messages, ctx),
  ]);
  return { meetings, commitments };
}
