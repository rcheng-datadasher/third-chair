# Pitfalls Research

**Domain:** Solo 4h15m hackathon build — Slack Socket Mode + Next.js/shadcn/Tailwind v4 + Biome + Prisma/Postgres (Docker) + Trigger.dev + LangGraph JS + Kilo Gateway + googleapis Calendar, package-managed and run with **bun** (`bun install`/`bun add`/`bunx`), in WSL Ubuntu on Windows with parallel git worktrees
**Researched:** 2026-09-11
**Confidence:** HIGH for Slack/Google/Trigger.dev/Biome facts and the documented bun compatibility issues cited below (verified against current docs/issue trackers); MEDIUM for Kilo Gateway per-model structured-output behavior and confidence calibration (empirical, model-dependent, not documented centrally)

All detections below are hand checks or log/console reads doable in under a minute. No test files anywhere — this is enforced by the project's own rules, not just this document's constraint.

## Critical Pitfalls

Ordered by estimated minutes lost on the day if not anticipated (highest first). These are the ones worth a deliberate line in the roadmap, not just awareness.

---

### Pitfall 1: Two Bolt processes on one app-level token in two worktrees — events land in the wrong worktree

**What goes wrong:**
You start a Bolt/Socket Mode process in worktree A to build the Slack surface, then start a *second* Bolt process in worktree B (different branch, maybe testing a fix) using the same `xapp-` token. Slack now load-balances events across however many WebSocket connections are open under that token. A message or button click you sent to test worktree B's code can be delivered down worktree A's connection instead — the handler in the *other* process silently swallows it, and worktree B logs nothing. This reads as "my code isn't being called" and is very hard to diagnose because both processes look healthy.

**Why it happens:**
Socket Mode explicitly supports up to 10 concurrent WebSocket connections per app for throughput load-balancing, and Slack's own docs say "it's best not to assume any particular pattern for how payloads will be distributed across multiple open connections." Two parallel git worktrees, each running the Bolt process against the same `.env` (same `SLACK_APP_TOKEN`), is exactly this scenario — and this project's stated workflow is parallel worktrees.

**How to avoid:**
Only one worktree/process may run the Bolt process at a time — this is already implied by the project's "per-workspace isolation... only one workspace runs a given long-lived process (e.g. Bolt) at a time" rule; make it a literal habit, not just a written rule. Before starting Bolt in a new worktree, kill any Bolt process running elsewhere (`pkill -f "lib/slack/app"` or check the terminal you left running). If two Slack-touching tracks genuinely need to run concurrently, create a second Slack app (or at minimum a second app-level token via "Generate Token") for the second worktree rather than sharing one.

**Warning signs:**
A button click, shortcut, or watched-channel message produces no log line in the worktree/terminal you're actively testing, but the flow *did* visibly execute (message posted, card appeared) — check the *other* terminal window; if it logged the event, that's the tell. One-minute check: `ps aux | grep -i bolt` (or check open terminals) before starting a new Bolt process anywhere.

**Phase to address:** Slack surface phase (wave 1) and every phase thereafter that touches `lib/slack/`. State explicitly in `CLAUDE.md`/phase kickoff: "only one Bolt process running at any time, across all worktrees."

---

### Pitfall 2: Repo on `/mnt/c` under WSL — file-watch misses edits silently

**What goes wrong:**
The working directory for this session is `C:\coding_proj\ai-secretary`, which from WSL is `/mnt/c/coding_proj/ai-secretary` — the Windows filesystem mounted via 9p/DrvFs. Node's file watchers (Next.js Fast Refresh, `tsc --watch`, chokidar-based tools Bolt/Trigger.dev's dev CLI use) rely on inotify, which does not propagate reliably across that mount. You edit a file, save it, and nothing recompiles — you keep debugging against stale code, which in a 4h15m window is the single most expensive kind of confusion because you don't know it's happening.

**Why it happens:**
This is a long-standing, well-documented WSL2 limitation, not a misconfiguration you can flag away — file change events from Windows-side edits (or even WSL-side edits to a DrvFs-mounted path) are unreliable for inotify-based watchers.

**How to avoid:**
Clone/keep the repo inside the native Linux filesystem — `~/projects/ai-secretary` (i.e., under `/home/<user>/...`), not `/mnt/c/...`. Do this **tonight**: if the repo currently lives under `/mnt/c`, `git clone` (or `cp -r` + re-init) it into `~/` before the window opens, and open your editor/terminal against that path exclusively. If you must keep editing from a Windows-side editor, make sure that editor is also pointed at the `\\wsl$\...` or WSL-native path, not `C:\coding_proj`.

**Warning signs:**
Edit a file (add a `console.log`), save, and time how long until the terminal running the dev server prints a "compiled"/"reloaded" line. If it doesn't happen within ~2 seconds, or requires a manual restart to pick up, you're on the slow/broken path — check this once, at the very start of Phase 1, before writing any real feature code.

**Phase to address:** Scaffold phase, before any other work — the repo location decision has to be right on the very first commit, since moving mid-build costs a re-clone and re-`bun install` for every open worktree.

---

### Pitfall 3: Trigger.dev's dev CLI needs internet even for "local" runs — venue wifi kills all background work

**What goes wrong:**
Trigger.dev's local dev model is hybrid: orchestration (scheduling, retries, run metadata) happens on Trigger.dev's cloud even when tasks execute on your laptop via `npx trigger.dev@latest dev` (the CLI must run under Node regardless of bun elsewhere — see the bun-specific pitfall below). If venue wifi drops or degrades badly, every task invocation — including the one that calls the LangGraph agent — can stall or fail with no local fallback, taking down extraction, conflict-reasoning, and the confirmation flow with it, mid-demo.

**Why it happens:**
This is architectural, not a bug: the CLI syncs with Trigger.dev's servers to receive trigger requests and report status even in dev mode. It is not a fully offline dev loop.

**How to avoid:**
Treat "no live Trigger.dev dependency during the actual on-stage run" as the real mitigation, not something to engineer around: (1) test a mobile-hotspot fallback tonight and know the phone's tethering password by heart; (2) the project's own freeze-and-record phase (screen-recorded clean run) is the correct insurance — make sure it's recorded as a true fallback video, not just a nice-to-have, and have it ready to play if wifi dies live; (3) if wifi is visibly flaky in the hour before your slot, do a live sanity ping (`curl -sS https://api.trigger.dev` or just trigger one dummy task) rather than assuming it's fine.

**Warning signs:**
Any task invocation during rehearsal takes noticeably longer than the same one did minutes earlier, or the `trigger dev` terminal shows reconnect/retry noise. Check venue wifi quality (`ping -c 3 8.8.8.8` from WSL) as part of the pre-demo checklist, not just once in the morning.

**Phase to address:** Freeze-and-record phase (the recording is the mitigation); flag as a live pre-demo checklist item, not a code fix.

---

### Pitfall 4: Dedupe key and calendar pollution make the second rehearsal a silent no-op — and the live demo inherits stale conflicts

**What goes wrong:**
`dedupe_key = sha256(team_id + channel_id + thread_ts/message_ts + normalized_intent)` is deterministic. If you seed the *same* demo message text a second time to rehearse, you get the *same* dedupe key, which either violates the unique constraint (Prisma throws, nothing visible happens) or — if your upsert logic swallows the conflict — silently reuses the existing `Proposal` row and shows nothing new. Separately, every rehearsal that reaches Calendar creates a **real** event with a **real** Meet link on A's calendar and (if `sendUpdates: 'all'` fires) emails B a real invite each time. By the third rehearsal, the target time slot may already be "busy" from an earlier run, which corrupts the freebusy check the live demo's headline conflict moment depends on.

**Why it happens:**
Idempotency by design (correct for production) collides with "run the same scripted conversation repeatedly" (necessary for rehearsal). Nobody notices until the second run does nothing.

**How to avoid:**
Write a tiny reset script *before* the first rehearsal, not during: something like `scripts/reset-demo.ts` that (a) truncates/deletes `Proposal`, `Participant`, `ActionItem`, `Decision` rows for the demo `team_id`, and (b) deletes the Calendar events it created. For (b), tag every event created during rehearsal with `extendedProperties.private = { demo: "true" }` on insert, then the reset script lists and deletes events matching that property (`events.list` with `privateExtendedProperty=demo=true`, then `events.delete` per id) rather than trying to track ids by hand. Run the reset script between every rehearsal and once more immediately before walking on stage.

**Warning signs:**
Run the seeded conversation twice back-to-back tonight or during setup: if the second run produces no card / no dashboard row, or the Bolt log shows a Prisma unique-constraint error, the reset script is missing or incomplete. Check A's actual Google Calendar for the target day right before going live — more than one event near the demo's target time means pollution wasn't cleaned up.

**Phase to address:** Seed-and-rehearse phase, as an explicit deliverable (the reset script itself), not an afterthought discovered mid-rehearsal.

---

### Pitfall 5: `@slack/bolt` Socket Mode under bun — WebSocket JSON-parse errors, reconnect loop

**What goes wrong:**
Running the Bolt process directly with bun as the runtime (`bun run lib/slack/app.ts`, or worse, `bun --bun lib/slack/app.ts`) can produce `Unable to parse an incoming WebSocket message: JSON Parse error: Unexpected...` and a reconnect loop against Slack's Socket Mode connection. This is one of the highest-consequence risks in this stack because Bolt is the process the entire demo's trigger path depends on — if it can't hold a stable Socket Mode connection, nothing downstream ever fires, and it fails in a way that looks like a Slack-side flake rather than a runtime-choice bug.

**Why it happens:**
This is a documented, reproducible incompatibility between bun's WebSocket implementation and `@slack/bolt`'s Socket Mode client's message framing/parsing (filed as oven-sh/bun#4663) — bun's runtime and Node's differ enough at the WebSocket layer that Bolt's assumptions about incoming frame handling don't hold.

**How to avoid:**
Use bun only as the package manager/installer for the Bolt process (`bun install`, `bun add @slack/bolt`) but **launch the Bolt process itself under Node**, not bun — e.g. `node --loader tsx lib/slack/app.ts` or compile-then-`node dist/slack/app.js`. Do not add `--bun` anywhere near the Bolt entrypoint's run script, and do not use a bare `bun run` on it either if that resolves to bun's own runtime for a `.ts` file. This is the one process in the whole stack where "bun replaces npm as package manager and script runner" should be read as "for installing and scripting," not "for running this specific long-lived process."

**Warning signs:**
Start the Bolt process and watch its own console for the first few seconds: a "pong wasn't received"/reconnect message or a JSON parse error on the very first inbound event (even a harmless `hello` frame) is the signal — check this in under a minute, on the very first Bolt startup of the day, before building anything on top of it.

**Phase to address:** Slack surface phase (wave 1) — decide the Bolt run command (Node, not bun) before writing the first listener, since changing the entrypoint later means re-verifying every handler still fires.

---

### Pitfall 6: Prisma client generation hangs or grabs the wrong query-engine binary under bun

**What goes wrong:**
`bunx prisma generate` (and by extension `db push`, which generates as a side effect) has been reported to hang indefinitely, or to complete but produce a client bound to the wrong query-engine binary target — surfacing later as "Prisma Client could not locate the Query Engine for runtime ..." the first time a query actually runs, not at generate time.

**Why it happens:**
Prisma's postinstall/generate step shells out and does platform detection in ways that have known open compatibility gaps with bun's runtime and module resolution, independent of the separate Windows/WSL binary-mismatch pitfall below (this can bite even on a single, consistent WSL-native bun install).

**How to avoid:**
After `bun install` in the scaffold phase, run `bunx prisma generate` once by itself and give it a hard time-box (10–15 seconds) — if it hangs, kill it and fall back to running the same command through Node explicitly: `node ./node_modules/prisma/build/index.js generate` (or `node ./node_modules/.bin/prisma generate`). Once generated, do one real query immediately (not just "it exited 0") to confirm the client actually loads its engine.

**Warning signs:**
`bunx prisma generate` sitting with no output for more than ~15 seconds, or a `PrismaClientInitializationError` mentioning a query-engine runtime string the first time any code calls `db.$connect()`/a real query — check this once, right after scaffold, before any other Prisma-touching phase starts.

**Phase to address:** Scaffold phase, immediately after `bun install`, as an explicit smoke-test step before the Prisma singleton is wired into any process.

---

### Pitfall 7: Trigger.dev's own CLI doesn't run under bun — and silently falls back to npm during bundling, which can drop a stray `package-lock.json`

**What goes wrong:**
Two related traps stack here. First, the `trigger.dev` CLI itself does not support being invoked as a bun binary — it needs to run under Node even in a bun-first project (tasks it dispatches do execute under a bun runtime, just not the CLI process). Second, when Trigger.dev's tooling detects a bun lockfile in the project, its current dependency-resolution fallback is to shell out to **npm**, not bun, for parts of its own build/bundle step — which can materialize a `package-lock.json` in the repo that nobody asked for and that now disagrees with `bun.lock` about resolved versions.

**Why it happens:**
Documented, current Trigger.dev behavior: the CLI requires Node to run, and bun-lockfile detection currently triggers an npm-based fallback path internally rather than a bun-native one.

**How to avoid:**
Run the Trigger.dev CLI itself via Node — `npx trigger.dev@latest dev` (or `node node_modules/.bin/trigger dev` if already installed via `bun add -d trigger.dev`) — as a deliberate, documented exception to "bun replaces npm everywhere," not an oversight. After the first `trigger dev` invocation, check `git status` for an untracked `package-lock.json`; if one appears, delete it and add `package-lock.json` to `.gitignore` up front so it can never get committed by accident from either worktree.

**Warning signs:**
An untracked `package-lock.json` appearing after running `trigger dev` for the first time, or `bun install` afterward producing different resolved versions than before — both are the tell that the npm fallback path fired. Check `git status` once right after the first `trigger dev` run of the day.

**Phase to address:** First Trigger.dev integration phase — run the CLI once via Node before wiring real tasks, and gitignore `package-lock.json` in the scaffold phase pre-emptively.

---

### Pitfall 8: Meet link silently missing — `conferenceDataVersion=1` or `requestId` omitted

**What goes wrong:**
`events.insert` succeeds, returns 200, creates a real calendar event — but with no Meet link, no error, nothing to indicate anything is wrong. This is worse than a hard failure because it looks done. It's discovered only by opening the created event and checking for a video-call field.

**Why it happens:**
Google Calendar only generates conference data when the request includes **both** the query parameter `conferenceDataVersion=1` **and** a `conferenceData.createRequest.requestId` (any unique string) in the request body specifying `conferenceSolutionKey.type: "hangoutsMeet"`. Omit either and the API just ignores the conference request — no warning.

**How to avoid:**
Build the calendar client call once with both pieces present from the start, and verify against a real created event (not just checking the HTTP status). `requestId` should be a fresh unique string per call (a uuid is fine for this specific field — it's an idempotency token for the conference creation request, unrelated to the event `id` charset rule below).

**Warning signs:**
After the first real `events.insert` call, `GET` the event back (or open Calendar) and confirm `conferenceData.entryPoints` contains a `video` entry with a `meet.google.com` URI — a one-minute check, and the only reliable one, since the insert call itself won't tell you.

**Phase to address:** Calendar integration phase (wave 1), as part of its exit criterion — "event created with visible Meet link," checked by hand, not just "insert call returned 200."

---

### Pitfall 9: Custom Calendar event `id` rejected — cuid/uuid characters aren't legal

**What goes wrong:**
You derive the Calendar event `id` from the Proposal id for idempotency (per the project's own design). If that id is a `cuid()` or standard UUID, `events.insert` returns a 400 the first time you try a deterministic id, because Calendar restricts custom event ids to a narrow character set.

**Why it happens:**
Google's documented rule: a custom event id must be **5–1024 characters using base32hex** — lowercase letters `a`–`v` and digits `0`–`9` only. A UUID has hyphens and letters up to `f` only (so a lowercase UUID *might* pass by luck on the alphabet but the hyphens fail it outright); `cuid()` output commonly includes characters outside `a`–`v` and is not guaranteed lowercase-only, so it fails too.

**How to avoid:**
Don't hand Calendar the Proposal's `cuid()`/uuid directly. Derive a compliant id instead — e.g., hex-encode or hash the Proposal id and use only the resulting characters, or generate a separate base32hex-safe id (lowercase hex digest works: hex is a subset of `0-9a-f`, which is inside `a`–`v`). Store the result as `calendar_event_id` on the Proposal row rather than assuming the Proposal id itself is reusable.

**Warning signs:**
First real `events.insert` with a custom id throws a 400 with a message about the id format — check this in the first minute of wiring the idempotent-insert path, with one real call, before building the 409-fallback logic on top of it.

**Phase to address:** Calendar integration phase — get the id-generation helper right before writing the "catch 409, fall back to `events.get`" logic on top of it, or you'll be debugging two problems that look like one.

---

### Pitfall 10: 3-second Slack ack violated — slow handler causes retried, duplicated events

**What goes wrong:**
If a Slack event/action handler in Bolt does real work (calls the LLM, hits the DB, calls Calendar) before calling `ack()`, and that work takes longer than ~3 seconds, Slack resends the same event with an `X-Slack-Retry-Num` header. If the handler isn't idempotent to retries, you get two Proposals, two cards, or a duplicate Calendar event for one message — exactly the kind of bug that looks like "the demo is broken" live.

**Why it happens:**
Slack's Events API and interactivity contract require acknowledgement within 3 seconds; anything slower is not the app "gracefully queuing," it's a timeout from Slack's perspective, which retries by design.

**How to avoid:**
`ack()` must be the *first* thing every listener does, before any await that touches the LLM, DB, or Calendar. Anything slow goes to Trigger.dev (which is exactly what the architecture already specifies) — the Bolt listener's job is: ack, then hand off. Also handle the `X-Slack-Retry-Num` / retry case defensively even with fast acks, since Slack can still retry on rare infra hiccups: check `body.event_id` or similar against something you've already processed before doing anything with side effects.

**Warning signs:**
During dev, watch the Bolt process's console for the same event/`event_id` appearing twice within a few seconds of each other — that's Slack retrying because your first response was too slow (or dropped). One seeded message producing two approval cards is the on-stage symptom.

**Phase to address:** Slack surface phase — write the "ack first, then hand off" pattern into the very first listener you build, since every later listener will be copy-pasted from it.

---

### Pitfall 11: Confidence scores cluster uncalibrated (everything ~0.9) — the confidence gate doesn't visibly work

**What goes wrong:**
The confidence-gate feature is the demo's first "must land" AI feature and depends on the model actually producing a *spread* of confidence values across obvious/ambiguous/non-actionable messages. LLMs asked for a bare "confidence" score without a rubric tend to cluster near 0.85–0.95 for anything that looks plausible, which means the medium/low branches (edit-modal, silent+Decision) never trigger in the demo — the differentiator quietly doesn't exist on stage.

**Why it happens:**
"Confidence" is not a property the model can introspect numerically; without an explicit rubric anchoring what 0.3 vs 0.6 vs 0.9 *means* in this domain, the model defaults to a vague sense of "plausible = high."

**How to avoid:**
Give the extraction prompt an explicit rubric tied to concrete signals: e.g. "0.85+ only if an explicit time AND explicit participant(s) are stated; 0.5–0.7 if the intent is implied but time or participant is vague/missing; below 0.4 if this reads as commentary/banter with no concrete ask." Test this **tonight** with 4–5 representative sample messages (a slam-dunk, a vague one, an obvious non-item, one with implicit time like "same time as last week") run through the real extraction call, and eyeball whether the scores actually differ. This is a smoke test of prompt behavior, not account setup — do it before the window since there's no time to iterate on prompt wording live.

**Warning signs:**
Run the same 4–5 sample set again first thing in the window (one-minute check) — if scores are still bunched, the confidence gate has no discriminating power and the demo script should be adjusted to use only messages you've *verified* land on different branches, rather than trusting the model live.

**Phase to address:** Extraction phase (wave 2) — the rubric belongs in the prompt from the first draft, and the tonight smoke-test is a pre-window action item, not a phase task.

---

### Pitfall 12: Kilo Gateway model doesn't actually honor `json_schema` strict mode

**What goes wrong:**
You build the extraction/conflict-reasoning calls assuming strict JSON-schema-constrained output, then discover mid-build that the chosen `MODEL_FAST`/`MODEL_SMART` either ignores `response_format: {type: "json_schema", strict: true}` silently (falls back to loose JSON) or errors on the parameter entirely — surfacing as a Zod parse failure that looks like a data problem when it's actually a provider/model capability gap.

**Why it happens:**
Structured-output/strict-schema support is inconsistent across models routed through Kilo Gateway — it depends on the underlying provider's API, not Kilo Gateway uniformly, and Kilo Gateway passes the parameter through rather than emulating it for models that don't support it.

**How to avoid:**
Pick `MODEL_FAST`/`MODEL_SMART` model ids tonight and run one real structured-output call against each through `lib/ai/provider.ts` before the window, Zod-parsing the result. If a model fails or free-forms the JSON, either switch model id (env-only change, per the architecture) or relax to "JSON mode + Zod `.safeParse` + one repair retry" rather than hard strict mode. This is a smoke test of an already-chosen model, not new account setup, so it belongs tonight per the "cheap tonight, expensive tomorrow" rule.

**Warning signs:**
The very first real extraction call in the build: if `JSON.parse`/Zod throws on a response that looks almost-JSON (trailing commentary, markdown fences, missing required key), that's the tell — check this within the first few calls of the extraction phase, not after building the rest of the pipeline on top of an untested assumption.

**Phase to address:** Pre-window smoke test (do tonight); extraction phase should include a `.safeParse` + one bounded retry as defensive coding regardless of tonight's test result.

---

### Pitfall 13: `db push` races or drifts across two worktrees sharing one Postgres

**What goes wrong:**
Two worktrees both run `prisma db push` against the same dev database in a short window. Whichever ran last effectively wins and may silently drop a column/table the other track just added, or Prisma detects drift and offers an interactive "reset the database" prompt — which, taken without reading it in a hurry, wipes all seeded/rehearsal data.

**Why it happens:**
`db push` reconciles the live DB to match *your local* `schema.prisma`; if your local schema doesn't yet have the other track's changes (because you haven't merged `develop`), pushing yours will diverge from what's actually live.

**How to avoid:**
The project's own rule — "a track never pushes schema until it has merged the latest `develop`" — is the correct fix; the failure mode is skipping it under time pressure. Before running `db push` in any track, `git merge develop` (or fetch and check the merge base) first. Never accept a "data will be lost" prompt without reading exactly which columns.

**Warning signs:**
`prisma db push` printing a warning about column drops or an interactive data-loss prompt is the signal to stop and check what changed upstream — a one-minute `git log --oneline develop -5` and a diff of `prisma/schema.prisma` against your local copy before proceeding.

**Phase to address:** Every phase with schema changes; enforced procedurally (merge-before-push) rather than by a single code fix — call it out explicitly at each wave boundary in the roadmap.

---

### Pitfall 14: Forcing bun as the Next.js dev-server runtime causes excessive Fast Refresh rebuilds

**What goes wrong:**
Running `bun --bun next dev` (forcing bun's own runtime instead of Node for the Next.js dev server, as opposed to just using bun to invoke the `next` binary) has a documented interaction with Turbopack causing repeated, excessive BUILDING/BUILT Fast Refresh cycles per single edit — the count gets worse as the app grows, which is exactly the direction this session's dashboard is heading over the build window. This reads as "the dev server is stuck rebuilding" and wastes visible wall-clock time watching a spinner during the UI phases.

**Why it happens:**
A known, currently open compatibility gap between bun-as-runtime and Next.js's Turbopack dev pipeline, not a configuration mistake.

**How to avoid:**
Use bun as the package manager and to invoke the script (`bun run dev`, where `package.json`'s `dev` script is plain `next dev`), but do **not** add the `--bun` flag to that script or run `bun --bun next dev` directly — letting the `next` binary's own shebang run under Node avoids the Turbopack interaction entirely while bun still handles install/scripts for everything else.

**Warning signs:**
After the first meaningful edit to a dashboard component, watch the terminal: more than one BUILDING/BUILT pair logged for a single save is the tell — check this once, in the first few minutes of the dashboard phase, before assuming later slowness is your own code.

**Phase to address:** Dashboard/UI phase (wave 2) — fix the `dev` script's invocation before spending real time inside it.

---

### Pitfall 15: Parallel worktrees and bun — lockfile merge conflicts, not install-cache conflicts

**What goes wrong:**
Bun's install cache is global and content-addressed (`~/.bun/install/cache`), so two worktrees running `bun install` concurrently is *not* the danger it might sound like — that part is safe. The actual danger is at merge time: both tracks independently run `bun add <package>` during the build, each producing its own diverging `bun.lock` (text-based since bun 1.2+, but still not meant to be hand-merged any more than a binary lockfile is) and a `package.json` with different new dependencies. Resolving that as a normal git text conflict looks tractable and quietly leaves you with an internally inconsistent lockfile — resolved versions that don't match what's actually installed.

**Why it happens:**
`bun.lock`, despite being human-readable JSONC-like text, is a derived artifact of a resolution algorithm; editing it by hand to "merge" two branches' entries doesn't re-run that resolution.

**How to avoid:**
When merging a track into `develop` (or `develop` into a track), resolve `package.json` normally (it's small, real conflicts are readable), but never hand-merge `bun.lock` — take either side, then immediately run `bun install` to regenerate the lockfile fresh from the merged `package.json`, and commit the regenerated lockfile as part of the merge commit. This matches the project's existing "regenerate, don't resume" instinct for schema drift, applied to dependencies.

**Warning signs:**
A merge that touches both `package.json` and `bun.lock` on both sides — that combination is the trigger to regenerate rather than accept git's auto-merge of the lockfile. `bun install` erroring or silently changing many unrelated package versions right after a merge is the sign it was needed and skipped.

**Phase to address:** Every merge-into-`develop` step at a wave boundary — a one-line rule in `CLAUDE.md`: "never hand-merge `bun.lock`; regenerate with `bun install` after resolving `package.json`."

---

## Moderate Pitfalls

### Bot reprocesses its own messages / message subtypes — feedback loop risk

**What goes wrong:** Subscribing to `message.channels` for the watched-channel design means the bot also receives its own `chat.postMessage`/`chat.update` traffic (as `bot_message` subtype events) and edit events (`message_changed`). Worst case: the bot's own "Meeting confirmed: Thursday 3pm" text gets fed back into extraction and creates a second, spurious Proposal from its own confirmation message.

**Prevention:** In the `message.channels` handler, bail out immediately if `event.subtype` is `bot_message`/`message_changed`/`message_deleted`, or if `event.bot_id` matches the app's own bot user id (fetch once via `auth.test` at startup and cache it). This filter must be the first line of the handler, before any dedupe or extraction logic.

**Phase to address:** Slack surface phase — write the filter into the handler skeleton before any real logic is added.

---

### `block_actions` payload has no in-memory link to what Trigger.dev computed

**What goes wrong:** Assuming Slack "correlates" a button click back to whichever process posted the message. It doesn't need to and it won't help you if it did — Slack always routes `block_actions` to whatever process is holding the Socket Mode connection at that moment, which may not be (and generally isn't) the same process instance that ran the LangGraph extraction via Trigger.dev. If the proposal id, candidate slots, etc. only exist as a JS variable inside the Trigger.dev task's execution, the Bolt handler that receives the click has nothing to act on.

**Prevention:** Every piece of state a button action needs (at minimum the Proposal id) must be embedded in the block's `value`/`action_id` or the message's `private_metadata`, or re-fetchable from Postgres by an id in the payload — never assumed to be in memory anywhere. This falls straight out of the project's own "re-derive, don't resume" philosophy; apply it to the Slack layer too, not just the LangGraph layer.

**Phase to address:** Bridge/approval-handler phase — the Block Kit builder function should take `proposalId` as its only required correlation input.

---

### `chat.update` needs the exact channel + ts the message was posted with, from the same bot token

**What goes wrong:** `chat.update` silently fails or 400s if given the wrong `channel` (must be the channel/conversation id, not a name) or a `ts` that wasn't returned by (or associated with) the original `chat.postMessage` response — or if the message was posted by a different app/token than the one calling update.

**Prevention:** Persist `channel` and `ts` from the `chat.postMessage` response directly onto the Proposal row at creation time; use those stored values for the later `chat.update`, rather than trying to recover them from the button click payload (which does include `container.message_ts`/`channel_id`, but storing at creation time is one fewer place for drift).

**Phase to address:** Bridge/approval-handler phase.

---

### `users.info` 403s without `users:read.email`

**What goes wrong:** Fetching B's email to invite them to the Calendar event fails with `missing_scope` if `users:read.email` wasn't added before the last app reinstall.

**Prevention:** Per PROJECT.md this scope is already listed as installed — confirm it tonight with one `users.info` call against a real user id and check the response actually contains an `email` field (some scope states return the user object without the email even on success if the OAuth scope isn't in the *installed* set, not just the requested manifest).

**Phase to address:** Calendar/participant-resolution phase — verify with one real call before building the invite path on top of an assumption.

---

### Message shortcut `callback_id` mismatch — silent no-op

**What goes wrong:** The `callback_id` registered in Slack's app configuration (or manifest) for the "Extract action items" shortcut must exactly match the string passed to `app.shortcut('...')` in code. A mismatch produces no server-side error at all — Slack just shows the user "This app didn't respond in time" after the 3-second window, because nothing on your side matched and thus nothing called `ack()`.

**Prevention:** Trigger the shortcut once immediately after wiring the handler and confirm a log line prints inside the handler. If nothing prints, `grep` the manifest's callback id against `grep -rn "app.shortcut" lib/slack/` — this is a one-minute diff, not a debugging session, once you know to check it first.

**Phase to address:** Slack surface phase.

---

### Testing-mode OAuth refresh tokens can expire in 7 days

**What goes wrong:** A Google Cloud OAuth consent screen left in "Testing" publishing status issues refresh tokens that can expire after 7 days regardless of test-user status. Since PROJECT.md confirms the refresh token was verified "tonight" (2026-09-11) for use the next day, this specific run should be safe — but if that token is regenerated from an older credential, or the demo is rehearsed heavily across multiple days before the event, re-verify.

**Prevention:** One curl/script call using the stored refresh token to fetch a fresh access token, done as part of tonight's checklist (already implied by "verified refresh token" in PROJECT.md — just don't skip re-checking it the morning of, since "tonight" and "the window" are two different clock periods).

**Phase to address:** Pre-window checklist (do tonight and again the morning of, not a build phase).

---

### `freebusy.query` timezone mishandling — off-by-hours conflict checks

**What goes wrong:** `freebusy.query` timeMin/timeMax must be RFC3339 with an explicit offset or `Z`; feeding it a naive local-looking string without a timezone can shift the queried window by 8 hours relative to `Asia/Hong_Kong`, making the conflict check look at the wrong part of the day entirely — the headline "10:30 conflicts with 11:00" moment could simply miss because it queried UTC daytime instead of HKT.

**Prevention:** Always construct timeMin/timeMax with an explicit `+08:00` offset (or convert through a tz-aware date library) rather than `new Date().toISOString()` (which is always `Z`/UTC) without adjustment. Log the actual timeMin/timeMax sent on the first real call and eyeball that the hours match what you expect in HKT.

**Phase to address:** Conflict-detection phase (wave 3).

---

### "Next Friday" resolved wrong by the LLM

**What goes wrong:** Relative date phrases ("next Friday", "same time as last week") are exactly the kind of arithmetic LLMs get subtly wrong — off by a week, or ambiguous about whether "next Friday" said on a Friday means today or in 7 days.

**Prevention:** Pass the current date/time **and** day-of-week **and** timezone explicitly in the system prompt (e.g. "Today is Friday, 2026-09-12, 11:20 Asia/Hong_Kong"), and where possible resolve the final ISO timestamp deterministically in code from a smaller structured extraction (e.g. the model returns `{relative_phrase: "next Friday", time_of_day: "11:00"}` and code does the day-of-week math with a tz library) rather than trusting the model to emit a correct absolute ISO string end-to-end.

**Phase to address:** Extraction phase.

---

### Prisma engine binary mismatch between Windows and WSL `node_modules`

**What goes wrong:** If `bun install` is ever run from a Windows shell (PowerShell/cmd, including a Windows-native bun install) against the same `node_modules` directory the WSL-side app runs against (common if the repo sits on `/mnt/c` — see Pitfall 2), Prisma's downloaded query-engine binary is built for the wrong platform, and the app throws a "query engine library not found for this platform" error at runtime, not at install time.

**Prevention:** Run every `bun install` exclusively from a WSL bash shell for this repo, no exceptions — this becomes moot entirely once the repo lives under the native Linux filesystem (Pitfall 2's fix), since Windows tools won't touch that path at all.

**Phase to address:** Scaffold phase — same root cause as Pitfall 2, same fix.

---

### `googleapis` under bun — lower risk, but unverified until tried once

**What goes wrong:** No single documented showstopper exists for `googleapis` under bun specifically, but it's a large package with many transitive HTTP/auth dependencies (`gaxios`, `google-auth-library`, `gtoken`) that exercise Node-compat edges (streams, certain `https.Agent` options) bun's Node-compatibility layer sometimes hasn't fully covered for less-common packages. Discovering an incompatibility here mid-Calendar-phase, under time pressure, is worse than finding it in a 30-second check beforehand.

**Prevention:** Do one real `googleapis` OAuth2 client construction + a single `freebusy.query` call as the very first thing in the Calendar integration phase, under whatever runtime that process actually uses (Next.js route handlers run under Node regardless of bun-as-package-manager; if the Calendar client is called from a long-lived process, verify it there too). If it throws anything bun-flavored (a missing global, an unimplemented Node API), that's a signal to run that specific module under Node explicitly rather than debugging it as a Calendar-logic bug.

**Warning signs:** An error mentioning an unimplemented or partially-implemented Node built-in (rather than a Google API error with a normal HTTP status) on the very first real call.

**Phase to address:** Calendar integration phase (wave 1) — the smoke-test call before building the Meet-link/freebusy logic on top of it.

---

### Prisma's generator `output` path vs. `@prisma/client` import path mismatch

**What goes wrong:** Some current Prisma scaffolds/templates set a custom generator `output` (e.g. `generator client { output = "../generated/prisma" }`) instead of the classic `node_modules/@prisma/client` location. If `lib/db.ts` imports from `@prisma/client` but the schema generates elsewhere (or vice versa — a copy-pasted `lib/db.ts` from an older tutorial importing the default path while the schema was scaffolded with a custom output), the import fails or resolves a stale/empty client.

**Prevention:** After `prisma generate`, check the `generator client { output = ... }` line in `prisma/schema.prisma` and make sure `lib/db.ts`'s import path matches it exactly. One-line fix once seen, confusing if not checked.

**Phase to address:** Scaffold phase, at the same time the Prisma singleton is written.

---

### Trigger.dev bundling doesn't include Prisma's engine unless configured

**What goes wrong:** Trigger.dev bundles task code for its own execution environment; without the `prismaExtension` build extension configured in `trigger.config.ts`, a task that imports the shared Prisma client fails with a missing query-engine error the first time it actually runs a query — even though the same import works fine in the Next.js/Bolt processes.

**Prevention:** Add `prismaExtension` (from `@trigger.dev/build/extensions/prisma`) to `trigger.config.ts` pointing at `prisma/schema.prisma`, and also list `"@prisma/client"` under `additionalPackages` — the extension's own version-detection has a known dependency on that package being explicitly declared there.

**Phase to address:** Whichever phase first wires a Trigger.dev task to call Prisma (likely the extraction bridge phase) — verify with one trigger of a trivial Prisma-touching task before building real logic on top.

---

### Env vars not loaded in Trigger.dev tasks

**What goes wrong:** The `trigger dev` CLI resolves env vars from process env, then `.env.local`, then `.env` (via `--env-file`) — a different precedence than Next.js's own `.env.local`/`.env` loading. If secrets only live in a file the CLI doesn't check (or the CLI is started from a different working directory than expected), a task silently gets `undefined` for `DATABASE_URL`/`AI_API_KEY`/etc. and fails inside the task body, not at startup.

**Prevention:** Log one env var (e.g. `!!process.env.DATABASE_URL`) at the top of the very first task and manually trigger it before building real logic — this is a 30-second check that avoids debugging "why does the DB call fail" as if it were a Prisma problem when it's an env-loading problem.

**Phase to address:** First Trigger.dev integration phase.

---

## Minor Pitfalls

- **shadcn CLI writes v3-style config if it's stale.** Confirm after `bunx shadcn init` that no `tailwind.config.js/ts` was created and `app/globals.css` contains `@import "tailwindcss";` — a stale shadcn CLI version defaults to v3 scaffolding, which conflicts with the CSS-first rule. Update the CLI (`bunx shadcn@latest`) before init if unsure.
- **Custom shadcn tokens (`--elevated`, `--success`) produce no utility class without `@theme inline` mapping.** Defining `--elevated`/`--success` only in `:root` doesn't create `bg-elevated`/`text-success` — Tailwind v4 only generates utilities for names declared inside an `@theme inline { --color-elevated: var(--elevated); ... }` block. Check by using `bg-elevated` on one element and confirming it's actually styled in devtools before building the rest of the palette on the assumption it "just works."
- **Biome flags Tailwind v4 at-rules (`@theme`, `@custom-variant`, `@apply`) as unknown.** Set `css.parser.tailwindDirectives: true` in `biome.json` at scaffold time. Even with this enabled, some Biome 2.3.x point releases still emit residual warnings inside `@theme` blocks — these are warnings, not blockers to `biome check --write` succeeding, so don't spend time chasing a fully clean lint output on `globals.css` if it persists; exclude that file from `biome check` if it becomes noisy.
- **Biome reformats shadcn-generated files on the next `check --write`.** Expect a diff every time you run `bunx shadcn add <component>` even if you didn't touch the file — run `biome check --write` right after each `shadcn add`, not in a batch at the end, so the formatting diff doesn't get tangled with your own edits in a merge.
- **LangGraph `Annotation` fields overwrite by default, not append.** Any state key without an explicit reducer silently replaces on the next node's update rather than merging — a real risk for anything list-shaped (participants, candidate slots) touched by more than one node. Give every array/object field that more than one node writes to an explicit reducer; log the full state object once after a real run to confirm nothing unexpectedly reset to `[]`.
- **LangGraph JS API churn across versions.** Pin exact versions (no `^`/`~` ranges) for `langgraph`/`langchain` packages tonight, so a stray `bun install` mid-build doesn't pull a newer minor version with a changed `addNode`/`Annotation` signature.
- **Docker Desktop's WSL2 backend can consume unbounded RAM.** Set a memory cap in `%UserProfile%\.wslconfig` (`[wsl2]\nmemory=6GB` or similar, sized to leave headroom for Next.js/Bolt/Trigger.dev running natively) tonight, and restart WSL (`wsl --shutdown`) once to confirm it takes effect — check with `docker stats` that containers stay under their configured caps once the stack is up.
- **Two worktrees' dev servers collide on the same port.** Next.js silently increments to the next free port if 3000 is taken, which then doesn't match anything you've configured (OAuth redirect URIs, `SLACK_WATCH_CHANNEL_IDS`-adjacent env expecting a fixed base URL). Assign each worktree an explicit `-p` port in its own `.env`/`package.json` script rather than relying on auto-increment.
- **Slack rate limits during tight debug loops.** Repeatedly re-triggering the same message/button while iterating on a bug can produce `429`/`rate_limited` responses from `chat.postMessage`/`chat.update`, which look like a code bug (message that never updates) but is actually backoff. Watch Bolt's console for `429` explicitly before assuming the handler logic is wrong.

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|-------------------|
| Slack Socket Mode | Two processes sharing one app-level token across worktrees | One Bolt process at a time, across all worktrees; kill before switching |
| Slack Socket Mode + bun | Launching the Bolt process itself under bun's runtime | `bun install` the package, but launch the process under Node |
| Slack `message.channels` | Not filtering `bot_message`/`message_changed`/own `bot_id` | Filter first line of handler, before dedupe/extraction |
| Slack `chat.update` | Recomputing/guessing `channel`/`ts` from the click payload | Persist `channel`+`ts` on the Proposal row at post time |
| Slack `block_actions` | Assuming in-memory correlation to the process that created the card | Embed `proposalId` in the block value; re-fetch state from Postgres |
| Google Calendar Meet link | Missing `conferenceDataVersion=1` or `createRequest.requestId` | Set both on every `events.insert`; verify by reading `conferenceData.entryPoints` back |
| Google Calendar custom id | Using `cuid()`/uuid (hyphens, out-of-range letters) as event `id` | Derive a lowercase `[a-v0-9]` id (e.g. hex digest) from the Proposal id |
| Google Calendar invites | Omitting `sendUpdates: 'all'` | Set explicitly on every insert that should notify attendees |
| Google `freebusy.query` | Naive UTC timestamps for an `Asia/Hong_Kong` demo | Explicit `+08:00` offsets on timeMin/timeMax |
| Prisma + bun | Assuming `bunx prisma generate` behaves like `npx prisma generate` | Time-box it; fall back to `node node_modules/.bin/prisma generate` if it hangs |
| Trigger.dev CLI + bun | Trying to run `trigger dev` as a bun binary | Run the CLI via Node (`npx trigger.dev@latest dev`); bun only for the rest of the repo |
| Trigger.dev + npm fallback | Assuming the repo stays npm-free just because bun is the chosen manager | Gitignore `package-lock.json`; check `git status` after the first `trigger dev` run |
| Trigger.dev + Prisma | Assuming the shared Prisma client "just works" in a task | Add `prismaExtension` + `additionalPackages: ["@prisma/client"]` to `trigger.config.ts` |
| Trigger.dev env | Assuming Next.js's `.env.local` loading applies to tasks | Log one env var in the first real task; confirm before building on top |
| Next.js + bun | Running `bun --bun next dev` for speed | `bun run dev` invoking plain `next dev`, no `--bun` flag |
| Prisma + hot reload | New `PrismaClient()` per import in dev | `globalThis` singleton, module scope, one per process |
| Prisma + worktrees | `db push` before merging `develop` | Merge `develop` first, always, every time, in every track |
| bun + worktrees | Hand-merging `bun.lock` conflicts | Resolve `package.json`, then regenerate `bun.lock` via `bun install` |

## "Looks Done But Isn't" Checklist

- [ ] **Meet link on the calendar event:** often silently missing — verify by opening the created event (not just checking the API response status) and confirming a `meet.google.com` entry point exists.
- [ ] **B actually receiving the invite email:** verify `sendUpdates: 'all'` was set; check B's inbox once, don't assume attendee-list presence means notified.
- [ ] **Confidence gate showing real branch behavior:** verify by running the tonight's 4–5 sample messages again and confirming they land on different branches (high/medium/low), not just that a number is returned.
- [ ] **Second rehearsal actually re-runs the flow:** verify the dedupe/reset script exists and produces a *new* card, not silence or an error, on a repeated seeded message.
- [ ] **Calendar is clean before the live run:** open A's calendar for the target day and confirm no leftover rehearsal events near the demo's target slot.
- [ ] **`chat.update` actually mutates the same message in place:** verify visually — a new message appearing instead of the original updating means channel/ts is wrong, not that the feature "sort of works."
- [ ] **Custom shadcn tokens are visibly styled:** a token defined in `:root` but missing from `@theme inline` renders unstyled with no console error — check one element using it, don't assume the CSS variable alone is enough.
- [ ] **Two Bolt processes aren't both running:** check before starting work in a new worktree, not after a click mysteriously does nothing.
- [ ] **Bolt is running under Node, not bun's runtime:** a Bolt process that "starts fine" can still be one silent reconnect away from dropping every event — confirm the launch command once, don't infer it from "it seemed to work a minute ago."
- [ ] **No stray `package-lock.json` in the repo:** Trigger.dev's tooling can generate one behind your back; `git status` should never show it as untracked or committed.
- [ ] **Prisma client actually queries, not just "generated successfully":** a hung-then-killed `bunx prisma generate` can leave a half-written client that reports success on a retry but still can't find its engine at runtime — run one real query, not just the generate command, before trusting it.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|-----------------|
| Prisma "reset the database" accepted by accident | HIGH | Re-run seed script from scratch; if mid-demo, fall back to the freeze-and-record video |
| Duplicate Proposal from a retried Slack event | LOW | Add an `event_id`/dedupe check on the handler; manually delete the duplicate row for the live run |
| Calendar polluted with rehearsal events | LOW | Run the reset script's calendar-cleanup step (filter by `extendedProperties.private.demo`) |
| Two Bolt processes fighting over one token | LOW | Kill one; restart the surviving one; re-test with one message |
| Bolt reconnect-looping under bun's runtime | LOW | Change the launch command to Node; restart; re-test with one message |
| `bunx prisma generate` hangs | LOW | Kill it; rerun via `node node_modules/.bin/prisma generate` |
| Stray `package-lock.json` committed | LOW | Delete it, gitignore it, `bun install` to confirm `bun.lock` is still authoritative |
| `bun.lock` corrupted by a hand-merge | LOW | Discard the merged lockfile; `bun install` fresh from the merged `package.json` |
| Confidence scores uncalibrated, discovered late | MEDIUM | Narrow the live demo script to only the specific messages already verified to hit each branch; tighten the rubric only if time remains |
| Venue wifi drops mid-demo | HIGH (for a live re-run) / LOW (with prepared fallback) | Play the pre-recorded freeze video; do not attempt to debug live |
| LangGraph fighting the time budget | LOW (by design) | Rip out the graph, call the node functions in sequence directly — the project's own stated fallback, at the fixed merge-window decision time |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Two Bolt processes on one token | Slack surface phase (wave 1) + ongoing discipline | Check running processes before starting Bolt in a new worktree |
| Repo on `/mnt/c` file-watch failure | Scaffold phase | Edit-and-save timing check on the dev server's compile log |
| Trigger.dev needs internet | Freeze-and-record phase | Wifi ping check + hotspot fallback tested before the slot |
| Dedupe key blocks rehearsal / calendar pollution | Seed-and-rehearse phase | Run seeded message twice; check for a new card and a clean calendar |
| Bolt Socket Mode breaks under bun's runtime | Slack surface phase (wave 1) | Watch console on first startup for parse/reconnect errors |
| Prisma generate hangs/binary mismatch under bun | Scaffold phase | Time-box `bunx prisma generate`; confirm one real query after |
| Trigger.dev CLI doesn't run under bun; npm fallback | First Trigger.dev integration phase | Run CLI via Node; check `git status` for stray `package-lock.json` |
| Missing Meet link | Calendar integration phase (wave 1) | Open the created event, check `conferenceData.entryPoints` |
| Invalid custom event id charset | Calendar integration phase (wave 1) | First real `events.insert` with custom id succeeds, not 400 |
| 3-second ack violated | Slack surface phase (wave 1) | Watch for duplicate `event_id`/duplicate cards during dev |
| Confidence scores uncalibrated | Extraction phase (wave 2) + tonight smoke test | Run 4–5 sample messages, confirm score spread |
| Kilo Gateway strict-schema unsupported | Tonight smoke test | One real structured-output call per model id, Zod-parsed |
| `db push` race across worktrees | Every schema-touching phase | Merge `develop` before every push; watch for drift/data-loss prompts |
| Next.js dev server thrashing under forced bun runtime | Dashboard/UI phase (wave 2) | Watch for repeated BUILDING/BUILT on a single save |
| bun.lock merge conflicts across worktrees | Every merge-into-`develop` step | Regenerate via `bun install` after resolving `package.json`, never hand-merge |
| Bot reprocesses own messages | Slack surface phase (wave 1) | Filter check is the first line of the `message.channels` handler |
| `block_actions` state correlation | Bridge/approval-handler phase | Proposal id present in every block's value/private_metadata |
| `chat.update` wrong channel/ts | Bridge/approval-handler phase | Stored `channel`+`ts` on Proposal row used directly |
| `users:read.email` missing | Calendar/participant phase | One real `users.info` call returns an `email` field |
| Shortcut `callback_id` mismatch | Slack surface phase (wave 1) | Trigger shortcut once, confirm a log line prints |
| Testing-mode refresh token expiry | Pre-window checklist (tonight + morning-of) | One token refresh call succeeds |
| `freebusy` timezone mishandling | Conflict-detection phase (wave 3) | Log timeMin/timeMax, confirm HKT hours match expectation |
| "Next Friday" resolved wrong | Extraction phase (wave 2) | Current date+tz in prompt; deterministic day-of-week math in code |
| Prisma engine binary mismatch (Windows/WSL) | Scaffold phase | `bun install` only from WSL bash (moot once repo is native-FS) |
| Prisma generator output path mismatch | Scaffold phase | `schema.prisma` generator output matches `lib/db.ts` import |
| Trigger.dev + Prisma bundling | First Trigger.dev+Prisma phase | Trivial Prisma-touching task run once via `trigger dev` |
| Trigger.dev env vars not loaded | First Trigger.dev integration phase | Log one env var at task top, trigger manually |
| `googleapis` under bun untested | Calendar integration phase (wave 1) | One real OAuth2 + `freebusy.query` call under the actual runtime used |
| shadcn v3-style scaffold on v4 | Scaffold phase | No `tailwind.config.js`; `globals.css` has `@import "tailwindcss"` |
| Custom tokens missing `@theme inline` mapping | Dashboard/UI phase | One element using `bg-elevated` renders visibly styled |
| Biome flags Tailwind v4 at-rules | Scaffold phase | `css.parser.tailwindDirectives: true` set; `biome check` on `globals.css` reviewed once |
| LangGraph reducer overwrite surprises | Agent graph phase | Log full state after one real run; confirm arrays weren't reset |
| Docker/WSL memory pressure | Scaffold phase (tonight) | `.wslconfig` memory cap set; `docker stats` checked once |

## Do Tonight (not build-window work, but blocking if skipped)

- Add `message.channels` event subscription + `channels:history` scope, then **reinstall** the Slack app (already flagged in PROJECT.md as required — this is the single most consequential "tonight" item since nothing in the watched-channel design works without it).
- Confirm the repo lives under WSL's native filesystem (`~/...`), not `/mnt/c/...`; move it now if it doesn't.
- Set a `.wslconfig` memory cap and restart WSL once to confirm it applies.
- Pin exact (no `^`/`~`) versions for LangGraph JS, LangChain, and Trigger.dev packages in `package.json`.
- Run one real structured-output call against each chosen `MODEL_FAST`/`MODEL_SMART` id through the OpenAI-compatible SDK + Zod, confirming strict schema output actually parses.
- Run 4–5 representative sample messages through that same extraction call and confirm confidence scores actually spread across high/medium/low, not just clustering at ~0.9; tune the rubric now if they don't.
- Re-verify the Google OAuth refresh token still exchanges for a fresh access token (Testing-mode tokens can expire in 7 days).
- Confirm `users:read.email` is present on the *installed* scope set (not just the manifest) with one real `users.info` call.
- Add `prismaExtension` + `additionalPackages: ["@prisma/client"]` to `trigger.config.ts` before the first Trigger.dev+Prisma phase, so it isn't discovered as a build-time failure inside the window.
- Do one `bun install` end to end and confirm: `bunx prisma generate` completes without hanging, one real Prisma query works, the Bolt process starts under Node (not bun's runtime) and holds a stable Socket Mode connection for a minute, and no `package-lock.json` appears after a first `npx trigger.dev@latest dev` run. Gitignore `package-lock.json` proactively.
- Decide and write down the exact run command for each long-lived process now (Bolt → Node; Next.js dev → `bun run dev` without `--bun`; Trigger.dev CLI → Node via `npx`) so no one reaches for `bun --bun` out of habit mid-build tomorrow.

## Sources

- [Using Socket Mode — Slack Developer Docs](https://docs.slack.dev/apis/events-api/using-socket-mode/) — multi-connection load-balancing behavior, up to 10 connections, "no particular pattern" guarantee (HIGH confidence, official docs)
- [Socket Mode implementation — Slack](https://api.slack.com/apis/connections/socket-implement)
- [How to run multiple instances of a single Slack app — bolt-js#1263](https://github.com/slackapi/bolt-js/issues/1263)
- [@slack/bolt throwing errors and reconnecting under bun's WebSocket implementation — oven-sh/bun#4663](https://github.com/oven-sh/bun/issues/4663) — HIGH confidence, reproducible issue report
- [Events: insert — Google Calendar API reference](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert) — custom event id base32hex `[a-v0-9]`, 5–1024 chars (HIGH confidence, official docs)
- [Trigger.dev prismaExtension version detection — issue #1480](https://github.com/triggerdotdev/trigger.dev/issues/1480)
- [Trigger.dev Upgrade to new build system docs](https://trigger.dev/docs/upgrading-beta)
- [Trigger.dev Bun guide — CLI requires Node, tasks execute under Bun](https://trigger.dev/docs/guides/frameworks/bun)
- [Trigger.dev bun support tracking issue — npm fallback on bun-lockfile detection — issue #1191](https://github.com/triggerdotdev/trigger.dev/issues/1191)
- [`bun install` breaks Prisma — oven-sh/bun#4828](https://github.com/oven-sh/bun/issues/4828)
- [Postinstall fails / `bunx prisma generate` hangs — prisma/prisma#24678](https://github.com/prisma/prisma/issues/24678), [prisma/prisma#25730](https://github.com/prisma/prisma/issues/25730)
- [Prisma + Bun + Docker query-engine binary target mismatch — oven-sh/bun discussion #11853](https://github.com/oven-sh/bun/discussions/11853)
- [Next.js Turbopack excessive Fast Refresh rebuilds under bun runtime — vercel/next.js#89530](https://github.com/vercel/next.js/issues/89530)
- [Bun's new text-based lockfile (`bun.lock`, bun 1.2+)](https://bun.sh/blog/bun-lock-text-lockfile)
- [Biome — unknownAtRules for Tailwind v4 — issue #7223](https://github.com/biomejs/biome/issues/7223)
- [Biome v2.3 release notes — Tailwind v4 support, `css.parser.tailwindDirectives`](https://biomejs.dev/blog/biome-v2-3/)
- [Biome 2.3.1 residual Tailwind directive warnings — issue #7899](https://github.com/biomejs/biome/issues/7899)
- [shadcn/ui Tailwind v4 docs — `@theme inline` requirement](https://ui.shadcn.com/docs/tailwind-v4)
- [LangGraph.js MessagesAnnotation / reducer default-overwrite behavior](https://langchain-ai.github.io/langgraphjs/reference/variables/langgraph.MessagesAnnotation.html)
- Project source documents: `.planning/PROJECT.md`, `gsd-prompt-ai-secretary.md` (project-specific architecture decisions and pre-confirmed setup state, referenced throughout)
- WSL2 `/mnt/c` file-watch and inotify limitations, and Google OAuth Testing-mode 7-day refresh-token expiry: well-established, widely documented platform behavior (MEDIUM-HIGH confidence — not re-verified against a single canonical doc in this pass, but consistent with longstanding, current platform behavior)

---
*Pitfalls research for: AI Secretary hackathon build*
*Researched: 2026-09-11*
