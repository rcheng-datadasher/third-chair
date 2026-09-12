import { prisma } from "@/lib/db";
import { formatHkt } from "@/utils/time";

/** A Proposal projected for display; every time string is already HKT-formatted. */
export interface ProposalRow {
  id: string;
  title: string;
  status: string;
  startHkt: string;
  confidence: number | null;
}

/** A Decision projected for display; `whenHkt` derives from the Slack `source_ts`. */
export interface DecisionRow {
  id: string;
  verdict: string;
  whenHkt: string;
  confidence: number | null;
  reason: string;
  messageText: string;
  sourceChannel: string;
}

/** Placeholder for a value that has nothing to show (null confidence, bad timestamp). */
const EM_DASH = "—";

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
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    startHkt: formatHkt(p.start),
    confidence: toConfidence(p.confidence),
  }));
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
  return rows.map((d) => ({
    id: d.id,
    verdict: d.verdict,
    whenHkt: slackTsToHkt(d.source_ts),
    confidence: toConfidence(d.confidence),
    reason: d.reason,
    messageText: d.message_text,
    sourceChannel: d.source_channel,
  }));
}
