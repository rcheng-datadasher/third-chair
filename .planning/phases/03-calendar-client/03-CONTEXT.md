# Phase 3: Calendar Client - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning
**Source:** PRD Express Path (.planning/ROADMAP.md, Phase 3 section only) + REQUIREMENTS.md CAL-01..05 + PROJECT.md constraints

<domain>
## Phase Boundary

Wave A track B, 11:55–12:40 HKT (45 min), concurrent with Phase 2 (Slack Surface). Branch `gsd/phase-3-calendar-client`. Depends on Phase 1 only.

Delivers the real Google Calendar client in `lib/calendar/**`, replacing Phase 1's stub bodies:
- a googleapis OAuth2 client + one real `freebusy.query` smoke test as the literal first task;
- `freebusy.query` for A's calendar with explicit `+08:00` offsets (CAL-01);
- `events.insert` with a Meet link (`conferenceDataVersion=1` + `createRequest.requestId`) (CAL-02);
- invite B by email with `sendUpdates: 'all'` (CAL-03);
- deterministic base32hex event id derived from the proposal id, 409 → `events.get` treated as success (CAL-04);
- demo tagging via `extendedProperties.private.demo = "true"` (CAL-05).

Exercised by a throwaway script against live Google APIs and a hand-seeded `Proposal` row. No long-lived server. No Slack, agent, dashboard, or approval-handler work: wiring the client into Approve is Phase 4, the pending-Proposal conflict union and alternatives are Phase 7, cleanup of tagged events is Phase 10.

Requirements: CAL-01, CAL-02, CAL-03, CAL-04, CAL-05.

</domain>

<decisions>
## Implementation Decisions

### Sequencing (ROADMAP deliverables + time-eater guidance)
- **D-01:** The first task is one real googleapis OAuth2 client construction + one real `freebusy.query` call, run under the actual runtime (bun), before any other calendar logic is written. If it throws anything runtime-flavoured (missing Node built-in) rather than a Google HTTP error, that is a runtime problem, not calendar logic.
- **D-02:** Plan split follows the roadmap suggestion: 03-01 smoke test + `freebusy.query` with HKT offsets; 03-02 `events.insert` (Meet link, deterministic id, 409 fallback, demo tag) + invite.
- **D-03:** The deterministic-id helper is verified with one real insert **before** the 409 fallback is layered on top (ROADMAP time-eater #2), so an id-charset 400 and a 409 path bug are never debugged as one problem.

### freebusy (CAL-01)
- **D-04:** `timeMin`/`timeMax` are RFC3339 strings with an explicit `+08:00` offset, never `Date#toISOString()` output (`Z`). The actual request and response are logged on the call so the offsets can be eyeballed (success criterion 1).
- **D-05:** Phase 3 fills in the body of Phase 1's `checkConflicts(userId, startIso, endIso)` stub with the real `freebusy.query` against the organizer's primary calendar. It does **not** union pending Proposals from the DB; that is CFL-01 (Phase 7).

### Event insert (CAL-02, CAL-03, CAL-05)
- **D-06:** Every `events.insert` sets both `conferenceDataVersion: 1` and `conferenceData.createRequest` with a `requestId` and `conferenceSolutionKey.type: "hangoutsMeet"`. Omitting either silently produces an event with no Meet link and an HTTP 200.
- **D-07:** Event `start`/`end` carry `+08:00` dateTimes and `timeZone: "Asia/Hong_Kong"` (PROJECT.md: everything normalized to HKT).
- **D-08:** Attendees come from the proposal's `Participant` emails; the insert sets `sendUpdates: "all"` so B receives a real invite email.
- **D-09:** Every created event carries `extendedProperties.private.demo = "true"` (string; extended property values are strings).
- **D-10:** Done means the created event was **opened** and shows a `meet.google.com` link, and B's mailbox received the invite. An HTTP 200 alone is not evidence (ROADMAP time-eater #1).

### Idempotency (CAL-04)
- **D-11:** Event id is derived deterministically from the proposal id and uses only base32hex characters `[a-v0-9]`, length 5–1024. The proposal id (cuid) is never passed through directly.
- **D-12:** A repeat insert with the same proposal id that returns HTTP 409 falls back to `events.get` with the same id and returns that event as success. No second event is created (success criterion 4).

### Auth and data access
- **D-13:** Google OAuth client id/secret come from `lib/config.ts` (extend its `google` section if a key is missing, never a second env reader). The refresh token is read from the organizer's `User.google_refresh_token` row, seeded by hand in Phase 1. No token or secret in code.
- **D-14:** Postgres is **read-only** in this phase (ROADMAP "Processes / ports"): read the hand-seeded `Proposal`, its `Participant` rows and the organizer `User`. Persisting `calendar_event_id` / links on the Proposal is the approval path's job (Phase 4), so the client returns what the caller needs to persist.
- **D-15:** Only user A has Google consent. A missing refresh token on the requested user is a thrown, explicit error, never a silent no-op.

### File boundaries
- **D-16:** Owns `lib/calendar/**` and its own untracked `.env` (workspace port :3002, unused). Must not touch `lib/slack/**`, `app/**`, `components/**`, `lib/agent/**`. `prisma/schema.prisma` only after merging the latest `develop`, then `bunx prisma db push`.
- **D-17:** Named overlaps: `types/` (extend Phase 1's stub if a shared calendar type is truly needed, never fork) and `lib/config.ts` (extend, never duplicate).

### Cut order
- **D-18:** If overrunning, drop the real invite email to a logged stub first (verify the invite manually once later). Never cut freebusy, insert, idempotency, or the demo tag.

### Claude's Discretion
- File split inside `lib/calendar/` (e.g. a `google-client.ts` for the OAuth2 client, an event-id helper) as long as Phase 1's exported stub names stay and file names are kebab-case with TSDoc on every function.
- Exact hashing/encoding for the base32hex id (a lowercase hex digest is inside `[a-v0-9]`).
- `requestId` generation (any unique string per call).
- How the organizer is identified to `createCalendarEvent` (Phase 1 stub takes only `proposal`; `organizer_user_id` is null until Phase 4's claim). Extending the signature additively is allowed; forking a second function is not.
- Return shape extensions beyond `{ eventId, meetLink }` (e.g. adding `htmlLink`) as long as existing fields stay.
- Where the HKT RFC3339 formatting helper lives (prefer inside `lib/calendar/` to avoid a Wave A overlap on `utils/time.ts`).
- Shape and location of the throwaway smoke/exercise script (must not be committed into a non-allowed top-level folder).
- Log format for the freebusy request/response.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` §"Phase 3: Calendar Client" — deliverables, files owned/must-not-touch, exit criterion, cut order, time-eaters, success criteria, suggested plans. Also §"File Ownership Matrix" and §"Cut-Line Table".
- `.planning/REQUIREMENTS.md` — CAL-01..CAL-05.
- `.planning/PROJECT.md` — "Constraints" (HKT normalization, only A has consent, no tests, env-only secrets), "Agent design" (calendar idempotency, organizer rule), "Data model", repo rules (TSDoc, kebab-case, single config module, Biome only).

### Upstream phase (dependency)
- `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md` — D-06 (calendar stubs `checkConflicts`/`createCalendarEvent`), D-07 (DB types from generated Prisma client, `types/` runtime-free), D-09 (Proposal columns `calendar_event_id`, `calendar_html_link`, `meet_link`), D-12 (Prisma singleton in `lib/db.ts`), D-13/D-14 (seeded A with refresh token, B without; seeded pending Proposal Thu 17 Sep 2026 15:00 HKT with B as participant), D-15 (`lib/config.ts` Zod env, `google` section).
- `.planning/phases/01-foundation-hardcoded-round-trip/01-RESEARCH.md` §"Interfaces Before Implementation" — kebab-case stub file names `lib/calendar/freebusy.ts`, `lib/calendar/create-event.ts`.

### Research
- `.planning/research/PITFALLS.md` — Pitfall 8 (Meet link silently missing), Pitfall 9 (custom event id charset), "`freebusy.query` timezone mishandling", "`googleapis` under bun", "Testing-mode OAuth refresh tokens can expire in 7 days", integration-gotchas table.
- `.planning/research/ARCHITECTURE.md` §"Interfaces Before Implementation" (calendar rows; file names corrected by Phase 1 D-05).
- `.planning/research/STACK.md` — `googleapis` 180.0.0 pin.

</canonical_refs>

<specifics>
## Specific Ideas

- Exit criterion (binary, by hand): against a hand-seeded Proposal row, an event appears on A's calendar with a visible Meet link (opened, not HTTP-200-trusted); a second run with the same proposal id hits 409 and is treated as success, no duplicate.
- Success criteria: (1) logged freebusy request/response shows `+08:00` offsets for a known HKT window; (2) the opened test event shows a `meet.google.com` link; (3) B's mailbox receives a real invite; (4) re-running with the same proposal id creates no second event.
- Keep the demo slots clean: Fri 18 Sep 2026 11:00 HKT and 10:30 HKT are the headline conflict beat. Phase 3's test event should use the seeded Thu 17 Sep 2026 15:00 HKT proposal, not those slots.
- Refresh token is re-verified on the pre-window checklist; a token-exchange failure in the smoke test is a checklist miss, not a code bug.

</specifics>

<deferred>
## Deferred Ideas

- Pending-Proposal union in conflict detection and two reasoned alternatives: Phase 7 (CFL-01..05).
- Persisting `calendar_event_id`/links on the Proposal, organizer claim, re-checking calendar on Approve: Phase 4 (APR-01..04).
- Deleting `demo`-tagged events: Phase 10 (DMO-01).
- Resolving B's email via `users.info`: Phase 2 (SLK-08); Phase 3 reads the seeded `Participant.email`.

</deferred>

---

*Phase: 03-calendar-client*
*Context gathered: 2026-09-11 via PRD Express Path*
