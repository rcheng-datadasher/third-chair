# API Coverage — Google Calendar v3 (demo reset surface)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

**Scope of this matrix:** Phase 10's own use of the Google Calendar API from
`prisma/reset-demo.ts` (DMO-01). The read/write surface used by the product
itself (`freebusy.query`, `events.insert` with Meet link, deterministic id,
409 fallback, demo tag, invites) is owned and decided by **Phase 3**
(CAL-01..CAL-05); Phase 10 consumes that client read-only and adds no calls
beyond the two below. Phase 10 touches no Slack API surface programmatically:
every Slack message and button click in this phase is typed or clicked by hand
by the two real demo users (D-08), which is a product requirement, not an
integration gap.

| capability | decision | reason |
|---|---|---|
| `events.list` (tagged lookup, paginated) | INTEGRATE | Finds demo-tagged events via `privateExtendedProperty: ["demo=true"]`, following `nextPageToken` |
| `events.delete` (idempotent cleanup) | INTEGRATE | Deletes each tagged event with `sendUpdates: "none"`; 404/410 treated as success |
| `events.insert` | OPT-OUT | Owned by Phase 3 (CAL-02/03/05); the reset only removes events, never creates them |
| `events.get` | OPT-OUT | Not needed — the tag lookup returns the ids; Phase 3 owns the 409 → `events.get` fallback |
| `events.update` / `events.patch` | OPT-OUT | Out of scope — the reset deletes demo events; it never mutates any event |
| `events.move` | OPT-OUT | Not needed — no event is relocated between calendars |
| `freebusy.query` | OPT-OUT | Owned by Phase 3 (CAL-01) and exercised by Phase 7's conflict detection; the reset makes no availability decision |
| `calendarList` / `calendars` | OPT-OUT | Not needed — only A's `primary` calendar is ever addressed |
| `acl` | OPT-OUT | Explicitly out of scope — the reset never changes calendar sharing or permissions |
| `settings` | OPT-OUT | Not needed — no calendar setting is read or written |
| `channels.watch` (push notifications) | OPT-OUT | Not needed — the reset is a one-shot CLI script, not a subscriber |
| `colors` | OPT-OUT | Not needed — cosmetic, unrelated to cleanup |

**Auth:** reuses `getCalendarClient(userId)` from `lib/calendar/google-client.ts`
(Phase 3) with organizer A's stored refresh token. No new scope is requested and
no second OAuth path is built (D-02).
