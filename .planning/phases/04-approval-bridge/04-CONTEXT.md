# Phase 4: Approval Bridge - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning
**Source:** PRD Express Path (.planning/ROADMAP.md, Phase 4 section only) + REQUIREMENTS.md (APR-01..05, AGT-11) + PROJECT.md constraints

<domain>
## Phase Boundary

Serial phase on `main`, 12:40–13:05 HKT (25 min), branch `gsd/phase-4-approval-bridge`. Depends on Phase 2 (Slack Surface) and Phase 3 (Calendar Client). Runs alongside nothing.

Delivers:
1. Wave A merged: Phase 2 and Phase 3 branches into `develop`, then `develop` into `main`, with `/ponytail-review` on the merged diff.
2. The real approve/reject path: an Approve click on a Slack card reads the Proposal row, claims the organizer, creates the real Calendar event (Meet link + invite), and updates the same card in place to a confirmed state showing both links. Double-click and redelivery create exactly one event.
3. The Trigger.dev task wrapper around `runAgent()` (still Phase 1's stub body), `trigger.config.ts` with `prismaExtension`, and the `AGENT_TRANSPORT=trigger|inline` switch in `dispatchAgentRun`, verified both ways.

Requirements: APR-01, APR-02, APR-03, APR-04, APR-05, AGT-11. Not in scope: the real LangGraph graph (Phase 5), dashboard (Phase 6), conflict detection/alternatives (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Merge window (plan 04-01 opener)
- **D-01:** The first plan merges Phase 2's and Phase 3's branches into `develop`, then `develop` into `main`, before any Phase 4 code. `/ponytail-review` runs on the merged diff (DMO-05 discipline; the requirement itself is satisfied at Phase 7).
- **D-02:** Never hand-merge `bun.lock`: resolve `package.json`, then regenerate with `bun install` (PROJECT.md parallelism rules). `prisma db push` only after the merge, and only if `schema.prisma` changed.
- **D-03:** Bolt is the sole instance, restarted from `main` after the merge. Kill Phase 2's worktree Bolt first.

### Approve handler (APR-01, APR-02, APR-03, APR-04)
- **D-04:** Approval is ordinary backend code in `lib/` (e.g. `lib/slack/approve.ts`), called from the Bolt `block_actions` listener. It never goes through a Next.js route, a Trigger.dev task, a graph resume, or a model call (APR-01; PROJECT.md "re-derive, don't resume").
- **D-05:** The handler's first line after `ack()` reads a real proposal id from the button `value`. It never assumes in-memory correlation with whatever process posted the card (ROADMAP time-eater #1). Conventions inherited from Phase 1 D-03: action ids `approve_proposal` / `reject_proposal`, button `value` = proposal id.
- **D-06:** Sequence: read row → conditional organizer claim → create real event → persist event id/links + `status = confirmed` → `chat.update` the card using the **stored** `card_channel` + `card_ts` (Phase 1 D-02, SLK-06).
- **D-07:** The organizer claim is the conditional UPDATE from APR-02 / PROJECT.md: `UPDATE "Proposal" SET organizer_user_id = $me WHERE id = $p AND organizer_user_id IS NULL RETURNING id`. No row back renders an "already scheduled" state, not an error.
- **D-08:** A click on Approve by a user who is not the token-holding organizer must not attempt a Calendar write (success criterion 4; ROADMAP Flags Resolved "Only A has Google consent").
- **D-09:** Exactly one Calendar event per proposal under double-click or Slack redelivery (APR-03). Never cut this guard or the organizer claim (cut order).
- **D-10:** The confirmed card shows the calendar event link and the Meet link (APR-04). A second Approve click changes nothing further (success criterion 2).
- **D-11:** Reject is handled on the same `block_actions` shape: status `dismissed`, card updated in place to a dismissed chip. No Calendar call.

### Trigger.dev task + transport (AGT-11, APR-05)
- **D-12:** A Trigger.dev task in `lib/agent/tasks/` wraps `runAgent()` as a thin wrapper (no logic of its own), runs on the **Node** runtime (no `runtime: "bun"`), and posts the card with a plain `WebClient` (`@slack/web-api`), never Bolt.
- **D-13:** The task's idempotency key is derived from team + channel + ts (AGT-11).
- **D-14:** `trigger.config.ts` includes `prismaExtension` from `@trigger.dev/build` from the start, with `dirs` pointing at `lib/agent/tasks/`. Verify with one trivial Prisma-touching trigger **before** building on it (ROADMAP time-eater #2).
- **D-15:** `AGENT_TRANSPORT=trigger|inline` switches inside `dispatchAgentRun` (the Phase 1 seam) with an env change and restart only (APR-05). `inline` calls the same `runAgent()` directly from Bolt.
- **D-16:** CLI run command is `bunx trigger.dev@4.5.16 dev` (Node via shebang; never `--bun`). After the first run, `git status` must show no untracked `package-lock.json` (success criterion 5).
- **D-17:** Exit check both ways: `AGENT_TRANSPORT=trigger` shows a run in the Trigger.dev dashboard and posts a card; `AGENT_TRANSPORT=inline` with the CLI stopped and Bolt restarted still posts a card. Under time pressure, verify `inline` once, not twice (cut order).

### File ownership
- **D-18:** Owns: `lib/agent/tasks/`, `trigger.config.ts`, the approve/reject logic in `lib/` (e.g. `lib/slack/approve.ts`), and the real handler bodies registered in `lib/slack/bolt.ts`.
- **D-19:** Must not touch: `lib/agent/graph.ts` internals (still the Phase 1 stub), `app/**`, `components/**`.
- **D-20:** Named overlap: `lib/slack/bolt.ts` listener registration and card block builders. Phase 2 wrote the skeleton; this phase wires the real handler body into the same point and extends, never restructures.

### Processes
- **D-21:** Bolt (sole instance), Trigger.dev dev CLI (first run of the build), Postgres :5432. Next.js is not needed.

### Repo rules that bind this phase (PROJECT.md)
- **D-22:** One Prisma client per process (`lib/db.ts` singleton); never constructed inside a listener or task body. `lib/config.ts` is the only `process.env` reader. TSDoc on every function. Biome only (`biome check --write` before done). No test files. bun only. Exit criteria are hand checks under a minute.

### Claude's Discretion
- What the non-organizer / already-claimed clicker sees (ephemeral reply vs. card state), within D-07/D-08.
- How the "not token-holder" guard is expressed (claim SQL condition vs. pre-read), as long as D-07's conditional claim remains the tiebreak.
- Task id, file names inside `lib/agent/tasks/`, and how `trigger.config.ts` obtains the project ref.
- Whether `createCalendarEvent`'s return shape needs extending for `htmlLink` (Phase 3 owns the original).
- Whether Bolt uses `app.client` or the `lib/slack/client.ts` singleton for `chat.update`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` §"Phase 4: Approval Bridge": deliverables, exit criterion, cut order, time-eaters, success criteria, suggested plans. Also §"File Ownership Matrix", §"Process & Port Map", §"Flags Resolved" (Only A has Google consent; Trigger.dev wifi dependency).
- `.planning/REQUIREMENTS.md`: APR-01..05, AGT-11. Context: SLK-05/06 (card + `chat.update` contract), CAL-02..05 (event insert, invite, deterministic id + 409 fallback, demo tag).
- `.planning/PROJECT.md`: §"Agent design" (re-derive, organizer claim, calendar idempotency), §"Tech stack" (run commands, pins), §"Repo rules", §"Services, connections, environments", Key Decisions (`AGENT_TRANSPORT`, entry points in fixed folders, one Bolt process).

### Upstream phase decisions (already locked)
- `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md`: D-02 (round trip through the DB, stored card channel/ts), D-03 (action id + button value conventions), D-04 (Phase 4 creates `trigger.config.ts`, the task and transport branching), D-09/D-10/D-11 (schema columns, snake_case, status enums), D-15 (config module).
- `.planning/phases/01-foundation-hardcoded-round-trip/01-RESEARCH.md`: `approve_proposal` handler example, `BlockButtonAction` narrowing, config shape.

### Research
- `.planning/research/ARCHITECTURE.md`: "Trigger.dev Fallback: env-flag", data flow step 6 (Approve click → Bolt), interface table (`dispatchAgentRun`, task wrapper, `createCalendarEvent`).
- `.planning/research/PITFALLS.md`: Pitfall 7 (Trigger.dev CLI + stray `package-lock.json`); Moderate: `block_actions` correlation, `chat.update` channel/ts, Trigger.dev + Prisma bundling, env vars in Trigger.dev tasks.
- `.planning/research/STACK.md`: `@trigger.dev/sdk` / `@trigger.dev/build` 4.5.16, `prismaExtension` modern mode with Prisma 7.

</canonical_refs>

<specifics>
## Specific Ideas

- Exit criterion: hand-seeded proposal → Approve → real event with Meet link + B invited → same Slack card confirmed in place showing both links. Separately, a watched-channel message reaches the stub `runAgent` and posts its card via the Trigger.dev task (`AGENT_TRANSPORT=trigger`) and inline from Bolt (`AGENT_TRANSPORT=inline`, CLI stopped).
- Phase 1's seeded pending Proposal is Thu 17 Sep 2026 15:00 HKT (not the demo's Fri 18 Sep slots); it is the natural hand-seeded target for the approve check.
- Two demo users: A (Google consent) and B (no token). B's click is the success-criterion-4 check.

</specifics>

<deferred>
## Deferred Ideas

- Real LangGraph graph replacing the `runAgent` stub: Phase 5.
- Re-checking the calendar at approve time and conflict alternatives: Phase 7 (CFL-*).
- Expiry sweep re-triggering the agent: v2 (SCL-03).
- DMO-05 requirement sign-off: Phase 7 (last merging phase).

</deferred>

---

*Phase: 04-approval-bridge*
*Context gathered: 2026-09-11 via PRD Express Path*
