import { z } from "zod";
import { CommitmentIntentSchema } from "@/lib/agent/commitment-schema";

/**
 * A hand-seeded demo commitment row: the commitment schema plus a stable
 * `id`, which the nudge route (08-02) takes as its only input.
 */
export const SeedCommitmentSchema = CommitmentIntentSchema.extend({
  id: z.string().min(1),
});

/** The Zod-inferred shape of one seeded demo commitment row. */
export type SeedCommitment = z.infer<typeof SeedCommitmentSchema>;

/**
 * Six hand-seeded demo commitment rows, schema-parsed at module load so a
 * malformed row throws at import rather than rendering wrong on stage
 * (D-07). Drawn from the source document's own examples ("I'll send the
 * deck by Friday", "can you review the PR today?", "I'll look into it
 * after lunch"), covering all four component kinds and both directions —
 * asking "what do I owe people?" yields deadline-chip + draft-nudge +
 * clarify, and "what am I owed?" yields chase + clarify (D-09, D-10).
 */
export const seedCommitments: SeedCommitment[] =
  SeedCommitmentSchema.array().parse([
    {
      id: "send-deck-friday",
      type: "commitment",
      message_index: 0,
      direction: "owed_by_me",
      what: "send the deck",
      who: "Alex",
      when_promised_iso: "2026-09-10T09:00:00+08:00",
      due_iso: "2026-09-19T17:00:00+08:00",
      source_link: "slack://channel/C01SEED/1700000001",
      status: "open",
      confidence: 1,
      is_actionable: true,
      reason: null,
    },
    {
      id: "review-pr-overdue",
      type: "commitment",
      message_index: 1,
      direction: "owed_by_me",
      what: "review the PR",
      who: "Sam",
      when_promised_iso: "2026-09-08T14:00:00+08:00",
      due_iso: "2026-09-09T18:00:00+08:00",
      source_link: "slack://channel/C01SEED/1700000002",
      status: "overdue",
      confidence: 1,
      is_actionable: true,
      reason: null,
    },
    {
      id: "sam-owes-updated-deck",
      type: "commitment",
      message_index: 2,
      direction: "owed_to_me",
      what: "send the updated deck",
      who: "Sam",
      when_promised_iso: "2026-09-11T10:00:00+08:00",
      due_iso: "2026-09-20T12:00:00+08:00",
      source_link: "slack://channel/C01SEED/1700000003",
      status: "open",
      confidence: 1,
      is_actionable: true,
      reason: null,
    },
    {
      id: "alex-owes-budget-numbers",
      type: "commitment",
      message_index: 3,
      direction: "owed_to_me",
      what: "share the budget numbers",
      who: "Alex",
      when_promised_iso: "2026-09-05T11:00:00+08:00",
      due_iso: "2026-09-08T17:00:00+08:00",
      source_link: "slack://channel/C01SEED/1700000004",
      status: "overdue",
      confidence: 1,
      is_actionable: true,
      reason: null,
    },
    {
      id: "look-into-it-after-lunch",
      type: "commitment",
      message_index: 4,
      direction: "owed_by_me",
      what: "look into it after lunch",
      who: "Sam",
      when_promised_iso: "2026-09-12T13:00:00+08:00",
      due_iso: null,
      source_link: "slack://channel/C01SEED/1700000005",
      status: "open",
      confidence: 1,
      is_actionable: true,
      reason: null,
    },
    {
      id: "old-vendor-contact-dropped",
      type: "commitment",
      message_index: 5,
      direction: "owed_to_me",
      what: "send the vendor contact",
      who: "Alex",
      when_promised_iso: "2026-08-20T09:00:00+08:00",
      due_iso: null,
      source_link: "slack://channel/C01SEED/1700000006",
      status: "dropped",
      confidence: 1,
      is_actionable: false,
      reason: null,
    },
  ]);
