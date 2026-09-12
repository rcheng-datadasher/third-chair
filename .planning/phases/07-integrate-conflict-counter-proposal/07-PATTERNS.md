# Phase 7: Integrate + Conflict Counter-Proposal - Pattern Map

**Mapped:** 2026-09-12
**Files analyzed:** 6 (no dashboard/app files — out of scope per D-24)
**Analogs found:** 6 / 6 (all from upstream phase CONTEXT/RESEARCH contracts — repo is planning-only, no source exists yet; "analogs" are the interface shapes fixed by Phases 1–5)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog (contract source) | Match Quality |
|---|---|---|---|---|
| `lib/agent/nodes/check-conflicts.ts` (or plain fn post-rip) | service/graph-node | request-response (calendar read + DB read) | Phase 3 `checkConflicts(userId, startIso, endIso)` stub (`03-CONTEXT.md` D-05) + Phase 5 graph node shape | exact (fills existing stub, adds union) |
| `lib/agent/conflict-schema.ts` | model/schema | transform | Phase 5's per-LLM-output Zod schema convention (`lib/agent/` per Phase 1 D-07) | role-match |
| `lib/agent/nodes/propose.ts` (conflict branch) | service/graph-node | request-response (one `MODEL_SMART` call) | `lib/ai/provider.ts` `complete<T>({tier, schema, ...})` (Phase 5 D-05/D-06, AGT-01) | exact |
| `lib/slack/blocks.ts` (`buildConflictBlocks`, `buildConflictWarningBlocks`) | component/card-builder | transform | Phase 2's `buildApprovalBlocks` (approve/reject) + Phase 5's edit-modal variant, same file (Phase 1 D-03 action-id/value convention) | exact |
| `lib/slack/bolt.ts` (`choose_alt` action + optional `/secretary scan` branch) | controller/listener | event-driven (Slack `block_actions` / slash command) | Phase 4's `app.action("approve_proposal", ...)` listener (`04-CONTEXT.md` D-05) + Phase 2's `/secretary` command registration | exact |
| `lib/slack/approve.ts` (read, reuse only — no new file) | service | request-response | Phase 4's approve sequence (`04-CONTEXT.md` D-04/D-06): read row → conditional organizer claim → create event → persist links + `status=confirmed` → `chat.update` | exact (import, do not reimplement — D-15) |

## Pattern Assignments

### `lib/agent/nodes/check-conflicts.ts` (service/graph-node, request-response)

**Analog:** Phase 3's `checkConflicts` stub (`03-CONTEXT.md` D-05) — "Phase 3 fills in the body of Phase 1's `checkConflicts(userId, startIso, endIso)` stub with the real `freebusy.query`... It does not union pending Proposals from the DB; that is CFL-01 (Phase 7)." Phase 7 extends this exact function/signature to add the union, not a new function.

**Core pattern** — half-open overlap + pending-Proposal union (`07-RESEARCH.md` lines 196-219):
```typescript
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

const pendingClashes = await prisma.proposal.findMany({
  where: {
    team_id: ctx.team_id,
    status: "pending",
    start: { lt: requestedEnd },
    end: { gt: requestedStart },
  },
});
```
Query window: the requested day's HKT working hours (e.g. `09:00+08:00`–`19:00+08:00`), not just the requested slot — orchestrator review Pitfall 5, `07-RESEARCH.md` lines 318-333, else the model can't see the rest of A's day.

**Timezone pattern** (D-10, Pitfall 3, lines 292-304): construct `Date` objects from `freebusy.query`'s `busy[].start/.end` (`Z`-suffixed UTC) and from `state.intent.startIso` (`+08:00`); compare only `Date`/epoch, never raw strings. Log the actual `timeMin`/`timeMax` sent, confirm `+08:00` in the log line.

**Filter rule:** `status: "pending"` only — a `confirmed` Proposal is already reflected in `freebusy.query`; including it double-counts.

---

### `lib/agent/conflict-schema.ts` (model/schema, transform)

**Analog:** none in-repo yet; pattern is the project rule "one Zod schema per LLM output" already applied by Phase 5's extraction schemas in `lib/agent/`.

**Schema pattern** (`07-RESEARCH.md` lines 339-358) — two named fields, not an array (structured-output array-length enforcement is unreliable per-provider; named object properties are not):
```typescript
import { z } from "zod";

const AlternativeSlotSchema = z.object({
  startIso: z.string().datetime({ offset: true }),
  endIso: z.string().datetime({ offset: true }),
  reason: z.string().min(1).max(200),
});

export const ConflictAlternativesSchema = z.object({
  optionA: AlternativeSlotSchema,
  optionB: AlternativeSlotSchema,
});
export type ConflictAlternatives = z.infer<typeof ConflictAlternativesSchema>;
```

---

### `lib/agent/nodes/propose.ts` conflict branch (service/graph-node, request-response)

**Analog:** `lib/ai/provider.ts`'s `complete<T>({tier, system, prompt, schema, schemaName})` (Phase 5 D-05/D-06, single source of truth per AGT-01). Phase 7 is a caller with `tier: "smart"`, not a second implementation.

**Core pattern** (`07-RESEARCH.md` lines 361-397) — one call, `.safeParse` semantics via `complete`, re-validate against the same `rangesOverlap`, retry once on failure, then deterministically patch (never abort to CFL-05 for this failure mode):
```typescript
let result = await complete({
  tier: "smart",
  schema: ConflictAlternativesSchema,
  system: CONFLICT_SYSTEM_PROMPT,
  prompt: buildConflictPrompt(requested, busy, preferences), // preferences: [] is valid (D-12)
});

const invalid = [result.optionA, result.optionB].filter((slot) =>
  busy.some((b) => rangesOverlap(new Date(slot.startIso), new Date(slot.endIso), b.start, b.end)),
);

if (invalid.length > 0) {
  result = await complete({
    tier: "smart",
    schema: ConflictAlternativesSchema,
    system: CONFLICT_SYSTEM_PROMPT,
    prompt: `${prompt}\n\nNote: ${invalid.map((s) => s.startIso).join(", ")} still overlaps a busy block. Propose different times.`,
  });
}
```

**Graph placement:** inside the existing `propose` node, gated on `state.conflicts.length > 0` — no 6th node (5-node cap, AGT-10). If D-07 rips the graph, same function called in sequence post-`checkConflicts`.

---

### `lib/slack/blocks.ts` — `buildConflictBlocks` / `buildConflictWarningBlocks` (component/card-builder, transform)

**Analog:** Phase 2's `buildApprovalBlocks` (approve/reject) and Phase 5's edit-modal variant, same file — D-25 names this an explicit overlap: Phase 7 adds a conflict variant beside them, never restructures. Inherits Phase 1 D-03's `action_id`/`value` convention: `approve_proposal`/`reject_proposal`, `value` = proposal id.

**Core pattern** (`07-RESEARCH.md` lines 401-439):
```typescript
export function buildConflictBlocks(p: { id: string; title: string }, alts: ConflictAlternatives) {
  const optionBlock = (slot: AlternativeSlot, index: 0 | 1, label: string) => [{
    type: "section",
    text: { type: "mrkdwn", text: `*Option ${label} — ${formatHkt(slot.startIso)}*\n_${slot.reason}_` },
    accessory: {
      type: "button",
      text: { type: "plain_text", text: "Choose" },
      action_id: "choose_alt",       // same action_id both options — value carries the index
      value: `${p.id}:${index}`,     // proposal id + slot index, per D-14
    },
  }];
  return [
    { type: "section", text: { type: "mrkdwn", text: `*${p.title}* — clashes with an existing event` } },
    ...optionBlock(alts.optionA, 0, "A"),
    ...optionBlock(alts.optionB, 1, "B"),
  ];
}

/** CFL-05 degraded form. */
export function buildConflictWarningBlocks(p: { id: string; title: string }, clashSummary: string) {
  return [{
    type: "section",
    text: { type: "mrkdwn", text: `*${p.title}* clashes with: ${clashSummary}\n_Automatic alternatives are not available — please reschedule manually._` },
  }];
}
```
Rendering call reuses Phase 4/1's `postProposalCard(proposal)` / `updateProposalCard(channel, ts, proposal)` signatures — Phase 7 only supplies a new block-builder, not a new posting mechanism.

---

### `lib/slack/bolt.ts` — `choose_alt` handler + optional `/secretary scan` (controller/listener, event-driven)

**Analog:** Phase 4's `app.action("approve_proposal", ...)` listener (`04-CONTEXT.md` D-05: `ack()` first, read real proposal id from button `value`, never assume in-memory correlation) and Phase 2's `/secretary` slash-command registration.

**Auth/ack pattern + core pattern** (`07-RESEARCH.md` lines 442-469):
```typescript
import { approveProposal } from "./approve"; // Phase 4's function — imported, NOT reimplemented (D-15)

app.action("choose_alt", async ({ ack, action, body, client }) => {
  await ack(); // first line, before any DB/network call — same discipline as approve_proposal

  const value = (action as { value?: string }).value ?? "";
  const [proposalId, indexStr] = value.split(":");
  const slotIndex = Number(indexStr) as 0 | 1;
  if (!proposalId || (slotIndex !== 0 && slotIndex !== 1)) return; // defensive parse, V5

  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal || proposal.status !== "pending" || !proposal.alternatives) return; // re-derive from DB, never trust payload

  const alts = proposal.alternatives as ConflictAlternatives;
  const chosen = slotIndex === 0 ? alts.optionA : alts.optionB;

  await prisma.proposal.update({
    where: { id: proposalId },
    data: { start: new Date(chosen.startIso), end: new Date(chosen.endIso) },
  });

  await approveProposal(proposalId); // SAME function Phase 4's approve_proposal action calls
});
```

**IMPORTANT (per `07-RESEARCH.md` Open Question 2 / Assumption A4):** before writing this handler, `07-01`'s merge step must open the real `lib/slack/approve.ts` and confirm the approve sequence is exported as a standalone `async function approveProposal(proposalId: string): Promise<void>`, not inlined in the listener. If inlined, extract it first (mechanical, same lines moved) — D-15 requires literally the same function, not a parallel implementation.

**`/secretary scan` append pattern** (D-20, `07-RESEARCH.md` lines 224-240) — branch inside Phase 2's existing `/secretary` handler, do not register a second `app.command("/secretary", ...)` (Bolt runs every matching listener → double ack):
```typescript
if (command.text.trim() !== "scan") return; // existing handler routes other subcommands
const history = await client.conversations.history({ channel: command.channel_id, limit: 50 });
const messages = (history.messages ?? [])
  .filter((m) => !m.subtype && !m.bot_id)
  .reverse()
  .map(toSlackMessage);
await extractIntents(messages, ctx); // Phase 5's existing signature (AGT-02), one batch call
```

---

## Shared Patterns

### Overlap predicate — single source of truth
**Source:** `rangesOverlap(aStart, aEnd, bStart, bEnd)`, defined once (in `lib/agent/` or `utils/`), used by both `checkConflicts` and the model-slot re-validation in `propose`. Never a second, independently-written comparison — this is the exact drift class Pitfall 1/2 in `07-RESEARCH.md` warn about.

### Time formatting
**Source:** `utils/time.ts`'s existing `Intl.DateTimeFormat` HKT formatter (Phase 1 D-08), reused for the conflict prompt, the log line (D-10), and the card's `formatHkt(slot.startIso)`. No second formatter.

### Model calls
**Source:** `lib/ai/provider.ts`'s `complete<T>({tier, schema, ...})` (Phase 5, AGT-01 single source of truth). All conflict-alternative generation routes through this — no bespoke `fetch()`/Kilo Gateway call.

### Approve path
**Source:** `lib/slack/approve.ts`'s `approveProposal(proposalId)` (Phase 4). The organizer-claim guard (APR-02) is inherited automatically by calling this function — this is also the ASVS V4 access-control argument, not just a reuse convenience.

### Action-id / value convention
**Source:** Phase 1 D-03 — `action_id` names the action, `value` carries the proposal id (extended here to `proposalId:slotIndex`). Consistent across `approve_proposal`, `reject_proposal`, and the new `choose_alt`.

## No Analog Found

None — every file in scope has a directly-cited upstream contract (Phase 1/2/3/4/5 CONTEXT.md or this phase's own RESEARCH.md code examples) to copy from. The repo has no committed source yet, so all "analogs" are these locked interface shapes rather than existing files on disk.

## Metadata

**Analog search scope:** `.planning/phases/{01,02,03,04,05}-*/*-CONTEXT.md`, `.planning/phases/07-integrate-conflict-counter-proposal/07-RESEARCH.md`, `.planning/research/ARCHITECTURE.md` (referenced, not re-quoted)
**Files scanned:** 7 CONTEXT.md files + 1 RESEARCH.md (no source files exist in the repo yet — verified via `git ls-files` scope: only `.planning/`, `.claude/`, `gsd-prompt-ai-secretary.md` tracked)
**Pattern extraction date:** 2026-09-12
