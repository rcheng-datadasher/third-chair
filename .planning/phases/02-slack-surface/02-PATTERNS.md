# Phase 2: Slack Surface - Pattern Map

**Mapped:** 2026-09-12
**Files analyzed:** 11 new/modified
**Analogs found:** 0 in-repo / 11 in Phase 1 contract docs

## No In-Repo Codebase Exists Yet

The repo currently contains only `.planning/`, `.claude/`, and a root prompt doc — **no source code**. Phase 1 (which creates `lib/config.ts`, `lib/db.ts`, `lib/slack/*.ts` stubs, `utils/time.ts`, `types/*.ts`) is planned but not yet executed in this worktree. There is nothing to `Glob`/`Grep` for.

Consequently every "analog" below is a **contract**, not a codebase file: the stub signature Phase 1 commits to (`01-RESEARCH.md` §"Interfaces Before Implementation"), corrected by `02-RESEARCH.md`'s "Orchestrator Review Notes" (which **overrides** its own Code Examples section above it — already applied below). Treat the excerpts as the literal code to write, not inspiration from a sibling file.

## File Classification

| New/Modified File | Role | Data Flow | Contract Source | Match Quality |
|---|---|---|---|---|
| `lib/slack/bolt.ts` | config/registration | event-driven | Phase 1 stub signature table (`imports and registers listeners/actions only`) | exact (signature locked, body empty in Phase 1) |
| `lib/slack/handlers/watched-channel-message.ts` | controller (event listener) | event-driven | 02-RESEARCH "Watched-channel handler skeleton" + Orchestrator Note 4 (type) | exact |
| `lib/slack/handlers/app-mention.ts` | controller (event listener) | event-driven | 02-RESEARCH "Secondary trigger handlers" `handleAppMention`; Phase 1 D-01 `app_mention` original trigger | exact |
| `lib/slack/handlers/extract-shortcut.ts` | controller (interactive listener) | request-response | 02-RESEARCH "Secondary trigger handlers" `handleExtractShortcut` | exact |
| `lib/slack/handlers/secretary-command.ts` | controller (interactive listener) | request-response | 02-RESEARCH "Secondary trigger handlers" `handleSecretaryCommand`, corrected by Orchestrator Note 5 (no `ts`, dispatches nothing this phase) | exact (with correction) |
| `lib/slack/handlers/approve-proposal.ts` | controller (interactive listener) | request-response / CRUD | Phase 1 01-RESEARCH `handleApproveProposal` (unchanged, already real) | exact — reuse verbatim, do not fork |
| `lib/slack/handlers/reject-proposal.ts` | controller (interactive listener) | request-response / CRUD | 02-RESEARCH `handleRejectProposal`, corrected by Orchestrator Note 3 (call `updateProposalCard(channel, ts, proposal)`, 3 args) | exact (with correction) |
| `lib/slack/blocks.ts` | utility (pure builder) | transform | 02-RESEARCH `buildApprovalBlocks`/`buildConfirmedBlocks`/`buildDismissedBlocks`; Phase 1 stub table row (no `buildConflictBlocks`, D-06) | exact |
| `lib/slack/post-proposal-card.ts` | service | request-response | Phase 1 stub signature `postProposalCard(proposal): Promise<{channel,ts}>` — Phase 2 fills in real body | exact — signature frozen, don't change |
| `lib/slack/update-proposal-card.ts` | service | request-response | Phase 1 stub signature `updateProposalCard(channel, ts, proposal): Promise<void>` — Phase 2 fills in real body, MUST pass both `text`+`blocks` internally (Pitfall 4) | exact — signature frozen, don't change |
| `lib/slack/resolve-email.ts` | service | request-response | 02-RESEARCH `resolveParticipantEmail` (dual-scope `users.info`) | exact |

## Pattern Assignments

### `lib/slack/bolt.ts` (registration, event-driven)

**Contract:** Phase 1 stub table + D-17 (registration-only, no logic). Only imports handler functions and calls `app.message(...)`, `app.event("app_mention", ...)`, `app.shortcut(...)`, `app.command(...)`, `app.action("approve_proposal", ...)`, `app.action("reject_proposal", ...)`. No business logic lives here — every phase 4/5/7 appends registrations, never restructures.

```typescript
import { App } from "@slack/bolt";
import { config } from "@/lib/config";
import { handleWatchedChannelMessage } from "@/lib/slack/handlers/watched-channel-message";
import { handleAppMention } from "@/lib/slack/handlers/app-mention";
// ...one import + one app.<method>(...) registration line per handler
```

---

### `lib/slack/handlers/watched-channel-message.ts` (controller, event-driven, no ack)

**Contract:** 02-RESEARCH.md lines 281-322 ("Watched-channel handler skeleton"), typed per Orchestrator Note 4 — use `SlackEventMiddlewareArgs<"message">` (event is the `MessageEvent` union), not `GenericMessageEvent`, and import via `@/lib/config`, `@/lib/agent/dispatch`.

**Filter order** (Common Pitfall 2, exact code to copy):
```ts
if (event.channel_type !== "channel") return;
if (!config.slack.watchChannelIds.includes(event.channel)) return;
if (event.subtype !== undefined) return;
if (event.bot_id) return; // belt-and-suspenders; Bolt's ignoreSelf already drops our own posts
```
No `ack` in the destructure — D-07/Pitfall 1: event listeners are auto-acked by Bolt (`App.ts` 1144-1154, VERIFIED per Orchestrator Note 1). A compile error referencing `ack` here means the type is wrong.

Survives filter → `logger.info(...)` within 1s → `await dispatchAgentRun({...})` (same call secondary triggers use).

---

### `lib/slack/handlers/app-mention.ts`, `extract-shortcut.ts`, `secretary-command.ts` (SLK-03)

**Contract:** 02-RESEARCH.md lines 324-361, with two corrections:
- No `any` types (repo rule) — type with Bolt's exported types: `AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_mention">`, `SlackShortcutMiddlewareArgs<MessageShortcut>`, `SlackCommandMiddlewareArgs`.
- `secretary-command.ts`: `/secretary` carries no message `ts`, and `SlackMessage.ts` is a required `string` (Phase 1 type) — don't build a `dispatchAgentRun` call with `ts: undefined` (won't compile, breaks dedupe). Per Orchestrator Note 5: `await ack()`, log a line, **dispatch nothing** this phase (Phase 7's `/secretary scan` gives it a body). This is also the first thing cut under D-06.

`app_mention`/shortcut handlers: no `ack` for `app_mention` (event listener); `await ack()` as literal first statement for the shortcut handler (interactive).

---

### `lib/slack/handlers/approve-proposal.ts` (SLK-04/06)

**Contract:** Reuse Phase 1's `01-RESEARCH.md` lines 484-520 `handleApproveProposal` **verbatim** — it already exists as the Phase 1 deliverable; Phase 2 only needs `reject-proposal.ts` as its mirror. Do not fork/duplicate this file.

### `lib/slack/handlers/reject-proposal.ts` (SLK-04/06)

**Contract:** 02-RESEARCH.md lines 365-396 `handleRejectProposal`, corrected by Orchestrator Note 3: call `updateProposalCard(proposal.card_channel, proposal.card_ts, proposal)` — **3 args**, matching Phase 1's frozen stub signature (`updateProposalCard(channel, ts, proposal)`), not the 4-arg `(channel, ts, blocks, fallbackText)` shown in the uncorrected Code Examples section. `await ack()` is the literal first statement (D-07). Sets `status: "dismissed"`.

```typescript
import type { BlockButtonAction } from "@slack/bolt";
import { prisma } from "@/lib/db";
import { updateProposalCard } from "@/lib/slack/update-proposal-card";

export async function handleRejectProposal({ ack, body }: /* typed action args, no any */) {
  await ack(); // FIRST STATEMENT — D-07
  const action = (body as BlockButtonAction).actions[0];
  const proposalId = action.value;
  if (!proposalId) return;
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return;
  await prisma.proposal.update({ where: { id: proposalId }, data: { status: "dismissed" } });
  await updateProposalCard(proposal.card_channel, proposal.card_ts, proposal); // 3 args, D-11
}
```

---

### `lib/slack/blocks.ts` (SLK-05, pure builder)

**Contract:** 02-RESEARCH.md lines 423-480 `buildApprovalBlocks`/`buildConfirmedBlocks`/`buildDismissedBlocks` — use as written (field limits VERIFIED against `docs.slack.dev`). Import `formatHkt` from `@/utils/time` (Phase 1 D-08/D-10, no second formatter). Action ids `approve_proposal`/`reject_proposal`, button `value` = proposal id (Phase 1 D-03/D-09, not re-decided).

### `lib/slack/post-proposal-card.ts` / `update-proposal-card.ts` (SLK-05/06)

**Contract:** Phase 1 stub signatures are frozen (01-RESEARCH.md "Interfaces Before Implementation" table):
- `postProposalCard(proposal): Promise<{ channel: string; ts: string }>`
- `updateProposalCard(channel, ts, proposal): Promise<void>`

`update-proposal-card.ts`'s real body must pass **both** `text` and `blocks` on every internal `chat.update` call — Pitfall 4 (02-RESEARCH.md lines 251-262): `text` without `blocks` silently deletes the card's blocks. Build the status-chip blocks internally via `buildConfirmedBlocks`/`buildDismissedBlocks` based on `proposal.status`.

### `lib/slack/resolve-email.ts` (SLK-08)

**Contract:** 02-RESEARCH.md lines 484-505 `resolveParticipantEmail`, as written — in-process `Map` cache is intentional (`ponytail: in-process cache, cleared on restart`, process runs once per demo window). Requires both `users:read` and `users:read.email` scopes (Pitfall 5) — verify with one real `users.info` call before writing the real body (Orchestrator Note 7).

---

## Shared Patterns

### Ack discipline (all interactive listeners)
**Source:** 02-RESEARCH.md "Ack Discipline — the two contracts" table + Orchestrator Note 1.
**Apply to:** `approve-proposal.ts`, `reject-proposal.ts`, `extract-shortcut.ts`, `secretary-command.ts` — `await ack()` literal first statement, before any DB/network call.
**Apply the opposite to:** `watched-channel-message.ts`, `app-mention.ts` — no `ack` in the destructure at all; Bolt auto-acks Events API payloads (VERIFIED, `App.ts:1144-1154`).

### `chat.update` always passes `text` + `blocks` together
**Source:** 02-RESEARCH.md Pitfall 4, `docs.slack.dev/reference/methods/chat.update`.
**Apply to:** every call site inside `update-proposal-card.ts` — never build a `chat.update` payload with only one of the two fields.

### Stored channel/ts, never the click payload
**Source:** Phase 1 D-02/D-11, 02-RESEARCH.md Anti-Patterns.
**Apply to:** `approve-proposal.ts`, `reject-proposal.ts` — always read `proposal.card_channel`/`proposal.card_ts` from the DB row fetched via `action.value`, never `body.channel.id`/`body.message.ts`.

### Imports via `@/` tsconfig alias, no `any`
**Source:** 02-RESEARCH.md Orchestrator Review Note 4.
**Apply to:** every new file in `lib/slack/**` — `@/lib/config`, `@/lib/db`, `@/utils/time`, `@/lib/agent/dispatch`; type every Bolt handler arg with Bolt's exported middleware-args types, never `any`.

### HKT formatting
**Source:** `utils/time.ts` (Phase 1 D-08, locked D-10).
**Apply to:** `blocks.ts`'s `buildApprovalBlocks` — no second formatter, no date library.

## No Analog Found

None — every file in scope maps to an explicit Phase 1 stub signature or a Phase 2 research code example (corrected by the Orchestrator Review Notes where applicable).

## Metadata

**Analog search scope:** Entire repo (`Glob`/`Grep` would return nothing — confirmed no `lib/`, `app/`, or `types/` directories exist yet in this worktree).
**Files scanned:** 0 (no source tree present); 2 phase docs read in full (01-RESEARCH.md, 02-RESEARCH.md) plus both CONTEXT.md files.
**Pattern extraction date:** 2026-09-12
