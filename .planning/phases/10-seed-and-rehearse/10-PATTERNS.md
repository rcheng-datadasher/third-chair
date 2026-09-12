# Phase 10: Seed-and-Rehearse - Pattern Map

**Mapped:** 2026-09-11
**Files analyzed:** 1 (new)
**Analogs found:** 1 / 1 (all planned, none on disk — repo has no application source yet)

**IMPORTANT:** The repo currently contains no `lib/`, `prisma/`, or `app/` source files — only `.planning/`. Every "analog" below is a **planned (not yet on disk) — grep-verify at execution time** code sketch from an upstream phase's RESEARCH.md/CONTEXT.md, not a file that exists in the tree today. Before writing `prisma/reset-demo.ts`, grep the actual files once Phases 1 and 3 have executed:
- `grep -n "export const prisma" lib/db.ts`
- `grep -n "export const config" lib/config.ts`
- `grep -n "export" lib/calendar/*.ts`
- `cat prisma/schema.prisma` (for real field/table names — team_id, calendar_event_id, FKs)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `prisma/reset-demo.ts` | utility/script (CLI, one-shot) | batch (DB delete + external API list/delete) | Planned `lib/db.ts` (Prisma singleton contract) + planned `lib/config.ts` (typed env contract) + planned `lib/calendar/google-client.ts` (OAuth client contract) + planned `prisma/seed.ts` (sibling script under `prisma/`, same run shape, opposite direction) | role-match (planned sketch, no on-disk analog exists) |

## Pattern Assignments

### `prisma/reset-demo.ts` (utility/script, batch)

**Analog 1 — Prisma singleton import contract**
Source: `.planning/phases/01-foundation-hardcoded-round-trip/01-RESEARCH.md` "Code Examples", `lib/db.ts` sketch (planned, not yet on disk).

```typescript
// lib/db.ts (planned shape — Prisma 7 requires a driver adapter, no bare constructor)
import { PrismaClient } from "../generated/prisma"; // prisma-client provider, custom output path
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

`reset-demo.ts` must `import { prisma } from "../lib/db";` — never construct a second `PrismaClient`. Confirm the actual relative path and export name once `lib/db.ts` exists (Phase 1).

---

**Analog 2 — Config module contract (no direct `process.env` reads)**
Source: `.planning/phases/01-foundation-hardcoded-round-trip/01-RESEARCH.md` "Code Examples", `lib/config.ts` sketch (planned).

```typescript
// lib/config.ts (planned shape — sole process.env reader project-wide)
import { z } from "zod";

const envSchema = z.object({ /* SLACK_TEAM_ID, GOOGLE_* , DATABASE_URL, ... */ });
const env = envSchema.parse(process.env);

export const config = {
  slack: { teamId: env.SLACK_TEAM_ID /* exact key TBD, grep once written */ },
  // ...
};
```

`reset-demo.ts` must scope every `deleteMany` with `config.slack.teamId` (or whatever the real key ends up being) — never read `process.env` directly (repo rule + V4 access-control note in RESEARCH.md).

---

**Analog 3 — Calendar OAuth client contract**
Source: `.planning/phases/03-calendar-client/03-RESEARCH.md` "Code Examples" (`getCalendarClient(userId: string)`), plus the orchestrator correction noted in that phase's context (planned, not yet on disk).

```typescript
// lib/calendar/google-client.ts (planned shape — exact export name/signature TBD)
export async function getCalendarClient(userId: string): Promise<calendar_v3.Calendar> {
  // builds an OAuth2 client from the user's stored refresh token via lib/config.ts creds,
  // returns an authenticated googleapis calendar client
}
```

`reset-demo.ts` should call this factory for A's account rather than building a second OAuth2 flow inline. **Open question (RESEARCH.md A1):** if Phase 3 only exports fully-wrapped `checkConflicts`/`createCalendarEvent` and no bare client factory, fall back to constructing `google.auth.OAuth2` directly inside `reset-demo.ts` using `lib/config.ts`'s credentials — still D-02-compliant since it's the one file this phase owns, and is ~5 lines, not a second module. Grep `lib/calendar/**` for the actual export surface before deciding.

---

**Analog 4 — Sibling script run-shape (`prisma/seed.ts`)**
Source: `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md` D-13 (planned — `prisma/seed.ts` seeds identity rows + one fixture Proposal at Thu 17 Sep 2026 15:00, using `bun prisma/seed.ts` as its run command, no `package.json` script entry).

`reset-demo.ts` is `prisma/seed.ts`'s mirror-image sibling: same directory, same "plain script invoked via `bun prisma/<name>.ts`, no new `package.json` script" convention, opposite direction (delete instead of insert). Match its `main().catch().finally(prisma.$disconnect())` run shape once that file exists — grep it for the exact top-level structure Phase 1 actually used, and mirror it rather than inventing a divergent shape.

---

**Core pattern — reset script full shape** (own construction, RESEARCH.md "Code Examples", already correct and ready to use verbatim modulo real field names):

```typescript
// prisma/reset-demo.ts — run with: bun prisma/reset-demo.ts
import { prisma } from "../lib/db";
import { config } from "../lib/config";
// import { getCalendarClient } from "../lib/calendar/google-client"; // verify export name

async function findDemoEvents(calendar): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await calendar.events.list({
      calendarId: "primary",
      privateExtendedProperty: ["demo=true"],
      showDeleted: false,
      pageToken,
    });
    for (const event of res.data.items ?? []) if (event.id) ids.push(event.id);
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return ids;
}

async function deleteDemoEvents(calendar, ids: string[]): Promise<number> {
  let deleted = 0;
  for (const eventId of ids) {
    try {
      await calendar.events.delete({ calendarId: "primary", eventId, sendUpdates: "none" });
      deleted++;
    } catch (err: unknown) {
      const e = err as { status?: number; code?: number | string; response?: { status?: number } };
      const status = e.status ?? e.response?.status ?? Number(e.code);
      if (status !== 410 && status !== 404) throw err; // already-gone = success (idempotent)
    }
  }
  return deleted;
}

async function main() {
  const calendar = await getCalendarClient(/* A's userId */);
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
  .catch((err) => { console.error("reset-demo failed:", err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
```

**Error handling pattern:** two independently-logged phases (Calendar cleanup, then DB `$transaction`) — never one opaque try/catch wrapping both, so a partial failure is diagnosable (RESEARCH.md "Known Threat Patterns").

**FK-safe delete order:** children (`ActionItem`, `Participant`, `Decision`) before parent (`Proposal`) — matches the general Prisma/Postgres convention of deleting leaf rows before rows they reference, independent of whether `onDelete: Cascade` is declared.

## Shared Patterns

### One Prisma client per process
**Source:** planned `lib/db.ts` (see Analog 1).
**Apply to:** `prisma/reset-demo.ts` — never `new PrismaClient()` inline.

### Sole `process.env` reader
**Source:** planned `lib/config.ts` (see Analog 2).
**Apply to:** `prisma/reset-demo.ts` — read `config.slack.teamId`, never `process.env` directly.

### `team_id`-scoped mutation (defense-in-depth, V4 access control)
**Source:** RESEARCH.md "Security Domain" table.
**Apply to:** every `deleteMany` call in `prisma/reset-demo.ts` — never a bare `deleteMany({})`.

## No Analog Found

None — the single file this phase creates has planned upstream sketches covering every part of its shape (Prisma client, config, calendar client, sibling script convention). The Calendar `events.list`/`events.delete` orchestration logic itself has no in-repo analog (nothing else in the codebase talks to Calendar yet) — that logic is taken directly from RESEARCH.md's "Code Examples" section (official Google Calendar API docs, HIGH confidence), not from a codebase analog.

## Metadata

**Analog search scope:** `.planning/phases/01-foundation-hardcoded-round-trip/`, `.planning/phases/03-calendar-client/`, `.planning/phases/10-seed-and-rehearse/`. No `Glob`/`Grep` run against `lib/`, `app/`, `prisma/` — confirmed empty (repo has no application source yet; only `.planning/`, `.claude/CLAUDE.md`, and an untracked root doc).
**Files scanned:** 2 upstream CONTEXT/RESEARCH docs (Phase 1, Phase 3) + this phase's own CONTEXT.md and RESEARCH.md.
**Pattern extraction date:** 2026-09-11
</content>
