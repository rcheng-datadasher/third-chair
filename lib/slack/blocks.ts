import { formatHkt } from "@/utils/time";

/** Max length of the card's plain_text header (Slack's own limit). */
const HEADER_MAX_LEN = 150;
/** Max length of any single mrkdwn field's text (Slack's own limit). */
const MRKDWN_FIELD_MAX_LEN = 2000;

/**
 * Minimal shape `buildApprovalBlocks` needs to render a pending-approval
 * card. Callers (`post-proposal-card.ts`) load `participants` themselves —
 * builders never load their own data.
 */
export interface ApprovalCardInput {
  id: string;
  title: string;
  start: Date;
  end: Date;
  /** 0–1 fraction (Phase 1's `HARDCODED_CONFIDENCE` scale), or null. */
  confidence: number | null;
  /** Already-built display labels (Slack mentions), never addresses. */
  participants: string[];
}

/** Minimal shape the status-chip builders need. */
export interface ChipCardInput {
  title: string;
}

/**
 * Escapes the three mrkdwn-significant characters so proposal-derived text
 * (a title, and from Phase 5 onward, text lifted from a user's message)
 * cannot become a channel broadcast, a false user mention, or spoofed link
 * markup once rendered into an `mrkdwn` field. Order matters: `&` must be
 * escaped first, or escaping `<`/`>` afterward would double-escape the
 * entities just inserted.
 *
 * @param text - Untrusted, proposal-derived text.
 * @returns The text with `&`, `<` and `>` replaced by their HTML entities.
 */
export function escapeMrkdwn(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Truncates a string to a maximum length, matching a Block Kit field's own
 * character limit.
 *
 * @param text - The text to truncate.
 * @param maxLength - The maximum number of characters to keep.
 * @returns `text` unchanged if within the limit, otherwise the first
 *   `maxLength` characters.
 */
function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

/**
 * Builds one `mrkdwn` section field: escapes the value, truncates the whole
 * field text to Slack's 2000-character limit, and wraps it with a bold
 * label line.
 *
 * @param label - The field's bold label (e.g. "When").
 * @param value - The untrusted, proposal-derived value to escape and render.
 * @returns A Block Kit `mrkdwn` text object for a `section` block's `fields`.
 */
function mrkdwnField(label: string, value: string) {
  return {
    type: "mrkdwn" as const,
    text: truncate(`*${label}:*\n${escapeMrkdwn(value)}`, MRKDWN_FIELD_MAX_LEN),
  };
}

/**
 * Builds the pending-approval card: header, a four-field section (When,
 * Duration, Participants, Confidence), and an Approve/Reject actions block.
 * Slack rejects an empty `plain_text` header, so an empty title falls back
 * to a placeholder rather than sending one.
 *
 * @param p - The proposal (plus resolved participant labels) to render.
 * @returns Block Kit blocks array for `chat.postMessage`/`chat.update`.
 */
export function buildApprovalBlocks(p: ApprovalCardInput) {
  const headerText = p.title.trim()
    ? truncate(p.title, HEADER_MAX_LEN)
    : "(untitled proposal)";
  const durationMinutes = Math.round(
    (p.end.getTime() - p.start.getTime()) / 60_000,
  );
  const participantsText = p.participants.length
    ? p.participants.join(", ")
    : "—";
  const confidenceText =
    p.confidence == null ? "—" : `${Math.round(p.confidence * 100)}%`;

  return [
    {
      type: "header" as const,
      text: { type: "plain_text" as const, text: headerText },
    },
    {
      type: "section" as const,
      fields: [
        mrkdwnField("When", formatHkt(p.start)),
        mrkdwnField("Duration", `${durationMinutes} min`),
        mrkdwnField("Participants", participantsText),
        mrkdwnField("Confidence", confidenceText),
      ],
    },
    {
      type: "actions" as const,
      block_id: "proposal_actions",
      elements: [
        {
          type: "button" as const,
          action_id: "approve_proposal",
          text: { type: "plain_text" as const, text: "Approve" },
          style: "primary" as const,
          value: p.id,
        },
        {
          type: "button" as const,
          action_id: "reject_proposal",
          text: { type: "plain_text" as const, text: "Reject" },
          style: "danger" as const,
          value: p.id,
        },
      ],
    },
  ];
}

/**
 * Builds one status-chip variant: the same header, plus a `context` chip in
 * place of the actions block — removing the buttons is what stops a second
 * click on a decided proposal.
 *
 * @param p - The proposal to render, needing only `title`.
 * @param chipText - The mrkdwn chip copy (already emoji-prefixed).
 * @returns Block Kit blocks array for `chat.update`.
 */
function buildChipBlocks(p: ChipCardInput, chipText: string) {
  const headerText = p.title.trim()
    ? truncate(p.title, HEADER_MAX_LEN)
    : "(untitled proposal)";
  return [
    {
      type: "header" as const,
      text: { type: "plain_text" as const, text: headerText },
    },
    {
      type: "context" as const,
      elements: [{ type: "mrkdwn" as const, text: chipText }],
    },
  ];
}

/**
 * Builds the confirmed-status chip variant (Approve clicked).
 *
 * @param p - The proposal to render, needing only `title`.
 * @returns Block Kit blocks array for `chat.update`.
 */
export function buildConfirmedBlocks(p: ChipCardInput) {
  return buildChipBlocks(p, "✅ *Confirmed*");
}

/**
 * Builds the dismissed-status chip variant (Reject clicked).
 *
 * @param p - The proposal to render, needing only `title`.
 * @returns Block Kit blocks array for `chat.update`.
 */
export function buildDismissedBlocks(p: ChipCardInput) {
  return buildChipBlocks(p, "❌ *Dismissed*");
}

/**
 * Builds the already-scheduled-status chip variant.
 *
 * @param p - The proposal to render, needing only `title`.
 * @returns Block Kit blocks array for `chat.update`.
 */
export function buildAlreadyScheduledBlocks(p: ChipCardInput) {
  return buildChipBlocks(p, "📅 *Already scheduled*");
}
