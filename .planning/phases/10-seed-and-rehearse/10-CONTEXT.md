# Phase 10: Seed-and-Rehearse - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning
**Source:** PRD Express Path (.planning/ROADMAP.md, Phase 10 section only)

<domain>
## Phase Boundary

The full demo path runs cleanly three times from a reset baseline, with no rehearsal pollution.

Delivers:
- `prisma/reset-demo.ts`: clears demo DB rows and deletes tagged calendar events, so a repeated seeded message produces a fresh card (DMO-01).
- The demo conversation seeded by hand in the watched channel, with the full flow run three times on `main` (DMO-02).
- `/impeccable audit` on the running dashboard before freeze, completing DSH-07. Critique and polish were already applied inline in Phase 6; this is the final deterministic-rule pass.

Time box 14:45–15:10 HKT (25 min). Depends on Phase 7. Runs alongside nothing: stretch work was abandoned by 14:40, and rehearsal runs only what is on `main`. Not in scope: recording the run and the final README (Phase 11), and any feature, schema, or UI change.

</domain>

<decisions>
## Implementation Decisions

### Branching and file ownership
- **D-01:** Commits go directly to `main`, with no new branch. A merge is impossible by construction.
- **D-02:** The only file this phase creates or edits is `prisma/reset-demo.ts` (new). Everything else is off limits: no schema changes, no feature edits, no new branches. The script reuses existing modules (the shared Prisma client, the config module, the calendar client) rather than adding helpers elsewhere.
- **D-03:** Plan split follows the roadmap suggestion. 10-01: `prisma/reset-demo.ts` (DB truncation plus tagged calendar-event cleanup). 10-02: seed the conversation, rehearse 3×, run the impeccable audit.

### Reset script (DMO-01)
- **D-04:** The script clears demo DB rows and deletes the Calendar events tagged by CAL-05 (`extendedProperties.private.demo`) on A's calendar.
- **D-05:** It is idempotent. Running it twice in a row leaves zero demo rows and zero tagged calendar events (success criterion 1).
- **D-06:** Early detection is the first check once the script exists: run the seeded message twice back to back and confirm the second run produces a new card, not silence and not a Prisma unique-constraint error.
- **D-07:** The reset script is never skipped, even when the phase overruns.

### Rehearsal (DMO-02)
- **D-08:** The demo conversation is seeded **by hand** in the watched channel. It is not replayed by a script.
- **D-09:** The flow per run: ignored chatter → Friday 11:00 proposal → approve → B's 10:30 ask → conflict alternatives. It runs three times on `main`.
- **D-10:** Every run produces a fresh card and a fresh calendar event. A silent no-op is never acceptable (success criterion 2).
- **D-11:** Check A's calendar for the target day right before each rehearsal.
- **D-12:** After the final run, A's calendar for the target day shows exactly what that run created and nothing extra (success criterion 3). After the final reset, A's calendar shows no leftover rehearsal events near the demo's target slot (exit criterion).
- **D-13:** Cut order if overrunning: drop from three runs to two only if genuinely squeezed. Never go to zero runs, and never skip the reset script.

### Impeccable audit (DSH-07)
- **D-14:** `/impeccable audit` runs on the live, running dashboard (deterministic local rules, no API key), and its output is reviewed (success criterion 4). This is the only impeccable command in this phase.
- **D-15:** Audit findings are reviewed and recorded, not fixed. This follows from D-02: no feature or UI edits in this phase.

### Processes and verification
- **D-16:** Processes and ports are identical to Phase 7: Next.js dev :3000, Bolt (the sole instance anywhere), Trigger.dev dev CLI, Postgres :5432.
- **D-17:** Exit criterion (binary, checked by hand): the reset script plus the seeded conversation run three times back to back. Each run produces a fresh card and a fresh calendar event, never a silent no-op. A's calendar shows no leftover rehearsal events near the demo's target slot after the final reset. No tests of any kind.

### Claude's Discretion
- Which tables count as "demo rows", and the deletion mechanism and order (FK-safe). Identity and seeded-credential rows that the demo needs to keep working must survive.
- The `sendUpdates` choice on event deletion, and handling already-deleted events so that D-05 holds.
- Whether to also remove stale bot cards from earlier rehearsals in the channel. This is cosmetic and cut first.
- Exact wording of the seeded chatter, the 11:00 ask, and B's 10:30 ask, provided the flow in D-09 fires deterministically.
- The run command for the script, and how it reports what it deleted, so D-05 is checkable at a glance.
- Where the audit output and review notes are recorded inside the phase directory.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` §"Phase 10: Seed-and-Rehearse": goal, deliverables, files owned and forbidden, exit criterion, cut order, most likely time-eater, success criteria, suggested plans.
- `.planning/ROADMAP.md` §"Cut-Line Table" (Phase 10 row), §"Process & Port Map" (Phase 10 row), §"File Ownership Matrix" (`prisma/reset-demo.ts`).
- `.planning/REQUIREMENTS.md`: DMO-01, DMO-02, DSH-07. Context: CAL-04 (deterministic event id + 409 fallback), CAL-05 (demo tag), AGT-09 (`dedupe_key`), FND-08 (schema, shared Prisma singleton), FND-10 (seeded A↔token mapping).

### Project constraints
- `.planning/PROJECT.md`: §"Constraints" (timeline, binary exit criteria, two demo users, only A has Google consent, `Asia/Hong_Kong`), §"Agent design" (one Proposal per intent via `dedupe_key`, calendar idempotency, conflict detection = freebusy ∪ pending Proposals), §"Data model", §"Repo rules" (TSDoc on every function, Biome only, no tests, single config module, one Prisma client per process), §"Tech stack" (bun run commands), §"Code-quality plugins" (impeccable `audit` on the running app before freeze).
- `gsd-prompt-ai-secretary.md` (repo root): the authoritative source doc, covering seed-and-rehearse and impeccable usage.

### Research
- `.planning/research/PITFALLS.md` Pitfall 4: dedupe and calendar pollution make the second rehearsal a silent no-op. It includes the reset-script shape (`events.list` with `privateExtendedProperty=demo=true`, then `events.delete`).
- `.planning/research/SUMMARY.md`: rationale for seed-and-rehearse as its own phase.

### Upstream phase contexts (consumed, not re-decided here)
- `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md`: `lib/db.ts` singleton, `prisma/seed.ts` (identity rows, fixture Proposal at Thu 17 Sep 15:00), demo slots avoided by the seed.
- `.planning/phases/03-calendar-client/03-CONTEXT.md`: the tag value `"true"` (string), event id derived from proposal id, `sendUpdates: "all"` on insert.
- `.planning/phases/05-agent-confidence-gate/05-CONTEXT.md`: canonical demo message, "next Friday" = Fri 18 Sep 2026 when run on Sat 12 Sep 2026, and an ignored Decision for chatter.
- `.planning/phases/07-integrate-conflict-counter-proposal/07-CONTEXT.md`: demo beat sequence (D-17) and the 10:30-vs-11:00 overlap/duration note.

</canonical_refs>

<specifics>
## Specific Ideas

- The canonical demo message is B posting "Let's have a talk next Friday at 11am." (PROJECT.md).
- Demo slots: Fri 18 Sep 2026 11:00 HKT (first ask, approved, so an event exists) and 10:30 HKT the same day (B's conflicting ask). This is the target day to check on A's calendar.
- The most likely time-eater: a deterministic `dedupe_key` plus idempotent calendar writes turn the second rehearsal into a silent no-op, and leftover events pollute the exact slot the conflict demo depends on.
- Impeccable `audit` uses deterministic local detector rules and needs no API key, so it stays fast under time pressure.

</specifics>

<deferred>
## Deferred Ideas

- Screen-recording a clean run: Phase 11 (DMO-03).
- Final README, including `/ponytail-debt` known shortcuts: Phase 11 (DMO-04).
- Fixing impeccable audit findings: out of scope here (no feature/UI edits). Findings may feed Phase 11's README known-shortcuts section.

</deferred>

---

*Phase: 10-seed-and-rehearse*
*Context gathered: 2026-09-11 via PRD Express Path*
