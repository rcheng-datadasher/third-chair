# Phase 3: Calendar Client - Pattern Map

**Mapped:** 2026-09-12
**Files analyzed:** 6
**Analogs found:** 0 on-disk / 6 total — repo is greenfield (verified: `git ls-files | grep -E '^(lib|types|app)/'` returns nothing). Every analog is a **planned contract**, not code on disk. Executor must read the real Phase 1 output files before writing against them — do not assume RESEARCH.md's sketch is byte-for-byte what Phase 1 actually created.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/calendar/google-client.ts` | service (auth client factory) | request-response | Phase 1 planned `lib/db.ts` (Prisma singleton pattern) + this phase's own 03-RESEARCH.md §Code Examples | planned, not on disk |
| `lib/calendar/hkt-rfc3339.ts` | utility | transform | Phase 1 D-08 "no date library" convention (cited, no file yet) | no analog — new pattern, fully specified in 03-RESEARCH.md |
| `lib/calendar/event-id.ts` | utility | transform | none — first use of `node:crypto` in repo | no analog — fully specified in 03-RESEARCH.md |
| `lib/calendar/freebusy.ts` | service (external API read) | request-response | Phase 1 stub `lib/calendar/freebusy.ts` (`checkConflicts` signature) — 01-RESEARCH.md §"Interfaces Before Implementation" | planned, not on disk — this phase fills the body, signature must match exactly |
| `lib/calendar/create-event.ts` | service (external API write) | request-response | Phase 1 stub `lib/calendar/create-event.ts` (`createCalendarEvent` signature) — 01-RESEARCH.md §"Interfaces Before Implementation" | planned, not on disk — same rule |
| `lib/calendar/smoke.ts` | script (throwaway) | request-response | Phase 1 planned `lib/db.ts` singleton import convention | planned, not on disk |
| `lib/config.ts` (extend only) | config | — | Phase 1 planned `lib/config.ts` (Zod env schema, `google` section) — 01-RESEARCH.md §"Code Examples" | planned, not on disk — extend, never duplicate (D-17) |

## Pattern Assignments

### `lib/calendar/google-client.ts` (service, request-response)

**Analog:** Phase 1's planned `lib/db.ts` Prisma singleton (for the `prisma` import convention) + this phase's own fully-specified code in 03-RESEARCH.md lines 298-323.

**Import pattern to copy** (03-RESEARCH.md lines 299-301):
```typescript
import { google } from "googleapis";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
```

**Core pattern — resolve token, throw if missing (D-15), build client** (03-RESEARCH.md lines 308-322): read `User.google_refresh_token` via `prisma.user.findUniqueOrThrow`, throw an explicit `Error` if null, construct `google.auth.OAuth2(clientId, clientSecret)`, `setCredentials({ refresh_token })`, return `google.calendar({ version: "v3", auth: oauth2Client })`.

**Executor note:** before writing, `Read` the actual `lib/db.ts` and `lib/config.ts` files Phase 1 produced — confirm the `prisma` export name and `config.google.clientId`/`clientSecret` field names match this sketch exactly (01-RESEARCH.md's Code Examples section is the contract; if Phase 1 executed differently, follow what's actually on disk).

---

### `lib/calendar/hkt-rfc3339.ts` (utility, transform)

**Analog:** none in-repo; Phase 1 D-08 established the "no date library, fixed offset" convention this extends. Fully specified in 03-RESEARCH.md lines 265-277 — copy verbatim, it's the entire function:
```typescript
export function toHktRfc3339(d: Date): string {
  const shifted = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().replace(/\.\d{3}Z$/, "+08:00");
}
```
Verify against `2026-09-17T07:00:00.000Z` → `2026-09-17T15:00:00+08:00` before using in freebusy/insert calls (matches seeded Proposal).

---

### `lib/calendar/event-id.ts` (utility, transform)

**Analog:** none. Fully specified in 03-RESEARCH.md lines 279-292 — copy verbatim:
```typescript
import { createHash } from "node:crypto";
export function deriveEventId(proposalId: string): string {
  return createHash("sha256").update(proposalId).digest("hex");
}
```

---

### `lib/calendar/freebusy.ts` (service, request-response — fills Phase 1 stub)

**Analog:** Phase 1's planned stub signature `checkConflicts(userId: string, startIso: string, endIso: string): Promise<ConflictSlot[]>` (01-RESEARCH.md §"Interfaces Before Implementation" — **executor must Read the actual stub file first**, the signature is a locked contract, not this phase's to change).

**Imports pattern** (03-RESEARCH.md lines 416-418):
```typescript
import type { ConflictSlot } from "@/types/agent"; // Phase 1 shared type — never redeclare
import { getCalendarClient } from "./google-client";
import { toHktRfc3339 } from "./hkt-rfc3339";
```

**Core pattern** (03-RESEARCH.md lines 421-447): build `requestBody` with `timeMin`/`timeMax` passed straight through (caller already formats `+08:00`, D-04), log the request, call `calendar.freebusy.query`, map `busy[]` back through `toHktRfc3339` for the log (Pitfall B — never trust Google's raw response offset format), return `ConflictSlot[]`.

**Error handling:** none added here — D-15's missing-token throw lives in `google-client.ts`, propagates naturally.

---

### `lib/calendar/create-event.ts` (service, request-response — fills Phase 1 stub)

**Analog:** Phase 1's planned stub signature `createCalendarEvent(proposal)`, extended additively per CONTEXT D-17/discretion to `createCalendarEvent(proposal: Proposal, organizerUserId: string): Promise<{ eventId, meetLink, htmlLink }>` — **executor must Read the actual stub file first** to confirm the exact name/shape before extending it.

**Imports pattern** (03-RESEARCH.md lines 328-333):
```typescript
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Proposal } from "@/prisma/generated/prisma/client"; // confirm exact path against Phase 1's actual generator output
import { getCalendarClient } from "./google-client";
import { deriveEventId } from "./event-id";
import { toHktRfc3339 } from "./hkt-rfc3339";
```

**Core pattern — insert with top-level params, not nested in requestBody** (03-RESEARCH.md lines 366-392): build `requestBody` (`id`, `summary`, `start`/`end` with `timeZone: "Asia/Hong_Kong"`, `attendees`, `conferenceData.createRequest`, `extendedProperties.private.demo: "true"`); call `calendar.events.insert({ calendarId: "primary", conferenceDataVersion: 1, sendUpdates: "all", requestBody })` — `conferenceDataVersion`/`sendUpdates`/`calendarId` MUST stay top-level, not nested (Anti-Pattern, real GitHub issue cited).

**Error handling — 409 idempotency fallback** (03-RESEARCH.md lines 335-339, 393-409):
```typescript
function isConflict(err: unknown): boolean {
  const e = err as { status?: number; response?: { status?: number } };
  return e?.status === 409 || e?.response?.status === 409;
}
```
On conflict: `calendar.events.get({ calendarId: "primary", eventId })`; if `existing.data.status === "cancelled"`, throw a named error (Pitfall D — don't silently return a dead event); otherwise return its `{ eventId, meetLink, htmlLink }`.

**Meet-link extraction (tolerant of async generation, Pitfall C)** (03-RESEARCH.md lines 341-350): check `conferenceData.entryPoints` video entry first, fall back to `hangoutLink`, fall back to `""` — never throw on empty.

---

### `lib/calendar/smoke.ts` (throwaway script, request-response)

**Analog:** none — new, not committed past the branch merge. Fully specified in 03-RESEARCH.md lines 458-482. Uses `@/lib/db` import and calls `checkConflicts` from the sibling file. Run via `bun lib/calendar/smoke.ts`. Delete before merging to `develop` (per CONTEXT.md "Shape and location" discretion note).

---

### `lib/config.ts` (extend only, config)

**Analog:** Phase 1's planned `lib/config.ts` Zod env schema with a `google` section — 01-RESEARCH.md §"Code Examples" (`lib/config.ts`). **Executor must Read the actual file first.** Only extend the `google` sub-object if `clientId`/`clientSecret` keys are missing; never add a second env reader (D-13).

## Shared Patterns

### Auth / credential resolution
**Source:** `lib/calendar/google-client.ts` (this phase, no prior analog) — every calendar-calling file (`freebusy.ts`, `create-event.ts`, `smoke.ts`) goes through `getCalendarClient(userId)`; never construct `google.auth.OAuth2` a second time elsewhere.

### Time formatting
**Source:** `lib/calendar/hkt-rfc3339.ts` — apply to both `freebusy.ts` (response re-render) and `create-event.ts` (`start`/`end` dateTime fields). Never use `Date#toISOString()` raw output (`Z` suffix) for anything sent to or logged against Google.

### Error handling — explicit throw, never silent no-op
**Source:** D-15 (missing refresh token) and Pitfall D (cancelled-event 409 fallback) — both are named `throw new Error(...)`, no swallowed errors, no default/fallback values standing in for a real failure.

### Config access
**Source:** Phase 1's planned `lib/config.ts` singleton — `import { config } from "@/lib/config"`, never `process.env` directly inside `lib/calendar/**`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `lib/calendar/hkt-rfc3339.ts` | utility | transform | First HKT-offset formatter in the repo; fully specified inline in 03-RESEARCH.md, no codebase precedent needed |
| `lib/calendar/event-id.ts` | utility | transform | First use of `node:crypto` hashing in the repo; fully specified inline |

## Metadata

**Analog search scope:** entire repo tracked tree (`git ls-files`) — confirmed empty for `lib/`, `types/`, `app/`.
**Files scanned:** 0 source files (none exist yet); 3 planning docs (03-CONTEXT.md, 03-RESEARCH.md, 01-CONTEXT.md/01-RESEARCH.md referenced by section).
**Pattern extraction date:** 2026-09-12
