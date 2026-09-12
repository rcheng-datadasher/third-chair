import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { Prisma } from "../../prisma/generated/client";
import type {
  ConflictSlot,
  RunAgentInput,
  RunAgentResult,
} from "../../types/agent";
import type { SlackMessage } from "../../types/slack";
import { resolveStartIso } from "../../utils/time";
import { prisma } from "../db";
import { postEditApproveCard } from "../slack/post-edit-approve-card";
import { postProposalCard } from "../slack/post-proposal-card";
import { computeDedupeKey, normalizeIntent } from "./dedupe";
import {
  type ExtractedIntent,
  ExtractedIntentSchema,
  extractIntents,
  type LocatedIntent,
} from "./extract-intents";

/** The three confidence bands `classifyNode` routes on (D-01/D-02/AGT-08). */
export type ConfidenceBand = "high" | "medium" | "low";

/** Confidence at or above this, plus explicit day and time hints, buckets "high". Tuned in Task 1 step 7 against the developer's samples. */
export const HIGH_FROM = 0.75;
/** Confidence below this (or no actionable intent) buckets "low". Tuned in Task 1 step 7 against the developer's samples. */
export const LOW_BELOW = 0.4;
/** Fallback meeting length when the message states none. */
export const DEFAULT_DURATION_MINUTES = 30;

/**
 * The only bucketing function (Orchestrator correction #4): every branch
 * decision in the graph goes through this, never a second ad-hoc
 * threshold check.
 *
 * @param intent - The extracted intent for this message, or `null` when
 *   extraction returned nothing.
 * @returns "low" for no intent / non-actionable / confidence below
 *   `LOW_BELOW`; "high" for confidence at or above `HIGH_FROM` with an
 *   explicit time and a day hint; "medium" otherwise (AGT-04's vague-time
 *   narrowing).
 */
export function bucketConfidence(intent: LocatedIntent | null): ConfidenceBand {
  if (
    intent == null ||
    !intent.is_actionable ||
    intent.confidence < LOW_BELOW
  ) {
    return "low";
  }
  if (
    intent.confidence >= HIGH_FROM &&
    intent.time_of_day != null &&
    (intent.weekday != null || intent.day_offset != null)
  ) {
    return "high";
  }
  return "medium";
}

/** The graph's shared state, threaded through every node. */
export const AgentState = Annotation.Root({
  message: Annotation<SlackMessage>(),
  now: Annotation<Date>(),
  intent: Annotation<LocatedIntent | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  band: Annotation<ConfidenceBand>({
    reducer: (_, next) => next,
    default: () => "low",
  }),
  reason: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  conflicts: Annotation<ConflictSlot[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  proposalId: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  /** True when `proposeNode` recovered an existing Proposal via a P2002 dedupe collision, rather than creating a new one. */
  replayed: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
});

/**
 * Runs `extractIntents` on the one triggering message and keeps only the
 * intent whose resolved Slack `ts` matches it (extraction is batch-shaped;
 * a single-message run should still guard against a mismatched index).
 *
 * A whitespace-only message short-circuits without calling the model
 * (edge AGT-10/empty) — there's nothing for the model to extract from, and
 * skipping the call keeps a Trigger.dev retry storm of empty events cheap.
 *
 * @param state - Current graph state.
 * @returns A partial state update setting `intent` (and `reason` for the
 *   empty-text case, so `classifyNode` doesn't need to invent one).
 */
export async function extractNode(
  state: typeof AgentState.State,
): Promise<Partial<typeof AgentState.State>> {
  if (state.message.text.trim() === "") {
    return { intent: null, reason: "empty message text; model not called" };
  }
  const located = await extractIntents([state.message], { now: state.now });
  const intent = located.find((i) => i.ts === state.message.ts) ?? null;
  return { intent };
}

/**
 * Buckets the extracted intent into a confidence band via
 * `bucketConfidence`, and builds the human-readable reason stored on the
 * eventual Decision row.
 *
 * @param state - Current graph state.
 * @returns A partial state update setting `band` and `reason`.
 */
export function classifyNode(
  state: typeof AgentState.State,
): Partial<typeof AgentState.State> {
  const band = bucketConfidence(state.intent);
  const reason =
    state.intent != null
      ? `${band} confidence ${state.intent.confidence.toFixed(2)}: ${state.intent.reason}`
      : state.reason || "no scheduling intent extracted";
  return { band, reason };
}

/**
 * Fills the intent's `start_iso` from `resolveStartIso` — deterministic,
 * code-only date resolution (D-12); no model call.
 *
 * @param state - Current graph state.
 * @returns A partial state update with `intent.start_iso` set, or an empty
 *   update when there is no intent (shouldn't happen on this edge, but keeps
 *   the node total).
 */
export function resolveTimeNode(
  state: typeof AgentState.State,
): Partial<typeof AgentState.State> {
  if (state.intent == null) {
    return {};
  }
  const startIso = resolveStartIso(state.now, {
    weekday: state.intent.weekday,
    day_offset: state.intent.day_offset,
    time_of_day: state.intent.time_of_day,
  });
  return { intent: { ...state.intent, start_iso: startIso } };
}

/**
 * Placeholder conflict check. Real conflict detection is Phase 7's
 * (CFL-01, D-02) — this phase's graph never branches on `conflicts`.
 *
 * @param _state - Current graph state (unused).
 * @returns A partial state update with an empty `conflicts` list.
 */
export function checkConflictsNode(
  _state: typeof AgentState.State,
): Partial<typeof AgentState.State> {
  return { conflicts: [] };
}

/**
 * Creates the Proposal (+ Participant rows) and posts its approval card for
 * a high/medium-band intent (D-14). Runs only on the `resolveTime ->
 * checkConflicts -> propose` path; low band routes straight to `END` and
 * never reaches this node.
 *
 * @param state - Current graph state; `state.intent.start_iso` must be set.
 * @returns A partial state update setting `proposalId`.
 */
export async function proposeNode(
  state: typeof AgentState.State,
): Promise<Partial<typeof AgentState.State>> {
  const { message, intent } = state;
  if (intent == null || intent.start_iso == null) {
    return { proposalId: null };
  }

  // Re-validate the resolved intent through the same schema that backs the
  // DB write (D-09) — a shape failure here throws before any write (T-05-02).
  const validated = ExtractedIntentSchema.parse(intent);

  const mentionedIds = extractMentionedIds(message.text);
  const participantIds = [...new Set([message.userId, ...mentionedIds])].sort();

  const dedupeKey = computeDedupeKey(
    message.teamId,
    message.channelId,
    message.threadTs ?? message.ts,
    normalizeIntent({
      type: validated.type,
      start_iso: validated.start_iso ?? intent.start_iso,
      participant_slack_ids: participantIds,
    }),
  );

  const start = new Date(validated.start_iso ?? intent.start_iso);
  const durationMinutes =
    validated.duration_minutes ?? DEFAULT_DURATION_MINUTES;
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const participantRows = await buildParticipantRows(
    message.teamId,
    message.userId,
    participantIds,
  );

  let proposal: Awaited<ReturnType<typeof createProposal>>;
  let replayed = false;
  try {
    proposal = await createProposal(
      message,
      dedupeKey,
      validated,
      start,
      end,
      participantRows,
    );
  } catch (err) {
    // A redelivered message (Slack retry, Trigger.dev retry) reproduces the
    // same dedupe_key and hits the Proposal.dedupe_key unique constraint
    // (AGT-09) — reuse the existing row instead of throwing. Every other
    // error propagates unchanged; retrying a non-P2002 failure would just
    // reproduce it (05-RESEARCH "Don't Hand-Roll").
    if (
      !(err instanceof Prisma.PrismaClientKnownRequestError) ||
      err.code !== "P2002"
    ) {
      throw err;
    }
    replayed = true;
    proposal = await prisma.proposal.findUniqueOrThrow({
      where: { dedupe_key: dedupeKey },
      include: { participants: true },
    });
  }

  // ponytail: this read-then-post is not race-safe against two concurrent
  // redeliveries of the same message both observing card_ts=null and both
  // posting a card. Accepted for the demo's single-watched-channel volume;
  // upgrade path is a DB-level advisory lock or a conditional update.
  if (proposal.card_ts == null) {
    // High band gets the one-click approve/reject card; medium gets Edit &
    // approve — one call site, one poster selected by band (D-15).
    const postCard =
      state.band === "high" ? postProposalCard : postEditApproveCard;
    const { channel, ts } = await postCard(proposal);
    proposal = await prisma.proposal.update({
      where: { id: proposal.id },
      data: { card_channel: channel, card_ts: ts },
      include: { participants: true },
    });
  }

  if (!replayed) {
    await createActionItems(proposal);
  }

  return { proposalId: proposal.id, replayed };
}

/**
 * Inserts one Proposal row plus its nested Participant rows.
 *
 * Pulled out of `proposeNode` so the P2002-recovery `catch` above can call
 * it exactly once and know precisely which call the retry constraint
 * applies to.
 *
 * @param message - The triggering Slack message.
 * @param dedupeKey - The proposal's dedupe key (D-20).
 * @param validated - The schema-validated, `start_iso`-filled intent.
 * @param start - Resolved meeting start.
 * @param end - Resolved meeting end.
 * @param participantRows - Nested-create input rows for `Participant`.
 * @returns The created Proposal, with its `participants` included.
 */
async function createProposal(
  message: SlackMessage,
  dedupeKey: string,
  validated: ExtractedIntent,
  start: Date,
  end: Date,
  participantRows: Awaited<ReturnType<typeof buildParticipantRows>>,
) {
  return prisma.proposal.create({
    data: {
      team_id: message.teamId,
      dedupe_key: dedupeKey,
      title: validated.title.trim() || "Meeting",
      start,
      end,
      tz: "Asia/Hong_Kong",
      status: "pending",
      confidence: validated.confidence,
      source_channel: message.channelId,
      source_ts: message.ts,
      participants: {
        create: participantRows,
      },
    },
    include: { participants: true },
  });
}

/**
 * Creates one `ActionItem` per participant who has a `User` row in the same
 * team (D-20) — a participant with no `User` row keeps only their
 * `Participant` row. Runs once per newly created Proposal, never on a
 * replayed (P2002-recovered) run.
 *
 * @param proposal - The newly created Proposal, with `participants` included.
 */
async function createActionItems(
  proposal: Prisma.ProposalGetPayload<{ include: { participants: true } }>,
): Promise<void> {
  const userIds = proposal.participants
    .map((p) => p.user_id)
    .filter((id): id is string => id != null);
  if (userIds.length === 0) {
    return;
  }
  await prisma.actionItem.createMany({
    data: userIds.map((userId) => ({
      proposal_id: proposal.id,
      user_id: userId,
      kind: "meeting",
      state: "pending",
      slack_channel: proposal.card_channel ?? proposal.source_channel,
      slack_ts: proposal.card_ts ?? proposal.source_ts,
      expires_at: proposal.start,
    })),
  });
}

/**
 * Extracts Slack user ids literally mentioned in a message's text
 * (`<@Uxxxx>` markup) — never ids the model invented.
 *
 * @param text - Raw Slack message text.
 * @returns The mentioned Slack user ids, in the order they appear.
 */
function extractMentionedIds(text: string): string[] {
  const matches = text.matchAll(/<@([A-Za-z0-9]+)>/g);
  return [...matches].map((m) => m[1]);
}

/**
 * Resolves an email for each participant Slack id (skipping ids with no
 * resolvable email — Participant.email is required) and builds the nested
 * `Participant` create rows, role mirrored from `prisma/seed.ts`: the
 * message author is "attendee" (Phase 1 precedent), everyone else is
 * "invitee" (seed precedent).
 *
 * @param teamId - Slack team id.
 * @param authorSlackId - The triggering message's author Slack id.
 * @param participantSlackIds - All participant Slack ids (author + mentions), sorted/deduped.
 * @returns Nested-create input rows for `prisma.proposal.create`.
 */
async function buildParticipantRows(
  teamId: string,
  authorSlackId: string,
  participantSlackIds: string[],
): Promise<
  Array<{
    user_id?: string;
    slack_user_id: string;
    email: string;
    role: string;
  }>
> {
  const users = await prisma.user.findMany({
    where: { team_id: teamId, slack_user_id: { in: participantSlackIds } },
  });
  const byslackId = new Map(users.map((u) => [u.slack_user_id, u]));

  const rows: Array<{
    user_id?: string;
    slack_user_id: string;
    email: string;
    role: string;
  }> = [];
  for (const slackUserId of participantSlackIds) {
    const user = byslackId.get(slackUserId);
    const email = user?.email;
    if (email == null) {
      continue; // no resolvable email — skip (Participant.email is required)
    }
    rows.push({
      user_id: user?.id,
      slack_user_id: slackUserId,
      email,
      role: slackUserId === authorSlackId ? "attendee" : "invitee",
    });
  }
  return rows;
}

/**
 * The compiled 5-node confidence-gate graph (D-01). Five `addNode` calls,
 * `extract -> classify` unconditionally, a conditional edge from `classify`
 * to `END` on low band or onward to `resolveTime -> checkConflicts ->
 * propose -> END` on high/medium. Compiled with zero arguments: no
 * checkpointer (D-01).
 */
export const agentGraph = new StateGraph(AgentState)
  .addNode("extract", extractNode)
  .addNode("classify", classifyNode)
  .addNode("resolveTime", resolveTimeNode)
  .addNode("checkConflicts", checkConflictsNode)
  .addNode("propose", proposeNode)
  .addEdge(START, "extract")
  .addEdge("extract", "classify")
  .addConditionalEdges("classify", (s) =>
    s.band === "low" ? END : "resolveTime",
  )
  .addEdge("resolveTime", "checkConflicts")
  .addEdge("checkConflicts", "propose")
  .addEdge("propose", END)
  .compile();

/**
 * Runs the compiled confidence-gate graph for one Slack message end to end,
 * then writes the single Decision row for the run (Orchestrator correction
 * #3, D-16/D-17/D-18) — every branch, including low band, gets exactly one
 * Decision. A thrown run writes no Decision; a Trigger.dev retry writes it
 * on the retried attempt.
 *
 * Redelivery-safe (AGT-09, D-18): a pre-check on `team_id`/`source_channel`/
 * `source_ts` returns a finished run's ids with no model call and no graph
 * invocation at all. A run that got as far as `proposeNode` but crashed
 * before this function's own `decision.create` (P2002-recovered on the
 * retried attempt) looks up and returns the existing Decision instead of
 * writing a second one; `decision.create` stays the single write site.
 *
 * ponytail: two deliveries landing within the same instant can both pass
 * the pre-check read and both fall through to write an ignored Decision.
 * Accepted for the demo's single-watched-channel volume; upgrade path is a
 * unique `(team_id, source_channel, source_ts)` constraint on Decision.
 *
 * @param input - Wraps the one Slack message to process.
 * @returns The new (or replayed) Proposal id (`null` for low band /
 *   non-actionable) and Decision id.
 */
export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const { message } = input;

  const existingDecision = await prisma.decision.findFirst({
    where: {
      team_id: message.teamId,
      source_channel: message.channelId,
      source_ts: message.ts,
    },
  });
  if (existingDecision != null) {
    return {
      proposalId: existingDecision.proposal_id,
      decisionId: existingDecision.id,
    };
  }

  const now = new Date();
  const result = await agentGraph.invoke({ message, now });

  if (result.replayed && result.proposalId != null) {
    const priorDecision = await prisma.decision.findFirst({
      where: { proposal_id: result.proposalId },
    });
    if (priorDecision != null) {
      return { proposalId: result.proposalId, decisionId: priorDecision.id };
    }
  }

  const decision = await prisma.decision.create({
    data: {
      team_id: message.teamId,
      source_channel: message.channelId,
      source_ts: message.ts,
      message_text: message.text,
      verdict: result.proposalId != null ? "acted" : "ignored",
      confidence: result.intent?.confidence ?? 0,
      reason: result.reason,
      proposal_id: result.proposalId,
    },
  });

  return { proposalId: result.proposalId, decisionId: decision.id };
}
