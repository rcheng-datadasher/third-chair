# API Coverage — Google Calendar API v3

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Phase 3 (Calendar Client) integrates the three methods the demo needs; everything else is opted out with a reason.
> Client: `googleapis@180.0.0` (already installed in Phase 1), OAuth2 refresh-token auth as user A.

| capability | decision | reason |
|---|---|---|
| freebusy.query | INTEGRATE | CAL-01: A's busy blocks for an HKT window (`+08:00` offsets), `lib/calendar/freebusy.ts` `checkConflicts` |
| events.insert | INTEGRATE | CAL-02/03/05: Meet link via `conferenceDataVersion: 1` + `conferenceData.createRequest`, invite via `sendUpdates: "all"`, demo tag via `extendedProperties.private.demo`, deterministic `id` (CAL-04) |
| events.get | INTEGRATE | CAL-04: 409 duplicate-id fallback returns the existing event as success |
| oauth2 tokeninfo | INTEGRATE | Scope check of A's refresh token before any Calendar call (`lib/calendar/smoke.ts`); logs the scope list only |
| events.list | OPT-OUT | not needed yet — Phase 10 cleanup (DMO-01) lists `privateExtendedProperty=demo=true` events |
| events.delete | OPT-OUT | not needed yet — Phase 10 cleanup (DMO-01) deletes demo-tagged events |
| events.patch | OPT-OUT | not needed — events are never edited after approval in the demo |
| events.update | OPT-OUT | not needed — events are never edited after approval in the demo |
| events.move | OPT-OUT | not needed — always the organizer's `primary` calendar |
| events.quickAdd | OPT-OUT | not needed — the agent supplies structured start/end, no free-text parsing by Google |
| events.instances | OPT-OUT | not needed — no recurring events |
| events.import | OPT-OUT | not needed — no private copies of external events |
| events.watch | OPT-OUT | not needed — no push notifications; approval is Slack-driven |
| channels.stop | OPT-OUT | not needed — no watch channels are opened |
| calendarList | OPT-OUT | not needed — always `calendarId: "primary"` |
| calendars | OPT-OUT | not needed — no secondary calendars created or read |
| acl | OPT-OUT | not needed — no sharing or permission changes |
| settings | OPT-OUT | not needed — timezone fixed to `Asia/Hong_Kong` in code |
| colors.get | OPT-OUT | not needed — no event colouring |
