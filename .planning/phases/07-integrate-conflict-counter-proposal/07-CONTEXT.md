# Phase 7: Integrate + Conflict Counter-Proposal - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning
**Source:** PRD Express Path (`.planning/ROADMAP.md`, Phase 7 section only) + CFL-01..05, DMO-05, OPT-01 in `.planning/REQUIREMENTS.md` + `.planning/PROJECT.md` constraints. No discuss-phase; every roadmap recommendation is adopted as a locked decision.

<domain>
## Phase Boundary

Serial integration phase on `main`, 13:50–14:45 HKT (55 min), branch `gsd/phase-7-integrate-conflict`. Sole phase in its slot. Depends on Phase 5 (Agent + Confidence Gate) and Phase 6 (Dashboard).

Delivers, in order:
1. Wave B merge (Phase 5 + Phase 6 branches → `develop` → `main`), real graph wired into Phase 4's Trigger.dev task in place of the stub, dashboard confirmed showing real extracted rows, full-path dry run, and the fixed LangGraph keep-or-rip checkpoint.
2. Conflict-aware counter-proposal (CFL-01..04): clash detection against A's busy blocks ∪ pending Proposals, one `MODEL_SMART` call returning exactly two reasoned alternative slots, rendered as buttons whose choice runs the existing approve path. Or, if not started by 14:15, the degraded static conflict warning (CFL-05) and stop.
3. Optional, only if ahead: `/secretary scan` (OPT-01).

Ends with the seeded dry run on `main` and `/ponytail-review` on the full merged diff (DMO-05).

Not in this phase: any dashboard UI (`app/**`, `components/**`), any Calendar client change (`lib/calendar/**` is read-only), stretch work (Phases 8/9), the reset script and rehearsals (Phase 10).

</domain>

<decisions>
## Implementation Decisions

### Plan structure and sequencing
- **D-01:** Three plans, as suggested by the roadmap:
  - `07-01`: Merge Wave B into `develop` → `main` + wire real graph into the task + full-path dry run + LangGraph keep-or-rip checkpoint.
  - `07-02`: Conflict counter-proposal (CFL-01..04), or degraded static warning (CFL-05) if past 14:15.
  - `07-03` (optional, only if ahead): `/secretary scan` (OPT-01).
- **D-02:** `07-01` merges Phase 5's and Phase 6's branches into `develop`, then `develop` into `main`, before any feature code.
- **D-03:** Before any `bunx prisma db push` after the merge, re-merge `develop` and diff `prisma/schema.prisma` against both Wave B branches, so drift from a missed branch is caught before pushing (roadmap time-eater #2).
- **D-04:** `bun.lock` is never hand-merged: resolve `package.json`, then regenerate the lockfile with `bun install` (File Ownership Matrix rule).

### Integration (07-01)
- **D-05:** The real graph (Phase 5's `runAgent`) replaces the stub body called from Phase 4's Trigger.dev task. The `AGENT_TRANSPORT=trigger|inline` switch from Phase 4 must keep working in both modes after the wiring.
- **D-06:** Confirm the dashboard (Phase 6, `:3000` on `main`) shows real extracted `Proposal`/`Decision` rows end to end. This phase adds no dashboard UI; it only confirms.
- **D-07:** **LangGraph keep-or-rip is fixed, not optional:** at ~14:00, if the graph is still fighting the time budget, rip it out and call the same node functions in sequence (~10 min). This is the decision point AGT-10 names.
- **D-08:** Confidence-gate integration is never cut. It is what the demo leans on if the conflict work degrades.

### Conflict detection (CFL-01)
- **D-09:** A clash is the intent's slot overlapping A's calendar busy blocks (via Phase 3's `freebusy.query` client, called read-only) **unioned with pending Proposals in the DB**.
- **D-10:** Log the actual `timeMin`/`timeMax` sent on the conflict check and eyeball that they carry `+08:00` offsets matching the intended HKT window (success criterion 3; roadmap time-eater #1).

### Counter-proposal (CFL-02)
- **D-11:** On a clash, make **exactly one `MODEL_SMART` call**, through `lib/ai/provider.ts` (AGT-01, single source of truth), that receives the busy blocks plus known preferences and returns **exactly two** alternative slots, each with a one-line human reason.
- **D-12:** Zero `Preference` rows is a valid input and must work; the call never depends on S1.
- **D-13:** The model output is Zod-validated (project rule: one schema per LLM output, Zod at every external boundary).

### Conflict card and selection (CFL-03)
- **D-14:** The card renders both alternatives with their reasons as buttons. Each button's `value` = proposal id + slot index.
- **D-15:** Choosing an alternative runs the **same approve path** (Phase 4's handler: organizer claim, calendar write, `chat.update`) against the chosen slot. No second approve implementation.
- **D-16:** Choosing an alternative produces a real calendar event for the chosen slot (success criterion 2).

### Demo beat (CFL-04)
- **D-17:** The seeded sequence is: Friday 11:00 ask → approve (event exists) → B's ask for 10:30 the same day → conflict card with two reasoned alternatives. B makes the second ask (only two Slack users; no user C).

### Degraded form and cut line (CFL-05)
- **D-18:** **Hard cut line 14:15.** If `07-02` has not started by 14:15, implement only the static conflict warning: the card names the clashing block. Then stop.
- **D-19:** Cut order if overrunning: (1) drop `/secretary scan` unconditionally first; (2) past 14:15 without CFL started, degrade to CFL-05; (3) never cut the confidence-gate integration.

### Optional scan (OPT-01)
- **D-20:** `/secretary scan` runs `extractIntents` over the last ~50 messages of the current channel and produces proposals/decisions. Built only after CFL is demo-ready. It appends to `lib/slack/bolt.ts`, never restructures it.

### Exit and review (DMO-05)
- **D-21:** Exit criterion, and the dry run gating Phases 8/9: on `main`, seed the Friday 11:00 ask → approve → seed B's 10:30 ask → card shows two reasoned alternatives (or the static warning if degraded) → picking an alternative completes the approve path. The sequence must never produce nothing (success criterion 1).
- **D-22:** `/ponytail-review` runs on the full merged diff before the phase is marked done. This satisfies DMO-05 for the whole build.

### File ownership
- **D-23:** Owns:
  - `lib/agent/**`: conflict node or plain-function equivalent.
  - `lib/ai/**`: the `MODEL_SMART` conflict call.
  - `lib/slack/**`: conflict card rendering + optional scan listener.
  - `lib/calendar/**`: read-only calls, no edits.
- **D-24:** Must not touch `app/**` or `components/**`; the conflict card lives in Slack.
- **D-25:** `lib/slack/bolt.ts` and card block builders are a named overlap. This phase's conflict plan owns them, adding a conflict variant beside Phase 2's approve/reject builder and Phase 5's edit variant. The scan plan appends only.

### Processes
- **D-26:** Runs Next.js dev `:3000`, Bolt (the sole instance anywhere), Trigger.dev dev CLI and Postgres `:5432`. That's the same set as Phase 4, now carrying real traffic. Kill any other worktree's Bolt first.

### Claude's Discretion
- Where clash detection and the counter-proposal call sit: inside the graph's `checkConflicts`/`propose` nodes, or as plain functions called after extraction (if D-07 rips the graph). Either satisfies CFL-01/02.
- The search window and candidate-slot constraints fed to `MODEL_SMART`, e.g. same day, working hours in HKT, same duration, no overlap with any busy block.
- Whether model-returned slots are re-checked in code against the busy set before rendering, and what happens if a returned slot still clashes (retry once, or fall back to the CFL-05 warning).
- Zod schema shape for the two alternatives (e.g. `{ startIso, endIso, reason }` × 2), and whether structured output or JSON mode + manual parse is used, per the model's capability.
- How the chosen slot reaches the approve path: update the Proposal's `start`/`end` from stored alternatives before calling the shared approve logic, or pass the slot in.
- Where alternatives are stored between card render and click (the Proposal row vs. the button value), and the button `action_id`, consistent with existing conventions.
- How the pending-Proposal union is queried (status, organizer, time-range filter), and whether the clashing Proposal's own row is excluded.
- Whether a conflict card still offers the original Approve/Reject beside the alternatives.
- Degraded-warning copy and layout.
- Scan implementation details: `conversations.history` paging, bot/subtype filtering, and batching into one `extractIntents` call vs. per-message.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` §"Phase 7: Integrate + Conflict Counter-Proposal": deliverables, exit criterion, cut order, time-eaters, success criteria, suggested plans. Also §"File Ownership Matrix", §"Flags Resolved" (User C → B), §"Cut-Line Table" (14:15), §"Process & Port Map".
- `.planning/REQUIREMENTS.md`: CFL-01..05, DMO-05, OPT-01. Also read AGT-01 (provider single source), AGT-02 (`extractIntents` signature), AGT-10 (keep-or-rip), APR-01..04 (the approve path CFL-03 reuses), CAL-01 (`+08:00` freebusy).
- `.planning/PROJECT.md`: "Agent design" (conflict detection = `freebusy.query` ∪ pending Proposals; re-derive don't resume), "Tech stack" (model tiering, Zod), "Repo rules", Constraints (cut line, `Asia/Hong_Kong`, two demo users, only A has Google consent).

### Upstream phase artifacts (read what exists at planning time)
- `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md`: schema columns this phase consumes (`Proposal.alternatives Json?`, `card_channel`/`card_ts`), `<verb>_proposal` action-id and `value` = proposal id conventions, `utils/time.ts` HKT formatter, and seed slot avoidance of Fri 18 Sep 11:00/10:30 (D-14 there).
- `.planning/phases/01-foundation-hardcoded-round-trip/01-RESEARCH.md`: stack and API detail verified for the scaffold.
- Phase 3, 4, 5 and 6 CONTEXT/RESEARCH/SUMMARY files, where they exist under `.planning/phases/`: the calendar client signature (`checkConflicts`/freebusy), the approve handler, the graph/`runAgent`, and the dashboard queries this phase integrates.

### Research
- `.planning/research/ARCHITECTURE.md`: graph node layout (`checkConflicts`, `propose`), `ConflictSlot` type, `buildConflictBlocks(p, alts)` signature suggestion, approve re-derive flow.
- `.planning/research/FEATURES.md`: conflict counter-proposal pattern (feed freebusy + Preference rows, exactly two `{start, end, reason}`); conflict call gated to high-confidence intents.
- `.planning/research/PITFALLS.md`: `freebusy.query` timezone mishandling; Kilo Gateway structured-output support per model (Pitfall on `json_schema`); dedupe/calendar pollution (Pitfall 4) affecting the conflict slot; `bun.lock` merge rule (Pitfall 15).
- `.planning/research/STACK.md`: `openai` + Zod v4 structured output via Kilo Gateway, `require_parameters`, JSON-mode fallback.
- `gsd-prompt-ai-secretary.md` (repo root): §"AI features" item 2 (conflict-aware counter-proposal), §agent design (conflict detection), §ponytail (`/ponytail-review` at merge windows). Its "user C" is superseded by B.

</canonical_refs>

<specifics>
## Specific Ideas

- Demo slots: Fri 18 Sep 2026 11:00 HKT (first ask, approved → event exists) and 10:30 HKT the same day (B's conflicting ask). Both are relative to the build date (Sat 12 Sep 2026), so "next Friday" = 18 Sep.
- The 10:30 ask clashes with the 11:00 event only if the requested duration runs past 11:00 (e.g. 30+ min from 10:30 reaches 11:00, so overlap needs >30 min, or an end-inclusive check). The planner/researcher must pin the overlap rule and the default duration so the demo beat actually fires.
- The logged `timeMin`/`timeMax` must show `+08:00` (success criterion 3).
- Timeline anchors: 13:50 start, ~14:00 keep-or-rip, 14:15 CFL hard cut, 14:40 stretch merge deadline, 14:45 phase end.

</specifics>

<deferred>
## Deferred Ideas

- Expiry re-trigger (SCL-03): v2, not built.
- Preference learning / Graphiti (S1, Phase 9): the conflict call reads `Preference` rows only if they exist; nothing writes them here.
- Any dashboard rendering of alternatives: out of scope (`app/**`, `components/**` untouched).
- Reset script and calendar cleanup between runs: Phase 10.
- `/secretary scan` is itself optional (OPT-01) and first to be cut.

</deferred>

---

*Phase: 07-integrate-conflict-counter-proposal*
*Context gathered: 2026-09-11 via PRD Express Path*
