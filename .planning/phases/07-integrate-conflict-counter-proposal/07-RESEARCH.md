# Phase 7: Integrate + Conflict Counter-Proposal - Research

**Researched:** 2026-09-11
**Domain:** Wave-B merge mechanics, live-graph wiring, Google Calendar `freebusy.query` union with pending Proposals, one-shot `MODEL_SMART` structured-output counter-proposal, Slack Block Kit conflict card + shared approve-path reuse, optional `/secretary scan`
**Confidence:** MEDIUM-HIGH — merge/process mechanics and Block Kit shapes are HIGH (official docs + verbatim upstream-phase decisions); the `MODEL_SMART` two-alternative structured-output shape and the demo-beat duration arithmetic are MEDIUM/flagged — both need a hand check in the first minutes of `07-02`, not blind trust.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Plan structure and sequencing**
- D-01: Three plans — `07-01` (merge Wave B → `develop` → `main` + wire real graph into task + full-path dry run + LangGraph keep-or-rip checkpoint), `07-02` (conflict counter-proposal CFL-01..04, or degraded CFL-05 if past 14:15), `07-03` (optional, only if ahead: `/secretary scan` OPT-01).
- D-02: `07-01` merges Phase 5's and Phase 6's branches into `develop`, then `develop` into `main`, before any feature code.
- D-03: Before any `bunx prisma db push` after the merge, re-merge `develop` and diff `prisma/schema.prisma` against both Wave B branches.
- D-04: `bun.lock` is never hand-merged: resolve `package.json`, then regenerate the lockfile with `bun install`.

**Integration (07-01)**
- D-05: The real graph (Phase 5's `runAgent`) replaces the stub body called from Phase 4's Trigger.dev task. `AGENT_TRANSPORT=trigger|inline` must keep working in both modes after the wiring.
- D-06: Confirm the dashboard shows real extracted `Proposal`/`Decision` rows end to end. No dashboard UI added this phase.
- D-07: LangGraph keep-or-rip is fixed, not optional: at ~14:00, if the graph is still fighting the time budget, rip it out and call the same node functions in sequence (~10 min).
- D-08: Confidence-gate integration is never cut.

**Conflict detection (CFL-01)**
- D-09: A clash is the intent's slot overlapping A's calendar busy blocks (via Phase 3's `freebusy.query` client, read-only) **unioned with pending Proposals in the DB**.
- D-10: Log the actual `timeMin`/`timeMax` sent on the conflict check and eyeball `+08:00` offsets matching the intended HKT window.

**Counter-proposal (CFL-02)**
- D-11: On a clash, make **exactly one `MODEL_SMART` call**, through `lib/ai/provider.ts`, that receives busy blocks + known preferences and returns **exactly two** alternative slots, each with a one-line human reason.
- D-12: Zero `Preference` rows is a valid input and must work.
- D-13: The model output is Zod-validated.

**Conflict card and selection (CFL-03)**
- D-14: The card renders both alternatives with their reasons as buttons. Each button's `value` = proposal id + slot index.
- D-15: Choosing an alternative runs the **same approve path** (Phase 4's handler) against the chosen slot. No second approve implementation.
- D-16: Choosing an alternative produces a real calendar event for the chosen slot.

**Demo beat (CFL-04)**
- D-17: Fri 11:00 ask → approve (event exists) → B's ask for 10:30 the same day → conflict card with two reasoned alternatives.

**Degraded form and cut line (CFL-05)**
- D-18: Hard cut line 14:15. If `07-02` has not started by 14:15, implement only the static conflict warning naming the clashing block. Then stop.
- D-19: Cut order: (1) drop `/secretary scan` first, (2) past 14:15 without CFL started → CFL-05, (3) never cut confidence-gate integration.

**Optional scan (OPT-01)**
- D-20: `/secretary scan` runs `extractIntents` over the last ~50 messages of the current channel. Built only after CFL is demo-ready. Appends to `lib/slack/bolt.ts`, never restructures it.

**Exit and review (DMO-05)**
- D-21: Exit criterion: seed Fri 11:00 → approve → seed B's 10:30 → card shows two reasoned alternatives (or static warning) → picking an alternative completes the approve path. Never produces nothing.
- D-22: `/ponytail-review` runs on the full merged diff before the phase is marked done — satisfies DMO-05 for the whole build.

**File ownership**
- D-23: Owns `lib/agent/**` (conflict node/plain-function), `lib/ai/**` (MODEL_SMART conflict call), `lib/slack/**` (conflict card + optional scan listener), `lib/calendar/**` (read-only calls, no edits).
- D-24: Must not touch `app/**`/`components/**`.
- D-25: `lib/slack/bolt.ts` and card block builders — named overlap; this phase's conflict plan owns them this phase, adding a conflict variant beside Phase 2's approve/reject and Phase 5's edit variant. Scan plan appends only.

**Processes**
- D-26: Next.js `:3000`, Bolt (sole instance), Trigger.dev dev CLI, Postgres `:5432` — same set as Phase 4, now carrying real traffic. Kill any other worktree's Bolt first.

### Claude's Discretion

- Where clash detection and the counter-proposal call sit: inside the graph's `checkConflicts`/`propose` nodes, or as plain functions after extraction (if D-07 rips the graph).
- The search window and candidate-slot constraints fed to `MODEL_SMART` (same day, working hours HKT, same duration, no overlap).
- Whether model-returned slots are re-checked in code before rendering, and what happens if a returned slot still clashes (retry once, or fall back to CFL-05).
- Zod schema shape for the two alternatives, and structured output vs. JSON mode + manual parse.
- How the chosen slot reaches the approve path: update the Proposal's `start`/`end` from stored alternatives before calling the shared approve logic, or pass the slot in.
- Where alternatives are stored between card render and click (Proposal row vs. button value), and the button `action_id`.
- Whether a conflict card still offers the original Approve/Reject beside the alternatives.
- Degraded-warning copy and layout.
- Scan implementation details: `conversations.history` paging, bot/subtype filtering, batching vs. per-message.

### Deferred Ideas (OUT OF SCOPE)

- Expiry re-trigger (SCL-03): v2.
- Preference learning / Graphiti (S1, Phase 9): read-only if rows exist; nothing writes them here.
- Any dashboard rendering of alternatives: out of scope.
- Reset script and calendar cleanup between runs: Phase 10.
- `/secretary scan` is itself optional (OPT-01) and first to be cut.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CFL-01 | Detect clash: intent slot vs. A's busy blocks ∪ pending Proposals | §Architecture Patterns "Conflict detection query", §Common Pitfalls "Half-open interval math", §Code Examples "checkConflicts union query" |
| CFL-02 | On clash, one `MODEL_SMART` call → exactly two alternatives with reasons, works with zero `Preference` rows | §Code Examples "MODEL_SMART two-alternative schema + call", §Common Pitfalls "Structured-output array-length risk" |
| CFL-03 | Card renders both alternatives as buttons (`value` = proposal id + slot index); choosing one runs the same approve path | §Code Examples "buildConflictBlocks", §Architecture Patterns "Reusing Phase 4's approve function" |
| CFL-04 | Demo beat: Fri 11:00 event exists → B's 10:30 ask produces conflict card | §Common Pitfalls "Demo-beat duration risk" — **flagged, needs planner decision** |
| CFL-05 | Degraded static conflict warning if not started by 14:15 | §Code Examples "buildConflictWarningBlocks" |
| DMO-05 | `/ponytail-review` on the full merged diff | §Architecture Patterns "Merge and review sequencing" |
| OPT-01 | `/secretary scan` over last ~50 messages | §Code Examples "/secretary scan handler" |
</phase_requirements>

## Summary

Phase 7 is an integration + one-feature phase with almost no new external unknowns — every library, schema field, and convention it needs was already fixed in Phases 1, 4, and 5. The real risk surface is arithmetic and reuse discipline, not new tooling:

1. **The demo-beat duration is under-specified and can silently fail to clash.** Phase 5's `extractIntents` produces a `durationMinutes` field, but no phase has locked its default value. Under a correct half-open overlap check (`start < otherEnd && end > otherStart`, i.e. back-to-back is *not* a clash — this is required so approving one meeting doesn't self-block an adjacent one), a 30-minute default duration on B's 10:30 ask produces `10:30–11:00`, which does **not** overlap an `11:00–11:30` (or later) event. The scripted demo beat (CFL-04) can only be trusted if either the default duration is long enough, or the seeded message wording states a duration explicitly. This is flagged, not silently fixed — see Pitfall 1 below.
2. **The `MODEL_SMART` "exactly two alternatives" contract is safer as two named object fields than as an array/tuple.** OpenAI/Kilo Gateway structured-output strict mode reliably enforces object shape (required properties) but has patchier, provider-dependent enforcement of array/tuple length constraints. `{ optionA: Slot, optionB: Slot }` is a shape no provider can partially satisfy; `z.array(Slot).length(2)` can come back with 1 or 3 items despite the Zod schema, especially on a fallback JSON-mode path.
3. **The approve path must be reused, not reimplemented.** Phase 4 (`04-CONTEXT.md` D-04/D-06) already fixed the approve sequence as ordinary backend code in `lib/slack/approve.ts`, called from a Bolt `block_actions` listener — but its context doesn't confirm the function is exported separately from the listener wrapper. Phase 7's `07-01` plan should explicitly check Phase 4's actual `lib/slack/approve.ts` shape at merge time and, if the approve logic isn't already an importable function taking a proposal id, extract it into one (a small, mechanical refactor) rather than duplicating the read→claim→create-event→update-card sequence for the "choose alternative" button — D-15 is explicit that there must be no second approve implementation.
4. Everything else — the merge order, `freebusy.query` shape, Block Kit button conventions, LangGraph conditional structure, `/secretary scan` mechanics — is either already locked by an upstream phase or a direct, low-risk application of already-cited official docs.

**Primary recommendation:** Build `07-02`'s conflict node as *state produced by `checkConflicts`, consumed by `propose`* inside the existing 5-node graph (no 6th node), use a two-named-field Zod schema for the `MODEL_SMART` response, re-validate both returned slots in code against the same overlap function before rendering buttons (retry once on failure, then deterministically patch only the invalid slot rather than aborting to CFL-05), and import — don't reimplement — Phase 4's approve function for the "choose alternative" button handler.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Merge orchestration (`develop`→`main`) | Build-time / git, not a runtime tier | — | No code executes; this is repo mechanics |
| Real graph invocation from Trigger.dev task | Backend (`lib/agent/graph.ts` via `lib/agent/tasks/`) | Trigger.dev process | Task is a thin wrapper (Phase 4 D-12); all logic stays in `lib/agent/` so the `inline` transport fallback keeps working unchanged |
| Conflict detection (`freebusy.query` ∪ pending Proposals) | Backend (`lib/agent/nodes/checkConflicts.ts` calling `lib/calendar/freebusy.ts`, read-only) | Database (Proposal table read) | Same tier Phase 5's graph already runs in; Calendar client stays Phase 3's, called not edited (D-23/D-24) |
| `MODEL_SMART` counter-proposal call | Backend (`lib/ai/provider.ts`) | — | Single source of truth for all model calls (AGT-01), unchanged from Phase 5 |
| Conflict card rendering + button dispatch | Bolt process (`lib/slack/**`) | — | `block_actions` for the "choose alternative" click only ever arrives on Bolt's Socket Mode connection (ARCHITECTURE.md, confirmed unchanged) |
| Approve-on-chosen-slot | Backend (`lib/slack/approve.ts`, reused from Phase 4) | Database (organizer claim), Google Calendar (event write) | D-15 requires literally the same function, not a parallel one |
| `/secretary scan` message fetch + batch extraction | Bolt process (`lib/slack/bolt.ts` listener) → Backend (`extractIntents`) | — | Slash-command payload only reaches Bolt; the batch call reuses Phase 5's existing signature unchanged |
| Dashboard confirmation (read-only) | Frontend Server (Next.js, Phase 6, unchanged) | Database | Phase 7 only *verifies* this tier, doesn't touch it (D-24) |

No capability here crosses a tier boundary that PROJECT.md/ARCHITECTURE.md didn't already fix; this map exists to catch drift, not to introduce new ownership.

## Standard Stack

No new packages this phase — see **Package Legitimacy Audit** below. Every library used (`googleapis@180.0.0`, `openai@7.15.0`, `zod@4.6.2`, `@langchain/langgraph@1.4.14`, `@slack/bolt@5.1.0`) is already installed and pinned per `.planning/research/STACK.md` `[VERIFIED: npm registry]`, confirmed unchanged in Phase 1/5 context.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `z.object({ optionA: Slot, optionB: Slot })` for the MODEL_SMART schema | `z.tuple([Slot, Slot])` or `z.array(Slot).length(2)` | Tuples/length-constrained arrays are the more "natural" Zod shape for "exactly two," but structured-output strict-mode JSON Schema conversion (`prefixItems`/`minItems`/`maxItems`) has inconsistent enforcement across Kilo-routed providers (STACK.md's own "What NOT to Use" already flags per-model structured-output inconsistency generally); two required named object fields is a JSON Schema shape every strict-mode implementation handles identically (required properties), and the code-side re-validation this research recommends (Pitfall 2) makes the choice low-stakes either way — named fields is simply the lower-risk default |
| Adding a 6th graph node for conflict counter-proposal | Extending `checkConflicts`/`propose` (locked ≤5-node cap, AGT-10) | A 6th node would violate the hard cap; keeping the counter-proposal call inside `propose` (gated on `state.conflicts.length > 0`) costs nothing and matches Phase 5 D-02's own framing ("check-conflicts node is on the path but its real logic belongs to Phase 7") |
| A separate deterministic candidate-slot generator as the primary counter-proposal mechanism | One `MODEL_SMART` call (locked, D-11) | Out of scope — D-11 already locks the mechanism; a deterministic generator is recommended only as the *fallback* when a model-returned slot fails re-validation (see Pitfall 2), not as a replacement for the model call |

## Package Legitimacy Audit

**No new external packages are installed in this phase.** All libraries used by CFL-01..05, DMO-05, and OPT-01 (`googleapis`, `openai`, `zod`, `@langchain/langgraph`, `@slack/bolt`, `@prisma/client`) were installed and audited in Phase 1 (`01-RESEARCH.md` §Package Legitimacy Audit) and re-confirmed unchanged in Phase 5's context. The Package Legitimacy Gate is not applicable this phase — planner does not need a `checkpoint:human-verify` for installs here.

## Architecture Patterns

### System Architecture Diagram (conflict path only — the merge/wiring plan has no new data flow beyond what ARCHITECTURE.md already documents)

```
B's Slack message "10:30 same day?"
      │ message.channels event (watched channel, Bolt)
      ▼
dispatchAgentRun → runAgent (real graph, Phase 5, wired live this phase)
      │
      ▼
extract → classify → resolveTime
      │ state.intent = { startIso: "2026-09-18T10:30:00+08:00", durationMinutes, ... }
      ▼
checkConflicts node
  1. lib/calendar/freebusy.ts → freebusy.query(A, timeMin, timeMax, tz=Asia/Hong_Kong)  [READ-ONLY]
  2. Prisma: SELECT Proposal WHERE team_id=? AND status='pending'
     AND start < requestedEnd AND end > requestedStart               [pending-Proposal union]
  3. state.conflicts = [...freebusyBlocks, ...pendingProposalBlocks]  (empty array if none)
      │
      ▼
propose node
  ┌─ state.conflicts.length === 0 ─────────────┐   ┌─ state.conflicts.length > 0 ──────────────┐
  │ create Proposal (status=pending)            │   │ create Proposal (status=pending,           │
  │ lib/slack/blocks.ts buildApprovalBlocks      │   │   alternatives=null until model returns)   │
  │ postProposalCard → normal Approve/Reject     │   │ lib/ai/provider.ts complete({tier:"smart"}) │
  └───────────────────────────────────────────── ┘   │   → { optionA, optionB } (Zod-validated)    │
                                                        │ re-validate both against the same          │
                                                        │   overlap function used in checkConflicts   │
                                                        │ UPDATE Proposal SET alternatives = json     │
                                                        │ lib/slack/blocks.ts buildConflictBlocks     │
                                                        │ postProposalCard → 2 "Choose" buttons       │
                                                        │   value = `${proposalId}:${slotIndex}`      │
                                                        └──────────────────────────────────────────────┘
                                                                       │ user clicks "Choose Option A"
                                                                       ▼
                                                        Bolt block_actions "choose_alt" handler
                                                          1. ack() first
                                                          2. parse proposalId, slotIndex from value
                                                          3. read Proposal.alternatives[slotIndex]
                                                          4. UPDATE Proposal SET start=alt.startIso,
                                                             end=alt.endIso WHERE status='pending'
                                                          5. call approveProposal(proposalId)   ← SAME
                                                             function Phase 4's approve_proposal      ← function,
                                                             action calls (D-15)                       no 2nd impl
                                                                       ▼
                                                        real Calendar event + chat.update to confirmed
```

### Reusing Phase 4's approve function (D-15, CFL-03)

Phase 4 fixes (D-04, D-06) that approval is "ordinary backend code in `lib/` (e.g. `lib/slack/approve.ts`), called from the Bolt `block_actions` listener," running: read row → conditional organizer claim → create real event → persist links + `status=confirmed` → `chat.update`. **Before writing the `choose_alt` handler, `07-01`'s merge step must open Phase 4's actual `lib/slack/approve.ts` and confirm the approve sequence is exported as a plain async function taking a proposal id** (e.g. `export async function approveProposal(proposalId: string): Promise<void>`), not inlined directly in the `app.action("approve_proposal", ...)` callback. If Phase 4 left it inlined, `07-01` extracts it into an importable function as a small, mechanical refactor (same lines, moved) — this is the one place in the whole phase where the plan should not assume the upstream shape without a one-file read, because D-15's "no second approve implementation" is unenforceable otherwise.

The `choose_alt` handler's only new step beyond calling `approveProposal` is updating `start`/`end` from the stored `alternatives` field first (Discretion item — this research recommends updating the row before calling the shared function, so `approveProposal` never needs to know whether it's approving an original or a chosen-alternative slot — it just reads whatever `start`/`end` currently sit on the row).

### Conflict detection query (CFL-01) — half-open interval union

**Overlap predicate** (same one used to re-validate model-returned slots, Pitfall 2): two ranges `[aStart, aEnd)` and `[bStart, bEnd)` overlap iff `aStart < bEnd && aEnd > bStart`. This is half-open (end-exclusive) so a meeting ending at 11:00 and one starting at 11:00 are **not** a clash — this is required, not optional: without it, approving a proposal would spuriously "conflict" with any adjacent proposal sharing an exact boundary, including its own just-approved neighbor in a busy day.

```typescript
/**
 * Returns true if two half-open time ranges overlap.
 * End-exclusive: back-to-back ranges (aEnd === bStart) do NOT overlap.
 */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}
```

**Pending-Proposal union query** — filter to `status: "pending"` only (a `confirmed` Proposal is already reflected in `freebusy.query`'s real Calendar data — including it too would double-count the same busy block; `dismissed`/`already_scheduled` rows are irrelevant), scoped by `team_id`, and simple time-range overlap in SQL/Prisma:

```typescript
// lib/agent/nodes/check-conflicts.ts (or a plain function post-rip, per D-07)
const pendingClashes = await prisma.proposal.findMany({
  where: {
    team_id: ctx.team_id,
    status: "pending",
    start: { lt: requestedEnd },
    end: { gt: requestedStart },
  },
});
```
Because `checkConflicts` runs *before* `propose` creates the new Proposal row (graph order: extract → classify → resolveTime → checkConflicts → propose), there is no self-row to exclude — the row being checked doesn't exist yet at check time.

### `/secretary scan` (OPT-01) — reuse, don't fork

```typescript
// Appended to lib/slack/bolt.ts per D-20 (append-only)
app.command("/secretary", async ({ command, ack, client }) => {
  await ack(); // MUST be first line — 3s budget (SLK-04 pattern, already established Phase 2)
  if (command.text.trim() !== "scan") return; // other /secretary invocations handled elsewhere (Phase 2)
  // NOTE (orchestrator review): Bolt runs EVERY matching listener. If Phase 2 already registered
  // app.command("/secretary"), do NOT register a second one (double ack). Branch on `text === "scan"`
  // inside Phase 2's existing handler instead (append a branch, don't restructure).

  const history = await client.conversations.history({ channel: command.channel_id, limit: 50 });
  const messages = (history.messages ?? [])
    .filter((m) => !m.subtype && !m.bot_id) // drop bot messages and edit/delete/join subtypes
    .reverse() // Slack returns newest-first; chronological order for numbered-line extraction
    .map(toSlackMessage); // map to the existing SlackMessage[] shape (types/slack.ts)

  await extractIntents(messages, ctx); // same signature Phase 5 already built (AGT-02) — one batch call, not per-message
});
```
`dedupe_key` (Phase 5 D-20/AGT-09, reused unchanged) already makes a re-run of `/secretary scan` over the same history safe: re-extracted intents that normalize identically hit the unique-constraint path and are treated as a no-op, matching PITFALLS.md's Pitfall 4 guidance applied to a new call site rather than a new mechanism.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Overlap detection | A custom date-range comparison per call site | One shared `rangesOverlap(aStart, aEnd, bStart, bEnd)` in `lib/agent/` (or `utils/`), used by `checkConflicts` AND the model-slot re-validation | Two independently-written overlap checks are exactly the kind of drift this project's own repo rules ("reuse before writing") exist to prevent — and a second, subtly different implementation is how the demo beat's own math gets silently wrong in one path but not the other |
| Approve-on-chosen-slot | A parallel `approveAlternative()` function | Import and call Phase 4's `approveProposal(proposalId)` after updating `start`/`end` | D-15 explicit: "same approve path... No second approve implementation" |
| MODEL_SMART structured output plumbing | A bespoke fetch()/JSON.parse() against Kilo Gateway | `lib/ai/provider.ts`'s existing `complete<T>({tier:"smart", schema, ...})` (Phase 5 D-05/D-06, already built) | AGT-01 single-source-of-truth rule; Phase 7 is a *caller* of this function with `tier: "smart"`, not a second implementation |
| HKT time formatting for the prompt / logged timeMin/timeMax | A new formatter | `utils/time.ts`'s existing `Intl.DateTimeFormat` HKT formatter (Phase 1 D-08) | Already exists, already used by Phase 2/6; no reason for Phase 7 to add a second one |

**Key insight:** every hand-roll risk in this phase is actually a *reuse* risk — the danger isn't writing new code badly, it's writing a second version of something Phase 1/4/5 already built correctly.

## Common Pitfalls

### Pitfall 1: Demo-beat duration can make CFL-04 silently not clash

**What goes wrong:** The scripted demo beat (D-17/CFL-04) is "Fri 11:00 event exists → B asks for 10:30 the same day → conflict." Under the correct half-open overlap rule this research recommends (and which the project itself needs to avoid false-positive adjacent-meeting conflicts elsewhere), a 10:30 request only clashes with an 11:00 event if the 10:30 request's own duration pushes its end **past** 11:00. If `extractIntents`' default `durationMinutes` (Phase 5, AGT-02 — no default value is locked in either Phase 5 or Phase 7 CONTEXT.md) is 30 minutes, B's ask resolves to `10:30–11:00`, which does **not** overlap an `11:00–…` event (`10:30–11:00` ends exactly when `11:00–…` starts — half-open, no overlap). The headline demo moment (D-21's exit criterion) can silently fail to fire, and nothing in the code is "wrong" — the math is doing exactly what CONTEXT.md itself already names as a risk in `<specifics>`.

**Why it happens:** No phase has locked a default meeting duration. Phase 5's context only says `durationMinutes` is part of `ExtractedIntent`, not its default when a message doesn't state one. Two independently-scripted messages ("at 11am" / "at 10:30") that both default to 30 minutes produce back-to-back, not overlapping, ranges.

**How to avoid — planner must pick one before scripting the dry run:**
1. **Preferred, no code risk:** word the seed messages with explicit durations that guarantee overlap regardless of `extractIntents`' default — e.g. B's second message: "Let's talk at 10:30, need about an hour" (resolves to `10:30–11:30`, which overlaps any `11:00–…` event by construction). This needs zero coordination with Phase 5's actual default and is entirely inside Phase 7's own control, since Phase 7 hand-seeds both messages for its own dry run (D-21).
2. **Alternative, needs a quick check:** confirm Phase 5's actual shipped default duration (read `lib/agent/` once, or test the extraction call) — if it is 60 minutes or more, the beat fires as scripted with no wording changes needed. If it turns out to be 30 minutes, option 1 is required regardless.

**Do not** relax the overlap check to be end-inclusive (`aEnd >= bStart`) purely to force this one beat to fire — that reintroduces false conflicts on every legitimately back-to-back pair of meetings for the rest of the project's life, a materially worse tradeoff than fixing the seed message's wording once.

**Warning signs:** The first live dry run (`07-02`'s own exit check) produces a normal approval card instead of a conflict card for B's 10:30 ask — check this immediately, don't assume a code bug, check the actual resolved `start`/`end` on both Proposal rows first (`SELECT start, end FROM "Proposal" ORDER BY created_at DESC LIMIT 2`).

**Phase to address:** `07-02`, before writing the conflict node — decide seed message wording as the first five minutes of the plan, not discovered as a bug during the dry run.

---

### Pitfall 2: Structured-output "exactly two" isn't self-enforcing — code must re-check

**What goes wrong:** Even with a correct Zod schema, a model behind Kilo Gateway can return a malformed or logically-invalid response: a JSON-mode fallback path (STACK.md's own documented fallback for models that don't honor strict `json_schema`) has no schema enforcement at all beyond what `.parse()`/`.safeParse()` catches after the fact, and even a strict-mode response that *type-checks* can still describe a slot that itself clashes with the busy set (models routinely propose "2pm" without cross-referencing every busy block correctly) or falls outside working hours / in the past.

**Why it happens:** `zodResponseFormat`/strict `json_schema` guarantees shape conformance (the response is a syntactically valid instance of the schema), never semantic correctness (that the proposed times are actually free). This is the same class of risk PITFALLS.md's Pitfall 12 already names for extraction, applied here to a call whose failure mode is more visible — a conflict card offering an alternative that *itself* conflicts is a worse demo moment than a confidence-gate miss.

**How to avoid:**
1. Parse with `.safeParse()`, not `.parse()` — a throw here must not crash the graph mid-run.
2. Re-run both returned slots through the **same** `rangesOverlap` function used in `checkConflicts` against the same busy-block ∪ pending-Proposal set. Also check both fall inside working hours and are not in the past.
3. If either check fails: retry the `MODEL_SMART` call **once**, appending a corrective note naming exactly which slot(s) failed and why ("10:00–11:00 still overlaps your 11:00 event"). One retry, not a loop.
4. If the retry still fails: **do not** abort to CFL-05 (that degraded path is specifically for "conflict work never started by 14:15," a different failure mode) — instead deterministically patch only the still-invalid slot in code: the next `Preference`-aware (or default 30-minute-aligned) free slot after the latest busy block ends, same day, within working hours. This is a ~10-line function, not a general scheduler, and only ever fires as a last-resort patch for one slot, not the primary mechanism (D-11's "one `MODEL_SMART` call" stays the normal path).

**Warning signs:** A conflict-card alternative's own displayed time falls inside a busy block already logged for the same check — visible immediately on the card, not something requiring a log dive.

**Phase to address:** `07-02`, in the same function that calls `complete({tier:"smart", ...})` — write the re-validation alongside the call, not as an afterthought.

---

### Pitfall 3: `freebusy.query` response times are UTC regardless of the request's `timeZone`

**What goes wrong:** Comparing a `busy[].start`/`.end` value (returned as `...Z`, UTC) directly against a naive HKT-looking string, or against `state.intent.startIso` if that ISO string wasn't itself parsed with its `+08:00` offset preserved, produces an 8-hour-shifted overlap check — the exact failure mode PITFALLS.md's `freebusy.query timezone mishandling` pitfall already names project-wide, restated here because CFL-01 is the first place in the project this specific response shape (not just the request) is consumed.

**Why it happens:** Per Google's own Calendar API reference (confirmed this session), the request's `timeZone` field only affects how *naive* `timeMin`/`timeMax` values (ones without an explicit offset) are interpreted — request values with an explicit `+08:00` offset don't need it. The **response** `busy[].start`/`.end` values are UTC (`Z` suffix), independent of what `timeZone` was requested — `[CITED: developers.google.com/workspace/calendar/api/v3/reference/freebusy/query]`, cross-checked against a public example response showing `"2019-03-02T15:00:00Z"`. Google's own reference page does not explicitly restate this response-format guarantee in the exact words fetched this session (flagged, not blindly asserted) — treat as `[CITED, MEDIUM confidence]`, not `[VERIFIED]`, and confirm on the first real call per D-10.
- Request shape confirmed this session: `{ timeMin, timeMax, timeZone, items: [{ id: "primary" }] }`.
- Response shape confirmed this session: `{ kind, timeMin, timeMax, calendars: { [id]: { busy: [{ start, end }], errors: [...] } } }`.

**How to avoid:** Always construct JS `Date` objects from the response's ISO strings (which parse correctly regardless of `Z` vs. offset — `new Date("...Z")` and `new Date("...+08:00")` both produce the correct instant), and only ever compare `Date` objects (or their `.getTime()` epoch values), never raw strings. Never assume a `Z`-suffixed response string "is UTC time of day in HKT" without going through `Date`.

**Warning signs:** The overlap check silently returns `false` for a pair of times a human can see clearly overlap when printed in HKT — the tell that a raw-string comparison snuck in somewhere instead of a `Date`-object comparison.

**Phase to address:** `07-02`, `checkConflicts` implementation — this is the same D-10 log-and-eyeball step already locked, this pitfall just names the response-side half of the same risk the request-side log check doesn't cover.

---

### Pitfall 4: `db push` drift if the merge didn't actually pick up both Wave-B branches' schema state (already named in ROADMAP.md, restated with the exact check)

**What goes wrong:** Both Phase 5 and Phase 6 may have added `Preference`/`Decision`/dashboard-adjacent columns independently on their own branches. If `07-01` merges only one of the two branches into `develop` before running `bunx prisma db push` — or merges both but a fast-forward/no-op merge silently drops one branch's schema hunk due to a conflict resolved wrong — the pushed schema can be missing a column either track's code expects, surfacing as a runtime Prisma error, not a merge error.

**How to avoid:** D-03 already locks the fix procedurally: after merging both branches into `develop`, `git diff` `prisma/schema.prisma` between the merged `develop` and each of the two source branches individually, confirming every field either branch added is present in the merged result, **before** running `db push`. This is a one-minute check, not a design decision.

**Phase to address:** `07-01`, immediately after the merge, before the first `db push`.

---

### Pitfall 5 (orchestrator review): a slot-sized freebusy window starves the counter-proposal

**What goes wrong:** Suppose `checkConflicts` queries `freebusy.query` (and the pending-Proposal union) only for the requested slot `[10:30, 11:30)`. Then the busy set holds just the one clashing block. The `MODEL_SMART` call can't see the rest of A's day, so it may propose 14:00 while A is busy at 14:00. Pitfall 2's code-side re-validation runs against that same narrow set, so it passes the bad slot too.

**How to avoid:**
- Query one window, the requested day's HKT working hours (e.g. `2026-09-18T09:00:00+08:00` → `2026-09-18T19:00:00+08:00`).
- Detect the clash as `rangesOverlap(requested, block)` over that set.
- Pass the whole set to the model and to re-validation.

This is one query, not two, and the log line D-10 requires shows the day window.

**Related: pending conflict rows pollute later checks.** The conflict-card Proposal is created `pending` with its original clashing 10:30 start. Until it's resolved, it counts as a busy block in every later clash check for that day. The same applies to rehearsal leftovers, which Phase 10's reset clears. Two fixes are acceptable:
- Store the conflict card's Proposal with a non-pending status until an alternative is chosen.
- Filter conflict-card rows out of the union.

Or just accept it for the scripted demo and note it as a known shortcut.

## Code Examples

### `lib/ai/provider.ts` conflict call — two named fields, not an array (CFL-02, D-11/D-13)

```typescript
// lib/agent/conflict-schema.ts (Zod schema lives in lib/agent/, per Phase 1 D-07)
import { z } from "zod";

const AlternativeSlotSchema = z.object({
  startIso: z.string().datetime({ offset: true }), // must carry an explicit offset, not naive
  endIso: z.string().datetime({ offset: true }),
  reason: z.string().min(1).max(200), // "one-line human reason"
});

/**
 * Exactly two alternative slots. Named fields, not an array/tuple — structured-output
 * strict-mode enforcement of array length is inconsistent across Kilo-routed
 * providers; two required object properties is enforced identically everywhere.
 */
export const ConflictAlternativesSchema = z.object({
  optionA: AlternativeSlotSchema,
  optionB: AlternativeSlotSchema,
});
export type ConflictAlternatives = z.infer<typeof ConflictAlternativesSchema>;
```

```typescript
// lib/agent/nodes/propose.ts (or plain function post-rip, per D-07) — conflict branch only
import { rangesOverlap } from "../../utils/time"; // or wherever the shared predicate lives
import { complete } from "../../ai/provider";
import { ConflictAlternativesSchema, type ConflictAlternatives } from "../conflict-schema";

async function proposeAlternatives(
  requested: { startIso: string; endIso: string; durationMinutes: number },
  busy: Array<{ start: Date; end: Date }>,
  preferences: Array<{ key: string; value: string }>, // [] is valid input (D-12)
): Promise<ConflictAlternatives> {
  const prompt = buildConflictPrompt(requested, busy, preferences); // busy blocks rendered in HKT via utils/time.ts

  let result = await complete({
    tier: "smart",
    schema: ConflictAlternativesSchema,
    system: CONFLICT_SYSTEM_PROMPT,
    prompt,
  });

  const invalid = [result.optionA, result.optionB].filter(
    (slot) => busy.some((b) => rangesOverlap(new Date(slot.startIso), new Date(slot.endIso), b.start, b.end)),
  );

  if (invalid.length > 0) {
    // One retry with corrective feedback naming the bad slot(s) — Pitfall 2
    result = await complete({
      tier: "smart",
      schema: ConflictAlternativesSchema,
      system: CONFLICT_SYSTEM_PROMPT,
      prompt: `${prompt}\n\nNote: ${invalid.map((s) => s.startIso).join(", ")} still overlaps a busy block. Propose different times.`,
    });
  }

  return result; // caller re-checks once more and deterministically patches any still-invalid slot (Pitfall 2 step 4)
}
```

### `buildConflictBlocks` (CFL-03, D-14) — Block Kit

```typescript
// lib/slack/blocks.ts — Phase 7's conflict variant, beside Phase 2's approve/reject
// and Phase 5's edit-modal variant (D-25 named overlap: extends, never restructures)
export function buildConflictBlocks(p: { id: string; title: string }, alts: ConflictAlternatives) {
  const optionBlock = (slot: AlternativeSlot, index: 0 | 1, label: string) => [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Option ${label} — ${formatHkt(slot.startIso)}*\n_${slot.reason}_`,
      },
      accessory: {
        type: "button",
        text: { type: "plain_text", text: "Choose" },
        action_id: "choose_alt", // same action_id both blocks — value carries the distinguishing index
        value: `${p.id}:${index}`, // well under Slack's 2000-char value limit
      },
    },
  ];

  return [
    { type: "section", text: { type: "mrkdwn", text: `*${p.title}* — clashes with an existing event` } },
    ...optionBlock(alts.optionA, 0, "A"),
    ...optionBlock(alts.optionB, 1, "B"),
  ];
}

/** CFL-05 degraded form — named block, not the conflict card, so bolt.ts can pick either at render time. */
export function buildConflictWarningBlocks(p: { id: string; title: string }, clashSummary: string) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${p.title}* clashes with: ${clashSummary}\n_Automatic alternatives are not available — please reschedule manually._`,
      },
    },
  ];
}
```

### `choose_alt` action handler (CFL-03, D-15) — reuses Phase 4's approve function

```typescript
// lib/slack/bolt.ts — appended action registration (D-25)
import { approveProposal } from "./approve"; // Phase 4's function — imported, NOT reimplemented

app.action("choose_alt", async ({ ack, action, body, client }) => {
  await ack(); // first line, before any DB/network call

  const value = (action as { value?: string }).value ?? "";
  const [proposalId, indexStr] = value.split(":");
  const slotIndex = Number(indexStr) as 0 | 1;
  if (!proposalId || (slotIndex !== 0 && slotIndex !== 1)) return;

  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal || proposal.status !== "pending" || !proposal.alternatives) return;

  const alts = proposal.alternatives as ConflictAlternatives;
  const chosen = slotIndex === 0 ? alts.optionA : alts.optionB;

  await prisma.proposal.update({
    where: { id: proposalId },
    data: { start: new Date(chosen.startIso), end: new Date(chosen.endIso) },
  });

  await approveProposal(proposalId); // SAME function approve_proposal calls (D-15) — no second implementation
});
```

## State of the Art

No ecosystem-level "old vs. current approach" shifts are relevant to this phase specifically — the versions and API shapes are the same ones Phases 1/3/5 already locked and verified. The one genuinely new-to-this-session fact is the confirmation that OpenAI-node's Zod v4 incompatibility issues (`openai/openai-node#1540`, `#1602`) are both **closed**, filed against `openai@5.11.0`, well before this project's pinned `openai@7.15.0` — consistent with, not contradicting, STACK.md's existing claim that the fix landed at `5.23.2`+.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `freebusy.query` response `busy[].start`/`.end` are always UTC (`Z`) regardless of the request's `timeZone` field | Pitfall 3 | Low — mitigated regardless by the recommendation to always compare via `Date` objects, never raw strings; D-10's own "log and eyeball" step also independently catches this on the first real call |
| A2 | No phase has locked a default `durationMinutes` value for `extractIntents`, so the demo-beat duration is genuinely open, not just under-documented | Pitfall 1 | High if unaddressed — this is the one finding in this research that can silently break DMO-05's exit criterion; mitigated by the explicit recommendation to control it via seed-message wording, which needs no coordination with Phase 5's actual shipped value |
| A3 | Structured-output strict-mode array-length (`minItems`/`maxItems`/tuple `prefixItems`) enforcement is less reliable across Kilo-routed providers than required-object-property enforcement | §Standard Stack Alternatives, Pitfall 2 | Medium — if wrong (i.e., array length actually is reliably enforced), the named-fields schema is still strictly safe, just marginally more verbose than necessary; the cost of being wrong here is zero, only the cost of being right is foregone convenience |
| A4 | Phase 4's `lib/slack/approve.ts` approve sequence is *not yet* confirmed to be exported as a standalone callable function (Phase 4's own CONTEXT.md doesn't specify this level of detail) | §Architecture Patterns "Reusing Phase 4's approve function" | Medium — if Phase 4 already exports it as a function, Phase 7 saves the refactor step; if it's inlined in the listener, skipping the extraction step and copy-pasting the sequence instead would silently violate D-15, so the research explicitly calls out reading the real file first rather than assuming either way |

**If this table is empty:** N/A — see rows above; A2 is the one item the planner should treat as needing an explicit decision (not a "confirm in passing" item) before `07-02` is scripted.

## Open Questions

1. **What did Phase 5 actually ship as `extractIntents`'s default `durationMinutes` when a message states no duration?**
   - What we know: the field exists on `ExtractedIntent` (ARCHITECTURE.md interface table); no default value is locked in any CONTEXT.md.
   - What's unclear: whether it's 30, 45, or 60 minutes, or whether the model is asked to infer a "reasonable" duration per-message with no fixed floor.
   - Recommendation: irrelevant to the demo beat if the planner takes this research's Pitfall 1 recommendation (word B's seed message with an explicit duration) — the open question only matters for *unscripted* input (e.g. a live `/secretary scan` or an off-script mention during Q&A), where it's a fine README "known shortcut," not a phase blocker.

2. **Does Phase 4's approve logic already exist as an importable function, or only inline in the Bolt listener?**
   - What we know: D-04/D-06 fix the *sequence*, not the export shape.
   - What's unclear: the literal file contents, which won't exist until Phase 4 executes (this repo is planning-only at research time).
   - Recommendation: `07-01`'s merge step opens the real file and extracts a function if needed — a five-minute mechanical step, not a research gap requiring further investigation now.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No new auth surface; Slack Socket Mode / Google OAuth token handling unchanged from Phases 2–4 |
| V3 Session Management | No | No sessions created in this phase |
| V4 Access Control | Yes | The `choose_alt` handler must inherit the same organizer-authorization posture as `approve_proposal` — calling the shared `approveProposal(proposalId)` function (D-15) means the conditional-claim guard (APR-02, "only A can write to Calendar") is automatically inherited, not re-implemented. This is itself the correctness argument for reuse, not just a laziness one. |
| V5 Input Validation | Yes | `choose_alt`'s button `value` is untrusted Slack payload input — parsed defensively (`slotIndex !== 0 && slotIndex !== 1` guard shown in Code Examples) before any DB read; `MODEL_SMART`'s response is validated with Zod (`.safeParse`, CFL-02/D-13) before being persisted or rendered |
| V6 Cryptography | No | No new secrets or crypto surface introduced this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Malformed/adversarial `choose_alt` button value (a stale or hand-crafted `value` string from Slack retry or replay) | Tampering | Defensive parse + `proposal.status !== "pending"` guard before any write (shown in Code Examples) — re-derives from the DB row, never trusts the payload's own claims about proposal state |
| Model-hallucinated alternative slot presented as authoritative without re-validation | Tampering (of the demo's own correctness) | Code-side re-validation against the same overlap function before rendering (Pitfall 2) — the LLM output is treated as untrusted input to the scheduling domain, same posture as any external API response |
| Non-organizer (B) clicking "Choose Option A" and attempting a Calendar write | Elevation of Privilege | Inherited automatically from reusing `approveProposal` (V4 above) — B clicking still routes through Phase 4's conditional organizer claim, which already guards this |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md`, `.planning/phases/04-approval-bridge/04-CONTEXT.md`, `.planning/phases/05-agent-confidence-gate/05-CONTEXT.md` — schema field names (`Proposal.alternatives Json?`, status enums), approve-sequence decisions, extraction contract, all read directly this session
- `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/research/FEATURES.md`, `.planning/research/STACK.md` — graph structure, Block Kit conventions, `MODEL_SMART`/Kilo Gateway compatibility notes, all read directly this session
- `developers.google.com/workspace/calendar/api/v3/reference/freebusy/query` — request/response JSON shape, fetched this session `[CITED]`

### Secondary (MEDIUM confidence)
- `github.com/openai/openai-node` issues #1540, #1602 — both confirmed closed this session, filed against `openai@5.11.0`, consistent with STACK.md's existing "fixed at 5.23.2+" claim `[CITED, cross-checked]`
- `github.com/openai/openai-node/blob/master/helpers.md` (via WebSearch aggregation) — `zodResponseFormat`/`chat.completions.parse` usage shape `[CITED, WebSearch cross-check]`
- OpenRouter `require_parameters` provider-routing behavior (via WebSearch aggregation of `openrouter.ai/docs/guides/routing/provider-selection` and the Instructor library's OpenRouter integration guide) `[CITED, WebSearch cross-check]`
- Slack Block Kit button `value` 2000-character limit (via WebSearch aggregation, consistent across `node-slack-sdk` source and multiple independent technical writeups) `[CITED, WebSearch cross-check]`

### Tertiary (LOW confidence)
- Google's exact wording on response-time UTC-regardless-of-`timeZone` behavior was not found verbatim on the fetched reference page this session — inferred from a publicly cited example response (`"...Z"` suffix) and general, long-standing Google Calendar API behavior; flagged explicitly in Pitfall 3 as `[CITED, MEDIUM]`, not `[VERIFIED]`, with D-10's own "log and eyeball on the first real call" as the actual verification step

## Metadata

**Confidence breakdown:**
- Merge mechanics, file ownership, process/port map: HIGH — verbatim from locked upstream CONTEXT.md decisions
- Conflict detection query shape and overlap math: HIGH — half-open interval logic is unambiguous; the union query is a direct Prisma `findMany` with no novel API surface
- `MODEL_SMART` structured-output schema shape recommendation: MEDIUM — the named-fields-over-array reasoning is sound but not independently load-tested against the actual chosen `MODEL_SMART` model id this session (that verification belongs to the pre-window checklist item already covering structured-output smoke tests, extended to this new schema shape)
- Demo-beat duration risk: MEDIUM-HIGH confidence that the risk itself is real (the arithmetic is unambiguous); LOW confidence in predicting Phase 5's actual shipped default, hence the recommendation to control it via seed wording rather than trying to predict it

**Research date:** 2026-09-11
**Valid until:** This build window only (Sat 12 Sep 2026) — re-verify any reused claim if this document is consulted outside that window.
