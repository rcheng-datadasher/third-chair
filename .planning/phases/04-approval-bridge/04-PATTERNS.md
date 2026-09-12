# Phase 4: Approval Bridge - Pattern Map

**Mapped:** 2026-09-12
**Files analyzed:** 6 new/modified
**Analogs found:** 0 on-disk / 6 total — repo is still greenfield at planning time (Phases 1-3 are planned but not executed in this worktree; `git ls-files` for `lib/**` returns nothing). Every analog below is a **planned contract** from upstream phase docs, not code read off disk. Executor must `Read` the actual Phase 1/2/3 output files before extending them — RESEARCH.md sketches are the contract of record only until Phase 1-3 branches are merged (D-01), after which the real files supersede these excerpts.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/slack/approve.ts` | service (backend domain logic, called from Bolt listener) | request-response / CRUD | Phase 1's `handleApproveProposal` (01-RESEARCH.md, reused verbatim by Phase 2 per 02-PATTERNS.md) — this phase supersedes it with the token-guard + organizer-claim version | planned, not on disk — extend/replace, same file identity Phase 1/2 established |
| `lib/slack/handlers/approve-proposal.ts` (modify) | controller (interactive listener) | request-response | Phase 2's `approve-proposal.ts` skeleton (02-PATTERNS.md: "Reuse Phase 1's `handleApproveProposal` verbatim") — this phase wires the listener to call the new `lib/slack/approve.ts` logic instead | planned, not on disk |
| `lib/slack/handlers/reject-proposal.ts` (modify, if needed) | controller (interactive listener) | request-response | Phase 2's `handleRejectProposal` (02-PATTERNS.md lines 80-95, verbatim 3-arg `updateProposalCard` call already correct) — likely no change needed, confirm only | planned, not on disk |
| `lib/slack/blocks.ts` (extend) | utility (pure builder) | transform | Phase 2's `buildConfirmedBlocks`/`buildDismissedBlocks` (02-PATTERNS.md, 02-RESEARCH.md lines 423-480) — this phase adds calendar `htmlLink`/Meet link rendering to `buildConfirmedBlocks` | planned, not on disk — extend, never restructure (D-20) |
| `lib/agent/dispatch.ts` (fill trigger branch) | service | event-driven | Phase 1's `dispatchAgentRun` inline-only stub (01-PATTERNS.md: "CONTEXT.md D-04, inline-only body, no transport branching yet") — this phase fills the `trigger` branch | planned, not on disk — signature frozen, only the `trigger` branch body is new |
| `lib/agent/tasks/run-agent.ts` | service (thin task wrapper) | event-driven | none — first Trigger.dev task in repo; fully specified in 04-RESEARCH.md §"Code Examples" | no in-repo analog — new pattern, fully specified inline in RESEARCH.md |
| `trigger.config.ts` (new, root) | config | — | none — first Trigger.dev config in repo; fully specified in 04-RESEARCH.md §"Trigger.dev v4: `trigger.config.ts` exact shape" | no analog — new file, copy verbatim shape from RESEARCH.md |

## Pattern Assignments

### `lib/slack/approve.ts` (service, request-response/CRUD)

**Analog:** Phase 1's `handleApproveProposal` (01-RESEARCH.md lines 484-520, reused verbatim through Phase 2 per 02-PATTERNS.md line 74). This phase's version is the real, final body — 04-RESEARCH.md lines 182-248 is the authoritative, ready-to-copy implementation (the orchestrator already corrected an earlier draft in-line; use the version shown, not a naive first pass).

**Imports pattern** (04-RESEARCH.md lines 185-187):
```typescript
import { prisma } from "../db";
import { createCalendarEvent } from "../calendar/create-event";
import { updateProposalCard } from "./update-proposal-card";
```
(Prefer `@/lib/db`, `@/lib/calendar/create-event`, `@/lib/slack/update-proposal-card` per Phase 2's established `@/` alias convention, 02-PATTERNS.md "Imports via `@/` tsconfig alias, no `any`".)

**Core pattern — idempotent status check, then token-guard pre-read, then D-07's byte-identical claim SQL, then Calendar write, then persist + update card** (04-RESEARCH.md lines 189-247, copy verbatim):
```typescript
export async function handleApproveProposal(proposalId: string, teamId: string, clickerSlackUserId: string) {
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return;

  if (proposal.status !== "pending") {
    await updateProposalCard(proposal.card_channel, proposal.card_ts, proposal);
    return;
  }

  const clicker = await prisma.user.findUnique({
    where: { team_id_slack_user_id: { team_id: teamId, slack_user_id: clickerSlackUserId } },
  });
  if (!clicker?.google_refresh_token) {
    return; // D-08: no Calendar write; ephemeral feedback via respond() is Claude's Discretion
  }

  const claimed = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "Proposal" SET organizer_user_id = ${clicker.id}
    WHERE id = ${proposalId} AND organizer_user_id IS NULL
    RETURNING id
  `;

  if (claimed.length === 0) {
    const current = await prisma.proposal.findUnique({ where: { id: proposalId } });
    if (current?.organizer_user_id !== clicker.id) {
      return; // "already scheduled" — ephemeral only, never a Proposal.status write
    }
  }

  const { eventId, meetLink, htmlLink } = await createCalendarEvent(proposal);
  const updated = await prisma.proposal.update({
    where: { id: proposalId },
    data: {
      calendar_event_id: eventId,
      calendar_html_link: htmlLink,
      meet_link: meetLink,
      status: "confirmed",
      organizer_user_id: clicker.id,
    },
  });
  await updateProposalCard(updated.card_channel, updated.card_ts, updated);
}
```

**Do not fold the token guard into the UPDATE's WHERE clause** — D-07's SQL string must stay byte-identical to CONTEXT.md's quote (04-RESEARCH.md Pitfall 1). The `google_refresh_token` pre-read is what gates B's click, not a SQL condition change.

**Error handling:** none added here beyond the existing checks — `createCalendarEvent`'s 409 fallback (Phase 3) and the pre-read/claim sequence are the entire error surface; no `try/catch` wrapper is introduced (matches Phase 3's "explicit throw, never silent no-op" pattern, 03-PATTERNS.md).

---

### `lib/slack/handlers/approve-proposal.ts` (modify, controller)

**Analog:** Phase 2's existing skeleton, which itself reused Phase 1's `handleApproveProposal` verbatim (02-PATTERNS.md lines 22, 72-74). This phase's job is to point the listener at the new `lib/slack/approve.ts` logic and pass `body.team.id`/`body.user.id`/`action.value` through — same `ack()`-first, `BlockButtonAction` narrowing pattern as Phase 1/2 (01-RESEARCH.md `BlockButtonAction` narrowing; 02-PATTERNS.md "Ack discipline").

**Payload field extraction** (04-RESEARCH.md lines 464-472, copy verbatim):
```typescript
const action = (body as BlockButtonAction).actions[0];
const proposalId = action.value;                 // D-05
const clickerSlackUserId = body.user.id;
const teamId = body.team.id;
```

**Shared pattern — `ack()` literal first statement:** unchanged from Phase 1/2 (02-PATTERNS.md "Ack Discipline").

---

### `lib/slack/handlers/reject-proposal.ts` (modify, controller — confirm only)

**Analog:** Phase 2's `handleRejectProposal` (02-PATTERNS.md lines 76-95) — already uses the correct 3-arg `updateProposalCard(channel, ts, proposal)` signature and `status: "dismissed"`. No Calendar call (D-11). This phase likely leaves this file untouched; only confirm it still matches D-06's sequence (`ack()` → read row → update status → `chat.update` with stored channel/ts).

---

### `lib/slack/blocks.ts` (extend, utility/transform)

**Analog:** Phase 2's `buildConfirmedBlocks` (02-RESEARCH.md lines 423-480, `formatHkt` from `@/utils/time`). Extend to render `proposal.calendar_html_link` and `proposal.meet_link` (APR-04) — tolerate `meetLink === null` (04-RESEARCH.md lines 446-460, "Conference creation can be asynchronous"). Do not restructure the file or change `buildApprovalBlocks`'s action ids/values (D-20 — extend, never restructure).

---

### `lib/agent/dispatch.ts` (fill `trigger` branch)

**Analog:** Phase 1's frozen `dispatchAgentRun` signature and inline-only body (01-PATTERNS.md: "CONTEXT.md D-04"). 04-RESEARCH.md lines 301-318 gives the exact addition:

```typescript
import { tasks, idempotencyKeys } from "@trigger.dev/sdk";
import type { runAgentTask } from "./tasks/run-agent"; // type-only import
import { runAgent } from "./graph";
import { config } from "../config";

export async function dispatchAgentRun(input: RunAgentInput): Promise<void> {
  if (config.agent.transport === "inline") {
    await runAgent(input);
    return;
  }
  const key = await idempotencyKeys.create([input.message.teamId, input.message.channelId, input.message.ts]);
  await tasks.trigger<typeof runAgentTask>("run-agent", input, { idempotencyKey: key });
}
```
Type-only import of `runAgentTask` keeps task code out of Bolt's bundle (D-12's import-graph boundary). `config.agent.transport` read via `lib/config.ts` (Phase 1's singleton), not `process.env` directly.

---

### `lib/agent/tasks/run-agent.ts` (new, thin wrapper)

**Analog:** none — first Trigger.dev task in the repo. Fully specified, copy verbatim (04-RESEARCH.md lines 288-297):
```typescript
import { task } from "@trigger.dev/sdk";
import { runAgent } from "../graph"; // ONLY import from lib/agent/** — never lib/slack/bolt.ts
import type { RunAgentInput } from "../../../types/agent";

export const runAgentTask = task({
  id: "run-agent",
  run: async (input: RunAgentInput) => runAgent(input),
});
```
**Must contain zero logic beyond this call** (D-12) — if `inline` and `trigger` transports ever diverge, that's the bug, not a variation to add here.

---

### `trigger.config.ts` (new, root config)

**Analog:** none — first Trigger.dev config file. Fully specified, copy verbatim shape (04-RESEARCH.md lines 257-276):
```typescript
import { defineConfig } from "@trigger.dev/sdk";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF!,
  dirs: ["./lib/agent/tasks"],
  build: {
    extensions: [
      prismaExtension({ mode: "modern" }), // zero other options for Prisma 7 prisma-client generator
    ],
  },
});
```
Root config file reading `process.env` directly is a documented exception to "`lib/config.ts` is the only reader" (same category as `prisma.config.ts`, D-22's own carve-out) — do not route this through `lib/config.ts`. Do not set `runtime: "bun"` (default is Node, D-12).

## Shared Patterns

### Organizer claim SQL stays byte-identical
**Source:** CONTEXT.md D-07; 04-RESEARCH.md Pitfall 1.
**Apply to:** `lib/slack/approve.ts` only. Never add a WHERE-clause condition for the token guard — that lives in the pre-read.

### Stored channel/ts, never the click payload
**Source:** Phase 1 D-02/D-06/D-11; carried through Phase 2 (02-PATTERNS.md "Stored channel/ts, never the click payload").
**Apply to:** `lib/slack/approve.ts`'s call into `updateProposalCard` — always `proposal.card_channel`/`proposal.card_ts`, never `body.channel.id`/`body.message.ts`.

### `chat.update` for state transitions, `respond()`/`response_url` only for ephemeral non-organizer notices
**Source:** 04-RESEARCH.md Pitfall 5.
**Apply to:** `lib/slack/approve.ts` (confirmed/already-scheduled transitions) vs. the ephemeral "not the organizer" feedback path.

### Import-graph boundary: task code never imports Bolt
**Source:** 04-RESEARCH.md "Import-graph hazard"; ARCHITECTURE.md.
**Apply to:** `lib/agent/tasks/run-agent.ts` and everything `runAgent()` transitively imports — zero references to `lib/slack/bolt.ts` or `@slack/bolt`, only `@slack/web-api`'s standalone `WebClient` (already Phase 1's pattern in `lib/slack/client.ts`).

### Config-only env access (with root-config-file carve-out)
**Source:** Phase 1 D-15/01-PATTERNS.md "Config-only env access"; 04-RESEARCH.md D-22 clarification.
**Apply to:** `lib/agent/dispatch.ts`, `lib/agent/tasks/run-agent.ts` (application runtime code) read via `@/lib/config`. `trigger.config.ts` (root build/CLI config, same category as `prisma.config.ts`) reads `process.env` directly — documented exception, not a violation.

### `@/` alias imports, no `any`, named exports, TSDoc
**Source:** Phase 1 D-05; Phase 2 "Imports via `@/` tsconfig alias, no `any`" (02-PATTERNS.md).
**Apply to:** all new/modified files in this phase.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `lib/agent/tasks/run-agent.ts` | service (task wrapper) | event-driven | First Trigger.dev task in the repo; fully specified inline in 04-RESEARCH.md, no codebase precedent needed |
| `trigger.config.ts` | config | — | First Trigger.dev config in the repo; fully specified inline in 04-RESEARCH.md |

## Metadata

**Analog search scope:** entire tracked tree (`git ls-files`) — confirmed empty for `lib/`, `types/`, `app/`, `trigger.config.ts` at planning time; Phase 1-3 PATTERNS.md/RESEARCH.md docs used as the planned-contract source per D-01 (Wave A merge happens inside this phase, before any Phase 4 code).
**Files scanned:** 0 source files (none exist in this worktree yet); 6 phase docs read in full (04-CONTEXT.md, 04-RESEARCH.md, 01-PATTERNS.md, 02-PATTERNS.md, 03-PATTERNS.md, cross-referenced sections of 01/02/03-RESEARCH.md already embedded in those PATTERNS.md files).
**Pattern extraction date:** 2026-09-12
