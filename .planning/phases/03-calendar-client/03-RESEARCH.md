# Phase 3: Calendar Client - Research

**Researched:** 2026-09-11
**Domain:** Google Calendar API v3 (`freebusy.query`, `events.insert`, `events.get`) via `googleapis` 180.0.0, OAuth2 refresh-token auth, idempotent event creation, HKT RFC3339 formatting
**Confidence:** MEDIUM-HIGH — OAuth scope requirements, custom-id charset, `conferenceDataVersion` param placement, and gaxios error shape are `[CITED]`/`[VERIFIED]` from official Google docs and source fetched this session; two behaviors (freebusy response offset echoing, `hangoutLink` sync-vs-async timing) are undocumented by Google and flagged LOW-confidence with a pragmatic code-level mitigation rather than a wait-and-see plan.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** First task is one real googleapis OAuth2 client construction + one real `freebusy.query` call, run under bun. A runtime-flavoured error (missing Node built-in) is a runtime problem, not calendar logic.
- **D-02:** Plan split: 03-01 smoke test + `freebusy.query` with HKT offsets; 03-02 `events.insert` (Meet link, deterministic id, 409 fallback, demo tag) + invite.
- **D-03:** Deterministic-id helper verified with one real insert **before** the 409 fallback is layered on top.
- **D-04:** `timeMin`/`timeMax` are RFC3339 strings with explicit `+08:00`, never `Date#toISOString()` (`Z`). Request and response logged so offsets can be eyeballed (success criterion 1).
- **D-05:** Phase 3 fills in `checkConflicts(userId, startIso, endIso)`'s body with real `freebusy.query` against the organizer's primary calendar. Does **not** union pending Proposals — that's CFL-01 (Phase 7).
- **D-06:** Every `events.insert` sets both `conferenceDataVersion: 1` and `conferenceData.createRequest` with `requestId` + `conferenceSolutionKey.type: "hangoutsMeet"`. Omitting either silently produces a Meet-less event with HTTP 200.
- **D-07:** Event `start`/`end` carry `+08:00` dateTimes and `timeZone: "Asia/Hong_Kong"`.
- **D-08:** Attendees from `Participant` emails; insert sets `sendUpdates: "all"`.
- **D-09:** Every created event carries `extendedProperties.private.demo = "true"` (string).
- **D-10:** Done means the created event was **opened** showing a `meet.google.com` link, and B's mailbox received the invite. HTTP 200 alone is not evidence.
- **D-11:** Event id derived deterministically from the proposal id, base32hex `[a-v0-9]`, length 5–1024. The proposal id (cuid) is never passed through directly.
- **D-12:** A repeat insert with the same proposal id returning HTTP 409 falls back to `events.get` with the same id, returns that event as success. No second event created.
- **D-13:** Google OAuth client id/secret from `lib/config.ts` (extend `google` section if a key is missing). Refresh token read from `User.google_refresh_token`, seeded by hand in Phase 1. No token/secret in code.
- **D-14:** Postgres is **read-only** in this phase: read seeded `Proposal`, `Participant`, organizer `User`. Persisting `calendar_event_id`/links on the Proposal is Phase 4's job — the client returns what the caller needs to persist.
- **D-15:** Only user A has Google consent. Missing refresh token on the requested user is a thrown, explicit error, never a silent no-op.
- **D-16:** Owns `lib/calendar/**` and its own untracked `.env` (port :3002, unused). Must not touch `lib/slack/**`, `app/**`, `components/**`, `lib/agent/**`. `prisma/schema.prisma` only after merging latest `develop`, then `bunx prisma db push`.
- **D-17:** Named overlaps: `types/` (extend Phase 1's stub if truly needed, never fork) and `lib/config.ts` (extend, never duplicate).
- **D-18:** Cut order — if overrunning, drop the real invite email to a logged stub first. Never cut freebusy, insert, idempotency, or the demo tag.

### Claude's Discretion

- File split inside `lib/calendar/` as long as Phase 1's exported stub names stay and file names are kebab-case with TSDoc on every function.
- Exact hashing/encoding for the base32hex id.
- `requestId` generation (any unique string per call).
- How the organizer is identified to `createCalendarEvent` (Phase 1 stub takes only `proposal`; extending additively is allowed, forking a second function is not).
- Return shape extensions beyond `{ eventId, meetLink }` (e.g. `htmlLink`) as long as existing fields stay.
- Where the HKT RFC3339 formatting helper lives (prefer inside `lib/calendar/` to avoid a Wave A overlap on `utils/time.ts`).
- Shape and location of the throwaway smoke/exercise script (must not be committed into a non-allowed top-level folder).
- Log format for the freebusy request/response.

### Deferred Ideas (OUT OF SCOPE)

- Pending-Proposal union in conflict detection and two reasoned alternatives: Phase 7 (CFL-01..05).
- Persisting `calendar_event_id`/links on the Proposal, organizer claim, re-checking calendar on Approve: Phase 4 (APR-01..04).
- Deleting `demo`-tagged events: Phase 10 (DMO-01).
- Resolving B's email via `users.info`: Phase 2 (SLK-08); Phase 3 reads the seeded `Participant.email`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAL-01 | `freebusy.query` returns A's busy blocks for a given HKT window, with explicit `+08:00` offsets | §Common Pitfalls "Freebusy response offset is undocumented"; §Code Examples "freebusy.ts" |
| CAL-02 | `events.insert` creates an event with a Meet link (`conferenceDataVersion=1` + `createRequest.requestId`), visible when opened | §Common Pitfalls "conferenceDataVersion/sendUpdates are top-level params, not requestBody fields", "hangoutLink may not be synchronous"; §Code Examples "create-event.ts" |
| CAL-03 | Event invites B by email with `sendUpdates: 'all'`, B's inbox receives it | §Code Examples "create-event.ts" (`sendUpdates: "all"` top-level param) |
| CAL-04 | Event id deterministic base32hex from proposal id; repeat insert 409s, falls back to `events.get`, treated as success | §Common Pitfalls "409 detection and the cancelled-event trap"; §Code Examples "event-id.ts", "409 fallback" |
| CAL-05 | Demo-created events tagged `extendedProperties.private.demo=true` for cleanup | §Code Examples "create-event.ts"; note for Phase 10 in Don't Hand-Roll |
</phase_requirements>

## Summary

Phase 3 is a thin, well-documented Google Calendar API integration with one genuine scope trap and two undocumented-behavior traps that are cheap to neutralize in code rather than worth spending window time investigating live.

**The scope trap (highest-cost if missed):** `freebusy.query`'s accepted OAuth scopes (`calendar`, `calendar.readonly`, `calendar.freebusy`, `calendar.events.freebusy`) and `events.insert`'s accepted scopes (`calendar`, `calendar.events`, `calendar.app.created`, `calendar.events.owned`) **share exactly one scope in common: `https://www.googleapis.com/auth/calendar`** `[CITED: developers.google.com/workspace/calendar/api/v3/reference/freebusy/query, .../events/insert]`. If A's seeded refresh token was minted with only `calendar.events` (a very plausible narrower choice for "just create events"), `freebusy.query` will 403 with `insufficientPermissions` — not a calendar-logic bug, a scope bug. This must be checked as literally the smoke test (D-01) confirms it implicitly, but the researcher found no scope declaration in the repo docs to confirm ahead of time — **flag this to the planner as a pre-task checklist line**, not something to debug reactively.

**The two undocumented-behavior traps, both solved the same way — control what you can control, log a locally-computed value instead of trusting Google's response shape:**
1. Google's docs state the `timeZone` request field on `freebusy.query` only sets "time zone used in the response" but never specify whether `busy[].start`/`busy[].end` actually echo back an offset or always normalize to `Z` `[CITED, but incomplete]`. Since D-04's success criterion is "the logged response shows `+08:00` offsets," the safe move is to log the **request** (guaranteed `+08:00`, fully in our control) and additionally log a **locally HKT-converted rendering of the response's busy blocks** using the same stdlib formatter used for the request — this satisfies the success criterion regardless of what format Google actually returns.
2. `conferenceData.createRequest`'s conference data is generated **asynchronously**; Google's own guide says to check `conferenceData.createRequest.status.statusCode` and implies polling may be needed, but no official doc or issue found this session states a typical delay or confirms `hangoutLink` is reliably present in the very same `events.insert` response `[CITED — status field documented; timing undocumented]`. D-10 already requires opening the event by hand to verify, which is also the correct fallback if the field is empty on first read — no extra code needed beyond checking both `hangoutLink` and `conferenceData.entryPoints` and not treating an empty field as a hard error.

**Also load-bearing and easy to get wrong from memory:** `conferenceDataVersion`, `sendUpdates`, and `calendarId` are **top-level parameters of the `events.insert()` call**, not fields inside `requestBody` `[VERIFIED: googleapis.dev/nodejs/googleapis TS interface `Params$Resource$Events$Insert`, fetched this session]` — nesting them inside `requestBody` is the exact mistake behind a real GitHub issue ("Invalid conference type value").

**Primary recommendation:** Build the OAuth2 client + one `freebusy.query` smoke call first (D-01), logging both the request's `+08:00` window and a locally-reformatted (not raw) rendering of the response; verify the seeded refresh token's scope covers `calendar` full access before assuming a narrower scope works for both freebusy and insert; then build `events.insert` with `conferenceDataVersion`/`sendUpdates` as top-level params and treat `hangoutLink` absence on the sync response as expected-not-alarming (open the event by hand per D-10 either way).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Free/busy conflict lookup | Backend (`lib/calendar/freebusy.ts`) | External API (Google Calendar) | Pure server-side read against Google's API using the organizer's stored refresh token; no client-side call is possible (token never leaves the server) |
| Calendar event creation + Meet link | Backend (`lib/calendar/create-event.ts`) | External API (Google Calendar) | Same reasoning — write operation requiring a server-held OAuth credential |
| Idempotency (event-id derivation, 409 handling) | Backend (`lib/calendar/`) | — | Pure function + one retry-shaped API call; no DB or UI involvement in this phase (persistence of the result is Phase 4) |
| OAuth2 client / refresh-token exchange | Backend (`lib/calendar/google-client.ts`) | Config (`lib/config.ts`) | Client id/secret are config; the refresh token is per-organizer DB state read once per call, never cached client-side |
| Demo tagging (`extendedProperties`) | Backend (`lib/calendar/create-event.ts`) | Database (Phase 10 reads it back) | Written at insert time by this phase; read/filtered by a later phase's cleanup script — no dependency the other direction |

No capability in Phase 3 belongs in the Next.js app tier, Bolt tier, or client/browser tier — this is a pure backend-to-external-API integration, consistent with D-16's `lib/calendar/**`-only file boundary.

## Standard Stack

### Core

No new packages. `googleapis@180.0.0` is already pinned and installed in Phase 1 (STACK.md, D-21). Re-verified this session:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `googleapis` | **180.0.0** `[VERIFIED: npm registry]` | Calendar v3 client (`freebusy.query`, `events.insert`, `events.get`) | Already pinned in Phase 1; `npm view googleapis@180.0.0 version` confirms current registry version this session |
| `google-auth-library` | **^11.0.0** (transitive, resolves 10.5.0 via `googleapis-common@9`) `[VERIFIED: npm registry]` | `google.auth.OAuth2` client, automatic access-token refresh from a stored refresh token | Pulled in automatically by `googleapis`; no separate install needed |
| `gaxios` | **^7.1.3/7.1.4** (transitive) `[VERIFIED: npm registry]` | Underlying HTTP client — its `GaxiosError` is what a 409 surfaces as | Confirms the exact error shape used in the 409-fallback code below |

No installation step needed for Phase 3 — everything above is a transitive or already-installed dependency. `node:crypto` (stdlib) covers the deterministic id; no date library needed (D-08 pattern, HKT has no DST).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| stdlib `Date` arithmetic for the RFC3339 `+08:00` formatter | `date-fns-tz` / `luxon` | Explicitly rejected — Phase 1's D-08 already locks "no date library" for the same reason: HKT has no DST, so a fixed `+8h` shift is always correct and one function, not a dependency |
| `crypto.createHash('sha256').update(id).digest('hex')` for the event id | `crypto.randomUUID()` reformatted, or a base32 library | Hex digest is trivially a subset of `[a-v0-9]` (hex uses `0-9a-f`, all within `a-v`) with zero new code; a real base32 encoder is unnecessary machinery for a charset hex already satisfies |

## Package Legitimacy Audit

No new packages installed this phase. `googleapis` was checked via the legitimacy seam this session for due diligence (it was `[VERIFIED]` version-only in Phase 1's STACK.md, not run through this specific checker before):

```
gsd_run query package-legitimacy check --ecosystem npm googleapis
```

| Package | Registry | Weekly Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-------------------|--------------|---------|-------------|
| `googleapis` | npm | 7,515,785 | github.com/googleapis/google-api-nodejs-client | `SUS` (reason: `too-new` — heuristic reads latest-version publish date, 2026-09-10, not package age; this is Google's own officially supported Node client, published continuously for years) | Approved — false positive from the "too-new" heuristic, same pattern already documented in Phase 1's audit for `@slack/web-api`/`@prisma/adapter-pg`. No `checkpoint:human-verify` needed; already installed and running in Phase 1. |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `googleapis` — false positive, official Google repo, millions of weekly downloads, already installed and in use since Phase 1.

## Architecture Patterns

### System Architecture Diagram

```
Throwaway exercise script (bun lib/calendar/smoke.ts)
      │  reads hand-seeded Proposal + organizer User from Postgres (read-only)
      ▼
┌──────────────────────────────────────────────────────────┐
│ lib/calendar/google-client.ts                             │
│  getCalendarClient(userId) → reads User.refresh token     │
│   1. new google.auth.OAuth2(clientId, clientSecret)        │
│   2. oauth2Client.setCredentials({ refresh_token })         │
│   3. google.calendar({ version: "v3", auth: oauth2Client }) │
│      → googleapis auto-refreshes the access token on call   │
└───────────────┬─────────────────────────┬───────────────────┘
                │                          │
                ▼                          ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│ lib/calendar/freebusy.ts  │   │ lib/calendar/create-event.ts  │
│ checkConflicts(userId,    │   │ createCalendarEvent(proposal, │
│                            │   │   organizerUserId)            │
│   startIso, endIso)       │   │  1. deriveEventId(proposal.id)│
│  → calendar.freebusy      │   │     (hex digest, a-v0-9)      │
│    .query({ requestBody:  │   │  2. calendar.events.insert({  │
│    { timeMin, timeMax,    │   │    calendarId:'primary',       │
│    timeZone, items }})    │   │    conferenceDataVersion:1,    │
│  logs request +08:00 AND  │   │    sendUpdates:'all',          │
│  a locally-reformatted    │   │    requestBody:{ id, start,    │
│  HKT rendering of the     │   │    end, attendees,             │
│  response (Pitfall below) │   │    conferenceData.createRequest,│
│                            │   │    extendedProperties.private  │
│                            │   │    .demo:'true' }})            │
│                            │   │  3. on HTTP 409 → events.get(  │
│                            │   │     calendarId, eventId) and   │
│                            │   │     return that as success     │
│                            │   │     unless status==='cancelled'│
└──────────────────────────┘   └──────────────────────────────┘
                │                          │
                ▼                          ▼
        ConflictSlot[] (returned,     { eventId, meetLink, htmlLink }
        not persisted — caller's job) (returned, not persisted — Phase 4's job)
```

Nothing in this diagram touches Slack, the agent, or the dashboard — matches D-16's file boundary and the CONTEXT.md phase boundary exactly.

### Interfaces (Phase 1 stub signatures, unchanged names)

| File | Signature | Real impl this phase |
|---|---|---|
| `lib/calendar/freebusy.ts` | `checkConflicts(userId: string, startIso: string, endIso: string): Promise<ConflictSlot[]>` | Body filled in — real `freebusy.query`, no pending-Proposal union (D-05) |
| `lib/calendar/create-event.ts` | `createCalendarEvent(proposal, organizerUserId: string): Promise<{ eventId: string; meetLink: string; htmlLink: string }>` | Body filled in. Recommended additive extension of Phase 1's stub: the organizer param (null `organizer_user_id` until Phase 4) and `htmlLink` (APR-04 needs it). Update the stub's call sites, if any, in the same commit |

New files this phase (discretion, kebab-case, TSDoc required):
- `lib/calendar/google-client.ts` — OAuth2 client construction, exported `getCalendarClient(userId: string): Promise<calendar_v3.Calendar>` (reads the refresh token from the `User` row, D-13)
- `lib/calendar/event-id.ts` — `deriveEventId(proposalId: string): string`
- `lib/calendar/hkt-rfc3339.ts` (or inline in the two callers) — `toHktRfc3339(d: Date): string`
- `lib/calendar/smoke.ts` — throwaway exercise script (not a stub, not exported elsewhere; see Code Examples). Delete it before the track merges to `develop`, so no dead entrypoint reaches `main`

### Anti-Patterns to Avoid

- **Nesting `conferenceDataVersion`/`sendUpdates`/`calendarId` inside `requestBody`** — these are top-level parameters of the `events.insert()` call `[VERIFIED: googleapis.dev/nodejs/googleapis TS interface, fetched this session]`. Nesting them inside `requestBody` either silently no-ops the conference request or throws "Invalid conference type value" (a real, still-open GitHub issue against this exact mistake).
- **Trusting `err.status === 409` alone without a `response?.status` fallback** — `GaxiosError` sets both `status` and `response.status` to the same value in current gaxios `[CITED: gaxios source + DeepWiki summary]`, but checking both costs one `||` and removes any doubt about whether `googleapis`'s error-wrapping layer preserves the top-level `status` shortcut in every code path.
- **Treating an empty `hangoutLink` on the `events.insert` response as a hard failure** — conference data generation is documented as asynchronous; D-10 already requires opening the event by hand, which is also the correct verification step if the field is empty on the synchronous response.
- **Passing the Proposal's `cuid()` directly as the Calendar event `id`** — already flagged in PITFALLS.md Pitfall 9; re-stated here because D-11 depends on it and it is the single most likely first-real-call 400.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Base32hex-safe id derivation | A custom base32 encoder | `crypto.createHash('sha256').update(proposalId).digest('hex')` (stdlib `node:crypto`) | Hex output (`0-9a-f`) is a strict subset of the required `[a-v0-9]` charset — zero new code, zero new dependency |
| HKT RFC3339 formatting for API calls | A date-tz library | Fixed `+8h` shift + `toISOString()` string surgery (one function, see Code Examples) | HKT has no DST (already the reasoning behind Phase 1's D-08); the request-side format is fully under our control |
| 409 detection across googleapis' error wrapping | A custom error-classification module | `(err.status ?? err.response?.status) === 409` | Two-field check covers the documented `GaxiosError` shape; no abstraction needed for one comparison |
| Demo-event cleanup query shape | Building it now | `events.list({ privateExtendedProperty: 'demo=true' })` — **Phase 10's job, not designed here** | CONTEXT.md deferred list explicitly assigns this to DMO-01; this phase only needs to *write* the tag correctly, confirmed via `[CITED: developers.google.com/workspace/calendar/api/guides/extended-properties]` value-type (string) and filter syntax |

**Key insight:** every genuinely new piece of logic this phase needs (id derivation, HKT formatting, 409 detection) is a one-line-to-one-function stdlib answer — consistent with Phase 1's established pattern of resisting new dependencies for narrow, well-understood problems.

## Common Pitfalls

*(PITFALLS.md's Pitfall 8 "Meet link silently missing", Pitfall 9 "custom event id charset rejected", and the "`freebusy.query` timezone mishandling" moderate pitfall are already canonical and not re-listed here — the four below are Phase-3-specific findings this research session surfaced.)*

### Pitfall A: The organizer's refresh token may not have a scope that satisfies both `freebusy.query` and `events.insert`

**What goes wrong:** `freebusy.query` succeeds but `events.insert` 403s with `insufficientPermissions`, or vice versa, depending on which scope the token was originally minted with.

**Why it happens:** The two methods' accepted-scope lists intersect at exactly one scope. `freebusy.query` accepts `calendar`, `calendar.readonly`, `calendar.freebusy`, `calendar.events.freebusy` `[CITED: developers.google.com/workspace/calendar/api/v3/reference/freebusy/query]`. `events.insert` accepts `calendar`, `calendar.events`, `calendar.app.created`, `calendar.events.owned` `[CITED: developers.google.com/workspace/calendar/api/v3/reference/events/insert]`. `events.get` accepts a superset including `calendar.events.freebusy` `[CITED: developers.google.com/workspace/calendar/api/v3/reference/events/get]`. The only scope common to all three calls this phase makes is the full `https://www.googleapis.com/auth/calendar` scope. No document read in this session (PROJECT.md, CONTEXT.md, STACK.md, PITFALLS.md) states which exact scope string the seeded refresh token was minted with.

**Note (orchestrator):** a token's granted scopes are a set, so `calendar.events` + `calendar.readonly` (or `calendar.events` + `calendar.freebusy`) together also cover all three calls. The requirement is coverage, not full `calendar` specifically. The fastest check is one `GET https://oauth2.googleapis.com/tokeninfo?access_token=<fresh token>` after the refresh exchange; its `scope` field lists what was granted.

**How to avoid:** Before writing any calendar-logic code, confirm (by inspecting the OAuth consent screen config or the token-minting script from "tonight's checklist") that the granted scope includes `https://www.googleapis.com/auth/calendar` (full access), not a narrower `calendar.events`-only scope. If it's narrower, the smoke test (D-01) will surface this on the very first `freebusy.query` call as a 403, not a network/runtime error — treat a 403 with `insufficientPermissions` in the reason field as a scope problem, not a calendar-logic bug, and re-mint/re-consent with the full scope.

**Warning signs:** `freebusy.query` (or `events.insert`) throws with HTTP 403 and an error body reason of `insufficientPermissions` or `forbidden`, not a 401 (bad token) or 400 (bad request shape).

**Phase to address:** Phase 3, D-01's smoke test — this is exactly what that first real call is for; treat a 403 there as a distinct outcome from "runtime problem" (D-01's own framing) and from "calendar logic bug."

---

### Pitfall B: `freebusy.query`'s response offset format is undocumented — don't depend on Google echoing `+08:00`

**What goes wrong:** D-04's success criterion requires the *logged response* to visibly show `+08:00` offsets. If Google always normalizes `busy[].start`/`busy[].end` to UTC `Z` regardless of the request's `timeZone`/offset (plausible, and the official reference docs do not confirm either way), a raw log of the API response will show `Z`, and the check "eyeball the offsets" fails even though the query itself is correct.

**Why it happens:** The official `freebusy/query` reference page defines `timeZone` only as "Time zone used in the response... default is UTC" `[CITED: developers.google.com/workspace/calendar/api/v3/reference/freebusy/query]` without stating whether this changes the wire format of `busy[].start`/`busy[].end` or only some other response field. No secondary source fetched this session resolved the ambiguity either way.

**How to avoid:** Don't depend on Google's response format for the success criterion. Log two things on every `freebusy.query` call: (1) the raw request `timeMin`/`timeMax` (guaranteed `+08:00`, under our control) and (2) each returned `busy[]` block **re-rendered through the same `toHktRfc3339` helper** used for the request, regardless of what offset the raw API response used. This makes D-04's "offsets can be eyeballed" success criterion pass deterministically without depending on undocumented Google behavior — and it's one extra `.map()`, not new logic.

**Warning signs:** The raw response log shows `Z`-suffixed timestamps where `+08:00` was expected — this is not a bug to fix, it's the reason the locally-reformatted log line exists.

**Phase to address:** Phase 3, plan 03-01 (`freebusy.query` + HKT offsets).

---

### Pitfall C: `hangoutLink`/Meet URI may not be present in the synchronous `events.insert` response

**What goes wrong:** Code that reads `res.data.hangoutLink` (or `conferenceData.entryPoints`) immediately after `events.insert` and throws if it's empty will intermittently fail even on a correctly-formed request.

**Why it happens:** Google's own conference-data guide states conference data is generated **asynchronously**, and instructs callers to check `conferenceData.createRequest.status.statusCode` (`"pending"` vs `"success"`) `[CITED, via WebSearch aggregation of Google's conference-data guide language — not independently re-fetched from the primary guide URL this session; treat as MEDIUM confidence]`. No source found this session states a typical delay or guarantees same-response availability for `hangoutsMeet` specifically.

**How to avoid:** Read the Meet URI from whichever field is populated (`conferenceData.entryPoints?.find(e => e.entryPointType === "video")?.uri` first, `hangoutLink` as fallback — they're usually populated together in practice for `hangoutsMeet`). If both are empty on the synchronous response, do not throw — D-10 already requires a human to open the event and confirm the link visually, which is also the correct recovery step here (open it a few seconds later, or re-`events.get` once). Do not build a polling loop for this; it adds code for a case the phase's own exit criterion already checks by hand.

**Warning signs:** `res.data.hangoutLink` and `res.data.conferenceData?.entryPoints` both undefined immediately after insert, with `conferenceData.createRequest.status.statusCode === "pending"` — expected, not an error; open the event to confirm (D-10).

**Phase to address:** Phase 3, plan 03-02 (`events.insert`) — write the return-shape extraction to tolerate this, not throw on it.

---

### Pitfall D: 409-on-cancelled-event is undocumented — decide the policy explicitly, don't assume

**What goes wrong:** If the event previously created with the deterministic id was later cancelled/deleted (e.g., a rehearsal reset that used `events.delete` rather than a fresh id, or a user manually deleted it in the Calendar UI), a repeat `events.insert` with the same id may still 409 (Google tracks ids as reserved regardless of status — the general pattern for ID-based systems, `[ASSUMED]`, not confirmed by any source fetched this session for this specific edge case). The D-12 fallback (`events.get` → return as success) would then hand back an event whose `status` is `"cancelled"` and claim it as the created Meet-linked event — silently wrong.

**Why it happens:** No official doc or issue fetched this session states Calendar's behavior for a duplicate-id insert against a previously-cancelled event id. This is a genuine gap, not merely under-researched — treat it as `[ASSUMED — needs a guard, not a debugging session]`.

**How to avoid:** In the 409-fallback path, after `events.get` succeeds, check `existing.data.status === "cancelled"` before returning it as success. If cancelled, this is an edge case outside Phase 3's exit criterion (the reset script's calendar-cleanup, Phase 10, is what's supposed to prevent stale cancelled events from colliding with a rehearsal) — the pragmatic Phase 3 response is to throw a clear, named error rather than silently returning a dead event's (missing) Meet link. Do not build recovery logic (e.g., auto-generating a new id) for this edge case now — it's speculative until observed.

**Warning signs:** `events.get` in the fallback path returns `status: "cancelled"` — this should never happen in Phase 3's own exit-criterion rehearsal (fresh proposal, no prior delete), but would surface if Phase 3's smoke test is run against a stale rehearsal event from an earlier session.

**Phase to address:** Phase 3, plan 03-02 — the guard is one `if` statement in the 409-fallback function; write it in from the start (D-03 already sequences the id-helper-then-fallback split for exactly this kind of "don't debug two problems as one" reason).

## Code Examples

### `lib/calendar/hkt-rfc3339.ts` — smallest correct HKT RFC3339 formatter (stdlib only)

```typescript
/**
 * Formats a UTC Date as an RFC3339 string with an explicit +08:00 offset
 * (Asia/Hong_Kong has no DST, so a fixed +8h shift is always correct).
 */
export function toHktRfc3339(d: Date): string {
  const shifted = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  // shifted.toISOString() renders HKT wall-clock digits under a "Z" label;
  // relabel the suffix instead of reformatting the digits.
  return shifted.toISOString().replace(/\.\d{3}Z$/, "+08:00");
}
```
Verify against a known instant before trusting it in the freebusy/insert calls: `2026-09-17T07:00:00.000Z` (UTC) → `2026-09-17T15:00:00+08:00` (matches the seeded Proposal's Thu 17 Sep 2026 15:00 HKT from Phase 1 D-14 — a free correctness check against real seed data).

### `lib/calendar/event-id.ts` — deterministic base32hex id

```typescript
import { createHash } from "node:crypto";

/**
 * Derives a Calendar-safe custom event id from a Proposal id.
 * Google requires [a-v0-9], 5-1024 chars — a lowercase hex digest
 * (0-9a-f) is a strict subset of that charset.
 */
export function deriveEventId(proposalId: string): string {
  return createHash("sha256").update(proposalId).digest("hex");
}
```

### `lib/calendar/google-client.ts` — OAuth2 client (D-13, D-15)

> **Orchestrator correction (post-research):** the token is resolved from the `User` row inside this helper (CONTEXT D-13), so callers pass a `userId`, never a raw token. That keeps Phase 1's `checkConflicts(userId, startIso, endIso)` signature unchanged. The sketches below are adjusted accordingly.

```typescript
import { google } from "googleapis";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

/**
 * Builds a Calendar v3 client authenticated as the given user,
 * using their stored Google refresh token. Throws explicitly if the
 * refresh token is missing (D-15 — never a silent no-op).
 */
export async function getCalendarClient(userId: string) {
  const { google_refresh_token: refreshToken } = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { google_refresh_token: true },
  });
  if (!refreshToken) {
    throw new Error(`User ${userId} has no Google refresh token — cannot call Calendar API`);
  }
  const oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}
```

### `lib/calendar/create-event.ts` — insert with Meet link, 409 fallback, demo tag (CAL-02/03/04/05)

```typescript
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Proposal } from "@/prisma/generated/prisma/client"; // exact path per Phase 1 generator output
import { getCalendarClient } from "./google-client";
import { deriveEventId } from "./event-id";
import { toHktRfc3339 } from "./hkt-rfc3339";

/** True if the caught error is Calendar's "identifier already exists" (409). */
function isConflict(err: unknown): boolean {
  const e = err as { status?: number; response?: { status?: number } };
  return e?.status === 409 || e?.response?.status === 409;
}

function extractMeetLink(event: {
  hangoutLink?: string | null;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] } | null;
}): string {
  return (
    event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
    event.hangoutLink ??
    "" // Pitfall C: may be empty on the sync response — D-10 verifies by hand
  );
}

// Signature: Phase 1 stub `createCalendarEvent(proposal)` extended additively with the
// organizer (organizer_user_id is null until Phase 4's claim) and `htmlLink` in the return.
// Participant emails are read (read-only, D-14) rather than widening the proposal type.
export async function createCalendarEvent(
  proposal: Proposal, // generated Prisma type (Phase 1 D-07)
  organizerUserId: string,
): Promise<{ eventId: string; meetLink: string; htmlLink: string }> {
  const calendar = await getCalendarClient(organizerUserId);
  const eventId = deriveEventId(proposal.id);
  const participants = await prisma.participant.findMany({
    where: { proposal_id: proposal.id },
    select: { email: true },
  });

  const requestBody = {
    id: eventId,
    summary: proposal.title,
    start: { dateTime: toHktRfc3339(proposal.start), timeZone: "Asia/Hong_Kong" },
    end: { dateTime: toHktRfc3339(proposal.end), timeZone: "Asia/Hong_Kong" },
    attendees: participants.map((p) => ({ email: p.email })),
    conferenceData: {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    extendedProperties: { private: { demo: "true" } },
  };

  try {
    const res = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: 1, // top-level param, NOT inside requestBody (Anti-Pattern)
      sendUpdates: "all", // top-level param
      requestBody,
    });
    return {
      eventId: res.data.id!,
      meetLink: extractMeetLink(res.data),
      htmlLink: res.data.htmlLink ?? "",
    };
  } catch (err) {
    if (!isConflict(err)) throw err;

    // D-12: 409 → events.get with the same id, treat as success
    const existing = await calendar.events.get({ calendarId: "primary", eventId });
    if (existing.data.status === "cancelled") {
      // Pitfall D: undocumented edge case — fail loudly, don't fake success
      throw new Error(
        `Calendar event ${eventId} exists but is cancelled; cannot idempotently reuse it`,
      );
    }
    return {
      eventId: existing.data.id!,
      meetLink: extractMeetLink(existing.data),
      htmlLink: existing.data.htmlLink ?? "",
    };
  }
}
```

### `lib/calendar/freebusy.ts` — `checkConflicts` with dual-logged offsets (CAL-01, Pitfall B)

```typescript
import type { ConflictSlot } from "@/types/agent"; // Phase 1 shared type — never redeclare (D-17)
import { getCalendarClient } from "./google-client";
import { toHktRfc3339 } from "./hkt-rfc3339";

// Signature unchanged from Phase 1's stub. Freebusy only; pending-Proposal union is CFL-01 (Phase 7).
export async function checkConflicts(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<ConflictSlot[]> {
  const calendar = await getCalendarClient(userId);
  const requestBody = {
    timeMin: startIso, // caller passes an already-+08:00 RFC3339 string (D-04)
    timeMax: endIso,
    timeZone: "Asia/Hong_Kong",
    items: [{ id: "primary" }],
  };
  console.log("[freebusy] request", requestBody); // D-04: request offsets visible

  const res = await calendar.freebusy.query({ requestBody });
  const busy = res.data.calendars?.primary?.busy ?? [];

  // Pitfall B: don't trust Google's response offset format — re-render locally
  const slots: ConflictSlot[] = busy.map((b) => ({
    startIso: toHktRfc3339(new Date(b.start!)),
    endIso: toHktRfc3339(new Date(b.end!)),
    reason: "Busy on calendar",
  }));
  console.log("[freebusy] response (raw)", busy, "(HKT-rendered)", slots);

  return slots;
}
```

### `lib/calendar/smoke.ts` — throwaway exercise script (D-01, open question 10)

Lives inside the phase's owned folder (`lib/calendar/**`), not a disallowed top-level `scripts/` directory (FND-01's fixed folder list has no `scripts/`). Run directly with bun, which auto-loads the root `.env` for a direct file invocation (no extra tooling):

```bash
bun lib/calendar/smoke.ts
```

```typescript
// lib/calendar/smoke.ts — throwaway, not exported/imported elsewhere.
// Exercises the real OAuth2 client + freebusy.query against the hand-seeded
// Proposal/User rows (D-01). Uses "@/" the same way the rest of the repo does
// since tsconfig's path alias applies process-wide, not per-entrypoint.
import { prisma } from "@/lib/db";
import { checkConflicts } from "./freebusy";

async function main() {
  const user = await prisma.user.findFirstOrThrow({
    where: { google_refresh_token: { not: null } },
  });
  const slots = await checkConflicts(
    user.id,
    "2026-09-17T00:00:00+08:00",
    "2026-09-18T00:00:00+08:00",
  );
  console.log("Smoke test OK. Busy slots:", slots);
}

main().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A repeat `events.insert` against a previously-cancelled event id still returns 409 (not a fresh 200) | Pitfall D | Medium — if wrong, the 409-fallback's cancelled-status guard simply never triggers (harmless); if the assumption should have been "insert succeeds fresh," the guard code is dead but not incorrect |
| A2 | `hangoutLink`/`conferenceData.entryPoints` are *usually* populated together in the synchronous response for `hangoutsMeet` specifically, even though Google documents the process as asynchronous | Pitfall C, Code Examples `extractMeetLink` | Low — D-10's by-hand verification is the actual safety net regardless; if the field truly needs a delay, the by-hand open-and-check step will catch it before the exit criterion is claimed |
| A3 | The seeded refresh token's OAuth scope is unknown from any document read this session; `calendar.events`-only is plausible and would break `freebusy.query` | Pitfall A | High if true and unchecked — but this is exactly what D-01's smoke test verifies as the very first action, so the risk window is minutes, not the whole phase |
| A4 | `freebusy.query`'s response `busy[].start`/`busy[].end` offset format (whether it echoes the request's offset or normalizes to `Z`) is genuinely undocumented, not just under-researched this session | Pitfall B | Low — mitigated by design (log a locally-reformatted rendering regardless of the raw response's format), so the success criterion doesn't depend on resolving this ambiguity |

## Open Questions

1. **What OAuth scope was the seeded refresh token (`User.google_refresh_token`) actually minted with?**
   - What we know: `freebusy.query` + `events.insert` + `events.get` together require the full `https://www.googleapis.com/auth/calendar` scope as the only common denominator (Pitfall A).
   - What's unclear: No document in this repo states the exact scope string used when A consented.
   - Recommendation: D-01's smoke test answers this empirically within the first API call — treat a 403 `insufficientPermissions` there as the answer, not a code bug to chase.

2. **Does a duplicate-id `events.insert` 409 against a previously-cancelled event, or succeed fresh?**
   - What we know: No source found this session addresses this specific case for Google Calendar.
   - What's unclear: The exact server-side id-reservation semantics for cancelled events.
   - Recommendation: The guard in Code Examples' `createCalendarEvent` (check `status === "cancelled"` after the 409-triggered `events.get`) handles both possible answers safely — if it 409s, the guard fires; if it doesn't (fresh insert succeeds), the guard is simply never reached. No further investigation needed before planning.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `googleapis` npm package | All of CAL-01..05 | ✓ (already installed, Phase 1) | 180.0.0 | — |
| Network egress to `www.googleapis.com` | All live API calls | Not probed this session (research ran outside the target WSL/bun environment) | — | PITFALLS.md's "Do Tonight" checklist already covers verifying the refresh token exchanges for a fresh access token — the same network path this phase needs |
| Seeded `User.google_refresh_token` (A) | D-13, D-15 | Depends on Phase 1 execution completing first (Phase 3 is Wave A, concurrent with Phase 2, both depend only on Phase 1) | — | None — D-15 requires a thrown error if missing, not a silent no-op; this is a hard phase-start dependency, not a fallback candidate |
| `bun` runtime for the smoke script | D-01 | Not probed this session (wrong OS — see Phase 1 research's own note) | — | PITFALLS.md's "`googleapis` under bun — lower risk, but unverified until tried once" moderate pitfall is the canonical guidance; D-01 IS that check for this phase |

**Missing dependencies with no fallback:** the seeded refresh token (blocks the phase entirely if absent — but this is a Phase 1 completion dependency, not something Phase 3 can work around).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Phase 3 consumes an already-minted refresh token; no login/auth flow is built in this phase |
| V3 Session Management | No | No sessions in this phase |
| V4 Access Control | Yes (narrow) | D-15's explicit-throw-on-missing-token IS the access control for this phase — never silently proceed as an unauthenticated/unauthorized caller |
| V5 Input Validation | Yes | `startIso`/`endIso` passed to `checkConflicts` should be validated as parseable RFC3339 before being sent to Google (a malformed string produces a Google-side 400, not a local validation failure — acceptable for this phase's scope, but worth a one-line guard since it's cheap) |
| V6 Cryptography | Yes (flagged, not fixed — inherited from Phase 1) | The refresh token this phase reads was seeded into Postgres in plaintext (Phase 1 D-13, already logged as an accepted `/ponytail-debt` shortcut in Phase 1's research). Phase 3 does not change this; it only reads the value already at rest. No new cryptography work belongs in Phase 3. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Refresh token leaked via error logs | Information Disclosure | Never log the raw `refreshToken` string; the Code Examples above log request/response *event data* only, never the credential itself — enforce this by code review, not tooling, since it's a one-phase, hand-checked build |
| Calendar API quota/rate-limit exhaustion from rehearsal loops | Denial of Service (self-inflicted) | Out of Phase 3's scope — PITFALLS.md's Pitfall 4 (dedupe/reset script) already owns this; Phase 3 just needs to not retry-loop on failure (the 409-fallback here calls `events.get` exactly once, not in a retry loop) |
| Deterministic event id used as an authorization boundary | Tampering (misuse, not a real threat here) | Not applicable — the event id is an idempotency key, not a secret or capability token; no security property depends on it being unguessable |

## Sources

### Primary (HIGH confidence)
- `developers.google.com/workspace/calendar/api/v3/reference/freebusy/query` (official docs, fetched this session) — OAuth scopes, request/response shape
- `developers.google.com/workspace/calendar/api/v3/reference/events/insert` (official docs, fetched this session) — custom id charset (`[a-v0-9]`, 5-1024), OAuth scopes, `sendUpdates` semantics
- `developers.google.com/workspace/calendar/api/v3/reference/events/get` (official docs, fetched this session) — OAuth scopes
- `developers.google.com/workspace/calendar/api/guides/extended-properties` (official docs, fetched this session) — value type (string), `privateExtendedProperty` filter syntax
- `googleapis.dev/nodejs/googleapis/latest/calendar/interfaces/Params$Resource$Events$Insert.html` (official TS interface reference, fetched this session) — confirms `conferenceDataVersion`/`sendUpdates`/`calendarId` are top-level params, not `requestBody` fields
- npm registry (`npm view googleapis@180.0.0 version dependencies`, `npm view googleapis-common@9.0.0 dependencies`, `npm view google-auth-library@11.0.0 dependencies`) — direct queries this session, confirms `gaxios@^7.1.x`/`google-auth-library@^11`/`10.5.0` transitive versions

### Secondary (MEDIUM confidence)
- `github.com/googleapis/gaxios` source + DeepWiki summary (WebSearch, cross-checked against multiple result snippets) — `GaxiosError.status`/`.response.status` shape for 409 detection
- `github.com/googleapis/google-api-python-client` issue #846 and aggregated WebSearch results — 409 "identifier already exists" is the documented, expected duplicate-id behavior; cancelled-event interaction not addressed by any source found
- WebSearch aggregation on Google's conference-data guide language (async generation, `status.statusCode` field) — not independently re-fetched from the primary conference-data guide URL this session; treated as MEDIUM per the source-hierarchy rule for WebSearch-aggregated claims

### Tertiary (LOW confidence)
- `github.com/googleapis/google-api-nodejs-client` issue #3052 — confirms the "nesting conference params inside requestBody breaks the request" failure mode exists in the wild, but doesn't address response timing
- Freebusy response offset-echoing behavior — genuinely unresolved by any source fetched this session; treated as an open question with a code-level mitigation rather than asserted either way

## Metadata

**Confidence breakdown:**
- OAuth scopes (freebusy/insert/get): HIGH — three separate official reference pages fetched and cross-tabulated this session
- Custom event id charset: HIGH — matches PITFALLS.md's existing Pitfall 9, re-confirmed from the same official source
- `conferenceDataVersion` param placement: HIGH — confirmed via the official TypeScript interface, not just prose docs
- Freebusy response offset format: LOW — genuinely undocumented; mitigated in code rather than resolved by more research
- `hangoutLink` sync-vs-async timing: LOW-MEDIUM — status field is documented, exact timing is not; mitigated by D-10's existing by-hand check
- 409-on-cancelled-event interaction: LOW — no source addresses this; mitigated defensively in code (Pitfall D)
- gaxios error shape: MEDIUM-HIGH — WebSearch-aggregated across multiple independent result snippets that agree, plus the official npm-registry-confirmed version pin

**Research date:** 2026-09-11
**Valid until:** Effectively for this build window only (Sat 12 Sep 2026) — re-verify scope/OAuth findings if reused past this hackathon build.
