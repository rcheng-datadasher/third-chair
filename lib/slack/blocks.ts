import { formatHkt } from "@/utils/time";

/** Max length of the card's title line (Slack's mrkdwn field limit governs this, not a header). */
const TITLE_MAX_LEN = 150;
/** Max length of any single mrkdwn field's text (Slack's own limit). */
const MRKDWN_FIELD_MAX_LEN = 2000;
/** Default "Approving will…" copy fragment for a meeting proposal (Phase 3 delivers the calendar write). */
const DEFAULT_MEETING_ACTION_FRAGMENT =
  "create a Google Calendar event with a Meet link and invite the participants";

/**
 * Full shape every card variant (pending, confirmed, dismissed,
 * already_scheduled) needs to render — a decided card keeps the same title,
 * addressee and fields as the pending one, so all four builders share this
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
  /** Already-built display labels (Slack mentions), never addresses. */
  participants: string[];
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
 * Builds one `mrkdwn` section field WITHOUT escaping the value. Reserved
 * for markup our own code built (a `<@USERID>` Slack mention) — escaping
 * `<`/`>` there would turn a working mention into literal `&lt;@ID&gt;`
 * text. Never pass proposal-derived free text here; use `mrkdwnField`.
 *
 * @param label - The field's bold label (e.g. "Participants").
 * @param rawMarkup - Trusted mrkdwn markup, already safe to render as-is.
 * @returns A Block Kit `mrkdwn` text object for a `section` block's `fields`.
 */
function mrkdwnRawField(label: string, rawMarkup: string) {
  return {
    type: "mrkdwn" as const,
    text: truncate(`*${label}:*\n${rawMarkup}`, MRKDWN_FIELD_MAX_LEN),
  };
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

/** One status's chip word + emoji for the fields grid's Status field. */
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
 * Builds the card body shared by every status variant: a bold, normal-size
 * title line (no `header` block — Slack renders those oversized), an
 * addressee `context` line naming who this is for, a compact two-column
 * fields section (When, Duration, Participants, Confidence, Status,
 * Created), a quoted Why line, and an "Approving will…" context line.
 * Mentions render highlighted, which is how the addressee is made
 * unmistakable without large type.
 *
 * @param p - The proposal (plus resolved participant labels and context) to render.
 * @param status - Drives the Status field's chip word + emoji.
 * @returns The shared Block Kit blocks array, before the status-specific closer.
 */
function buildCardBody(
  p: ApprovalCardInput,
  status: "pending" | "confirmed" | "dismissed" | "already_scheduled",
) {
  const titleText = p.title.trim()
    ? truncate(p.title, TITLE_MAX_LEN)
    : "(untitled proposal)";
  const durationMinutes = Math.round(
    (p.end.getTime() - p.start.getTime()) / 60_000,
  );
  // Mention markup our own code built from a Participant row — never escape.
  const participantsText = p.participants.length
    ? p.participants.join(", ")
    : "—";
  const confidenceText =
    p.confidence == null ? "—" : `${Math.round(p.confidence * 100)}%`;
  const addresseeText = p.onBehalfOfUserId
    ? `:bust_in_silhouette: Awaiting your approval, <@${p.onBehalfOfUserId}>`
    : ":bust_in_silhouette: Awaiting approval";

  return [
    {
      type: "section" as const,
      text: {
        type: "mrkdwn" as const,
        text: `*${escapeMrkdwn(titleText)}*`,
      },
    },
    {
      type: "context" as const,
      // Trusted markup (our own mention + emoji shortcode) — never escape.
      elements: [{ type: "mrkdwn" as const, text: addresseeText }],
    },
    {
      type: "section" as const,
      fields: [
        mrkdwnField("When", formatHkt(p.start)),
        mrkdwnField("Duration", `${durationMinutes} min`),
        mrkdwnRawField("Participants", participantsText),
        mrkdwnField("Confidence", confidenceText),
        mrkdwnRawField("Status", statusChipText(status)),
        mrkdwnField("Created", formatHkt(p.createdAt)),
      ],
    },
    {
      type: "section" as const,
      text: {
        type: "mrkdwn" as const,
        text: truncate(
          `*Why:*\n> ${escapeMrkdwn(p.reason ?? "—")}`,
          MRKDWN_FIELD_MAX_LEN,
        ),
      },
    },
    {
      type: "context" as const,
      elements: [
        {
          type: "mrkdwn" as const,
          text: `:calendar: Approving will ${escapeMrkdwn(
            p.action ?? DEFAULT_MEETING_ACTION_FRAGMENT,
          )}.`,
        },
      ],
    },
  ];
}

/**
 * Builds the pending-approval card: the shared body, a divider, and an
 * Approve/Reject actions block. Reject carries a `confirm` dialog; Approve
 * does not, per the requested UX (Approve is the expected happy path).
 *
 * @param p - The proposal (plus resolved participant labels and context) to render.
 * @returns Block Kit blocks array for `chat.postMessage`/`chat.update`.
 */
export function buildApprovalBlocks(p: ApprovalCardInput) {
  return [
    ...buildCardBody(p, "pending"),
    { type: "divider" as const },
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
          confirm: {
            title: { type: "plain_text" as const, text: "Reject proposal?" },
            text: {
              type: "mrkdwn" as const,
              text: "This dismisses the proposal. It will not be scheduled.",
            },
            confirm: { type: "plain_text" as const, text: "Reject" },
            deny: { type: "plain_text" as const, text: "Cancel" },
          },
        },
      ],
    },
  ];
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
function buildDecidedContext(verb: string, emoji: string, info: DecisionInfo) {
  const who = info.decidedByUserId ? ` by <@${info.decidedByUserId}>` : "";
  const when = info.decidedAt ? ` · ${formatHkt(info.decidedAt)}` : "";
  return {
    type: "context" as const,
    elements: [
      { type: "mrkdwn" as const, text: `${emoji} *${verb}*${who}${when}` },
    ],
  };
}

/**
 * Builds the confirmed-status card: the same title, addressee and fields as
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
) {
  return [
    ...buildCardBody(p, "confirmed"),
    buildDecidedContext("Confirmed", "✅", info),
  ];
}

/**
 * Builds the dismissed-status card: the same title, addressee and fields as
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
) {
  return [
    ...buildCardBody(p, "dismissed"),
    buildDecidedContext("Dismissed", "⛔", info),
  ];
}

/**
 * Builds the already-scheduled-status card (Phase 7 territory): the same
 * title, addressee and fields, with a plain status chip closer — no buttons.
 *
 * @param p - The proposal to render.
 * @returns Block Kit blocks array for `chat.update`.
 */
export function buildAlreadyScheduledBlocks(p: ApprovalCardInput) {
  return [
    ...buildCardBody(p, "already_scheduled"),
    {
      type: "context" as const,
      elements: [{ type: "mrkdwn" as const, text: "📅 *Already scheduled*" }],
    },
  ];
}
