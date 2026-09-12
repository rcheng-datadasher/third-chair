import { z } from "zod";

/**
 * One extracted commitment intent, additive beside the meeting intent in
 * `lib/agent/extract-intents.ts` (D-05: never edits that file's schema).
 * Field names and casing match Phase 5's convention exactly — snake_case,
 * every model-authored field nullable (never optional), because the OpenAI
 * strict-schema helper requires every property to be present.
 *
 * Carries only facts about the promise itself (direction, what, who, when
 * promised, due, source link, status) — no field holds an assessment,
 * rating or characterisation of the person named in it (this plan's
 * prohibition; 08-CONTEXT deferred item on colleague-mood analysis).
 */
export const CommitmentIntentSchema = z.object({
  type: z.literal("commitment"),
  message_index: z.number().int().min(0),
  direction: z.enum(["owed_by_me", "owed_to_me"]),
  what: z.string(),
  who: z.string(),
  when_promised_iso: z.string().nullable(),
  due_iso: z.string().nullable(),
  source_link: z.string().nullable(),
  status: z.enum(["open", "done", "overdue", "dropped"]),
  confidence: z.number().min(0).max(1),
  is_actionable: z.boolean(),
  reason: z.string().nullable(),
});

/** The Zod-inferred shape of one extracted commitment intent. */
export type CommitmentIntent = z.infer<typeof CommitmentIntentSchema>;

/**
 * The object-root wrapper the model must return: a `commitments` array,
 * never a bare array — same reason as `lib/agent/extract-intents.ts`'s
 * `intents` root (strict JSON-schema needs an object root).
 */
export const CommitmentExtractionSchema = z.object({
  commitments: z.array(CommitmentIntentSchema),
});

/**
 * A persisted commitment as the ledger UI and the nudge route see it: the
 * extracted intent plus the `Commitment` row's stable `id`. `status` here is
 * the *effective* status — `lib/commitment-ledger/list-commitments.ts`
 * derives `overdue` from an open row whose `due` has passed.
 */
export const LedgerCommitmentSchema = CommitmentIntentSchema.extend({
  id: z.string().min(1),
});

/** The Zod-inferred shape of one commitment row served to the ledger. */
export type LedgerCommitment = z.infer<typeof LedgerCommitmentSchema>;
