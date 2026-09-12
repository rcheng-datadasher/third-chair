# Phase 10: Seed-and-Rehearse - Research

**Researched:** 2026-09-11
**Domain:** Idempotent demo-data reset (Prisma 7 + Google Calendar tagged-event cleanup), hand-run rehearsal sequencing, `/impeccable audit` (deterministic local design-QA pass)
**Confidence:** HIGH for Google Calendar API mechanics, Slack `chat.delete` scope, and Trigger.dev idempotency semantics (all confirmed against official docs this session). MEDIUM for exact Prisma schema field names and the `lib/calendar`/`lib/db.ts` export surface, since the repo is not yet scaffolded — these are carried forward from upstream phase **decisions**, not read from source, and must be grep-verified once code exists (flagged throughout).

## Summary

Phase 10 is a single-file, no-new-dependency phase: `prisma/reset-demo.ts` is the only file created or edited (D-02), and it must reuse the shared Prisma client, config module, and calendar client rather than adding any second helper. The core technical finding: **the dedupe-key collision Pitfall 4 warns about does not actually occur for hand-retyped rehearsals.** `dedupe_key` is keyed on the real Slack message `ts`, and every hand-typed Slack message gets a brand-new `ts` — so a unique-constraint violation is structurally impossible unless a *script* replays a stored `ts` (which D-08 explicitly forbids). The real pollution risk is DB **row accumulation** (old pending/confirmed Proposals from earlier runs skewing CFL-01's pending-Proposal union) and Calendar **event accumulation** (extra tagged events skewing `freebusy.query` and cluttering A's calendar for the 10:30-vs-11:00 conflict beat) — both fixed by the reset script wiping every demo-scoped DB row and every `demo`-tagged Calendar event before each run, independent of any `ts`/`dedupe_key` logic.

The reset script's calendar half should **not** read `calendar_event_id` off the DB (order-independent, and the DB may already be gone) — it should look events up directly by the `extendedProperties.private.demo=true` tag via `events.list`, exactly as Pitfall 4 prescribes, then `events.delete` each id. Because Calendar event ids are deterministically derived from the Proposal's `cuid` (CAL-04), and every rehearsal creates a **fresh** Proposal row (fresh `ts` → fresh `dedupe_key` → fresh `cuid`), the "can a deleted event's id be re-inserted" risk flagged forward from Phase 4's research (A3) never actually triggers in practice: no rehearsal ever reuses a prior run's Proposal id, so no rehearsal ever reuses a prior run's Calendar event id.

**Primary recommendation:** Write `reset-demo.ts` as one Prisma `$transaction` (delete `ActionItem`/`Participant`/`Decision` then `Proposal`, scoped by `team_id`, never touching `User`/`Installation`/`Preference`) followed by a `events.list({ privateExtendedProperty: "demo=true" })` → `events.delete` loop (paginated, `sendUpdates: "none"`, errors on already-gone events swallowed as success), then `prisma.$disconnect()`. Run it directly as `bun prisma/reset-demo.ts` (no new `package.json` script — that would be a second file edit, forbidden by D-02). Sequence the 25-minute window as: one reset-twice idempotency smoke test, then three full cycles of **reset → calendar-empty check → seed 4 messages → verify → verify calendar has exactly this run's events**, then one **final bare reset with no run after it** so Phase 11 inherits a clean slate — this resolves what otherwise reads as a contradiction between D-12's two clauses (see Architecture Patterns).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
See `.planning/phases/10-seed-and-rehearse/10-CONTEXT.md` §Implementation Decisions D-01 through D-27 (Branching/file ownership D-01..D-03; Reset script D-04..D-07; Rehearsal D-08..D-13; Impeccable audit D-14..D-15; Processes/verification D-16..D-17) — copied there verbatim, not reproduced here to avoid drift. The load-bearing ones this research turns into concrete mechanics:
- D-02: only `prisma/reset-demo.ts` is created/edited; it reuses the shared Prisma client, config module, and calendar client — no new helper files anywhere.
- D-04/D-05: the script clears demo DB rows **and** deletes `extendedProperties.private.demo`-tagged Calendar events; running it twice leaves zero of both.
- D-08/D-09: the demo conversation is seeded **by hand**, never by script; flow is ignored chatter → Friday 11:00 ask → approve → B's 10:30 ask → conflict alternatives, run 3× on `main`.
- D-13: cut order is 3 runs → 2 if squeezed, never 0, never skip the reset script.
- D-14/D-15: `/impeccable audit` runs on the live running dashboard; findings are reviewed and recorded, not fixed.

### Claude's Discretion
- Which tables count as "demo rows" and the FK-safe deletion order/mechanism; identity/seeded-credential rows must survive.
- The `sendUpdates` choice on event deletion, and handling of already-deleted events.
- Whether to also delete stale bot cards from earlier rehearsals (cosmetic, cut first).
- Exact wording of seeded chatter / 11:00 ask / 10:30 ask, provided the D-09 flow fires deterministically.
- The run command for the script and how it reports what it deleted.
- Where audit output and review notes are recorded inside the phase directory.

### Deferred Ideas (OUT OF SCOPE)
- Screen-recording a clean run and the final README: Phase 11 (DMO-03/DMO-04).
- Fixing impeccable audit findings: out of scope here (no feature/UI edits); may feed Phase 11's README known-shortcuts section.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| DMO-01 | `prisma/reset-demo.ts` clears demo DB rows and deletes tagged Calendar events; repeated seeded message produces a fresh card | §Architecture Patterns "Reset script shape", §Code Examples, §Common Pitfalls 1–3 |
| DMO-02 | Demo conversation seeded by hand in the watched channel; full flow runs 3× on `main` | §Architecture Patterns "Rehearsal sequencing", §Code Examples "Seed messages", §Common Pitfalls 4–5 |
| DSH-07 | `/impeccable audit` runs on the live dashboard; output reviewed (final deterministic-rule pass) | §Architecture Patterns "Impeccable audit mechanics" |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Demo DB row cleanup | Database / Storage | — | `prisma/reset-demo.ts` is a CLI script against Postgres via the existing `lib/db.ts` singleton; no server tier involved |
| Tagged Calendar-event cleanup | External Service (Google Calendar API) | Database / Storage (reads nothing from DB — tag-based lookup) | Reset script calls `googleapis` directly via the reused OAuth client; Calendar, not Postgres, is the source of truth for "which events exist" |
| Rehearsal execution | Browser/Client (Slack UI, hand-typed) + Backend (existing Bolt/Trigger.dev/Calendar/Approve pipeline, unchanged) | — | Phase 10 adds no new backend code path; it exercises Phases 2–7's pipeline as a black box |
| `/impeccable audit` | Frontend Server (Next.js dev, running) | — | Deterministic local static analysis against the running `app/`/`components/` tree; no API key, no network dependency beyond what's already running |

This map has no misassignment risk: Phase 10 deliberately adds zero new capabilities to any tier — it only cleans state and drives the existing pipeline by hand.

## Standard Stack

No new dependencies. Phase 10 reuses, at exact versions already pinned in Phase 1:

| Library | Version | Purpose | Why reused, not added |
|---------|---------|---------|------------------------|
| `@prisma/client` (generated, `prisma-client` provider) | 7.10.0 `[CITED: 01-CONTEXT.md D-12, 01-RESEARCH.md Code Examples "lib/db.ts"]` | The `prisma` singleton export from `lib/db.ts` | D-02 forbids a second Prisma client; import the existing `export const prisma` |
| `googleapis` | 180.0.0 `[CITED: STACK.md]` | `calendar.events.list` / `calendar.events.delete` | D-02 forbids a second OAuth/calendar helper file; reuse whatever `lib/calendar/**` already exports for constructing the authenticated client (see Open Questions — exact export name not yet verifiable, repo unscaffolded) |
| `zod` (indirect, via `lib/config.ts`) | 4.6.2 `[CITED: STACK.md]` | Reading `team_id`/Google credentials through the one typed config reader | `lib/config.ts` is the only `process.env` reader project-wide (repo rule); the reset script must not read `process.env` directly |

**Installation:** none — `bun install` was already run in Phase 1; no `bun add` in this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero new packages (D-02). No `npm view`/registry check is required.

## Architecture Patterns

### Reset script data flow

```
bun prisma/reset-demo.ts
        │
        ├─► lib/config.ts            (team_id, Google creds — no direct process.env read)
        │
        ├─► lib/calendar/**          (reused OAuth2 client factory — no new client built)
        │         │
        │         ▼
        │   calendar.events.list({ calendarId: "primary",
        │       privateExtendedProperty: "demo=true", showDeleted: false })
        │         │  (paginate via pageToken until absent)
        │         ▼
        │   for each event → calendar.events.delete({ eventId, sendUpdates: "none" })
        │         │  (404/410 on an already-gone event → caught, treated as success)
        │         ▼
        │   report: N Calendar events deleted
        │
        └─► lib/db.ts → prisma       (shared singleton, NOT a new client)
                  │
                  ▼
            prisma.$transaction([
              prisma.actionItem.deleteMany({ where: { proposal: { team_id } } }),
              prisma.participant.deleteMany({ where: { proposal: { team_id } } }),
              prisma.decision.deleteMany({ where: { team_id } }),
              prisma.proposal.deleteMany({ where: { team_id } }),
            ])
                  │
                  ▼
            report: N Proposal / N Decision rows deleted
                  │
                  ▼
            prisma.$disconnect()   ← required so the bun process exits cleanly
```

**FK-safe order rationale:** `ActionItem` and `Participant` both hold a required `proposal_id` FK `[CITED: PROJECT.md:153-156 Data model sketch, 01-CONTEXT.md D-09]`; `Decision.proposal_id` is optional (nullable) per Phase 1's schema addition `[CITED: 01-CONTEXT.md D-09: "Decision adds source_channel, message_text and proposal_id?"]`. Deleting children before the parent `Proposal` row is correct regardless of whether the (not-yet-written) schema declares `onDelete: Cascade` — it never depends on cascade behavior being present.

**What survives, and why:** `User` (A's `google_refresh_token`, B's row), `Installation` (`team_id` mapping), and `Preference` (empty in the core demo path — only S1/Phase 9 writes it, and that phase is realistically README-only) are never touched. These are FND-10's hand-seeded identity rows; losing them mid-window means re-doing manual Google OAuth setup, which is explicitly out of scope for any build-window phase.

**Wiping the Phase 1 seed fixture is correct, not a bug.** Phase 1 seeded one pending Proposal at Thu 17 Sep 2026 15:00 HKT plus one `acted`/one `ignored` Decision for Phase 6's own exit criterion `[CITED: 01-CONTEXT.md D-13/D-14]`. `reset-demo.ts`'s `team_id`-scoped `deleteMany` removes these too — that is desired: by Phase 10, the dashboard should show only rehearsal-fresh data, not a stale fixture from scaffold time. **Do not re-run `prisma/seed.ts` after `reset-demo.ts`** — reseeding would put that same Thu-17-Sep fixture Proposal back on the dashboard for judges to see, which is exactly what the orchestrator's question 5 flagged as undesirable. `reset-demo.ts` only clears; it never reseeds.

### Rehearsal sequencing (resolves an apparent D-12 tension)

D-12 has two clauses that read as contradictory in isolation: "after the final run, A's calendar shows exactly what that run created" vs. "after the final reset, A's calendar shows no leftover rehearsal events." They resolve into one sequence with **4 resets total for 3 runs** — a reset before every run, plus one bare reset at the very end with no run after it:

```
1. Smoke tests BEFORE any rehearsal (not one of the 3 runs):
   a. Success criterion 1: run reset-demo.ts twice back-to-back. The second run
      must report 0 deleted for every table and 0 tagged events, with no Prisma
      or Calendar API error.
   b. D-06 (orchestrator correction — D-06 is about the *seeded message*, not the
      script): post the 11:00 ask, wait for its card, post the identical text again.
      The second post must produce a NEW card (fresh ts → fresh dedupe_key), never
      silence and never a P2002 log line. Note: because pending Proposals are unioned
      into conflict detection, the second card may legitimately be a conflict card
      against the first pending proposal — that still counts as "a new card".
   c. Reset once more so run 1 starts clean (this is run 1's step 2a).

2. For run in [1, 2, 3]:
     a. bun prisma/reset-demo.ts           — D-07, never skipped
     b. Open A's Calendar to Fri 18 Sep 2026, confirm nothing near 10:30–11:30 — D-11
     c. Post chatter (ignored)             — Decision row, verdict "ignored", no card
     d. Post the 11:00 ask                 — high-confidence card appears
     e. Click Approve                      — confirmed chip, real Calendar event + Meet link
     f. Post B's 10:30 ask (worded to force overlap — see Common Pitfalls 4)
                                            — conflict card, 2 reasoned alternatives
     g. Pick an alternative                — confirmed chip, second real Calendar event
     h. Verify: THIS run produced a NEW card each step (never silence, never a
        Prisma unique-constraint error) — D-10
     i. Verify: A's Calendar for the day shows exactly 2 events — the 11:00 one
        and the chosen alternative — nothing else — D-12 clause 1, checked per-run

3. bun prisma/reset-demo.ts               — the FINAL reset, no run after it.
   Verify: A's Calendar for the day shows zero demo-tagged events — D-12 clause 2 /
   exit criterion. This leaves Phase 11 a clean baseline for its own recorded run.
```

This also directly satisfies the phase's own cut order (D-13): dropping to 2 runs means dropping one iteration of step 2, never step 1 (smoke test) or step 3 (final reset).

### Impeccable audit mechanics

`/impeccable audit [target]` is a **code-level, not visual-only**, technical QA pass — read directly from the installed plugin `[VERIFIED: C:\Users\RonaldCheng\.claude\plugins\cache\impeccable\impeccable\4.3.1\skills\impeccable\reference\audit.md:1-9, "Run systematic technical quality checks and generate a comprehensive report. Don't fix issues; document them for other commands to address. This is a code-level audit, not a design critique." and "Web only."]`:

1. Setup runs `"${CLAUDE_SKILL_DIR}/scripts/impeccable" context` once per session — loads `PRODUCT.md`/`DESIGN.md` and the matching surface brief `[VERIFIED: same plugin path, SKILL.md:19]`.
2. Scores **5 dimensions 0-4 each** (Accessibility, Performance, Theming, Responsive Design, Implementation Integrity — the last "runs the bundled detector," the 61 deterministic local rules PROJECT.md describes), totals to a `??/20` Audit Health Score with a rating band `[VERIFIED: audit.md:9-77]`.
3. Produces a Pass/Fail Implementation Integrity Verdict, an Executive Summary, P0–P3-tagged findings each with location/category/impact/WCAG-standard/recommendation/**suggested command**, Patterns & Systemic Issues, Positive Findings, and a prioritized Recommended Actions list ending in `/impeccable polish` if any fixes were recommended `[VERIFIED: audit.md:64-130]`.
4. **It never edits code** — this matches D-15 exactly ("Don't fix issues; document them"). No conflict with D-02's file-ownership lock.
5. No API key, deterministic local rules — matches PROJECT.md's own description and D-14's stated rationale for keeping it even under time pressure. Duration is not documented by the plugin; given it is local static analysis over a small hackathon-scale `app/`/`components/` tree, budget **2–5 minutes** `[ASSUMED]`.

**Invocation while D-14 requires "the running dashboard":** run it with Next.js dev already up at `:3000` (already true per the Process map — identical to Phase 7). `impeccable context`'s Setup step accepts `--target <path>` for a named source file or route; feed it the app's route/URL if prompted, otherwise invoke plain `/impeccable audit` and let it read the running `app/`/`components/` tree it already has PRODUCT.md/DESIGN.md context for (both should already exist from Phase 6's `layout`/`typeset`/`colorize`/`critique`/`polish` passes `[CITED: PROJECT.md:164 Code-quality plugins]`).

**Recording output (Claude's Discretion item):** write a plain note (not application code — doesn't touch D-02's file lock) under `.planning/phases/10-seed-and-rehearse/`, e.g. `10-impeccable-audit-notes.md`, capturing the Audit Health Score, the P0–P3 findings list, and which findings are deferred to Phase 11's README "known shortcuts" section — this is exactly what D-15 requires ("reviewed and recorded, not fixed").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding which Calendar events to clean up | A second table mapping Proposal→event id, or trusting the DB's `calendar_event_id` column as the source of truth | `events.list({ privateExtendedProperty: "demo=true" })` — the tag IS the source of truth, independent of and more robust than DB state (Pitfall 4's own prescribed shape) | The DB row for a given event may already be gone by the time cleanup runs (order-independent); the Calendar tag never depends on Postgres being in any particular state |
| A second Prisma client instance inside the script | `new PrismaClient()` at the top of `reset-demo.ts` | Import the existing `prisma` singleton from `lib/db.ts` `[CITED: 01-RESEARCH.md Code Examples "lib/db.ts", export const prisma = ...]` | Repo rule: one Prisma client per process, never constructed inline; D-02 also forbids a second helper |
| A second Google OAuth2 client construction | A standalone `googleapis` auth flow inside `reset-demo.ts` | Whatever `lib/calendar/**` already exports for building the authenticated client (D-02: "reuses ... the calendar client") | Avoids a second refresh-token-handling code path; D-02 is explicit this phase adds no new calendar helper |
| Re-establishing which env vars matter | Reading `process.env.GOOGLE_*`/`SLACK_TEAM_ID` directly | `lib/config.ts`'s typed `config` object | Sole `process.env` reader rule, project-wide |

**Key insight:** every piece of machinery this phase needs (Prisma client, Calendar OAuth client, typed config, event-id/tag conventions) was already built in Phases 1–3. Phase 10's only genuinely new code is the delete/list orchestration logic itself — everything else is a straight import.

## Common Pitfalls

### Pitfall 1: Treating Pitfall 4's "dedupe key collision" as a literal unique-constraint risk for hand-typed reruns

**What goes wrong:** Building defensive upsert/catch logic around a Prisma `P2002` unique-constraint error on `dedupe_key`, under the assumption that reposting the same demo message text twice will hit the same key.

**Why it doesn't actually happen here:** `dedupe_key = sha256(team_id + channel_id + (thread_ts ?? message_ts) + normalized_intent)` `[CITED: REQUIREMENTS.md AGT-09, 05-CONTEXT.md D-20]`. A message posted by hand in Slack always receives a fresh `ts` from Slack's server — there is no way to make Slack reissue a prior `ts` short of replaying a stored value via a script, which D-08 explicitly forbids ("seeded by hand ... not replayed by a script"). So every hand-rehearsal's `dedupe_key` is structurally guaranteed to differ from every prior run's, with no code changes needed. Pitfall 4's warning is correctly aimed at a *replay script* scenario the project's own design (D-08) already avoids.

**What actually needs the reset script, then:** not collision-avoidance, but **volume control** — without a reset, every rehearsal adds a new confirmed Proposal + Calendar event near the target slot, and CFL-01's pending-Proposal union plus `freebusy.query`'s real Calendar data both see the accumulation, which is what pollutes the conflict beat and A's calendar over 3 reruns.

**How to avoid:** Don't build upsert-swallow logic in the reset script or anywhere else for this reason. Do build the delete-everything-scoped-by-`team_id` logic described above.

**Phase to address:** Seed-and-rehearse (this phase) — verified by D-06's own smoke test, which will simply always pass on the collision axis; the real thing D-06 catches is a broken/missing reset script, not a real dedupe collision.

---

### Pitfall 2: Assuming a deleted Calendar event's id can't be reused, and over-engineering around it

**What goes wrong:** Phase 4's research flagged forward (A3, `04-RESEARCH.md` Assumptions Log) that "deleted Calendar events retain their custom id for some period, blocking immediate re-insertion with the same deterministic id" — confirmed this session: **deleting an event and then re-inserting with the same custom id does return 409**, because Calendar does not immediately free a cancelled event's id for reuse `[CITED: aggregated WebSearch summary of Google Calendar API error-code guidance — no single canonical doc quote found this session for the exact retention window, but the 409-on-reuse behavior itself is corroborated by multiple independent sources]`.

**Why it's a non-issue here:** the Calendar event id is derived from the **Proposal's cuid**, and every rehearsal creates a **fresh Proposal row** (fresh `ts` → fresh `dedupe_key` → fresh `cuid`, per Pitfall 1 above). No rehearsal run ever attempts to re-insert using a prior run's proposal id, because that proposal id no longer exists anywhere in the flow after a reset. The 409-on-reuse risk only matters if some future code path deliberately reused an old Proposal id after a Calendar delete — nothing in Phases 1–10 does this.

**How to avoid:** No code change needed. Do not add id-collision-avoidance logic to `reset-demo.ts` or the Calendar client on the strength of this finding — it would be solving a problem this phase's own design (fresh cuid per run) already prevents.

**Warning signs it's wrong:** if a rehearsal's calendar insert ever throws 409 during Phase 10 itself (not the pre-existing CAL-04 409→`events.get` fallback path, which is about *duplicate clicks on the same Proposal*, not cross-run reuse), that means a Proposal row survived a reset it shouldn't have — check the reset script's `deleteMany` filter, not the Calendar client.

**Phase to address:** Seed-and-rehearse — this is confirmation that A3's flagged risk resolves by construction, documented here so the plan doesn't spend time building unnecessary guards.

---

### Pitfall 3: Reset script leaves the bun process hanging (no `$disconnect`)

**What goes wrong:** `bun prisma/reset-demo.ts` appears to finish (all console output printed) but the process never exits, because the pooled `pg` connection (`PrismaPg` adapter, `max: 5`) keeps the event loop alive.

**How to avoid:** End the script with `await prisma.$disconnect()`. This is standard practice for any short-lived Prisma script (as opposed to the long-lived Bolt/Next.js/Trigger.dev processes, which correctly never disconnect their singleton).

**Warning signs:** the terminal running the reset script doesn't return a prompt after printing its summary line.

**Phase to address:** Seed-and-rehearse, in the script's own structure.

---

### Pitfall 4: Seed message durations default to back-to-back, not overlapping — the conflict beat silently doesn't fire

**What goes wrong:** carried forward from Phase 7's own research (`07-RESEARCH.md` Pitfall 1): if both the 11:00 ask and the 10:30 ask resolve to the extraction default duration (undetermined until Phase 5 ships, but flagged as possibly 30 min), a 10:30–11:00 range and an 11:00–… range are adjacent, not overlapping, under the project's half-open overlap rule (`aStart < bEnd && aEnd > bStart`, end-exclusive by design — CFL-01's own correctness requirement, not something to relax). The conflict card never appears; B's second ask just gets approved directly.

**How to avoid (same fix Phase 7's own research already prescribes, reused verbatim for Phase 10's rehearsal wording):** word B's 10:30 message with an **explicit duration that guarantees overlap regardless of the shipped default** — e.g. *"Also need about an hour with you at 10:30 that same day"* (resolves to 10:30–11:30, which overlaps any 11:00–… event by construction). This needs zero coordination with whatever Phase 5 actually shipped as a default and is entirely inside the rehearsal script's own control. **Reuse whatever exact wording Phase 7 actually used in its own `07-02` dry run** if that differs from this suggestion — grep the Phase 7 plan/execution artifacts once they exist, rather than inventing a second, possibly-inconsistent phrasing.

**Warning signs:** the first rehearsal run produces a plain approval card for the 10:30 ask instead of a conflict card — check the actual resolved `start`/`end` on the two most recent Proposal rows before assuming a code regression.

**Phase to address:** Seed-and-rehearse's plan `10-02`, as the literal first thing decided (message wording), not discovered mid-rehearsal.

---

### Pitfall 5: @-mentioning the bot in seed text double-fires the handler

**What goes wrong:** Slack delivers an `@mention`ing message to **both** the watched-channel `message.channels` listener (SLK-02) **and** the `app_mention` listener (SLK-03) as two separate event deliveries for the same human message. Both listeners call the same `dispatchAgentRun`, so the flow could attempt to process the identical Slack `ts` twice.

**Why it's low-risk but not zero-risk:** because both deliveries carry the *same* `ts`, they'd compute the *same* `dedupe_key` (unlike Pitfall 1's cross-run case) — the DB's unique constraint on `dedupe_key` would reject the second insert. Depending on how the propose step's error handling is written (a bare `.create()` throwing `P2002` vs. a graceful catch), this could either be a harmless no-op or a logged error mid-rehearsal — noise the team doesn't want to debug live.

**How to avoid:** simplest fix is entirely in the seed wording — **don't @-mention the bot** in the chatter, the 11:00 ask, or the 10:30 ask. Plain watched-channel messages only exercise the `message.channels` path exactly once per post.

**Warning signs:** two card-post attempts or a `P2002` log line for a single seeded message.

**Phase to address:** Seed-and-rehearse — wording constraint, not a code fix.

---

### Pitfall 6 (Moderate): Calendar cancellation emails during rapid rehearsal iteration

**What goes wrong:** if `events.delete` in the reset script uses `sendUpdates: "all"` (matching the insert-side convention from CAL-03), B receives a real cancellation email for every single rehearsal cleanup — up to 6+ emails across 3 reruns, which is noisy and could make B doubt whether the eventual live-demo invite is real.

**How to avoid:** use `sendUpdates: "none"` on the reset script's `events.delete` calls specifically (this is explicitly Claude's Discretion per CONTEXT.md). The event still disappears from B's calendar regardless of the notification setting — `sendUpdates` only controls whether an email fires, not whether the attendee's calendar updates `[CITED: docs.google.com/workspace/calendar/api/v3/reference/events/delete, sendUpdates parameter description, fetched this session]`.

**Phase to address:** Seed-and-rehearse, in the reset script's delete call.

## Code Examples

### `events.list` — finding tagged events, paginated

```typescript
// Source: developers.google.com/workspace/calendar/api/v3/reference/events/list
// (fetched this session) — privateExtendedProperty format, showDeleted default,
// pagination via nextPageToken
async function findDemoEvents(calendar: calendar_v3.Calendar): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await calendar.events.list({
      calendarId: "primary",
      privateExtendedProperty: ["demo=true"], // key=value format, string values only
      showDeleted: false, // default; explicit for clarity
      pageToken,
    });
    for (const event of res.data.items ?? []) {
      if (event.id) ids.push(event.id);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return ids;
}
```

### `events.delete` — idempotent per-id cleanup

```typescript
// Source: developers.google.com/workspace/calendar/api/v3/reference/events/delete
// (fetched this session) — sendUpdates values; 410 "Resource has been deleted"
// confirmed via developers.google.com/workspace/calendar/api/guides/errors
async function deleteDemoEvents(calendar: calendar_v3.Calendar, ids: string[]): Promise<number> {
  let deleted = 0;
  for (const eventId of ids) {
    try {
      await calendar.events.delete({ calendarId: "primary", eventId, sendUpdates: "none" });
      deleted++;
    } catch (err: unknown) {
      // 410 Gone ("Resource has been deleted") or 404 Not Found — already gone,
      // treat as success so a double-run of the reset script stays a true no-op (D-05).
      // googleapis 180 throws a GaxiosError: HTTP status is on `status`/`response.status`;
      // `code` may be a string, so normalize with Number() (verify against the installed gaxios).
      const e = err as { status?: number; code?: number | string; response?: { status?: number } };
      const status = e.status ?? e.response?.status ?? Number(e.code);
      if (status !== 410 && status !== 404) throw err;
    }
  }
  return deleted;
}
```

### `reset-demo.ts` — top-level shape

```typescript
// prisma/reset-demo.ts
// Run with: bun prisma/reset-demo.ts   (no package.json script — D-02 file lock)
import { prisma } from "../lib/db";
import { config } from "../lib/config";
// import { getCalendarClient } from "../lib/calendar/..."; // exact export TBD — grep once code exists

async function main() {
  const calendar = /* reuse lib/calendar's OAuth2 client factory for A's org account */;

  const eventIds = await findDemoEvents(calendar);
  const eventsDeleted = await deleteDemoEvents(calendar, eventIds);

  const [actionItems, participants, decisions, proposals] = await prisma.$transaction([
    prisma.actionItem.deleteMany({ where: { proposal: { team_id: config.slack.teamId } } }),
    prisma.participant.deleteMany({ where: { proposal: { team_id: config.slack.teamId } } }),
    prisma.decision.deleteMany({ where: { team_id: config.slack.teamId } }),
    prisma.proposal.deleteMany({ where: { team_id: config.slack.teamId } }),
  ]);

  console.log(
    `reset-demo: deleted ${proposals.count} Proposal, ${participants.count} Participant, ` +
    `${actionItems.count} ActionItem, ${decisions.count} Decision row(s); ` +
    `${eventsDeleted} tagged Calendar event(s).`,
  );
}

main()
  .catch((err) => {
    console.error("reset-demo failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect(); // required — otherwise the bun process hangs (Pitfall 3)
  });
```

### Seed messages (Claude's Discretion — recommended defaults)

```
Chatter (ignored):      "haha yeah that thread yesterday was a mess 😅"
11:00 ask (high conf.):  "Let's have a talk next Friday at 11am."          [canonical — 05-CONTEXT.md]
10:30 ask (B, conflict): "Also need about an hour with you at 10:30 that same day"
```

None of these @-mention the bot (Pitfall 5). The 10:30 ask carries an explicit duration to force the overlap regardless of the extraction default (Pitfall 4) — reuse Phase 7's exact final wording if it differs once that phase has actually run.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `lib/calendar/**`'s exported OAuth2-client factory can be imported and reused as-is inside `reset-demo.ts` without modification | Code Examples, Don't Hand-Roll | Low-Medium — if Phase 3 didn't export a reusable factory (only fully-wrapped `checkConflicts`/`createCalendarEvent` functions), the planner must decide whether constructing a client inline in `reset-demo.ts` (still the one file this phase owns) counts as "reusing the calendar client" under D-02, or whether it needs a small additive export from Phase 3's files — flag as open question for the plan, not a research blocker |
| A2 | Exact Prisma field/table names (`team_id`, `Proposal.calendar_event_id`, `Decision.team_id`, `Participant`/`ActionItem`'s `proposal_id` FK) match what Phase 1 actually pushes | Architecture Patterns, Code Examples | Medium — schema doesn't exist yet this session; these are carried from `PROJECT.md`'s data-model sketch and Phase 1's `CONTEXT.md` decisions (both planning documents, not source). The plan must grep `prisma/schema.prisma` once it exists and adjust field names before executing. Same for `config.slack.teamId`: if `lib/config.ts` exposes no team id, an unfiltered `deleteMany()` on the four demo tables is acceptable (single-team dev DB), and `User`/`Installation`/`Preference` stay untouched either way |
| A3 | `/impeccable audit`'s "Implementation Integrity" dimension detector runs against the already-running Next.js dev server without needing a separate `--target` URL argument | Architecture Patterns "Impeccable audit mechanics" | Low — worst case the plan passes `--target http://localhost:3000` explicitly if the bare invocation doesn't find the running app; either way the command exists and is deterministic/local per plugin docs |
| A4 | `~2–5 minutes` for a full `/impeccable audit` run on this app's size | Architecture Patterns | Low — no published timing found; if materially slower, the 25-minute box absorbs it via the "drop to 2 runs" cut order (D-13), not by cutting the audit itself (D-14 never lists it as cuttable) |

## Open Questions

1. **Exact export surface of `lib/calendar/**` for OAuth client reuse**
   - What we know: Phase 3 built `lib/calendar/**` with `checkConflicts`/`createCalendarEvent` as its public stub-replacing functions (Phase 1 D-06), plus (per Phase 3's own discretion) some internal `google-client.ts`-style file for the OAuth2 construction.
   - What's unclear: whether that internal construction is exported for reuse, or private to the module.
   - Recommendation: the plan's first step in `10-01` should grep `lib/calendar/` once it exists; if no reusable export exists, the pragmatic (and still D-02-compliant, since it's still the one owned file) fallback is constructing a `google.auth.OAuth2` client directly inside `reset-demo.ts` using `lib/config.ts`'s Google credentials and the same refresh-token pattern Phase 3 established — this duplicates ~5 lines, not a second module.

2. **Whether Phase 7's actual dry-run seed wording for the 10:30 ask matches this research's suggestion**
   - What we know: `07-RESEARCH.md` recommends "Let's talk at 10:30, need about an hour" as one valid phrasing; this document proposes near-identical wording.
   - What's unclear: whether Phase 7's execution settled on exactly that text or something else.
   - Recommendation: the `10-02` plan should reuse whatever Phase 7 actually used (grep its execution artifacts/commit) for consistency, falling back to this document's suggestion if Phase 7 ran on the degraded CFL-05 static-warning path instead (in which case Phase 10's rehearsal exercises the warning card, not two alternatives — re-check D-09's flow description against whichever form Phase 7 shipped).

## Environment Availability

Not applicable — no new external dependency. Processes are identical to Phase 7 (Next.js dev `:3000`, Bolt sole instance, Trigger.dev dev CLI, Postgres `:5432`), already verified working by the time Phase 10 starts.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No new auth surface; reuses A's existing seeded refresh token unchanged |
| V3 Session Management | No | N/A — CLI script, not a web session |
| V4 Access Control | Yes | Every `deleteMany` scoped by `team_id` (Proposal/Participant/ActionItem/Decision); never a bare `deleteMany({})`. Single-tenant hackathon DB, but the scoping is free defense-in-depth against ever pointing the script at a shared/multi-team database by accident |
| V5 Input Validation | No | Script takes no external/CLI input; all values come from `lib/config.ts`'s already-Zod-validated env |
| V6 Cryptography | No | No new crypto code; reuses Phase 3's existing refresh-token handling unchanged |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Destructive script scope creep — an unscoped `deleteMany` wiping non-demo rows | Tampering | `WHERE team_id = config.slack.teamId` on every delete call, never omitted |
| Refresh-token leakage via console output | Information Disclosure | Log only counts/ids in the script's summary output; never log the raw token, request headers, or auth client internals |
| Silent partial failure (Calendar cleanup succeeds, DB cleanup throws, or vice versa) leaving mixed state | Denial of Service (of the rehearsal itself) | Run Calendar cleanup and the DB `$transaction` as two clearly separated, individually-logged steps (as shown in Code Examples) so a failure in one is visible and the operator knows exactly which half needs a manual retry, rather than a single opaque try/catch around both |

## Sources

### Primary (HIGH confidence)
- `developers.google.com/workspace/calendar/api/v3/reference/events/list` (WebFetch, fetched this session) — `privateExtendedProperty` key=value format, `showDeleted` default false, `maxResults`/`nextPageToken` pagination
- `developers.google.com/workspace/calendar/api/v3/reference/events/delete` (WebFetch, fetched this session) — `sendUpdates` values (`all`/`externalOnly`/`none`)
- `developers.google.com/workspace/calendar/api/guides/errors` (WebFetch, fetched this session) — HTTP 410 "Resource has been deleted" for already-deleted/cancelled events, distinguished from 404
- `docs.slack.dev/reference/methods/chat.delete` (WebFetch, fetched this session) — `chat:write` alone is sufficient for a bot to delete its own messages; `cant_delete_message` error otherwise
- `trigger.dev/docs/idempotency` (WebFetch, fetched this session) — default 30-day TTL, `"run"`/`"attempt"`/`"global"` scope semantics (confirms AGT-11's team+channel+ts key is stable and unrelated to the dedupe-key discussion in Pitfall 1 above — it protects the *task run*, not the Proposal row, per `04-RESEARCH.md`'s own already-established finding)
- `C:\Users\RonaldCheng\.claude\plugins\cache\impeccable\impeccable\4.3.1\skills\impeccable\reference\audit.md` and `SKILL.md` (Read, this session) — `/impeccable audit` mechanics, 5-dimension scoring, no-fix contract, setup/context step

### Secondary (MEDIUM confidence)
- WebSearch aggregate on "Google Calendar API insert event same custom id after delete 409" — corroborates the 409-on-id-reuse behavior Phase 4's research already flagged forward (A3), used here only to confirm the risk is real in principle, then show it's moot for this phase's actual flow

### Tertiary (LOW confidence)
- None used as load-bearing for any Standard Stack or Architecture Pattern claim.

### Upstream phase documents consumed (not re-verified against source, since source doesn't exist yet)
- `.planning/PROJECT.md` — Data model sketch (lines 148-159), Constraints, Key Decisions, Code-quality plugins section
- `.planning/REQUIREMENTS.md` — DMO-01, DMO-02, DSH-07, AGT-09, CAL-04, CAL-05, FND-08, FND-10
- `.planning/ROADMAP.md` §"Phase 10: Seed-and-Rehearse", §"Cut-Line Table", §"Process & Port Map", §"File Ownership Matrix"
- `.planning/research/PITFALLS.md` Pitfall 4 (dedupe/calendar pollution), "Looks Done But Isn't" checklist
- `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md` and `01-RESEARCH.md` — schema field decisions, `lib/db.ts` singleton shape, seed-data slots
- `.planning/phases/03-calendar-client/03-CONTEXT.md` — demo tag `"true"` string, deterministic base32hex event id, `sendUpdates: "all"` on insert
- `.planning/phases/04-approval-bridge/04-CONTEXT.md` and `04-RESEARCH.md` — idempotency key derivation, Assumption A3 (event-id reuse risk) flagged forward to this phase
- `.planning/phases/05-agent-confidence-gate/05-CONTEXT.md` — canonical demo message, "next Friday" = Fri 18 Sep 2026, dedupe_key formula
- `.planning/phases/07-integrate-conflict-counter-proposal/07-CONTEXT.md` and `07-RESEARCH.md` — demo beat sequence, half-open overlap rule, duration-wording fix for the conflict beat

## Metadata

**Confidence breakdown:**
- Google Calendar API mechanics (list/delete/pagination/error codes): HIGH — all confirmed via official docs this session
- Reset script Prisma mechanics: MEDIUM — correct pattern (transaction, FK order, `$disconnect`), but exact field names are carried from planning docs, not read from a real schema (doesn't exist yet)
- Dedupe-key/event-id-reuse non-issue analysis (Pitfalls 1–2): HIGH — derived from already-locked upstream decisions (dedupe_key formula, D-08's no-script-replay rule, CAL-04's per-proposal event id) via direct logical composition, not speculation
- `/impeccable audit` mechanics: HIGH — read directly from the installed plugin's reference file this session

**Research date:** 2026-09-11
**Valid until:** This phase runs same-day (2026-09-12) — no staleness window applies; all findings are for a single, non-repeating execution window.
