# Phase 11: Freeze-and-Record - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning
**Source:** PRD Express Path (.planning/ROADMAP.md, Phase 11 section only) + REQUIREMENTS.md DMO-03/DMO-04 + PROJECT.md constraints

<domain>
## Phase Boundary

Final phase, serial on `main`, 15:10–15:30 HKT (20 min), immediately before judging. Delivers exactly two things:

1. **One clean run of the full demo path, screen-recorded** as the venue-wifi fallback (DMO-03).
2. **The final `README.md`**, with every required section filled with real content (DMO-04).

No new code. The only repo file this phase changes is `README.md`. Depends on Phase 10 (reset script exists, flow rehearsed 3x on `main`). Nothing runs alongside it; any stretch work still running must already be stopped or abandoned under its own criteria.

Requirements: DMO-03, DMO-04. Nothing else.

</domain>

<decisions>
## Implementation Decisions

### Scope and ownership
- **D-01:** Files owned: `README.md` only. Every other file is off-limits, and explicitly **no new code**. Consequence: the recording file is **not committed to the repo** (it isn't `README.md`); it lives outside the working tree.
- **D-02:** Commits go **directly to `main`**. No new branch, no merge.
- **D-03:** Two plans, per the roadmap's suggestion: **11-01** screen-records one clean run; **11-02** finalizes the README (competitive section, batch-first, OAuth, `interrupt()` note, ponytail-debt, abandoned stretch).
- **D-04:** Impeccable: none. Ponytail: `/ponytail-debt` only (no `/ponytail-audit`, no `/ponytail-review` in this phase).

### Recording (DMO-03)
- **D-05:** Record **one clean run** of the whole demo path on `main`: the flow Phase 10 rehearsed (ignored chatter → Friday 11:00 proposal → approve → B's 10:30 ask → conflict alternatives, or the CFL-05 static warning if Phase 7 degraded).
- **D-06:** Acceptance: played back once, the video shows the entire demo path start to finish with **no dead air longer than a few seconds**, and **no narration filling a gap**.
- **D-07:** Before recording, run the early-detection checks: `ping -c 3 8.8.8.8` (from WSL) and **one live Trigger.dev sanity call**. If wifi is visibly flaky, treat that as the signal this recording matters more than usual. The recording is the mitigation, not a code fix.
- **D-08:** Processes and ports are the **same as Phase 10**: Next.js dev :3000, Bolt (sole instance), Trigger.dev dev CLI, Postgres :5432. Keep them alive only long enough to record, and shut them down once the recording is confirmed good (confirmed = played back).

### README (DMO-04)
- **D-09:** The README covers **every required section**, each with actual content and no placeholder or TODO left anywhere. That includes the FND-02 headings Phase 1 skeletoned: what it is, core functionality, how it differs, problems tackled, architecture, usage, scope/non-goals, production design notes.
- **D-10:** Competitive comparison names: **Slackbot, Reclaim/Motion, Clockwise, Slack calendar apps, Fireflies/Otter/Spinach, n8n/Zapier, Relay.app.**
  - **Clockwise** is cited as **shut down (27 Mar 2026)**, never as a live competitor.
  - **Relay.app** is cited as **winding down, with paid access lapsing 14 Sep 2026**, never as a live competitor.
  - The human-in-the-loop comparison **leads with n8n/Zapier** (PROJECT.md Key Decision).
- **D-11:** Batch-first detection is documented as the production design with the **~20x cost reasoning** (~30-token message vs ~700-token system prompt, amortized by batching a window). It must also explain **why regex/keyword pre-filtering fails** as the primary filter: "same time as last week", "after standup", typos, abbreviations and Cantonese-English code-switching, with silent and untunable misses.
- **D-12:** **Multi-workspace via OAuth** is documented: the schema is already multi-tenant (`Installation` by `team_id`, `@@unique([team_id, slack_user_id])`), and OAuth distribution itself wasn't built.
- **D-13:** Exactly **one line** notes where `interrupt()` *would* fit: a seconds-long pause that continues reasoning. It is not an approval gate that spans unbounded human time.
- **D-14:** **`/ponytail-debt` output is pasted verbatim** into a "known shortcuts" section.
- **D-15:** The README states the **abandoned stretch work and why**.

### Time pressure
- **D-16:** Cut nothing. If time is nearly gone, the **recording takes priority over README polish**, but both must exist in at least draft form by 15:30.

### Claude's Discretion
- Which screen recorder to use, and the recording's resolution, format and location outside the repo.
- Whether to run Phase 10's `prisma/reset-demo.ts` before recording (running an existing script isn't new code).
- README section order, headings wording beyond the required set, and prose.
- Whether the README references the recording (e.g. a note that a demo video exists) without committing the file.
- How the verbatim ponytail-debt block is formatted (e.g. fenced so Markdown doesn't reflow it).
- Whether 11-01 and 11-02 run in parallel (the recording is hands-on for the human; README drafting is agent work).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` §"Phase 11: Freeze-and-Record": deliverables, files owned, exit criterion, cut order, time-eater, success criteria. Also §"Process & Port Map" row 11 and §"Cut-Line Table" row 11.
- `.planning/REQUIREMENTS.md`: DMO-03, DMO-04. Also DMO-02 for the exact demo flow being recorded, and the Out of Scope table (feeds the README scope/non-goals section).
- `.planning/PROJECT.md`: Key Decisions (README competitive section row; `interrupt()` row; batch-first row; multi-tenant row); "Agent design" (batch-first reasoning text); "Out of Scope"; "Runtime processes"; "Data model"; Constraints.

### README content sources
- `gsd-prompt-ai-secretary.md` (repo root): §"Phase 1, first task: `CLAUDE.md` and `README.md`" gives the required README sections and the original "how it differs" paragraph, **which must be corrected for Clockwise/Relay.app**. §"Approval gate: re-derive, do not resume" covers the `interrupt()` one-liner. §"Code conventions" covers batch-first detection and `/ponytail-debt` → known shortcuts.
- `.planning/research/FEATURES.md` §"Competitive Landscape: Verification Update": per-competitor Sep 2026 status and wording guidance.
- `.planning/research/SUMMARY.md`: the date-reconciled Relay.app correction (paid access ends 14 Sep 2026, two days *after* the 12 Sep demo). It supersedes FEATURES.md's "the day before" wording.
- `.planning/research/PITFALLS.md` Pitfall 3: Trigger.dev needs internet; the recording is the mitigation.

### Prior phase artifacts (read at execution time, not decided here)
- Phase 1's `README.md` skeleton (FND-02 headings).
- Phase 10's `prisma/reset-demo.ts` and rehearsal outcome.
- Phases 8/9 abandon outcomes (what stretch work was abandoned, and why).

</canonical_refs>

<specifics>
## Specific Ideas

- Demo slots: Fri 18 Sep 2026 11:00 HKT (first ask) and 10:30 HKT (B's conflicting ask).
- Exit criterion (hand-checkable): the video plays back showing the full path with no narration filling a gap, and the README has every required section filled and cites Clockwise/Relay.app correctly as defunct/winding down.
- The ROADMAP's honest arithmetic makes S1 and S2 README-only in the realistic case, so the "abandoned stretch" section most likely documents both as designed-not-built.

</specifics>

<deferred>
## Deferred Ideas

None. The PRD covers the phase scope. v2 items (SCL-01..03, DST-01/02, STR-06..08) may be *described* in the README as roadmap, but none are built.

</deferred>

---

*Phase: 11-freeze-and-record*
*Context gathered: 2026-09-11 via PRD Express Path*
