# Phase 4: Approval Bridge - Research

**Researched:** 2026-09-11
**Domain:** Slack `block_actions` approve/reject handler (organizer claim, idempotent Calendar write) + Trigger.dev v4 task wrapper (`prismaExtension`, `AGENT_TRANSPORT` env switch)
**Confidence:** HIGH for Trigger.dev v4 config/SDK shapes and Slack retry/payload facts (official docs fetched this session); MEDIUM for the organizer-claim SQL recommendation (derived from locked D-07 SQL + Phase 1's already-verified schema, not independently executed against a live DB this session — same caveat Phase 1's research carried for `db push`); this phase's 25-minute box means every claim below is deliberately narrow, not exploratory.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Merge window (plan 04-01 opener)**
- D-01: First plan merges Phase 2's and Phase 3's branches into `develop`, then `develop` into `main`, before any Phase 4 code. `/ponytail-review` runs on the merged diff (DMO-05 discipline; the requirement itself is satisfied at Phase 7).
- D-02: Never hand-merge `bun.lock`: resolve `package.json`, then regenerate with `bun install`. `prisma db push` only after the merge, and only if `schema.prisma` changed.
- D-03: Bolt is the sole instance, restarted from `main` after the merge. Kill Phase 2's worktree Bolt first.

**Approve handler (APR-01, APR-02, APR-03, APR-04)**
- D-04: Approval is ordinary backend code in `lib/` (e.g. `lib/slack/approve.ts`), called from the Bolt `block_actions` listener. It never goes through a Next.js route, a Trigger.dev task, a graph resume, or a model call.
- D-05: The handler's first line after `ack()` reads a real proposal id from the button `value`. It never assumes in-memory correlation with whatever process posted the card. Action ids `approve_proposal` / `reject_proposal`, button `value` = proposal id.
- D-06: Sequence: read row → conditional organizer claim → create real event → persist event id/links + `status = confirmed` → `chat.update` the card using the **stored** `card_channel` + `card_ts`.
- D-07: The organizer claim is the conditional UPDATE from APR-02 / PROJECT.md: `UPDATE "Proposal" SET organizer_user_id = $me WHERE id = $p AND organizer_user_id IS NULL RETURNING id`. No row back renders an "already scheduled" state, not an error.
- D-08: A click on Approve by a user who is not the token-holding organizer must not attempt a Calendar write.
- D-09: Exactly one Calendar event per proposal under double-click or Slack redelivery (APR-03). Never cut this guard or the organizer claim.
- D-10: The confirmed card shows the calendar event link and the Meet link (APR-04). A second Approve click changes nothing further.
- D-11: Reject is handled on the same `block_actions` shape: status `dismissed`, card updated in place to a dismissed chip. No Calendar call.

**Trigger.dev task + transport (AGT-11, APR-05)**
- D-12: A Trigger.dev task in `lib/agent/tasks/` wraps `runAgent()` as a thin wrapper (no logic of its own), runs on the **Node** runtime (no `runtime: "bun"`), and posts the card with a plain `WebClient` (`@slack/web-api`), never Bolt.
- D-13: The task's idempotency key is derived from team + channel + ts (AGT-11).
- D-14: `trigger.config.ts` includes `prismaExtension` from `@trigger.dev/build` from the start, with `dirs` pointing at `lib/agent/tasks/`. Verify with one trivial Prisma-touching trigger **before** building on it.
- D-15: `AGENT_TRANSPORT=trigger|inline` switches inside `dispatchAgentRun` (the Phase 1 seam) with an env change and restart only. `inline` calls the same `runAgent()` directly from Bolt.
- D-16: CLI run command is `bunx trigger.dev@4.5.16 dev` (Node via shebang; never `--bun`). After the first run, `git status` must show no untracked `package-lock.json`.
- D-17: Exit check both ways: `AGENT_TRANSPORT=trigger` shows a run in the Trigger.dev dashboard and posts a card; `AGENT_TRANSPORT=inline` with the CLI stopped and Bolt restarted still posts a card. Under time pressure, verify `inline` once, not twice.

**File ownership**
- D-18: Owns: `lib/agent/tasks/`, `trigger.config.ts`, the approve/reject logic in `lib/` (e.g. `lib/slack/approve.ts`), and the real handler bodies registered in `lib/slack/bolt.ts`.
- D-19: Must not touch: `lib/agent/graph.ts` internals (still the Phase 1 stub), `app/**`, `components/**`.
- D-20: Named overlap: `lib/slack/bolt.ts` listener registration and card block builders. Phase 2 wrote the skeleton; this phase wires the real handler body into the same point and extends, never restructures.

**Processes**
- D-21: Bolt (sole instance), Trigger.dev dev CLI (first run of the build), Postgres :5432. Next.js is not needed.

**Repo rules that bind this phase**
- D-22: One Prisma client per process (`lib/db.ts` singleton); never constructed inside a listener or task body. `lib/config.ts` is the only `process.env` reader **for application runtime code** (Phase 1's `prisma.config.ts` already established the precedent that build/CLI-only config files — this phase's `trigger.config.ts` is the same category — read `process.env` directly, not through `lib/config.ts`, because Bolt/Next.js/Trigger.dev's task runtime never imports `trigger.config.ts`). TSDoc on every function. Biome only (`biome check --write` before done). No test files. bun only. Exit criteria are hand checks under a minute.

### Claude's Discretion

- What the non-organizer / already-claimed clicker sees (ephemeral reply vs. card state), within D-07/D-08.
- How the "not token-holder" guard is expressed (claim SQL condition vs. pre-read), as long as D-07's conditional claim remains the tiebreak.
- Task id, file names inside `lib/agent/tasks/`, and how `trigger.config.ts` obtains the project ref.
- Whether `createCalendarEvent`'s return shape needs extending for `htmlLink` (Phase 3 owns the original).
- Whether Bolt uses `app.client` or the `lib/slack/client.ts` singleton for `chat.update`.

### Deferred Ideas (OUT OF SCOPE)

- Real LangGraph graph replacing the `runAgent` stub: Phase 5.
- Re-checking the calendar at approve time and conflict alternatives: Phase 7 (CFL-*).
- Expiry sweep re-triggering the agent: v2 (SCL-03).
- DMO-05 requirement sign-off: Phase 7 (last merging phase).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| APR-01 | Approving runs ordinary backend code: read row, claim organizer, create event, update card — no graph resume/model call | §Architecture Patterns "Approve handler sequence"; confirms Bolt is the only process that can ever receive `block_actions` (no Trigger.dev round trip possible even if attempted) |
| APR-02 | Organizer claimed via conditional `UPDATE ... WHERE organizer_user_id IS NULL RETURNING id`; no row back → "already scheduled" state, not error | §Common Pitfalls "Organizer claim + token guard"; keeps D-07's SQL byte-identical, adds the token-holder gate as a pre-read, not a WHERE-clause change |
| APR-03 | Double-click / Slack redelivery creates exactly one Calendar event | §Common Pitfalls "409 fallback is sufficient"; CAL-04's deterministic id + 409→`events.get` already covers this, confirmed against Google's documented 409 semantics |
| APR-04 | Confirmed card shows calendar event link + Meet link | §Code Examples "Extracting htmlLink/meetLink from events.insert response" |
| APR-05 | `AGENT_TRANSPORT=trigger\|inline` switches with env + restart only | §Architecture Patterns "dispatchAgentRun branching" (already fixed in Phase 1; this phase only fills in the `trigger` branch's task) |
| AGT-11 | Trigger.dev task (Node runtime) wraps `runAgent()`, idempotency key from team+channel+ts, posts card with plain `WebClient` | §Standard Stack "Trigger.dev v4 exact shapes"; §Common Pitfalls "Import-graph hazard" |
</phase_requirements>

## Summary

This phase has two independent halves, and both are narrow, mechanical wiring against interfaces Phases 1–3 already fixed — nothing here calls for new architecture. The Approve handler (D-04–D-11) is plain backend code with one real subtlety: **the "only A can write" guard (D-08) and the "first-approver wins" tiebreak (D-07) are two separate checks, and the plan must not try to fold them into one SQL WHERE clause.** D-07's conditional UPDATE is locked verbatim in CONTEXT.md and downstream code (APR-02's hand check) expects it unchanged; the token-holder guard belongs in a pre-read before the UPDATE ever runs, not inside it. This resolves cleanly and costs no extra query — the handler already needs to read the Proposal row and the clicking user's `google_refresh_token` before it can create a Calendar event, so the guard is just "check the token is non-null before attempting the claim," not a new database round trip.

The Trigger.dev half (D-12–D-17, AGT-11) is v4-current and every shape below was fetched from Trigger.dev's own docs this session, not carried over from Phase 1's STACK.md verbatim (STACK.md verified *versions*, not *config shapes*). Three points matter for the planner: (1) `prismaExtension({ mode: "modern" })` takes **zero other options** for a Prisma 7 `prisma-client` generator — no `schema`, no `directUrlEnvVarName` — which is simpler than STACK.md's "modern mode" mention implied and removes a whole category of misconfiguration; (2) `prisma generate` is **not** run automatically by the extension in modern mode — the task-wrapper plan must call it (or confirm Phase 1's `postinstall` already covers it) before the first trivial-trigger smoke test, or the smoke test fails for a config reason that looks like a code bug; (3) the CLI (`trigger.dev`) and SDK (`@trigger.dev/sdk`) package versions must match exactly — both are already pinned to `4.5.16` in STACK.md, so this is a "don't drift" note, not new work.

The import-graph hazard the orchestrator flagged (task bundle must never import `lib/slack/bolt.ts`) is real and already implicitly enforced by Phase 1's `dispatchAgentRun`/`runAgent` seam — `ARCHITECTURE.md` (read this session, already a canonical ref) states this exact boundary: `runAgent()` posts cards via `@slack/web-api`'s standalone `WebClient`, never via Bolt's `app.client`. The task file (`lib/agent/tasks/*.ts`) only ever imports `runAgent` from `lib/agent/graph.ts`; nothing in that import chain reaches `lib/slack/bolt.ts`. This phase's job is to keep that true when wiring the task, not to invent a new boundary.

**Primary recommendation:** Keep D-07's UPDATE exactly as locked; gate entry to it with a pre-read of the clicking user's `google_refresh_token` (not a SQL condition change). For the Trigger.dev task, use `prismaExtension({ mode: "modern" })` with no other options, verify `prisma generate` has run, and prove the whole task→Prisma→card path with one trivial trigger before writing the real approve-adjacent logic on top.

## Top Risks for the Planner

1. **Token guard before the claim, and no status write on a lost claim.** B (no Google token) must be stopped by a pre-read of the clicker's `google_refresh_token` before D-07's UPDATE runs. When the claim returns no row, compare `organizer_user_id` to the clicker: same user means an idempotent retry (continue to the 409-safe insert), a different user means ephemeral "already scheduled" feedback only. Never write `already_scheduled` onto a pending Proposal: it would lock out a pre-set organizer (a Phase 5 default-to-addressee would trigger exactly that).
2. **The Prisma user lookup needs the compound key** `team_id_slack_user_id` (FND-08 `@@unique([team_id, slack_user_id])`), so the listener must pass `body.team.id`.
3. **Transitive import hazard.** Nothing reachable from `runAgent` may import `lib/slack/bolt.ts` or `@slack/bolt`; a Bolt `App` constructed inside the Trigger.dev worker opens a second Socket Mode connection that steals clicks.
4. **Trigger.dev bundle resolution.** `prismaExtension({ mode: "modern" })` does not run `prisma generate`, and the task's transitive graph relies on `@/` alias resolution by the bundler. The D-14 trivial trigger must import through `@/lib/db` and run one query before the real wrapper is trusted.
5. **APR-04 link extraction.** `createCalendarEvent` (Phase 3) may return only `{ eventId, meetLink }`. The confirmed card also needs `htmlLink`, and the Meet link must tolerate `null` while conference creation is `pending`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Approve/Reject click handling | Bolt process (Socket Mode, only receiver of `block_actions`) | Database (conditional claim) | Slack routes interactive payloads exclusively to the open WebSocket; no other tier can ever receive this, confirmed in ARCHITECTURE.md |
| Organizer claim + token guard | Backend domain logic (`lib/slack/approve.ts`) | Database | Ordinary code per APR-01 — never a graph resume, never model-gated |
| Calendar event creation on approve | Backend (`lib/calendar/create-event.ts`, Phase 3-owned) called from the approve handler | Google Calendar API | Approve handler calls Phase 3's function; this phase does not reimplement Calendar logic |
| Card update to confirmed/dismissed | Backend (`lib/slack/update-proposal-card.ts`, Phase 2-owned) called via `chat.update` | Bolt process (holds token) or standalone `WebClient` | Either client works (both hold the same bot token); Bolt's `app.client` is already in scope inside the listener |
| Watched-message → agent dispatch (trigger transport) | Trigger.dev task (`lib/agent/tasks/`) or inline call from Bolt | Database (Prisma via `prismaExtension`) | `dispatchAgentRun`'s env-flag branch (Phase 1-fixed) decides which; this phase implements the `trigger` branch's task and verifies both |
| Idempotent task dispatch | Trigger.dev SDK (`idempotencyKeys.create`) | — | A second, independent idempotency layer from `dedupe_key` — stops a duplicate *task run*, not a duplicate *Proposal row* (ARCHITECTURE.md, already established) |

No capability here is misassigned relative to PROJECT.md/ARCHITECTURE.md's fixed process split.

## Standard Stack

All packages this phase touches are already pinned and npm-verified in `.planning/research/STACK.md` (2026-09-11) — `@trigger.dev/sdk`, `trigger.dev`/`@trigger.dev/build`, `@prisma/adapter-pg`, `pg` (STACK.md + Phase 1's `04`-relevant additions), `@slack/web-api` (Phase 1 addition). **No new packages are introduced by this phase.** The Package Legitimacy Audit below is a reconfirmation, not a new check, since this phase installs nothing new — it only *invokes* what Phase 1/STACK.md already pinned.

### Core (already pinned, re-stated for this phase's use)

| Library | Version | Purpose in Phase 4 | Source |
|---------|---------|---------------------|--------|
| `@trigger.dev/sdk` | 4.5.16 `[VERIFIED: npm registry — STACK.md, 2026-09-11]` | `task()`, `tasks.trigger()`, `idempotencyKeys.create()` | STACK.md |
| `trigger.dev` (CLI) | 4.5.16 `[VERIFIED: npm registry — STACK.md]` | `bunx trigger.dev@4.5.16 dev` — **must match SDK version exactly** `[CITED: trigger.dev/docs/upgrading-packages, fetched this session]` | STACK.md + this session |
| `@trigger.dev/build` | 4.5.16 `[VERIFIED: npm registry — STACK.md]` | `prismaExtension` from `@trigger.dev/build/extensions/prisma` | STACK.md |
| `@prisma/adapter-pg` | 7.10.0 `[VERIFIED: npm registry — Phase 1 RESEARCH.md]` | Task's Prisma client construction, same singleton pattern as `lib/db.ts` | Phase 1 RESEARCH.md |
| `@slack/web-api` | 8.1.1 `[VERIFIED: npm registry — Phase 1 RESEARCH.md]` | Standalone `WebClient` the task uses to post cards (D-12) | Phase 1 RESEARCH.md |

### Installation

No new `bun add`. If `git status` after merging Wave A shows `package.json` already has these (it will, per Phase 1 D-21 + STACK.md), skip straight to config/code.

## Package Legitimacy Audit

No new external packages are installed in this phase — Phase 1 already ran `gsd_run query package-legitimacy check` against every package this phase invokes (`@trigger.dev/sdk`, `@trigger.dev/build`, `@prisma/adapter-pg`, `pg`, `@slack/web-api`), all verdict `OK` or `SUS`-with-low-risk-note (the `SUS` flags were the legitimacy checker's "too-new" heuristic reading latest-*publish*-date on official monorepos, not actual risk — see Phase 1 RESEARCH.md's audit table). Nothing here supersedes that audit.

**Packages removed due to `[SLOP]` verdict:** none (this phase, and Phase 1's prior audit).
**Packages flagged as suspicious `[SUS]`:** none new this phase.

## Architecture Patterns

### System Architecture Diagram

```
Watched-channel message (or seeded hand-fire)
      │
      ▼
Bolt process: dispatchAgentRun(input)  [Phase 1 seam, unchanged]
      │
      ├─ AGENT_TRANSPORT=inline ──────────────► runAgent(input) [same fn, same process]
      │
      └─ AGENT_TRANSPORT=trigger
            │ tasks.trigger("run-agent", input, { idempotencyKey })
            ▼
      Trigger.dev dev CLI (own process, Node runtime)
      lib/agent/tasks/run-agent.ts  — THIN: run: (input) => runAgent(input)
            │ imports ONLY lib/agent/graph.ts's runAgent
            │ (never imports lib/slack/bolt.ts — see Pitfall "Import-graph hazard")
            ▼
      runAgent() [Phase 1 stub body, unchanged this phase]
            │ posts card via lib/slack/client.ts (@slack/web-api WebClient)
            ▼
      Slack card appears — Approve / Reject buttons, value = proposal id
            │  user clicks Approve
            │  block_actions ALWAYS arrives on Bolt's Socket Mode WebSocket
            │  (Trigger.dev has no path to receive this — confirmed, ARCHITECTURE.md)
            ▼
Bolt process: app.action("approve_proposal", handleApproveProposal)
  1. ack() FIRST
  2. read proposal id from action.value (D-05)
  3. read Proposal row (status, card_channel, card_ts)
  4. if status !== "pending": no-op / re-render current state (idempotent double-click, APR-03)
  5. read clicking Slack user's User row (google_refresh_token)
  6. if no refresh_token: respond() ephemerally "not the organizer", STOP — no Calendar write (D-08)
  7. UPDATE "Proposal" SET organizer_user_id=$me WHERE id=$p AND organizer_user_id IS NULL
     RETURNING id                                                         (D-07, byte-identical)
  8. no row back AND organizer_user_id === $me  → idempotent retry, go to step 10 with existing event
     no row back AND organizer_user_id !== $me  → ephemeral "already scheduled by <@organizer>" to the clicker, STOP
                                                  (no Proposal.status write — see correction in the code below)
  9. row back → createCalendarEvent(proposal)  [Phase 3, deterministic id + 409 fallback = APR-03]
 10. persist calendar_event_id/calendar_html_link/meet_link, status="confirmed"
 11. chat.update(proposal.card_channel, proposal.card_ts, confirmedBlocks)  — STORED channel/ts, not payload's
```

Reading this diagram end to end proves APR-01 through APR-05 and AGT-11 without inventing anything beyond what Phases 1–3 already fixed.

### Approve handler: organizer claim + token guard (APR-02, D-07, D-08)

**Recommended pattern — pre-read gate, SQL condition unchanged:**

```typescript
// lib/slack/approve.ts
// Source: D-07 (CONTEXT.md, literal SQL); PROJECT.md "Exactly one organizer writes to Calendar"
import { prisma } from "../db";
import { createCalendarEvent } from "../calendar/create-event";
import { updateProposalCard } from "./update-proposal-card";

export async function handleApproveProposal(proposalId: string, teamId: string, clickerSlackUserId: string) {
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return; // unknown id — nothing to do

  if (proposal.status !== "pending") {
    // Idempotent: re-render whatever state already exists (confirmed/dismissed/already_scheduled)
    await updateProposalCard(proposal.card_channel, proposal.card_ts, proposal);
    return;
  }

  // User is @@unique([team_id, slack_user_id]) (FND-08), so findUnique needs the compound key —
  // pass body.team.id through from the listener.
  const clicker = await prisma.user.findUnique({
    where: { team_id_slack_user_id: { team_id: teamId, slack_user_id: clickerSlackUserId } },
  });
  if (!clicker?.google_refresh_token) {
    // D-08: no Calendar write attempted. Ephemeral feedback via respond()/postEphemeral —
    // the card itself is untouched (Claude's Discretion: card state vs. ephemeral, either is fine).
    return;
  }

  // D-07, byte-identical to CONTEXT.md's locked SQL — the token guard above is what makes this safe,
  // NOT a change to this WHERE clause.
  const claimed = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "Proposal" SET organizer_user_id = ${clicker.id}
    WHERE id = ${proposalId} AND organizer_user_id IS NULL
    RETURNING id
  `;

  if (claimed.length === 0) {
    // No row back: either someone else already claimed it, or THIS user already claimed it
    // (re-click/retry — must be idempotent per APR-03).
    const current = await prisma.proposal.findUnique({ where: { id: proposalId } });
    if (current?.organizer_user_id !== clicker.id) {
      // "Already scheduled" is a UI state for THIS clicker, not a Proposal status write.
      // [ORCHESTRATOR CORRECTION] Do NOT set Proposal.status = already_scheduled here: if the
      // organizer was pre-set (e.g. Phase 5 defaults it to the addressee) and has not approved yet,
      // that write would flip the row off "pending" and the real organizer's click would then hit the
      // status !== "pending" early return — no event would ever be created. Tell the clicker
      // ephemerally (respond({ response_type: "ephemeral", replace_original: false, text })) and
      // leave the shared card alone.
      return;
    }
    // else: fall through — this clicker IS the organizer, re-run the idempotent create below.
  }

  const { eventId, meetLink, htmlLink } = await createCalendarEvent(proposal); // Phase 3: 409-safe
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

**Why this shape:** D-07's SQL stays exactly as CONTEXT.md locked it (no cast, no extra condition), satisfying the letter of APR-02's hand check. The token guard runs *before* the UPDATE is ever attempted, so B's click never reaches the claim at all — D-08 is satisfied without touching the claim SQL. Idempotent re-click by the real organizer is handled by re-reading `organizer_user_id` after a failed claim and comparing to the clicker's own id, rather than trying to make the UPDATE itself return something useful on a no-op retry (Postgres `UPDATE ... RETURNING` returns zero rows whether the mismatch is "someone else" or "already me" — the SQL alone cannot distinguish these, hence the extra read).

**Prisma 7 raw query note:** `$queryRaw` tagged-template parameterization is unaffected by Prisma 7's `prisma.config.ts`/`directUrl` changes (those changes are CLI/datasource-config only, confirmed by Phase 1's research — the query API itself is unchanged). No enum cast is needed here because this specific UPDATE only touches `organizer_user_id` (not `status`); the `status` transitions in this handler go through `prisma.proposal.update()` (normal Prisma Client call), which handles the `ProposalStatus` enum automatically. Recommend keeping it this way — folding `status` into the same raw UPDATE would need an explicit `::"ProposalStatus"` cast for no benefit.

### Trigger.dev v4: `trigger.config.ts` exact shape

```typescript
// trigger.config.ts
// Source: trigger.dev/docs/config/config-file, trigger.dev/docs/config/extensions/prismaExtension
// (both fetched 2026-09-11) — [CITED]
import { defineConfig } from "@trigger.dev/sdk";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF!, // literal "proj_..." ref also valid; env-var form
                                              // matches this phase's "env-only swap" spirit and is
                                              // Trigger.dev's own documented example shape
  dirs: ["./lib/agent/tasks"],
  // runtime: default is Node — do NOT set runtime: "bun" (D-12, STACK.md "What NOT to Use")
  build: {
    extensions: [
      prismaExtension({ mode: "modern" }), // Prisma 7 + prisma-client generator: ZERO other options
                                            // needed — no schema path, no directUrlEnvVarName
    ],
  },
});
```

**Verified this session (not carried over from STACK.md, which only verified the *version*):**
- `maxDuration` is **optional** — no default task timeout is forced by omitting it `[CITED: trigger.dev/docs/config/config-file]`.
- `dirs` is exactly "directories where your tasks are located" — `["./lib/agent/tasks"]` matches D-14's locked location `[CITED: same]`.
- Default runtime is Node — confirms D-12's "no `runtime: 'bun'`" needs no override, it's already the default `[CITED: same]`.
- `prismaExtension({ mode: "modern" })` for a Prisma 7 `prisma-client`-generator project takes **no other required options**; modern mode does **not** run `prisma generate` for you — it must already have been run (Phase 1's `postinstall` script already does this per D-12/Phase 1 D-12, so this phase does not need a new step, only to **confirm** it ran) `[CITED: trigger.dev/docs/config/extensions/prismaExtension]`.
- CLI (`trigger.dev`) and SDK (`@trigger.dev/sdk`) versions must match; the `dev` command runs an update check and warns on mismatch — both are already pinned to `4.5.16`, so this is a "don't let a stray `bun add` drift one of them" note, not a task `[CITED: trigger.dev/docs/upgrading-packages]`.

### Trigger.dev v4: task + external trigger + idempotency (AGT-11)

```typescript
// lib/agent/tasks/run-agent.ts — THIN WRAPPER (D-12: "no logic of its own")
// Source: trigger.dev/docs/triggering (fetched this session)
import { task } from "@trigger.dev/sdk";
import { runAgent } from "../graph"; // ONLY import from lib/agent/** — never lib/slack/bolt.ts
import type { RunAgentInput } from "../../../types/agent";

export const runAgentTask = task({
  id: "run-agent",
  run: async (input: RunAgentInput) => runAgent(input),
});
```

```typescript
// lib/agent/dispatch.ts — Phase 1 seam, this phase fills in the "trigger" branch
// Source: trigger.dev/docs/triggering + trigger.dev/docs/idempotency (fetched this session)
import { tasks, idempotencyKeys } from "@trigger.dev/sdk";
import type { runAgentTask } from "./tasks/run-agent"; // type-only import — keeps task code
                                                         // out of Bolt's bundle (D-12's boundary)
import { runAgent } from "./graph";
import { config } from "../config";

export async function dispatchAgentRun(input: RunAgentInput): Promise<void> {
  if (config.agent.transport === "inline") {
    await runAgent(input);
    return;
  }
  // AGT-11: idempotency key from team + channel + ts
  const key = await idempotencyKeys.create([input.message.teamId, input.message.channelId, input.message.ts]);
  await tasks.trigger<typeof runAgentTask>("run-agent", input, { idempotencyKey: key });
}
```

**Verified this session:**
- Import path is `@trigger.dev/sdk` (not `/v3`) for v4 `[CITED: trigger.dev/docs/triggering]`.
- `import type { runAgentTask } from "./tasks/run-agent"` is the documented pattern for calling `tasks.trigger<typeof T>` — it keeps the task's *code* out of the calling process's bundle while preserving payload type-checking `[CITED: same]`.
- The SDK **auto-configures from `TRIGGER_SECRET_KEY`** in `process.env` — no explicit `configure({ secretKey })` call is required if that env var is set, which Phase 1's `lib/config.ts` already declares (per D-15 there) `[CITED: trigger.dev docs, WebSearch-aggregated this session]`. This means Bolt's process (which imports `dispatchAgentRun`) does not need a new `lib/config.ts` read for this — the SDK reads `process.env.TRIGGER_SECRET_KEY` itself, which is a **documented exception** to "lib/config.ts is the only `process.env` reader," same category as `trigger.config.ts` above. If the planner wants strict adherence to that rule anyway, an explicit `configure({ secretKey: config.trigger.secretKey })` call at Bolt startup is one extra line and removes the ambiguity — **recommended**, since it costs nothing and keeps the repo rule literally true rather than "true except for one SDK's internal default."
- `idempotencyKeys.create([...])` produces a 64-character hash; called **outside** a task run (i.e., from Bolt), the "run"/"attempt"/"global" scope distinction collapses — there is no parent run id to scope against, so passing an array of strings behaves consistently regardless of scope option `[CITED: trigger.dev/docs/idempotency]`. Default TTL is **30 days** `[CITED: same]` — comfortably longer than this build's 4h15m window, so a redelivered Slack event hours later (unlikely, but the mechanism exists) still dedupes.
- **`bunx trigger.dev@4.5.16 dev`** is confirmed as the correct invocation (matches D-16). **[ORCHESTRATOR CORRECTION, verified 2026-09-11]** `trigger dev` automatically loads `.env`, `.env.development`, `.env.local`, `.env.development.local`, `dev.vars` (later overrides earlier), and "these variables are available to your tasks via `process.env`. You don't need to use the `--env-file` flag for this automatic loading" `[CITED: trigger.dev/docs/deploy-environment-variables]`. Phase 1 D-16's single untracked root `.env` is therefore visible to local task runs, provided the CLI is started from the repo root. Keep the one `!!process.env.DATABASE_URL` log in the first trivial trigger as a cheap confirmation, not as an expected failure. (Dashboard env vars only matter for deployed runs, which this build never does.)
- **Secret key without breaking the config-module rule:** `import { configure } from "@trigger.dev/sdk"; configure({ secretKey: config.trigger.secretKey })` `[CITED: trigger.dev/docs/management/overview]`. The docs note the call can be omitted when `TRIGGER_SECRET_KEY` is set, but calling it once (e.g. at the top of `dispatch.ts` or Bolt startup) keeps "`lib/config.ts` is the only `process.env` reader" literally true in app code. `trigger.config.ts` is a root config file read by the CLI, not app code; a literal `proj_...` ref there is not a secret and avoids a `process.env` read entirely — either is acceptable.
- **`tasks.trigger` from the Bolt process runs under bun** (`bun lib/slack/bolt.ts`). It is an HTTPS call to the Trigger.dev API; no bun-specific failure is documented, but it has not been exercised under bun `[ASSUMED]`. If it fails, `AGENT_TRANSPORT=inline` is the built-in escape hatch, and the first `trigger`-mode message in plan 04-02 is the check.
- Whether `bunx trigger.dev dev` resolves tsconfig `@/` path aliases or writes a stray `package-lock.json` in a bun project: **no official doc found this session confirms or denies either** — both are `[ASSUMED]`, carried forward unchanged from PITFALLS.md's Pitfall 7 (already a canonical ref, already the source of D-16's `git status` check). This phase's plan should treat D-16's post-run `git status` check as the actual verification, not something this research can pre-answer.

### Import-graph hazard: task bundle must never import `lib/slack/bolt.ts`

**Confirmed, `[VERIFIED: .planning/research/ARCHITECTURE.md, read this session]`:**
> "Because `trigger/extract-and-propose.ts` is a thin wrapper around `lib/agent/graph.ts`'s `runAgent()`, the fallback costs one `if`, not a parallel implementation" and "`@slack/web-api` is also a declared dependency of `@slack/bolt` itself, but the Trigger.dev task runs in its own bundled process/worker and should not rely on a transitive/hoisted dependency it doesn't declare — add `@slack/web-api` directly ... instantiate one `WebClient` singleton in `lib/slack/client.ts`."

The module boundary this phase must preserve: `lib/agent/tasks/run-agent.ts` → `lib/agent/graph.ts` (`runAgent`) → `lib/slack/client.ts` (standalone `WebClient`, used inside `postProposalCard`/`updateProposalCard`, which live in `lib/slack/`). **Nothing in that chain imports `lib/slack/bolt.ts`.** Constructing a Bolt `App` with Socket Mode inside the Trigger.dev worker would open a second WebSocket connection under the same app token — Slack's own docs (already cited in PITFALLS.md Pitfall 1, re-confirmed by this session's `block_actions`-redelivery search below) load-balance across every open connection with no guaranteed routing, so a stray second connection isn't just wasteful, it can silently steal `block_actions` clicks meant for the real Bolt process. **Recommendation:** the task file should have zero import of anything under `lib/slack/bolt.ts` or `@slack/bolt` itself — only `@slack/web-api`. A grep on `lib/agent/tasks/` alone is not enough, because the hazard is transitive (`runAgent` imports `lib/slack/*`). `lib/slack/bolt.ts` is an entry point and nothing should import it, so the check is: `grep -rn "slack/bolt\|@slack/bolt" lib types utils --include=*.ts | grep -v "^lib/slack/bolt.ts"` returns nothing, apart from any Bolt-only listener files that bolt.ts itself imports (those must not be imported by `runAgent`'s chain either).

### Anti-Patterns to Avoid

- **Changing D-07's UPDATE WHERE clause to add the token check inline.** Breaks the literal-SQL contract CONTEXT.md and APR-02's hand check assume; use the pre-read gate instead (see Code Examples above).
- **Reading `channel`/`ts` from the `block_actions` payload instead of the stored `card_channel`/`card_ts`.** Already locked by D-02/D-06/PITFALLS.md; this phase is exactly where that discipline pays off.
- **Putting real logic in `lib/agent/tasks/run-agent.ts`.** If the task file does anything beyond calling `runAgent()`, the `inline` transport becomes a second implementation to keep in sync — exactly the drift ARCHITECTURE.md warns against.
- **Importing `@slack/bolt` or `lib/slack/bolt.ts` anywhere in the Trigger.dev task's import graph.** See Import-graph hazard above.
- **Starting `trigger dev` outside the worktree root that holds `.env`.** The CLI auto-loads root `.env` files for tasks (Pitfall 3), but only from where it runs.
- **Writing `status = already_scheduled` onto a still-pending Proposal when a claim fails.** It locks out the real organizer (see the corrected handler).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Task-run deduplication | A custom "have I seen this team+channel+ts before" table | `idempotencyKeys.create([teamId, channelId, ts])` + `{ idempotencyKey }` on `tasks.trigger` | Trigger.dev's own 30-day-TTL idempotency layer already exists (AGT-11's exact requirement); this is a one-line call, not a table |
| Distinguishing "already claimed by someone else" vs "already claimed by me" | A second boolean column or a lock table | Re-read `organizer_user_id` after a failed conditional UPDATE and compare to the clicker's id | One extra `findUnique`, no schema change, no new concurrency primitive |
| Calendar-event double-insert protection | A Postgres advisory lock or a `SELECT ... FOR UPDATE` around the Calendar call | CAL-04's deterministic id + Google's own 409 response | Already built in Phase 3; APR-03 rides on it for free — see Common Pitfalls below |

**Key insight:** every guard this phase needs (organizer tiebreak, token gate, dup-event prevention) is already provided by either D-07's locked SQL, one extra read, or Phase 3's existing idempotent insert — nothing here earns a new abstraction.

## Common Pitfalls

### Pitfall 1: Folding the token guard into APR-02's WHERE clause silently breaks the literal-SQL hand check

**What goes wrong:** A plan that writes `UPDATE ... WHERE id = $p AND organizer_user_id IS NULL AND EXISTS (SELECT 1 FROM "User" ...)` still satisfies APR-02's *behavior* but no longer matches the SQL CONTEXT.md's D-07 quotes verbatim — if a later reviewer or the plan-checker diffs against the locked string, it looks like a deviation.

**Why it happens:** It's the "obvious" one-query solution, and it does work — but it trades a byte-identical locked artifact for a marginally shorter diff.

**How to avoid:** Gate entry with a pre-read (see Code Examples) — same number of round trips in practice (the handler already needs the clicking user's refresh token for the Calendar call itself), zero SQL-string drift.

**Warning signs:** Code review shows the D-07 UPDATE string doesn't match CONTEXT.md's quoted SQL character-for-character.

**Phase to address:** This phase, the approve handler's first draft.

---

### Pitfall 2: `prismaExtension({ mode: "modern" })` still needs `prisma generate` run manually — D-14's "verify before building" is not optional

**What goes wrong:** The task fails at Calendar-adjacent runtime (not build time) with a missing-query-engine error identical in shape to Phase 1's Pitfall 6, because modern mode's extension does **not** run `prisma generate` for you — it only bundles what's already generated.

**Why it happens:** `[CITED: trigger.dev/docs/config/extensions/prismaExtension]` — legacy mode auto-generates; modern and engine-only modes require the generated client to already exist before the build/dev step runs.

**How to avoid:** Confirm Phase 1's `postinstall` script (D-12, Phase 1 CONTEXT.md) already ran `prisma generate` as part of `bun install` after the Wave-A merge — it should have, since `package.json`'s `postinstall` runs on every `bun install`, including the merge's regenerated lockfile install (D-02). Don't add a second explicit `prisma generate` step unless the trivial-trigger smoke test (D-14) actually fails.

**Warning signs:** The first trivial trigger's task run shows a Prisma engine-not-found error in the Trigger.dev dashboard/CLI output, not a Calendar or Slack error.

**Phase to address:** This phase, immediately after writing `trigger.config.ts`, before writing the real `run-agent` task body — exactly what D-14 already schedules.

---

### Pitfall 3: Starting `trigger dev` from the wrong directory hides the root `.env`

**What goes wrong:** `lib/config.ts` Zod-parses `process.env` at import, so a task whose env is missing fails at import with a config error, not a Prisma error.

**Why it happens:** `trigger dev` auto-loads `.env`/`.env.local` etc. and exposes them to tasks via `process.env` `[CITED: trigger.dev/docs/deploy-environment-variables — orchestrator-verified]`, but only from where the CLI runs. A worktree without its own untracked `.env` (Phase 1 D-16) has nothing to load. (The `--env-file` flag is unrelated: it only hydrates the CLI process.)

**How to avoid:** Start the CLI from the repo root of the worktree that has `.env`; log `!!process.env.DATABASE_URL` once in the first trivial trigger.

**Warning signs:** The first run fails with a Zod config parse error listing missing keys.

**Phase to address:** This phase, as part of D-14's "verify with one trivial trigger" step.

---

### Pitfall 4: 409 fallback is sufficient for APR-03 — no extra status guard needed, but a deleted/cancelled event id still 409s

**What goes wrong (nothing, if built as designed):** CAL-04's deterministic base32hex event id plus 409→`events.get` fallback (Phase 3, already built) is architecturally sufficient for APR-03's "exactly one event under double-click or redelivery" — a second concurrent insert attempt with the same derived id returns HTTP 409 "The requested identifier already exists," which the existing fallback already treats as success `[CITED: developers.google.com/workspace/calendar/api/guides/errors, WebSearch-confirmed this session]`. No additional application-level lock or status guard is needed beyond what Phase 3 already ships — adding one would be an unrequested abstraction per the ladder.

**The one operationally relevant note (not a bug, a rehearsal/reset gotcha):** deleting a Calendar event does **not** free its id for immediate re-insertion — Google's own behavior keeps the id reserved for some period after deletion, so a reset-and-rehearse cycle that deletes a demo event and then re-inserts with the *same deterministic id* (same proposal id, unchanged) will 409 even though the event is gone, and the 409-fallback's `events.get` call will then find nothing (the event is genuinely deleted) — this is a real failure mode for `prisma/reset-demo.ts` (Phase 10) if it ever reuses a proposal id after deleting its calendar event, `[CITED: WebSearch aggregation of googleapis/google-api-python-client#210 + Google's own error-handling guide, MEDIUM confidence — no single official doc states the retention window length]`. **Not actionable in Phase 4** (Phase 10 owns the reset script) — flagged here only because APR-03's exit check ("double-click creates exactly one event") could be misread as covering this case; it doesn't, and doesn't need to for this phase's scope.

**Phase to address:** No action needed in Phase 4. Flag forward to Phase 10's researcher.

---

### Pitfall 5: `respond()`/`response_url` is short-lived and message-replacing by default — don't use it for the confirmed-card update

**What goes wrong:** A plan that uses `body.response_url` (via `respond()`) to deliver the confirmed-state update instead of `chat.update` would, by Slack's default `response_url` behavior, **replace** the original message rather than update it in place the way `chat.update` guarantees, and `response_url` is time-limited (short-lived per-payload webhook) — using it for the permanent confirmed-state transition is the wrong tool even though it's tempting since it's already in `body`.

**Why it happens:** Both `respond()` and `chat.update` can technically mutate a message, and `body.response_url` is right there in the payload, making it look like the "simpler" option since it needs no `channel`/`ts` arguments.

**How to avoid:** Use `chat.update(channel, ts, blocks)` (via `app.client` or `lib/slack/client.ts`) with the **stored** `card_channel`/`card_ts` for the confirmed/dismissed/already-scheduled transitions (D-06). Reserve `respond()`/`response_url` only for the ephemeral "you're not the organizer" feedback (Claude's Discretion item, D-08) — a short-lived, non-persistent notice is exactly what `response_url` is for.

**Warning signs:** The confirmed card appears as a *new* message instead of the original card updating in place — the on-stage symptom PITFALLS.md's "`chat.update` needs the exact channel + ts" pitfall already names, now specifically attributable to using `response_url` instead.

**Phase to address:** This phase, approve/reject handler — pick `chat.update` for state transitions, `respond()` only for the ephemeral non-organizer notice.

---

### Pitfall 6: Slack does not "retry" `block_actions` the way Events API does — but Socket Mode load-balancing across stray connections produces the same symptom

**What goes wrong:** A double-click or an accidental second Bolt process can each produce what looks like "Slack retried my button click," but the mechanisms differ: interactive payloads (including `block_actions`) require an explicit `ack()` within 3 seconds. The "up to three retries at ~1-minute intervals" pattern is documented for the Events API; whether Socket Mode re-sends an un-acked interactive envelope is **not** confirmed by a primary source `[LOW — orchestrator downgraded from CITED]`. Treat redelivery as possible and make the handler idempotent regardless (it is), distinct from a genuine user double-click. Separately, if a second Bolt process is accidentally running (PITFALLS.md Pitfall 1, already canonical), the *same* click can be delivered to either connection with no guaranteed pattern, which can look like "nothing happened" in the terminal you're watching even though the flow completed elsewhere.

**Why it happens:** Two different failure classes producing the same visible symptom (a click that seems to do nothing, or seems to fire twice).

**How to avoid:** `ack()` first, always (already locked, D-05 implies it via the existing pattern). The organizer-claim UPDATE plus the pre-status-check (`if (proposal.status !== "pending")`) in the Code Examples above already makes the handler idempotent to either failure class — a true redelivery or a genuine double-click both hit the same "already confirmed, re-render" branch.

**Warning signs:** A click produces no visible change in the terminal you're watching, but the card *did* update — check the other Bolt terminal per PITFALLS.md's existing guidance, not a new check.

**Phase to address:** This phase's approve handler, already covered by the idempotent design above — this pitfall confirms *why* that design is necessary, not a new requirement.

## Code Examples

### Confirmed card blocks: extracting `htmlLink` and the Meet link from `events.insert`'s response (APR-04)

```typescript
// lib/calendar/create-event.ts return-shape addition (Phase 3-owned file; this phase
// only needs the return shape, doesn't touch the insert call itself — Claude's Discretion item)
// Source: developers.google.com Events resource reference + WebSearch this session [CITED]
interface CreatedEvent {
  eventId: string;
  htmlLink: string;   // top-level `htmlLink` field on the Event resource — the "open in Calendar" link
  meetLink: string | null; // prefer conferenceData.entryPoints.find(e => e.entryPointType === "video")?.uri
                            // over the older top-level `hangoutLink` field — entryPoints is the
                            // documented mechanism conferenceDataVersion=1 populates; hangoutLink is a
                            // legacy convenience alias that is not guaranteed present for every
                            // conference type, entryPoints is
}

function extractMeetLink(event: calendar_v3.Schema$Event): string | null {
  const videoEntry = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video");
  return videoEntry?.uri ?? event.hangoutLink ?? null;
}
```

**Conference creation can be asynchronous — check before trusting the link is populated:** `[CITED: developers.google.com Events resource + WebSearch this session]` conference creation via `createRequest` is asynchronous; the authoritative signal is `event.conferenceData.createRequest.status.statusCode`, which can be `"pending"` before settling to `"success"` (or `"failure"`). In practice, for a same-request synchronous-feeling `events.insert` call this resolves fast enough that Phase 3's existing "open the created event and verify a `meet.google.com` link" hand check (already in PITFALLS.md Pitfall 8, already canonical) is the correct verification — **if the insert response's `conferenceData` is present but `entryPoints` is empty and `createRequest.status.statusCode === "pending"`,** the confirmed card should not claim the Meet link is ready; the exit criterion is Phase 3's, not new to Phase 4, but the approve handler's `htmlLink`/`meetLink` extraction should tolerate a null Meet link rather than throwing (`meetLink: string | null` above, not `string`).

### `block_actions` payload fields used by this phase

```typescript
// Source: docs.slack.dev/reference/interaction-payloads/block_actions-payload/ (fetched this session)
// Already-cited BlockButtonAction type narrowing from Phase 1 RESEARCH.md applies unchanged.
const action = (body as BlockButtonAction).actions[0];
const proposalId = action.value;                 // D-05
const clickerSlackUserId = body.user.id;          // needed for the token-guard pre-read
const teamId = body.team.id;                      // not required by this handler directly,
                                                     // but confirms multi-tenant scoping is available
                                                     // if a later phase needs it
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `bunx trigger.dev@4.5.16 dev` resolves tsconfig `@/*` path aliases inside the task bundle (Trigger.dev bundles with esbuild, which honours tsconfig `paths`) | Standard Stack / Code Examples | Medium — relative imports in the task file alone do NOT sidestep this: `runAgent` → `lib/slack/*` → `lib/db.ts`/`lib/config.ts` in Phases 1–3 will use `@/` aliases, so the whole transitive graph depends on alias resolution. The D-14 trivial trigger must import through the real chain (at least `@/lib/db`) so a resolution failure surfaces before the real task body |
| A2 | `bunx trigger.dev@4.5.16 dev` may still write a stray `package-lock.json` in this bun-only repo, per PITFALLS.md's existing (unconfirmed-this-session) claim | Standard Stack "Trigger.dev v4" | Low — D-16 already mandates a `git status` check after the first run regardless of whether this assumption is true, so the mitigation exists either way |
| A3 | Deleted Calendar events retain their custom id for some period, blocking immediate re-insertion with the same deterministic id | Common Pitfalls "409 fallback" | Low for Phase 4 (not actionable here); Medium for Phase 10 if not flagged forward — flagged explicitly above |
| A4 | `idempotencyKeys.create([...])` called from Bolt (outside any task run) behaves identically regardless of the (unset) scope option, per the aggregated WebSearch summary rather than a single official doc quote | Code Examples "Trigger.dev v4: task + external trigger" | Low — even if scope behaves subtly differently than described, AGT-11 only requires *a* stable key derived from team+channel+ts, which the `[teamId, channelId, ts]` array input produces regardless of scope nuance |

## Open Questions

1. ~~Does `trigger dev` pick up the root `.env`?~~ **Resolved (orchestrator, 2026-09-11):** yes, `.env`/`.env.local`/etc. are auto-loaded and visible to tasks via `process.env` `[CITED: trigger.dev/docs/deploy-environment-variables]`.
2. **Does `bunx trigger.dev@4.5.16 dev` drop a `package-lock.json` in this bun repo?** Unconfirmed either way; D-16's `git status` check after the first run is the verification, and Phase 1 already gitignores the file.
3. **Where does the "already scheduled" feedback go?** Recommended: ephemeral `respond()` to the clicker, no Proposal status write (see the corrected handler). The planner may choose otherwise, but must not write `already_scheduled` onto a still-pending Proposal.

## Environment Availability

Same caveat as Phase 1's research: this session runs on Windows (Git Bash), not the target WSL Ubuntu machine, so `bunx trigger.dev@4.5.16 dev`, the live Trigger.dev dashboard round trip, and the actual `git status` check after first run could not be executed here. All Trigger.dev config/SDK *shapes* above were fetched from official docs this session (`[CITED]`), not executed against a real project in this sandbox.

| Dependency | Required By | Available (this session) | Fallback |
|------------|------------|-----------|----------|
| Trigger.dev account/project + CLI login | AGT-11, APR-05 (`trigger` transport) | Not probed (wrong OS); PROJECT.md states "Trigger.dev account + project + CLI login" was pre-confirmed 2026-09-11 | `AGENT_TRANSPORT=inline` is the built-in fallback this phase itself wires (D-15/D-17) |
| Live Slack workspace (Socket Mode) | Approve/Reject handler | Not probed (wrong OS); pre-confirmed per PROJECT.md | None needed — this is the demo's primary path |
| A's Google refresh token (valid, unexpired) | Calendar write in the approve handler | Not probed; PROJECT.md's pre-window checklist covers re-verification | None — B's click correctly no-ops per D-08 if this is ever absent, which is also the intended behavior for B |

**Missing dependencies with no fallback:** none beyond what the pre-window checklist (ROADMAP.md, already canonical) already covers.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Slack's Socket Mode token-based auth (library-internal) and Trigger.dev's `TRIGGER_SECRET_KEY` are both platform-managed; no app-level login in this phase |
| V3 Session Management | No | No sessions created |
| V4 Access Control | Yes | The organizer-claim + token-guard pattern above **is** this phase's access-control surface: only the token-holding user's click can ever reach a Calendar write (D-08); the conditional UPDATE (D-07) is the authorization check for "who gets to be organizer" |
| V5 Input Validation | Yes | `action.value` (proposal id) is looked up via `findUnique` — an unknown/malformed id resolves to "no proposal found," not a crash; no other external input is parsed in this phase |
| V6 Cryptography | Yes (flagged, not fixed — same as Phase 1) | `google_refresh_token` continues to be read in plaintext from Postgres (Phase 1's accepted, documented shortcut); this phase adds no new plaintext-secret handling beyond reading the existing column |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| A non-organizer forcing a Calendar write by clicking Approve | Elevation of Privilege | Token-guard pre-read (D-08), enforced before any Calendar API call — see Code Examples |
| Double-click / Slack redelivery creating two Calendar events | Tampering (unintended duplicate state) | CAL-04's deterministic event id + Google's 409 response (Phase 3, unchanged) + this phase's idempotent handler design |
| SQL injection via the raw `$queryRaw` organizer-claim UPDATE | Tampering | Prisma's tagged-template `$queryRaw` parameterizes all interpolated values automatically (`${clicker.id}`, `${proposalId}` are bound parameters, not string-concatenated) — already flagged for Phase 4 by Phase 1's own research, confirmed here as the actual implementation |
| A second Trigger.dev worker accidentally holding a Bolt Socket Mode connection | Spoofing / event hijack | Import-graph discipline (task never imports `lib/slack/bolt.ts` or `@slack/bolt`) — see dedicated pitfall above |

## Sources

### Primary (HIGH confidence)
- `trigger.dev/docs/config/config-file` (WebFetch, official docs, fetched 2026-09-11) — `defineConfig` shape, `maxDuration` optionality, `dirs`, default runtime
- `trigger.dev/docs/config/extensions/prismaExtension` (WebFetch, official docs, fetched 2026-09-11) — mode options, modern-mode minimal config, manual-`prisma generate` requirement
- `trigger.dev/docs/triggering` (WebFetch, official docs, fetched 2026-09-11) — `tasks.trigger()`, type-only task import pattern, import path `@trigger.dev/sdk`
- `trigger.dev/docs/idempotency` (WebFetch, official docs, fetched 2026-09-11) — `idempotencyKeys.create()` scope semantics, 30-day default TTL
- `trigger.dev/docs/cli-dev-commands` (WebFetch, official docs, fetched 2026-09-11) — `--env-file` CLI-process-only scoping
- `trigger.dev/docs/upgrading-packages` (WebSearch, official docs domain, fetched 2026-09-11) — CLI/SDK version-match requirement
- `docs.slack.dev/reference/interaction-payloads/block_actions-payload/` (WebFetch, official docs, fetched 2026-09-11) — `body.user.id`, `body.team.id`, `body.actions[].value`, `response_url` fields
- `developers.google.com/workspace/calendar/api/guides/errors` (WebSearch, official docs, fetched 2026-09-11) — 409 "identifier already exists" semantics
- `.planning/research/ARCHITECTURE.md` (Read, in-repo, this session) — import-graph boundary, quoted verbatim in "Import-graph hazard"
- `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md` and `01-RESEARCH.md` (Read, in-repo, this session) — D-07 literal SQL, `BlockButtonAction` type pattern, schema field names

### Secondary (MEDIUM confidence)
- WebSearch aggregation on Slack `block_actions` retry behavior (multiple sources: Slack's own acknowledgement-requirements documentation summarized via a third-party blog, cross-referenced against `docs.slack.dev`) — the "up to three additional retries, ~1-minute intervals" figure
- WebSearch aggregation on deleted-Calendar-event id retention (`googleapis/google-api-python-client#210` plus Google's error guide) — no single official doc states the exact retention window

### Tertiary (LOW confidence)
- None new this phase beyond what's already logged in the Assumptions table above (A1/A2 carry PITFALLS.md's existing unconfirmed status forward, not a new low-confidence claim this session invented).

## Metadata

**Confidence breakdown:**
- Trigger.dev v4 config/SDK shapes: HIGH — every shape fetched from official docs this session, cross-checked against STACK.md's already-verified versions
- Organizer-claim + token-guard SQL pattern: MEDIUM-HIGH — logically derived from D-07's locked, verbatim-quoted SQL and Phase 1's already-verified schema field names; not executed against a live DB this session (wrong OS)
- Google Calendar response-field extraction (`htmlLink`/`entryPoints`/`hangoutLink`): MEDIUM — official field names confirmed via WebSearch summarizing the official reference, not a direct doc fetch with the full schema table
- Slack `block_actions` retry semantics: MEDIUM — aggregated WebSearch, not a single canonical doc quote for the exact retry count/interval

**Research date:** 2026-09-11
**Valid until:** This build window only (Sat 12 Sep 2026) — re-verify Trigger.dev config shapes if reused beyond this hackathon, since v4 is GA but still evolving.
