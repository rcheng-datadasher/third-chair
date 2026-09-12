import { prisma } from "@/lib/db";
import { getMessagePermalink } from "@/lib/slack/permalink";
import { formatHkt } from "@/utils/time";

/** A Proposal projected for display; every time string is already HKT-formatted. */
export interface ProposalRow {
  id: string;
  title: string;
  status: string;
  startHkt: string;
  confidence: number | null;
  /** Permalink to the approval card in Slack, or null when no card was posted. */
  slackUrl: string | null;
}

/** A Decision projected for display; `whenHkt` derives from the Slack `source_ts`. */
export interface DecisionRow {
  id: string;
  verdict: string;
  whenHkt: string;
  confidence: number | null;
  /** Confidence band the agent stated in its reason ("low" | "medium" | "high"), if any. */
  band: string | null;
  reason: string;
  messageText: string;
  sourceChannel: string;
}

/** Placeholder for a value that has nothing to show (null confidence, bad timestamp). */
const EM_DASH = "—";

/** Slack user mention as it appears in raw message text, e.g. `<@U0123ABC>`. */
const SLACK_MENTION = /<@([A-Z0-9]+)(?:\|[^>]*)?>/g;

/** The confidence prefix the agent puts in front of its reason. */
const REASON_PREFIX = /^(low|medium|high) confidence [\d.]+:\s*/i;

/**
 * Replaces raw Slack mentions with a readable `@id` so titles never show
 * `<@U123>` on the projector.
 *
 * @param text - Text that may contain Slack mention markup.
 * @returns The text with mentions rendered as `@id`.
 */
function stripSlackMentions(text: string): string {
  return text.replace(SLACK_MENTION, "@$1");
}

/**
 * Splits the agent's reason into its stated confidence band and the reason
 * proper, so the band is not repeated next to the numeric column.
 *
 * @param reason - The raw reason text.
 * @returns The band (lower-cased) or null, and the reason without the prefix.
 */
function splitReason(reason: string): { band: string | null; text: string } {
  const m = REASON_PREFIX.exec(reason);
  return m
    ? { band: m[1].toLowerCase(), text: reason.slice(m[0].length) }
    : { band: null, text: reason };
}

/**
 * Maps a confidence column to a plain number for both JSON and RSC transport.
 *
 * @param value - The raw column value (Float or Decimal, possibly null).
 * @returns The numeric confidence, or null when absent.
 */
function toConfidence(value: number | null | undefined): number | null {
  return value == null ? null : Number(value);
}

/**
 * Formats a Slack `source_ts` (epoch seconds as a string) as HKT.
 *
 * @param sourceTs - The Slack message timestamp, e.g. `"1757600000.000100"`.
 * @returns The HKT string, or an em dash when the timestamp does not parse.
 */
function slackTsToHkt(sourceTs: string): string {
  const seconds = Number(sourceTs);
  return Number.isFinite(seconds)
    ? formatHkt(new Date(seconds * 1000))
    : EM_DASH;
}

/**
 * Reads every Proposal, newest first, for both the first paint and the poll.
 * Fields are mapped one by one so no internal column reaches the wire.
 *
 * @returns Proposal rows ordered by `created_at` desc, then `id` desc.
 */
export async function getProposalRows(): Promise<ProposalRow[]> {
  const rows = await prisma.proposal.findMany({
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
  });
  return Promise.all(
    rows.map(async (p) => ({
      id: p.id,
      title: stripSlackMentions(p.title),
      status: p.status,
      startHkt: formatHkt(p.start),
      confidence: toConfidence(p.confidence),
      slackUrl:
        p.card_channel && p.card_ts
          ? await getMessagePermalink(p.card_channel, p.card_ts)
          : null,
    })),
  );
}

/**
 * Reads every Decision, newest first, for both the first paint and the poll.
 * Decision has no `created_at`, so ordering and display time use `source_ts`.
 *
 * @returns Decision rows ordered by `source_ts` desc, then `id` desc.
 */
export async function getDecisionRows(): Promise<DecisionRow[]> {
  const rows = await prisma.decision.findMany({
    orderBy: [{ source_ts: "desc" }, { id: "desc" }],
  });
  return rows.map((d) => {
    const { band, text } = splitReason(d.reason);
    return {
      id: d.id,
      verdict: d.verdict,
      whenHkt: slackTsToHkt(d.source_ts),
      confidence: toConfidence(d.confidence),
      band,
      reason: text,
      messageText: stripSlackMentions(d.message_text),
      sourceChannel: d.source_channel,
    };
  });
}
