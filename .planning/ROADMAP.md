# Roadmap: AI Secretary

## Overview

A solo 4h15m hackathon build (Sat 12 Sep 2026, 11:15–15:30 HKT) that goes from an empty repo to a rehearsed, recorded demo of an unprompted Slack-to-Calendar approval agent. The build proves the trigger→card→button→`chat.update` shape on hardcoded data first (Phase 1), then runs two capped-at-two-concurrent waves of independent tracks (Slack∥Calendar, then Agent∥Dashboard) bridged by serial integration phases, lands the headline conflict-counter-proposal moment against a hard 14:15 cut line, and closes with mandatory rehearsal and freeze phases. Two stretch phases (S1 Graphiti, S2 CopilotKit) are honestly time-gated: both are optional, throwaway-branch, README-only in the likely case, and neither blocks anything else.

## Concurrency & Waves

```
R0  11:15-11:45  P1 Foundation                        1 terminal,  parallelization=true   (<=3 executors)
R1  11:45-12:20  P2 Slack ∥ P3 Calendar ∥ P5 Agent    3 terminals, parallelization=false  (3 executors)
    12:20-12:35  merge R1 -> main (types/, package.json, bun.lock; bun install; one db push)
R2  12:35-13:05  P4 Approval Bridge ∥ P6 Dashboard    2 terminals, parallelization=false  (2 executors)
    13:05-13:15  merge R2 -> main
R3  13:15-14:00  P7 Integrate + Conflict              1 terminal,  parallelization=true   (<=3 executors)
                 (CFL must start <=13:35)
--- 14:00  HARD STOP on new feature code; 14:00-14:30 review + refine (30 min) ---
    14:30-14:45  P10 Seed-and-Rehearse   reset + 2 runs, never cut
    14:45-15:00  P11 Freeze-and-Record   3rd run IS the recording; README final
--- 15:00  everything done; 15:00-15:30 is submission only, no repo changes ---
```

**Why this order and not the wave order (2∥3, then 4, then 5∥6).** Phase 5 has no real Phase 4
dependency: its preconditions are Phase 1 artifacts plus the pre-window rubric output, and with the
edit-modal cut it no longer writes `lib/slack/**`. Phase 6's precondition names Phase 4 but every
file it lists is a Phase 1 artifact. So Phase 5 runs in R1, which means **Phase 4 wires against
the real graph, not a stub** — the manual "wiring pass" the earlier two-round plan needed is gone.
Phase 6 runs beside Phase 4 in R2 with zero file overlap (`app/**`+`components/**` vs
`lib/slack/**`+`lib/agent/tasks/**`).

**Concurrency stays at 3.** R1 is three phases, one executor each. R0 and R3 are one phase whose
plans may fan out to three executors. Never both at once.

**Four-terminal variant (only if free RAM >= 8 GB at 11:45):** P6 joins R1 (11:45-12:20, four
executors; run terminal D inline via execute-plan.md so it is one process, not two), merge
12:20-12:40, R2 = P4 alone 12:40-13:00, R3 = P7 13:05-14:00 with its full 55 minutes (CFL by
13:35). The gain goes to Phase 7, not the buffer. If RAM drops under 2 GB during R1, stop terminal
D first — Phase 6 moves back to R2 and the three-terminal plan resumes unchanged.

**Only one Bolt consumer per round.** R1: P2 only (P3 is scripts vs Google; P5 is script/graph
invocation). R2: P4 only (P6 is Next.js on its own port). R3: P7. The blocking-human checkpoints
therefore never contend for the sole Bolt instance.

**One Postgres, one database, every worktree.** Never run `docker compose` from a worktree and
never create a per-track database. Each R1/R2 worktree's `.env` keeps main's `DATABASE_URL`
verbatim and changes only `PORT`. Consequences: one `bunx prisma db push` at a time, from the
terminal that owns the schema change, additive only (no drops/renames) so the other tracks keep
working against the same tables; main's post-merge `db push` is then a no-op check. Worktrees are
created with the Claude worktree skill (`/superpowers:using-git-worktrees`, branch
`worktree-<name>` under `.claude/worktrees/`), never by hand; `bun install` and the `.env` copy are
done by hand in each one. This is env-only, per the repo rule.

**Phases 10 and 11 run as one 30-minute block.** Rehearse twice (14:30-14:45), then the third
run is the one you screen-record (14:45-14:55), then final README (14:55-15:00). Do not rehearse
three times and *then* record — that is the 25 minutes the schedule no longer has.

**Concurrency is capped by memory, not cores.** A dry run on this machine (16 cores, 15.4 GB)
exhausted RAM and had to be killed: 0.3 GB free, 34 node/claude processes, 11 orphaned agent
worktrees. GSD's `parallelization` flag is a boolean gate with **no count limit** —
`max_concurrent_agents` is in the config template but `execute-phase` never reads it — so a 3-plan
phase spawns 3 executors, and three R1 terminals with it left on (P2, P3, P5 = 7 plans) would spawn seven.

The rule: **never more than 3 executors alive, and never stack the two parallelisms.** Solo phases
use one terminal with `parallelization=true` (<=3 executors). Waves use two terminals with
`parallelization=false` (2 executors). Toggle before every phase with
`gsd-tools query config-set parallelization <true|false>`; config.json ships `false` so the safe
setting is the default. Run `git worktree prune` between phases and stop the Next.js/Bolt
processes any phase does not need. Below ~2 GB free, clean up before starting a phase.

**Optional phases (8 and 9) — kept, not scheduled.** Both retain full RESEARCH.md, CONTEXT.md and
plans; nothing was deleted. They are simply **not in the default run order**: go straight from
Phase 7 to Phase 10. GSD will not start them on its own — `auto_advance` is off and every phase is
launched by an explicit `/gsd-execute-phase N`.

Reinstate one **only** if all three hold:

1. R2 is merged and Phase 7 has started on time (13:15) — its inputs, Phase 5's schema and
   Phase 6's dashboard, are on `main`;
2. free RAM is >= 8 GB (P7's three executors + one inline session is the 4-executor exception,
   never more), and
3. Phase 10 (seed-and-rehearse) still has its 14:30 slot intact.

**Phase 8** is the only candidate inside the window: inline `execute-plan.md` in a spare
worktree (port :3003, same database) from 13:15, hard stop **14:00** — demo-ready in the worktree
by then or `git worktree remove --force` it; merge only during the 14:00-14:30 review block, never
after. **Phase 9** is post-hackathon: 60-90 min plus Neo4j + Python (~1.5 GB) at the moment R3
has the most processes alive, and no slot exists where its dependencies are on `main` with an hour
left before 14:00. If both are ever possible, 8 before 9. Build each in a throwaway worktree;
abandon rather than finish late; nothing merges to `main` unless demo-ready. Never run either
alongside Phase 10 — rehearsal only exercises what is already on `main`. If abandoned, they are
README-only: designed, not built.

To come back later, after the hackathon: `/gsd-execute-phase 8` or `/gsd-execute-phase 9` works
unchanged — the plans are already there and no replanning is needed.

**Pre-applied scope cuts** (decided before the window, locked in each phase's CONTEXT.md):
Phase 1 README prose → headings only; Phase 2 `/secretary scan` + message shortcut → ack-and-log
stubs (handler layout and D-17 seams kept intact for Phases 4/5/7); Phase 5 medium-confidence
edit-modal path dropped; Phase 6 `/impeccable polish` loop + focus-state audit dropped. The
confidence gate, invite-by-email, demo tagging and the conflict counter-proposal are NOT cut.

A round ends when its slowest phase ends, so R1 is bounded by the slowest of P2/P3/P5.
Times assume parallel plan execution inside each phase is enabled (local bare remote — see the
restore instructions); without it phases run their plans sequentially and every box above grows.

Cap: at most two phases execute concurrently at any wall-clock moment. Only one Bolt process runs across every worktree at any time — kill it before starting it elsewhere.

## Phases

- [ ] **Phase 1: Foundation + Hardcoded Round Trip** - Repo scaffolded, schema pushed, stub interfaces fixed, hardcoded trigger→card→button→`chat.update` proven
- [ ] **Phase 2: Slack Surface** - Real watched-channel listener, Block Kit approval card, chat.update, email resolution
- [ ] **Phase 3: Calendar Client** - freebusy, event insert with Meet link, deterministic idempotent id, invite, demo tagging
- [ ] **Phase 4: Approval Bridge** - Real approve/reject path, organizer claim, Trigger.dev task wrapper, AGENT_TRANSPORT flag
- [ ] **Phase 5: Agent + Confidence Gate** - Real LangGraph extraction graph with calibrated confidence branching
- [ ] **Phase 6: Dashboard** - Action-item queue, Decision log, retro theme, live polling
- [ ] **Phase 7: Integrate + Conflict Counter-Proposal** - Full path wired live; headline two-alternative conflict card (or degraded warning)
- [ ] **Phase 8: [OPTIONAL] S2 Commitment Ledger** - CopilotKit generative UI over commitment extraction. **Not in the default run order — skip 7 → 10.** Research, context and 2 plans are kept and ready; see "Optional phases" below for when to reinstate.
- [ ] **Phase 9: [OPTIONAL] S1 Graphiti Preference Memory** - Self-hosted graph service, before/after proposal change. **Not in the default run order — skip 7 → 10.** Research, context and 2 plans are kept and ready; see "Optional phases" below for when to reinstate.
- [ ] **Phase 10: Seed-and-Rehearse** - Reset script, seeded conversation run 3×, impeccable audit
- [ ] **Phase 11: Freeze-and-Record** - Clean run recorded, final README

- [ ] **Free memory before the window.** Close Warp tabs, Notion, spare Chrome windows and any
      leftover `claude`/`node` processes from last night's dry run. Target **>=6 GB free** at 11:15
      (`free -h` in WSL, or Task Manager). The dry run died at 0.3 GB free with 34 node processes.
- [ ] **Set a `.wslconfig` memory cap** and `wsl --shutdown` once so WSL cannot take the whole machine
- [ ] **Start Postgres early** (`docker compose up -d postgres`) so its memory is already accounted for
      when you size the first phase

## Pre-Window Checklist (tonight — NOT a phase, needs no repo code)

- [ ] **Free memory before the window.** Close Warp tabs, Notion, spare Chrome windows and any
      leftover `claude`/`node` processes from last night's dry run. Target **>=6 GB free** at 11:15
      (`free -h` in WSL, or Task Manager). The dry run died at 0.3 GB free with 34 node processes.
- [ ] **Set a `.wslconfig` memory cap** and `wsl --shutdown` once so WSL cannot take the whole machine
- [ ] **Start Postgres early** (`docker compose up -d postgres`) so its memory is already accounted for
      when you size the first phase
- [ ] Slack: add `message.channels` event subscription + `channels:history` scope, reinstall the app, invite the bot to the demo channel
- [ ] Confirm repo lives on the WSL native filesystem (`~/...`), not `/mnt/c/...` — move it now if it doesn't
- [ ] Set a `.wslconfig` memory cap; `wsl --shutdown` once and confirm it took effect
- [ ] Re-verify the Google OAuth refresh token still exchanges for a fresh access token (Testing-mode tokens can expire 7 days after issue)
- [ ] One real `users.info` call against a real user id returns an `email` field on the *installed* scope set
- [ ] One real structured-output call per chosen model id (`MODEL_FAST`, `MODEL_SMART`) through the OpenAI-compatible SDK + Zod, confirmed to parse
- [ ] Run 4–5 representative sample messages through that same extraction call in a scratch script outside the repo; confirm confidence scores actually spread across high/medium/low, tune the rubric now if they don't
- [ ] 5-minute Bolt Socket Mode smoke test under bun in a scratch dir (fallback `bunx tsx`) — settles the Node-vs-bun runtime question before Phase 2
- [ ] Write down the exact per-process run command for each long-lived process (Bolt, Next.js dev, Trigger.dev CLI) so nobody reaches for `bun --bun` out of habit tomorrow

Version pins, `trigger.config.ts`'s `prismaExtension`, and gitignoring `package-lock.json` need the repo — those are Phase 1 and Phase 4 tasks, not tonight items.

## Process & Port Map

| Phase | Processes | Ports | Notes |
|---|---|---|---|
| 1 | Next.js dev, Postgres (docker) | :3000, :5432 | Bolt started only for the smoke test + round-trip proof, not left running |
| 2 [A] | Bolt (sole instance) | Socket Mode, no inbound port; workspace `.env` reserves :3001 | Kill any other worktree's Bolt first |
| 3 [B] | Ad-hoc script vs live Google APIs | workspace `.env` reserves :3002 | No long-lived server |
| 4 | Bolt (sole instance), Trigger.dev dev CLI, Postgres | :5432 | First `bunx trigger.dev@4.5.16 dev` run — check `git status` after |
| 5 [A] | Script/Trigger.dev task invocation | workspace :3001 | No long-lived server for the graph itself |
| 6 [B] | Next.js dev (separate workspace) | :3002, :5432 | Own port so it can run beside `main`'s :3000 |
| 7 | Next.js dev, Bolt (sole instance), Trigger.dev dev CLI, Postgres | :3000, :5432 | Same set as Phase 4, now carrying real traffic |
| 8 [throwaway] | Next.js dev (own workspace) | :3003, :5432 | CopilotKit installed only here |
| 9 [throwaway] | `docker compose --profile graph up` (neo4j, graph-service) | :7474, :7687, :8000 | Service itself lives in a sibling repo via `GRAPH_SERVICE_DIR` |
| 10 | Next.js dev, Bolt (sole instance), Trigger.dev dev CLI, Postgres | :3000, :5432 | Unchanged from Phase 7 |
| 11 | Same as Phase 10, only long enough to record | :3000, :5432 | Shut down once the recording is confirmed good |

## File Ownership Matrix

| Path | Owner phase(s) | Overlap note |
|---|---|---|
| `prisma/schema.prisma` | Phase 1 (created); any track may change it | Changes allowed on both tracks, serialized through `develop`: a track merges the latest `develop` before every `bunx prisma db push`, pushes, verifies, merges back to `develop`; the other track then merges `develop` and pushes again. Never two pushes at once |
| `types/` | Phase 1 (stubbed), extended by 5/6 and 2/3 | Shared — extend the Phase 1 stub, never fork a second copy |
| `lib/config.ts` | Phase 1 (created) | Any track needing a new env key extends this file, doesn't duplicate |
| `package.json` + `bun.lock` | All phases that add deps | Never hand-merge `bun.lock`; regenerate with `bun install` after resolving `package.json` |
| `app/globals.css` | Phase 6 | Theme tokens + `@theme inline` mappings live here only |
| `lib/slack/bolt.ts` (listener registration) | Phase 2 (skeleton) → Phase 4 (real approve/reject) → Phase 5 (AGT-05 edit-modal listeners, append-only) → Phase 7 (conflict + optional scan) | Named overlap across 4 phases by design — each extends, none restructures another's registrations |
| Card block builders (`lib/slack/**`) | Phase 2 → Phase 5 ("Edit & approve" variant) → Phase 7 (conflict variant) | Phase 5 and Phase 7 each add a variant beside Phase 2's approve/reject builder |
| `lib/slack/**` (rest) | Phase 2 | R1 terminal A |
| `lib/calendar/**` | Phase 3 | R1 terminal B |
| `lib/agent/**`, `lib/ai/**` | Phase 5 → Phase 7 (conflict node) → Phase 8/9 (additive, throwaway) | R1 terminal C; Phase 4 imports the graph in R2 |
| `app/**`, `components/**` | Phase 6 → Phase 8 (throwaway) | R2 terminal B |
| `trigger.config.ts`, `lib/agent/tasks/` | Phase 4 | — |
| `prisma/reset-demo.ts` | Phase 10 | New file, no other track touches it |
| `README.md` | Phase 1 (skeleton) → Phase 11 (final) | — |

## Flags Resolved

| Flag | Resolution |
|---|---|
| `LANGGRAPH_PG_URL`/`PostgresSaver` contradicting "no Postgres checkpointer" | Dropped entirely — no phase provisions it; LangGraph compiles with no checkpointer (Phase 5) |
| "No `message.channels`" vs unprompted detection | Resolved as an env allowlist (`SLACK_WATCH_CHANNEL_IDS`) — Phase 2 subscribes to `message.channels` but drops everything outside the allowlist on the handler's first line |
| User C → B (only two Slack users) | Phase 7's CFL-04 demo beat uses B's second ask (10:30 same day), not a third user |
| Graphiti "separate repo" vs `graph-service` in this repo's compose | `docker-compose.yml` (Phase 1) declares `graph-service` behind the `graph` profile, building from an env path (`GRAPH_SERVICE_DIR`) that points at the sibling repo; the Python code itself never lives in this repo |
| Folder list had no home for entry points | Resolved per PROJECT.md decision: Bolt entry `lib/slack/bolt.ts`, Trigger.dev tasks `lib/agent/tasks/`, demo reset `prisma/reset-demo.ts` — no new top-level dirs |
| Only A has Google consent | Phase 4's Approve handler must guard that the clicker is the token-holding organizer; B clicking must not attempt a token-less write — covered by APR-02's conditional claim |
| Medium-confidence "opens edit modal first" needs a `trigger_id` from a click | Phase 5/2 design: the card shows an "Edit & approve" button (not an auto-opened modal), since a modal requires a click-borne `trigger_id` |
| Trigger.dev control-plane wifi dependency | `AGENT_TRANSPORT=inline\|trigger` wired and tested both ways in Phase 4; Phase 11's recording is the actual on-stage mitigation |
| CopilotKit installed only when S2 starts | Enforced in Phase 8 — not added to Phase 1's scaffold |
| APR expiry re-trigger | Deferred to v2 (SCL-03 in REQUIREMENTS.md) — no phase builds it |
| Stretch time is effectively zero on schedule | Phase 8/9 both state the honest arithmetic inline: neither fits after the "core rehearsed" gate opens at 14:45; both are README-only in the realistic case |
| Phase 1 is the most overloaded phase | Cut order fixed in Phase 1's detail: README skeleton → headings only; stub modules → wave-A interfaces first; `graph` profile compose services → declared but untested |
| Additional: `config.json`'s `git.branching_strategy: "none"` vs this roadmap's per-phase branches | This build's hard concurrency requirement (cap-2, visible phase graph, mergeable tracks) needs a branch per phase (`gsd/phase-{N}-{slug}`) merging through `develop` into `main`, overriding the generic project default for this milestone only — Phases 10 and 11 are the explicit exception and commit directly to `main` with no new branch |

## Cut-Line Table

| Phase | Must have started by | If not started / overrun, degrades to |
|---|---|---|
| 1 | 11:15 (window open) | README → headings only; stubs → Wave-A interfaces first; `graph` compose services declared, untested |
| 2 | 11:45 | Drop `/secretary` and shortcut wiring, keep only the watched-channel path |
| 3 | 11:45 | Drop real invite email to a logged stub; keep freebusy/insert/idempotency |
| 4 | 12:35 | Verify `AGENT_TRANSPORT=inline` once, not twice; never cut organizer claim or dup-event guard |
| 5 | 11:45 | Drop the medium-confidence edit-modal step; card posts directly instead |
| 6 | 12:35 | Drop exhaustive focus-state audit; keep theme + critique/polish |
| 7 (conflict, CFL) | **13:35 hard** | Static conflict warning (CFL-05); demo leans on the confidence gate |
| 8 (S2) | **13:15**, R2 merged, free RAM >= 8 GB | Inline in a spare worktree beside Phase 7; not demo-ready in the worktree by **14:00** → abandon, README-only. Merge only in the 14:00–14:30 review block |
| 9 (S1) | never in-window | Post-hackathon only: 60–90 min + Neo4j/Python RAM, no slot with deps on `main` and an hour left. `/gsd-execute-phase 9` on Sunday |
| 10 | 14:30 (hard — never cut) | Drop rehearsal count from 3 to 2 runs; never skip the reset script |
| 11 | 14:45 | Prioritize the recording over README polish if time is nearly gone |

Stretch is abandoned, never finished late — nothing merges to `main` unless demo-ready.

## Phase Details

### Phase 1: Foundation + Hardcoded Round Trip

**Goal**: Repo scaffolded end to end and the trigger→card→button→`chat.update` round trip works on hardcoded data, before any LLM or Calendar code exists
**Mode:** mvp
**Time box**: 11:15–11:45 (30 min) — R0
**Label**: [main] — branch `gsd/phase-1-foundation` (first phase, nothing to merge from)
**Depends on**: Nothing (first phase)
**Runs alongside**: Nothing (sole phase this slot)
**Deliverables**: `CLAUDE.md` (first task) + `README.md` skeleton; Next.js+shadcn+Tailwind v4+Biome running under bun; pinned deps, `bun.lock` committed, `package-lock.json` gitignored; `docker-compose.yml` (postgres default, neo4j+graph-service behind `graph` profile, untested); `lib/config.ts` + `.env.local.example` + `.env.cloud.example`; full Prisma schema + `db push` + one real query from a `globalThis` singleton; stub modules with fixed signatures and hardcoded bodies for every cross-track interface (`types/`, `lib/agent` `runAgent`/`extractIntents`, `lib/slack` card builders/posters, `lib/calendar` freebusy/createEvent, `lib/ai/provider.ts`); hand-seeded A↔refresh-token↔HKT mapping; the hardcoded round trip itself, run inline from Bolt
**Files owned**: everything (first phase) — `CLAUDE.md`, `README.md`, `app/`, `components/`, `components/ui/`, `hooks/`, `stores/`, `lib/**` (stub-only), `utils/`, `types/`, `prisma/schema.prisma`, `docker-compose.yml`, `package.json`, `bun.lock`, `biome.json`, `postcss.config.mjs`, `.env.*.example`, `trigger.config.ts` (skeleton)
**Files must not touch**: N/A — no other track exists yet
**Named overlaps for downstream**: this phase fixes the shared/overlap files every later track must treat as such — `prisma/schema.prisma`, `types/`, `lib/config.ts`, `package.json`+`bun.lock`, `app/globals.css`, `lib/slack/bolt.ts` listener registration, card block builders
**Processes / ports**: Next.js dev `bun run dev` :3000; Postgres via `docker compose up postgres` :5432; Bolt run only for the smoke test + round-trip proof (Socket Mode, no port), not left running; `graph` profile NOT started
**Exit criterion**: Hardcoded trigger produces a card in the test channel; clicking Approve updates the same Slack message in place to a confirmed chip via `chat.update` — no LLM or Calendar call involved. Also: `bunx prisma db push` succeeds and `bun run dev` serves a page at :3000
**Cut order if overrunning**: (1) README → headings only, no prose; (2) stub modules → Wave-A (Slack/Calendar) interfaces fixed first, Wave-B stubs can wait; (3) `docker-compose` `graph` profile services → declared but untested. Never cut `CLAUDE.md`, the schema, the config module, or the hardcoded round trip itself
**Most likely time-eating failure + early detection**: Repo on `/mnt/c` breaks file-watch silently — edit one file in the first 2 minutes and time the dev-server reload; if it doesn't reload in ~2s, re-clone onto the native WSL filesystem before writing anything else. Second: `bunx prisma generate`/`db push` hangs under bun — time-box to 15s, fall back to `node node_modules/.bin/prisma generate`
**Impeccable**: none (scaffold only; structure/design work starts in Phase 6)
**Ponytail**: `/ponytail full` once, as the literal first action of the window
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05, FND-06, FND-07, FND-08, FND-09, FND-10, SLK-01, SLK-07
**Success Criteria** (what must be TRUE):

  1. `CLAUDE.md` and `README.md` exist with every required heading before any other file is opened
  2. `bun run dev` serves a page at :3000 and `bunx biome check` exits clean
  3. `docker compose up postgres` starts cleanly; `bunx prisma db push` succeeds; one real query returns from the shared Prisma client
  4. Pointing `NEO4J_URI`/`DATABASE_URL` at a placeholder cloud value and restarting needs no code edit
  5. Posting the hardcoded trigger produces a card in Slack; clicking Approve updates the same message in place to a confirmed chip

**Plans**: 3 (suggested)

- [x] 01-01-PLAN.md
- [x] 01-02-PLAN.md
- [ ] 01-03-PLAN.md

**Wave 1**

- [x] 01-01: CLAUDE.md + README skeleton + Next.js/shadcn/Tailwind/Biome scaffold under bun, pinned deps

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-02: Prisma schema + config module + env examples + docker-compose + db push smoke test

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-03: Stub modules (types/lib interfaces) + seed data + hardcoded round trip (SLK-01/07)

### Phase 2: Slack Surface

**Goal**: Real watched-channel Slack listener posts and updates a real Block Kit approval card
**Mode:** mvp
**Time box**: 11:45–12:20 (35 min) — R1, concurrent with Phases 3 and 5
**Label**: [track A] — branch `gsd/phase-2-slack-surface`
**Depends on**: Phase 1
**Runs alongside**: Phase 3 (Calendar Client) and Phase 5 (Agent) — R1, three terminals, cap 3
**Deliverables**: Bolt runtime smoke test as the literal first task (confirm tonight's bun/Node decision or flip to the fallback); watched-channel filtering with everything else dropped on the handler's first line (SLK-02); shortcut/`app_mention`/`/secretary` wiring (SLK-03); 3-second ack discipline (SLK-04); real approval card with Approve+Reject (SLK-05); `chat.update` to a status chip (SLK-06); `users.info` email resolution (SLK-08)
**Files owned**: `lib/slack/**` (bolt.ts, listeners, card builders, block-action handlers); own untracked `.env` (workspace port :3001, unused this phase)
**Files must not touch**: `lib/calendar/**`, `app/**`, `components/**`, `lib/agent/**`, `lib/ai/**`; `prisma/schema.prisma` only after merging the latest `develop` (then `bunx prisma db push`)
**Named overlaps**: `types/` (extend Phase 1's stub if a shared Slack type is needed, don't fork); `lib/config.ts` (extend, don't duplicate, if a new env key is needed)
**Processes / ports**: Bolt (`bun lib/slack/bolt.ts`, fallback `bunx tsx lib/slack/bolt.ts`) — Socket Mode, no inbound port, **the only Bolt process running anywhere**; Postgres :5432 shared, read-only against hand-seeded rows
**Exit criterion**: A real message with an obvious time+participant ask in the watched channel produces a real card with Approve/Reject; clicking either updates the same message in place to a status chip — against the still-hardcoded `runAgent` stub
**Cut order if overrunning**: Drop `/secretary` slash-command and shortcut wiring first (keep only the watched-channel path); never cut the card, update, or email resolution — they're load-bearing for every later phase
**Most likely time-eating failure + early detection**: Two Bolt processes on one app token stealing each other's events — check `ps aux | grep -i bolt` before starting; if a click "does nothing" after the smoke test passed once, check the *other* terminal's log first. Second: 3-second ack violated causing Slack retries and duplicate cards — `ack()` must be the literal first line of every listener; watch for a repeated `event_id` within seconds
**Impeccable**: none (not app/components)
**Requirements**: SLK-02, SLK-03, SLK-04, SLK-05, SLK-06, SLK-08
**Success Criteria** (what must be TRUE):

  1. A message in the watched channel reaches a Bolt log line within 1 second; a message in any other channel produces no log line at all
  2. The approval card shows title, HKT time, duration, participants, confidence, and both Approve and Reject buttons
  3. Clicking Approve or Reject replaces the buttons with a status chip on the same message (no new message appears)
  4. `ps aux | grep -i bolt` (or open terminals) shows exactly one Bolt process across every worktree

**Plans**: 2 (suggested)
**Wave 1**

- [ ] 02-01: Bolt runtime smoke test + watched-channel filter + shortcut/mention/slash wiring + ack-first pattern

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 02-02: Real approval card (Block Kit) + chat.update status chip + users.info email resolution

### Phase 3: Calendar Client

**Goal**: Calendar client creates a real event with a Meet link, invites the participant, and is idempotent on retry
**Mode:** mvp
**Time box**: 11:45–12:20 (35 min) — R1, concurrent with Phases 2 and 5
**Label**: [track B] — branch `gsd/phase-3-calendar-client`
**Depends on**: Phase 1
**Runs alongside**: Phase 2 (Slack Surface) and Phase 5 (Agent) — R1, three terminals, cap 3
**Deliverables**: One real googleapis OAuth2 client + `freebusy.query` call as the first task (smoke test before building on top); `freebusy.query` with explicit `+08:00` offsets (CAL-01); `events.insert` with Meet link via `conferenceDataVersion=1`+`createRequest.requestId` (CAL-02); invite by email with `sendUpdates:'all'` (CAL-03); deterministic base32hex event id + 409→`events.get` fallback (CAL-04); demo tagging via `extendedProperties.private.demo=true` (CAL-05)
**Files owned**: `lib/calendar/**`; own untracked `.env` (workspace port :3002, unused this phase)
**Files must not touch**: `lib/slack/**`, `app/**`, `components/**`, `lib/agent/**`; `prisma/schema.prisma` only after merging the latest `develop` (then `bunx prisma db push`)
**Named overlaps**: `types/` (shared `CalendarEvent`/`FreebusyBlock` types — extend Phase 1's stub, don't fork); `lib/config.ts` (Google env keys, extend not duplicate)
**Processes / ports**: No long-lived server; throwaway script/REPL against `lib/calendar/**` calling live Google APIs; Postgres :5432 shared, read-only against hand-seeded `Proposal` rows
**Exit criterion**: Against a hand-seeded Proposal row, an event appears on A's calendar with a visible Meet link (opened, not just HTTP-200-trusted); a second run with the same proposal id hits 409 and is treated as success, no duplicate event
**Cut order if overrunning**: Drop real invite email to a logged stub first (Approve flow still creates the event; verify the invite manually once later); keep freebusy/insert/idempotency/demo-tag
**Most likely time-eating failure + early detection**: Missing Meet link because `conferenceDataVersion=1`/`requestId` was omitted — the insert still returns 200, so it looks done; open the created event on the first real call, don't trust the HTTP status. Second: custom event id using cuid/uuid characters outside base32hex `[a-v0-9]` causes a 400 on the first deterministic-id insert — verify the id-generation helper with one real call before layering the 409-fallback on top
**Impeccable**: none
**Requirements**: CAL-01, CAL-02, CAL-03, CAL-04, CAL-05
**Success Criteria** (what must be TRUE):

  1. A `freebusy.query` for a known HKT window returns busy blocks with visible `+08:00` offsets in the logged request/response
  2. Opening the created test event in Google Calendar shows a `meet.google.com` link
  3. The invited mailbox receives a real invite email for that event
  4. Re-running the insert with the same proposal id does not create a second event

**Plans**: 2 (suggested)
**Wave 1**

- [ ] 03-01: googleapis smoke test + freebusy.query with HKT offsets

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 03-02: events.insert (Meet link, deterministic id, 409 fallback, demo tag) + invite

### Phase 4: Approval Bridge

**Goal**: Approving a proposal from Slack writes a real Calendar event and updates the card, with a working local/Trigger.dev transport switch
**Mode:** mvp
**Time box**: 12:35–13:05 (30 min) — R2, concurrent with Phase 6
**Label**: [main] — branch `gsd/phase-4-approval-bridge`
**Depends on**: Phase 2, Phase 3, Phase 5 (wires the Trigger.dev task to the real graph — no stub, no wiring pass)
**Runs alongside**: Phase 6 (Dashboard) — R2, two terminals, zero file overlap
**Deliverables**: First plan merges Phase 2's and Phase 3's branches into `develop`, then `develop` into `main`; `/ponytail-review` on the merged diff (DMO-05 discipline applies at every merging phase; the requirement itself is satisfied at Phase 7, the last merging phase). Real approve handler — read row, conditional-claim organizer (APR-02), create the real event, `chat.update` to confirmed with both links (APR-01, APR-04); double-click/redelivery safety (APR-03); `AGENT_TRANSPORT=trigger|inline` wired and tested both ways (APR-05); Trigger.dev task wrapper around `runAgent()` with `prismaExtension` in `trigger.config.ts`, idempotency key from team+channel+ts (AGT-11); first `bunx trigger.dev@4.5.16 dev` run, check `git status` for a stray `package-lock.json`
**Files owned**: `lib/agent/tasks/`, `trigger.config.ts`, the approve/reject logic in `lib/` (e.g. `lib/slack/approve.ts`) called from the Bolt `block_actions` listener — approval never goes through a Next.js route; extends `lib/slack/bolt.ts` action-handler registration with real logic
**Files must not touch**: `lib/agent/graph.ts` internals (still Phase 1's stub — real graph is Phase 5), `app/**`, `components/**`
**Named overlaps**: `lib/slack/bolt.ts` listener registration and card block builders — Phase 2 wrote the skeleton, this phase wires the real handler body into the same point (expected, sequential ownership, not a conflict)
**Processes / ports**: Bolt (sole instance, restarted from `main` after the merge — kill Phase 2's worktree Bolt first); Trigger.dev dev CLI (`bunx trigger.dev@4.5.16 dev`) started for the first time; Postgres :5432. Next.js not needed this phase
**Exit criterion**: Hand-seeded proposal → Approve → real event with Meet link + B invited → same Slack card confirmed in place showing both links. Separately, a watched-channel message reaches the (still stub) `runAgent` and posts its card via the Trigger.dev task with `AGENT_TRANSPORT=trigger`, and inline from Bolt with `AGENT_TRANSPORT=inline` and the Trigger.dev CLI stopped
**Cut order if overrunning**: Verify the `inline` transport once, not twice; never cut the organizer claim (APR-02) or the duplicate-event guard (APR-03)
**Most likely time-eating failure + early detection**: `block_actions` has no in-memory link to what Trigger.dev computed — the Approve handler's first line must read a real proposal id out of the payload/block value, never assume correlation. Second: `prismaExtension` missing from `trigger.config.ts` fails only at task runtime — add it now, verify with one trivial trigger before building the real approve-task body
**Impeccable**: none. **Ponytail**: `/ponytail-review` on the wave-A merge diff
**Requirements**: APR-01, APR-02, APR-03, APR-04, APR-05, AGT-11
**Success Criteria** (what must be TRUE):

  1. Approving a hand-seeded proposal produces exactly one calendar event with Meet link and invite, visible by opening the event
  2. The Slack card updates to a confirmed chip with both links; a second Approve click changes nothing further
  3. With `AGENT_TRANSPORT=trigger` a watched-channel message shows a run in the Trigger.dev dashboard and posts a card; with `AGENT_TRANSPORT=inline` (CLI stopped, Bolt restarted) the same message still posts a card
  4. A click on Approve by a user who isn't the token-holding organizer does not attempt a Calendar write
  5. `git status` after the first `trigger dev` run shows no untracked `package-lock.json`

**Plans**: 2 (suggested)

- [ ] 04-01-PLAN.md
- [x] 04-02-PLAN.md

**Wave 1**

- [ ] 04-01: (R1 already merged to main) approve/reject handler + organizer claim + chat.update; Trigger.dev task imports the REAL Phase 5 graph

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02: Trigger.dev task wrapper (AGT-11) + prismaExtension + AGENT_TRANSPORT flag verified both ways

### Phase 5: Agent + Confidence Gate

**Goal**: A real LangGraph extraction pipeline gates on confidence with a visibly calibrated spread
**Mode:** mvp
**Time box**: 11:45–12:20 (35 min) — R1, concurrent with Phases 2 and 3
**Label**: [track A] — branch `gsd/phase-5-agent-confidence`
**Depends on**: Phase 1 only (plus the pre-window rubric output). Formerly listed Phase 4; with the edit-modal cut this phase writes only `lib/agent/**` and `lib/ai/**`, so it runs in R1 before Phase 4 exists
**Runs alongside**: Phase 2 (Slack) and Phase 3 (Calendar) — R1, three terminals, cap 3
**Deliverables**: Real graph, ≤5 nodes, no checkpointer (AGT-10); `extractIntents(messages[], ctx)` with Zod-validated output mapped to real `ts` (AGT-02); deterministic date/day-of-week resolution done in code (AGT-03); confidence branches — high posts card (AGT-04), medium shows an "Edit & approve" button that opens a modal prefilled from `private_metadata` (AGT-05), low/non-actionable silent + `Decision` row (AGT-06), actionable also writes `Decision` (AGT-07); tonight's rubric baked into the prompt (AGT-08); `dedupe_key` logic (AGT-09); every call through `lib/ai/provider.ts` (AGT-01). The LangGraph keep-or-rip decision itself is fixed for the Phase 7 integration point, not here
**Files owned**: `lib/agent/**` (graph, nodes, `runAgent` — replacing Phase 1's stub body), `lib/ai/**` (real `provider.ts`)
**Files must not touch**: `app/**`, `components/**`, `lib/calendar/**`; `lib/slack/**` except the append-only AGT-05 additions below (calls the existing card-posting function, doesn't edit it)
**Named overlaps**: `types/` (ExtractedIntent/AgentState — Phase 6 reads Proposal/Decision types; extend the Phase 1 stub, don't fork); `lib/slack/bolt.ts` + card block builders — append-only for AGT-05: "Edit & approve" card variant, `block_actions` → `views.open` listener, `view_submission` handler. Never restructures Phase 2/4 registrations or builders. AGT-05 is CUT (see CONTEXT.md) — this phase now touches only `lib/agent/**` and `lib/ai/**`, which is why it runs in R1
**Processes / ports**: No long-lived server; graph exercised via a throwaway script or by manually invoking Phase 4's Trigger.dev task; own workspace `.env`/port :3001; Postgres :5432 shared, now writing real `Proposal`/`Decision`/`ActionItem` rows
**Exit criterion**: The 4–5 tonight-verified sample messages run through the real graph land on visibly different branches (card / edit-modal / silent+Decision) matching what was verified tonight, with a `Decision` row for every one
**Cut order if overrunning**: Drop the medium-confidence edit-modal step to "posts the card directly" (the high/low gate is the load-bearing differentiator, the modal is the refinement). Never cut the rubric (AGT-08) or Zod validation (AGT-02)
**Most likely time-eating failure + early detection**: Confidence scores cluster uncalibrated (~0.85–0.95 for everything) if tonight's rubric isn't actually in this prompt — re-run the same 4–5 samples in the first minutes and eyeball the spread before building branch logic on top of an assumption. Second: "next Friday" resolved wrong — pass today's date/day-of-week/tz explicitly, do the day-math in code
**Impeccable**: none (not app/components)
**Requirements**: AGT-01, AGT-02, AGT-03, AGT-04, AGT-05, AGT-06, AGT-07, AGT-08, AGT-09, AGT-10
**Success Criteria** (what must be TRUE):

  1. The 4–5 verified sample messages produce visibly different outcomes: at least one card directly, one edit-modal path, one silent
  2. Every one of those runs leaves exactly one `Decision` row with a confidence value and reason
  3. "Next Friday at 11am" resolves to the correct calendar date for the actual day this phase runs
  4. Switching `MODEL_FAST`/`MODEL_SMART` in `.env` and restarting changes which model handles a call, with no code edit

**Plans**: 3 (suggested)
**Wave 1**

- [ ] 05-01: Graph skeleton (5 nodes, no checkpointer) + provider.ts real calls + rubric-verified prompt

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 05-02: extractIntents array signature + Zod schema + deterministic date resolution

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 05-03: Confidence branches (high/medium/low) + Decision writes + dedupe_key

### Phase 6: Dashboard

**Goal**: The dashboard shows live proposal and Decision data in the retro theme, accessible and unstyled-literal-free
**Mode:** mvp
**Time box**: 12:35–13:05 (30 min) — R2, concurrent with Phase 4
**Label**: [track B] — branch `gsd/phase-6-dashboard`
**Depends on**: Phase 1 only. The plan precondition names Phase 4 but every artifact it lists (layout, globals.css, components.json, lib/db.ts, schema) is a Phase 1 artifact — run it in R2 against main after the R1 merge
**Runs alongside**: Phase 4 (Approval Bridge) — R2, two terminals, zero file overlap
**Deliverables**: Proposal/action-item queue with status+HKT time+confidence (DSH-01); Decision log view (DSH-02); TanStack Query polling (DSH-03); retro theme as shadcn CSS vars with `@theme inline` mappings, zero colour literals (DSH-04); consistent retro devices — hard borders, offset shadows, monospace data, uppercase micro-labels, status-in-form (DSH-05); amber/cyan contrast + focus states (DSH-06). Builds against Phase 1/4's hand-seeded rows, does not wait on Phase 5. Impeccable inline: `layout` while structure is written, `typeset`+`colorize` as type/colour are applied, `critique` then `polish` once functionally complete
**Files owned**: `app/**` (dashboard routes), `components/**` (dashboard components; `components/ui/` stays shadcn-unmodified), `app/globals.css`
**Files must not touch**: `lib/agent/**`, `lib/ai/**`, `lib/slack/**`, `lib/calendar/**`
**Named overlaps**: `types/` (reads Proposal/Decision/ActionItem types Phase 5 may also extend — read, don't fork); `package.json`+`bun.lock` (adds `@tanstack/react-query`, `zustand`, shadcn components — regenerate via `bun install` at merge, never hand-merge)
**Processes / ports**: Next.js dev on its own workspace port :3002 (separate from `main`'s :3000); Postgres :5432 shared, read-only
**Exit criterion**: Dashboard shows hand-seeded proposals with correct status/HKT time/confidence and the Decision log with at least one ignored entry; a manually-inserted row appears via polling within ~5s without reload
**Cut order if overrunning**: Cut the exhaustive focus-state audit to "checked on the three elements that matter" (buttons, table rows, nav); keep the theme itself. `critique`+`polish` is the pair that survives if this phase runs long — do those two even if `layout`/`typeset`/`colorize` were rushed
**Most likely time-eating failure + early detection**: Custom shadcn tokens (`--elevated`, `--success`) render unstyled with no console error if declared only in `:root` and not mapped inside `@theme inline` — check one element using `bg-elevated` in devtools within the first minutes. Second: forcing bun as the Next.js dev runtime (`--bun` flag) causes excessive Fast Refresh rebuilds — confirm the `dev` script is plain `next dev`
**Impeccable**: `layout` → `typeset`+`colorize` → `critique`+`polish` (inline, as noted in Deliverables)
**Requirements**: DSH-01, DSH-02, DSH-03, DSH-04, DSH-05, DSH-06
**UI hint**: yes
**Success Criteria** (what must be TRUE):

  1. The dashboard lists proposals with status, HKT time, confidence, and a separate view shows the Decision log with at least one ignored row and its reason
  2. A manually-inserted row appears in the dashboard within one polling interval with no manual reload
  3. Grepping components for hex colour codes outside `globals.css` returns nothing
  4. Tabbing through the page once shows a visible focus outline on every interactive element

**Plans**: 3 (suggested)
**Wave 1**

- [ ] 06-01: Layout — action-item queue + Decision log page structure (impeccable layout)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 06-02: Theme — shadcn CSS vars, retro devices, TanStack Query polling (impeccable typeset/colorize)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 06-03: Critique + polish pass (impeccable critique/polish)

### Phase 7: Integrate + Conflict Counter-Proposal

**Goal**: The full demo path runs live end to end, and a clash produces two reasoned alternative slots
**Mode:** mvp
**Time box**: 13:15–14:00 (45 min) — R3, solo, parallel plans — CFL work must have started by **13:35** or degrade to CFL-05
**Label**: [main] — branch `gsd/phase-7-integrate-conflict`
**Depends on**: Phase 5, Phase 6
**Runs alongside**: Nothing (sole phase; Phase 8/9 are gated on this phase's exit criterion and cannot start until it passes)
**Deliverables**: First plan merges Phase 5's and Phase 6's branches into `develop`, then `main`; wires the real graph into Phase 4's Trigger.dev task (replacing the stub); confirms the dashboard shows real extracted rows end to end. **LangGraph keep-or-rip decision point: by ~14:00, if the graph is still fighting the time budget, rip it out for plain node functions called in sequence (~10 min) — fixed, not optional.** Second plan: conflict-aware counter-proposal — one `MODEL_SMART` call with busy blocks + preferences (zero `Preference` rows is fine) returns two alternatives with reasons (CFL-01, CFL-02); card renders both as buttons, `value` = proposal id + slot index, choosing one runs the same approve path (CFL-03); demo beat — after the Friday 11:00 event exists, B's 10:30 ask produces the conflict card (CFL-04). **If this plan hasn't started by 14:15, implement the degraded static conflict warning instead (CFL-05) and stop.** Optional third plan, only if ahead: `/secretary scan` (OPT-01) over ~50 messages, built only after CFL is demo-ready. Ends with a full dry run of the entire demo path on `main` and `/ponytail-review` on the full merged diff — this satisfies DMO-05 for the whole build
**Files owned**: `lib/agent/**` (conflict node or plain-function equivalent), `lib/ai/**` (MODEL_SMART conflict call), `lib/slack/**` (conflict card rendering + optional scan listener), `lib/calendar/**` (read-only calls, no edits)
**Files must not touch**: `app/**`, `components/**` (no new dashboard UI needed — the conflict card lives in Slack)
**Named overlaps**: `lib/slack/bolt.ts` listener registration and card block builders — the conflict plan owns this file this phase; the optional scan plan appends only, never restructures
**Processes / ports**: Next.js dev :3000, Bolt (sole instance), Trigger.dev dev CLI, Postgres :5432 — same set as Phase 4, now carrying real end-to-end traffic
**Exit criterion**: On `main`, seed the Friday 11:00 ask → approve → seed B's 10:30 ask → card shows two reasoned alternatives (or, if degraded, the static warning) → picking an alternative completes the approve path. This sequence is the dry run gating Phase 8/9
**Cut order if overrunning**: (1) drop `/secretary scan` unconditionally first; (2) if CFL hasn't started by 14:15, cut to the CFL-05 static warning per the fixed cut line; (3) never cut the confidence-gate integration — it's what the demo leans on if conflict degrades
**Most likely time-eating failure + early detection**: `freebusy.query` timezone mishandling — naive UTC makes the 10:30-vs-11:00 check look at the wrong part of the day and silently miss the clash; log the actual `timeMin`/`timeMax` on the first real call and eyeball HKT hours. Second: `db push` drift if the merge didn't actually pick up both Wave-B branches' schema state — re-merge `develop` and diff `schema.prisma` before pushing
**Impeccable**: none (agent/Slack work). **Ponytail**: `/ponytail-review` on the full merged diff — satisfies DMO-05
**Requirements**: CFL-01, CFL-02, CFL-03, CFL-04, CFL-05, DMO-05, OPT-01
**Success Criteria** (what must be TRUE):

  1. The full seeded sequence run once on `main` produces either two reasoned alternatives or the static warning — never nothing
  2. Choosing an alternative slot completes the approve path with a real calendar event for the chosen slot
  3. Logged `timeMin`/`timeMax` for the conflict check show `+08:00` offsets matching the intended HKT window
  4. `/ponytail-review` has been run on the merged diff before this phase is marked done

**Plans**: 3 (suggested; plan 3 optional)
**Wave 1**

- [ ] 07-01: (R2 already merged to main) full-path dry run Slack→graph→card→approve→calendar + LangGraph keep-or-rip checkpoint
- [ ] 07-03 (optional, only if ahead): `/secretary scan` (OPT-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 07-02: Conflict counter-proposal (CFL-01..05) or degraded static warning if past 14:15

### Phase 8: [optional] S2 — Commitment Ledger

**Goal**: A CopilotKit surface renders a heterogeneous commitment ledger, proving generative UI
**Mode:** mvp
**Time box**: start 13:15 (spare terminal beside Phase 7, gates in "Optional phases"), hard stop **14:00** in the worktree, merged during the 14:00–14:30 review block or abandoned; budget ~45 min
**Label**: [throwaway] — branch `gsd/phase-8-s2-commitment-ledger` (never merges unless demo-ready)
**Depends on**: Phase 5 (extraction schema) and Phase 6 (dashboard) on `main` — i.e. the R2 merge; runs beside Phase 7, not after it
**Runs alongside**: Nothing — never alongside Phase 9 or Phase 10 (rehearsal only runs what is already on `main`)
**Honest arithmetic**: Phase 7 is boxed 13:50–14:45, so its dry run can't pass before the 13:45 latest start unless earlier phases ran ≥30 min ahead. On schedule this is **README-only** (documented as designed, not built)
**Deliverables (only if attempted)**: `commitment` type added to the extraction schema (STR-04) with direction/what/who/when-promised/due/source-link/status; CopilotKit surface rendering the ledger with a different component per row type — deadline chip+block-time, draft-nudge, chase, clarify (STR-05); nudges route through the existing approval card, never send directly
**Files owned**: `app/api/copilotkit/**` (or equivalent runtime route), `components/commitment-ledger/**`, additive-only changes to `lib/agent/**`'s extraction schema (new `commitment` type beside `meeting`, never editing the `meeting` shape)
**Files must not touch**: `lib/slack/**` internals beyond calling the existing approval-card function; `lib/calendar/**`
**Named overlap**: `lib/agent/**` extraction schema — additive field only; this throwaway branch rebases on any late Phase 7 change, never the reverse
**Processes / ports**: Next.js dev on its own workspace port :3003; CopilotKit dependency installed only now; Postgres :5432 shared
**Abandon criterion**: If the ledger isn't rendering at least two different component types by 14:00, abandon — do not merge, do not spend more time. Nothing else depends on this phase
**Exit criterion (only if demo-ready)**: Two different commitment-shaped questions render two visibly different components; sending a nudge produces the same approval-card flow as scheduling
**Requirements**: STR-04, STR-05
**UI hint**: yes
**Success Criteria** (what must be TRUE):

  1. The `commitment` type appears in extracted intents alongside `meeting` without breaking existing meeting extraction
  2. Two different commitment rows render two visibly different components
  3. Sending a nudge produces a Slack approval card, not a message sent directly

**Plans**: 2 (suggested, only if attempted)
**Wave 1**

- [ ] 08-01: `commitment` extraction type + heterogeneous component selection logic

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 08-02: CopilotKit ledger surface + nudge-through-approval-card wiring

### Phase 9: [optional] S1 — Graphiti Preference Memory

**Goal**: A self-hosted Graphiti/Neo4j service demonstrably changes a proposal after learning a preference
**Mode:** mvp
**Time box**: post-hackathon — no in-window slot (see "Optional phases"); budget ~60–90 min (20–30 of which is just the first Graphiti round trip)
**Label**: [throwaway] — branch `gsd/phase-9-s1-graphiti`; the service itself lives in a separate repo
**Depends on**: Phase 7 (full dry run must pass)
**Runs alongside**: Nothing — never alongside Phase 8 or Phase 10
**Honest arithmetic**: Phase 7 can't pass its dry run before ~14:15 on schedule, an hour past the 13:15 latest start — **this does not fit under any realistic sequencing.** Treat as README-only (Neo4j/graph-service declared in compose but not exercised) unless the build is ≥60 min ahead and Phase 8 is skipped in favour of this one
**Deliverables (only if attempted)**: separate-repo FastAPI service, `POST /episodes` + `GET /preferences?user_id=` against Neo4j (STR-01); closed-vocabulary distilled JSON preference facts ingested and read back (STR-02); same input visibly produces a different, better proposal after a preference is learned, graph shown before/after in Neo4j Browser via `graph/queries.cypher` (STR-03)
**Files owned (in this repo)**: `graph/queries.cypher`, activating the `docker-compose.yml` `graph` profile, additive `lib/agent/**` call to `GRAPH_SERVICE_URL` gated behind the service actually responding. The Graphiti service itself lives in a sibling repo via `GRAPH_SERVICE_DIR` — never inside this repo
**Files must not touch**: anything in Wave A/B's owned directories — this is the most isolated phase in the build by design
**Processes / ports**: `docker compose --profile graph up` → `neo4j` (:7474 Browser, :7687 bolt), `graph-service` FastAPI (:8000, depends on healthy neo4j); Postgres :5432 shared, reads `Preference` rows once written back
**Abandon criterion**: If the first `POST /episodes` → `GET /preferences` round trip hasn't succeeded within 30 minutes of starting, abandon — do not attempt the before/after demo. If the round trip works but the before/after change can't be shown, cut S1 per the source doc's own rule
**Exit criterion (only if demo-ready)**: The same input produces a visibly different, better proposal after one preference fact is ingested, shown before/after in Neo4j Browser via the same query
**Requirements**: STR-01, STR-02, STR-03
**Success Criteria** (what must be TRUE):

  1. `POST /episodes` with one distilled preference fact, then `GET /preferences?user_id=`, returns that fact
  2. Neo4j Browser at :7474 shows the new node/edge after ingestion, using a query from `graph/queries.cypher`
  3. The same scheduling input produces a visibly different proposal before vs. after the preference is learned

**Plans**: 2 (suggested, only if attempted)
**Wave 1**

- [ ] 09-01: FastAPI service (separate repo) + `/episodes`/`/preferences` + Neo4j round trip

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 09-02: Before/after demo wiring in `lib/agent/**` + `graph/queries.cypher`

### Phase 10: Seed-and-Rehearse

**Goal**: The full demo path runs cleanly three times from a reset baseline, with no rehearsal pollution
**Mode:** mvp
**Time box**: 14:30–14:45 (15 min; reset + 2 runs)
**Label**: [main, no new branch] — commits directly to `main`
**Depends on**: Phase 7
**Runs alongside**: Nothing — any unfinished stretch work is already abandoned by 14:15; rehearsal only runs what is on `main`
**Deliverables**: `prisma/reset-demo.ts` clearing demo rows + deleting tagged calendar events (DMO-01); demo conversation seeded by hand in the watched channel, full flow run three times on `main` (DMO-02); `/impeccable audit` on the running dashboard before freeze, completing DSH-07 (critique+polish were already applied inline in Phase 6 — this is the final deterministic-rule pass)
**Files owned**: `prisma/reset-demo.ts` (new file) — no other code changes
**Files must not touch**: everything else — no new branches, no schema changes, no feature edits
**Named overlaps**: none (no new branch, no merge possible by construction)
**Processes / ports**: Next.js dev :3000, Bolt (sole instance), Trigger.dev dev CLI, Postgres :5432 — identical to Phase 7
**Exit criterion**: Reset script + seeded conversation run three times back to back; each run produces a fresh card and a fresh calendar event (never a silent no-op); A's calendar shows no leftover rehearsal events near the demo's target slot after the final reset
**Cut order if overrunning**: Drop rehearsal count from three runs to two if genuinely squeezed — never to zero, and never skip the reset script itself
**Most likely time-eating failure + early detection**: Deterministic `dedupe_key` + idempotent calendar writes make the second rehearsal a silent no-op, and leftover events pollute the exact slot the conflict demo depends on — run the seeded message twice back-to-back the moment the reset script exists and confirm the second run produces a new card, not silence or a Prisma unique-constraint error; check A's calendar for the target day right before each rehearsal
**Impeccable**: `audit` on the running app (deterministic local rules, no API key, fast even under time pressure)
**Requirements**: DMO-01, DMO-02, DSH-07
**Success Criteria** (what must be TRUE):

  1. Running the reset script twice in a row leaves zero demo rows and zero tagged calendar events
  2. The seeded conversation run three times each produces a fresh card and a fresh calendar event
  3. A's calendar for the target day shows exactly what the final rehearsal run created, nothing extra
  4. `/impeccable audit` has run on the live dashboard with its output reviewed

**Plans**: 2 (suggested)

- [x] 10-01-PLAN.md
- [ ] 10-02-PLAN.md

**Wave 1**

- [x] 10-01: `prisma/reset-demo.ts` (DB truncation + tagged calendar-event cleanup)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 10-02: Seed conversation + rehearse 3× + impeccable audit

### Phase 11: Freeze-and-Record

**Goal**: A clean run is recorded as the wifi fallback, and the README is complete
**Mode:** mvp
**Time box**: 14:45–15:00 (15 min; 3rd rehearsal run is the recording)
**Label**: [main, no new branch] — commits directly to `main`, no new code
**Depends on**: Phase 10
**Runs alongside**: Nothing (final phase; any still-running stretch work must stop or be abandoned per its own criteria)
**Deliverables**: One clean run screen-recorded as the wifi fallback (DMO-03); final README covering every required section — competitive comparison (Slackbot, Reclaim/Motion, Clockwise noted shut down 27 Mar 2026, Slack calendar apps, Fireflies/Otter/Spinach, n8n/Zapier, Relay.app noted winding down / paid access lapsing 14 Sep 2026), batch-first detection reasoning (~20× cost, why regex pre-filtering fails), multi-workspace via OAuth, the one-line `interrupt()` note, `/ponytail-debt` output pasted in as "known shortcuts", abandoned stretch work and why (DMO-04)
**Files owned**: `README.md` only
**Files must not touch**: everything else — explicitly no new code
**Named overlaps**: none
**Processes / ports**: same as Phase 10, kept alive only long enough to record; may shut down once the recording is confirmed good
**Exit criterion**: The recorded video plays back showing the full demo path start to finish with no narration filling a gap; the README has every required section filled with content and cites Clockwise/Relay.app correctly as defunct/winding down
**Cut order if overrunning**: Cut nothing — if time is nearly gone, prioritize the recording over README polish, but both must exist in at least draft form
**Most likely time-eating failure + early detection**: Venue wifi drops mid-demo tomorrow and this recording is the only mitigation, not a code fix — before recording, `ping -c 3 8.8.8.8` and one live Trigger.dev sanity call; if wifi is visibly flaky, that's the signal this recording matters more than usual
**Impeccable**: none. **Ponytail**: `/ponytail-debt` — output pasted into the README's known-shortcuts section
**Requirements**: DMO-03, DMO-04
**Success Criteria** (what must be TRUE):

  1. The recorded video, played back once, shows the entire demo path with no dead air longer than a few seconds
  2. The README's competitive-comparison section names Clockwise as shut down and Relay.app as winding down, not as live competitors
  3. `/ponytail-debt` output appears verbatim in the README's known-shortcuts section
  4. Every required README heading has actual content, not a placeholder

**Plans**: 2 (suggested)

- [ ] 11-01-PLAN.md
- [x] 11-02-PLAN.md

- [ ] 11-01: Screen-record one clean run
- [x] 11-02: Finalize README (competitive section, batch-first, OAuth, interrupt() note, ponytail-debt, abandoned stretch)

## Progress

**Execution Order:** 1 → 2 ∥ 3 → 4 → 5 ∥ 6 → 7 → [8/9 optional, gated] → 10 → 11

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Hardcoded Round Trip | 1/3 | In Progress|  |
| 2. Slack Surface | 0/2 | Not started | - |
| 3. Calendar Client | 0/2 | Not started | - |
| 4. Approval Bridge | 1/2 | In Progress|  |
| 5. Agent + Confidence Gate | 0/3 | Not started | - |
| 6. Dashboard | 0/3 | Not started | - |
| 7. Integrate + Conflict Counter-Proposal | 0/3 | Not started | - |
| 8. [optional] S2 Commitment Ledger | 0/2 | Not started (gated) | - |
| 9. [optional] S1 Graphiti | 0/2 | Not started (gated) | - |
| 10. Seed-and-Rehearse | 1/2 | In Progress|  |
| 11. Freeze-and-Record | 1/2 | In Progress|  |

---
*Roadmap created: 2026-09-11*
*Build window: Sat 12 Sep 2026, 11:15–15:30 HKT*
