import type {
  KnownBlock,
  RichTextElement,
  RichTextSection,
} from "@slack/types";
import { formatHkt } from "@/utils/time";

/** Max length of the card's title line (Slack's mrkdwn field limit governs this, not a header). */
const TITLE_MAX_LEN = 150;
/** Default "Approving will…" copy fragment for a meeting proposal (Phase 3 delivers the calendar write). */
const DEFAULT_MEETING_ACTION_FRAGMENT =
  "create a Google Calendar event with a Meet link and invite the participants";

/**
 * One participant entry ready for the card's rich-text list. Callers
 * precompute `state` (e.g. "organizer", a `Participant.response`, or the
 * "pending invite" default) — builders never load their own data or decide
 * display semantics for a role/response pair.
 */
export interface ParticipantEntry {
  slackUserId: string;
  /** Precomputed display state, e.g. "organizer" or "pending invite". */
  state: string;
}

/**
 * Full shape every card variant (pending, confirmed, dismissed,
 * already_scheduled) needs to render — a decided card keeps the same title,
 * addressee and facts as the pending one, so all four builders share this
 * input. Callers (`post-proposal-card.ts`) load `participants` and the
 * extra context fields themselves — builders never load their own data.
 */
export interface ApprovalCardInput {
  id: string;
  title: string;
  start: Date;
  end: Date;
  /** 0–1 fraction (Phase 1's `HARDCODED_CONFIDENCE` scale), or null. */
  confidence: number | null;
  participants: ParticipantEntry[];
  /** `Proposal.created_at`, rendered in HKT via the same formatter as `start`. */
  createdAt: Date;
  /** Extraction reason (`Decision.reason`), or `null`/omitted when no Decision row exists yet. */
  reason?: string | null;
  /** Slack user id of the message's author / claimed organizer, or omitted when unresolvable — never faked. */
  onBehalfOfUserId?: string;
  /** Fragment completing "Approving will …". Defaults to the meeting action; later phases may pass another. */
  action?: string;
}

/**
 * Ephemeral, click-time-only info for a decided card's closing line (who
 * clicked, when). Sourced from the click payload / `new Date()` at decision
 * time — NEVER persisted, since `Proposal` has no `decided_by`/`decided_at`
 * column this phase (no schema change, D-16). Omit either field rather than
 * fake it; the closing line degrades gracefully.
 */
export interface DecisionInfo {
  decidedByUserId?: string;
  decidedAt?: Date;
}

/**
 * @deprecated Superseded by `ApprovalCardInput`, which every card variant
 * now needs in full (title + addressee + fields survive into the decided
 * state). Kept as an additive, unused export — no export is removed.
 */
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
 * Builds the top-level `text` fallback for a card post/update — used for
 * notifications and accessibility, and required alongside `blocks` on every
 * call (Pitfall 4). Pure string formatting, no I/O.
 *
 * @param status - The card's current status.
 * @param p - The proposal's title and (for `pending`) addressee.
 * @returns A short fallback string naming the addressee when known.
 */
export function buildFallbackText(
  status: "pending" | "confirmed" | "dismissed" | "already_scheduled",
  p: Pick<ApprovalCardInput, "title" | "onBehalfOfUserId">,
): string {
  switch (status) {
    case "pending":
      return p.onBehalfOfUserId
        ? `Approval needed from <@${p.onBehalfOfUserId}>: ${p.title}`
        : `Approval needed: ${p.title}`;
    case "confirmed":
      return `${p.title} — confirmed`;
    case "dismissed":
      return `${p.title} — dismissed`;
    case "already_scheduled":
      return `${p.title} — already scheduled`;
  }
}

/** One status's chip word + emoji for the facts table's Status row. */
function statusChipText(
  status: "pending" | "confirmed" | "dismissed" | "already_scheduled",
): string {
  switch (status) {
    case "pending":
      return "🟡 Pending";
    case "confirmed":
      return "✅ Confirmed";
    case "dismissed":
      return "⛔ Dismissed";
    case "already_scheduled":
      return "📅 Already scheduled";
  }
}

/**
 * Builds one label/value row for the facts table. Table cells accept a
 * `raw_text` element — always rendered literally, never parsed as markup,
 * so no escaping is needed (a stronger guarantee than mrkdwn+escaping).
 *
 * @param label - The row's label cell text (always a literal we control).
 * @param value - The row's value cell text.
 * @returns One `TableBlock` row: two `raw_text` cells.
 */
function factRow(label: string, value: string) {
  return [
    { type: "raw_text" as const, text: label },
    { type: "raw_text" as const, text: value },
  ];
}

/**
 * Builds the Participants `rich_text` block: an ordered `rich_text_list`,
 * one item per participant, each rendering a real Slack mention (`user`
 * element — always highlighted, never escaped) followed by their state.
 * An empty list falls back to a single "—" line, since Slack rejects a
 * `rich_text_list` with zero elements.
 *
 * @param participants - The proposal's participants, pre-labeled with state.
 * @returns One `RichTextBlock`.
 */
function buildParticipantsBlock(participants: ParticipantEntry[]): KnownBlock {
  if (participants.length === 0) {
    return {
      type: "rich_text",
      elements: [
        {
          type: "rich_text_section",
          elements: [{ type: "text", text: "—" }],
        },
      ],
    };
  }

  const items: RichTextSection[] = participants.map((participant) => ({
    type: "rich_text_section",
    elements: [
      { type: "user", user_id: participant.slackUserId },
      { type: "text", text: ` — ${participant.state}` },
    ] satisfies RichTextElement[],
  }));

  return {
    type: "rich_text",
    elements: [{ type: "rich_text_list", style: "ordered", elements: items }],
  };
}

/**
 * Builds the Why `rich_text` block: a bold "Why this action item" label
 * followed by a `rich_text_quote` holding the extraction reason. `text`
 * elements are always rendered literally, never parsed as markup, so no
 * escaping is needed here either.
 *
 * Empty state: Slack renders an empty/whitespace rich_text element as a
 * blank block with no visible content — a `.trim()` check guards against
 * that, falling back to a full sentence instead of a lone dash.
 *
 * `reason` comes from `loadApprovalCardExtras`' Decision lookup (latest row
 * linked by `proposal_id`) — it fills in automatically once this branch
 * merges with Phase 5's graph on `main`, which is what actually writes
 * `Decision.reason`.
 *
 * @param reason - `Decision.reason`, or `null`/undefined when absent.
 * @returns One `RichTextBlock`.
 */
function buildWhyBlock(reason: string | null | undefined): KnownBlock {
  const reasonText = reason?.trim()
    ? reason.trim()
    : "Reason not recorded yet — the agent's decision note will appear here.";
  return {
    type: "rich_text",
    elements: [
      {
        type: "rich_text_section",
        elements: [
          { type: "text", text: "Why this action item", style: { bold: true } },
        ],
      },
      {
        type: "rich_text_quote",
        elements: [{ type: "text", text: reasonText }],
      },
    ],
  };
}

/**
 * Builds the card body shared by every status variant: a bold, normal-size
 * title line (no `header` block — Slack renders those oversized), an
 * addressee `context` line naming who this is for, a `table` block of
 * scalar facts (When, Duration, Confidence, Status, Created), an ordered
 * Participants list, a quoted Why block, and an "Approving will…" context
 * line — each logical group separated by a `divider`. Mentions render
 * highlighted, which is how the addressee is made unmistakable without
 * large type.
 *
 * @param p - The proposal (plus resolved participants and context) to render.
 * @param status - Drives the facts table's Status row.
 * @returns The shared Block Kit blocks array, before the status-specific closer.
 */
function buildCardBody(
  p: ApprovalCardInput,
  status: "pending" | "confirmed" | "dismissed" | "already_scheduled",
): KnownBlock[] {
  const titleText = p.title.trim()
    ? truncate(p.title, TITLE_MAX_LEN)
    : "(untitled proposal)";
  const durationMinutes = Math.round(
    (p.end.getTime() - p.start.getTime()) / 60_000,
  );
  const confidenceText =
    p.confidence == null ? "—" : `${Math.round(p.confidence * 100)}%`;
  const addresseeText = p.onBehalfOfUserId
    ? `:bust_in_silhouette: Awaiting your approval, <@${p.onBehalfOfUserId}>`
    : ":bust_in_silhouette: Awaiting approval";

  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${escapeMrkdwn(titleText)}*` },
    },
    {
      type: "context",
      // Trusted markup (our own mention + emoji shortcode) — never escape.
      elements: [{ type: "mrkdwn", text: addresseeText }],
    },
    { type: "divider" },
    {
      type: "table",
      rows: [
        factRow("When", formatHkt(p.start)),
        factRow("Duration", `${durationMinutes} min`),
        factRow("Confidence", confidenceText),
        factRow("Status", statusChipText(status)),
        factRow("Created", formatHkt(p.createdAt)),
      ],
    },
    { type: "divider" },
    buildParticipantsBlock(p.participants),
    { type: "divider" },
    buildWhyBlock(p.reason),
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `:calendar: Approving will ${escapeMrkdwn(
            p.action ?? DEFAULT_MEETING_ACTION_FRAGMENT,
          )}.`,
        },
      ],
    },
  ] satisfies KnownBlock[];
}

/**
 * Builds the pending-approval card: the shared body, a divider, and an
 * Approve/Reject actions block. Reject carries a `confirm` dialog; Approve
 * does not, per the requested UX (Approve is the expected happy path).
 *
 * @param p - The proposal (plus resolved participants and context) to render.
 * @returns Block Kit blocks array for `chat.postMessage`/`chat.update`.
 */
export function buildApprovalBlocks(p: ApprovalCardInput): KnownBlock[] {
  return [
    ...buildCardBody(p, "pending"),
    { type: "divider" },
    {
      type: "actions",
      block_id: "proposal_actions",
      elements: [
        {
          type: "button",
          action_id: "approve_proposal",
          text: { type: "plain_text", text: "Approve" },
          style: "primary",
          value: p.id,
        },
        {
          type: "button",
          action_id: "reject_proposal",
          text: { type: "plain_text", text: "Reject" },
          style: "danger",
          value: p.id,
          confirm: {
            title: { type: "plain_text", text: "Reject proposal?" },
            text: {
              type: "mrkdwn",
              text: "This dismisses the proposal. It will not be scheduled.",
            },
            confirm: { type: "plain_text", text: "Reject" },
            deny: { type: "plain_text", text: "Cancel" },
          },
        },
      ],
    },
  ] satisfies KnownBlock[];
}

/**
 * Builds one decided-status closing line: who decided and when, degrading
 * gracefully when either piece of `DecisionInfo` is unknown (never faked).
 *
 * @param verb - "Confirmed" or "Dismissed".
 * @param emoji - The leading emoji for the line.
 * @param info - Ephemeral decision info from the click payload, if known.
 * @returns A Block Kit `context` block for the decided card's closer.
 */
function buildDecidedContext(
  verb: string,
  emoji: string,
  info: DecisionInfo,
): KnownBlock {
  const who = info.decidedByUserId ? ` by <@${info.decidedByUserId}>` : "";
  const when = info.decidedAt ? ` · ${formatHkt(info.decidedAt)}` : "";
  return {
    type: "context",
    elements: [{ type: "mrkdwn", text: `${emoji} *${verb}*${who}${when}` }],
  };
}

/**
 * Builds the confirmed-status card: the same title, addressee and facts as
 * the pending card, with the actions block replaced by a "Confirmed by …"
 * context line — no buttons.
 *
 * @param p - The proposal to render.
 * @param info - Ephemeral decision info (who clicked, when), if known.
 * @returns Block Kit blocks array for `chat.update`.
 */
export function buildConfirmedBlocks(
  p: ApprovalCardInput,
  info: DecisionInfo = {},
): KnownBlock[] {
  return [
    ...buildCardBody(p, "confirmed"),
    { type: "divider" },
    buildDecidedContext("Confirmed", "✅", info),
  ];
}

/**
 * Builds the dismissed-status card: the same title, addressee and facts as
 * the pending card, with the actions block replaced by a "Dismissed by …"
 * context line — no buttons.
 *
 * @param p - The proposal to render.
 * @param info - Ephemeral decision info (who clicked, when), if known.
 * @returns Block Kit blocks array for `chat.update`.
 */
export function buildDismissedBlocks(
  p: ApprovalCardInput,
  info: DecisionInfo = {},
): KnownBlock[] {
  return [
    ...buildCardBody(p, "dismissed"),
    { type: "divider" },
    buildDecidedContext("Dismissed", "⛔", info),
  ];
}

/**
 * Builds the already-scheduled-status card (Phase 7 territory): the same
 * title, addressee and facts, with a plain status chip closer — no buttons.
 *
 * @param p - The proposal to render.
 * @returns Block Kit blocks array for `chat.update`.
 */
export function buildAlreadyScheduledBlocks(
  p: ApprovalCardInput,
): KnownBlock[] {
  return [
    ...buildCardBody(p, "already_scheduled"),
    { type: "divider" },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: "📅 *Already scheduled*" }],
    },
  ];
}
