# Phase 11: Freeze-and-Record - Research

**Researched:** 2026-09-11
**Domain:** Zero-setup Windows 11 screen recording + README assembly from existing planning docs (docs-and-human-recording phase, no library/stack research)
**Confidence:** HIGH

## Summary

Phase 11 builds no code. Its two deliverables — one screen-recorded clean run (DMO-03) and a final `README.md` (DMO-04) — are both **assembly and capture tasks against material that already exists** in `.planning/`, `PROJECT.md`, and `gsd-prompt-ai-secretary.md`. The research question is therefore not "what library" but "what zero-install Windows 11 tool captures a multi-window desktop flow cleanly" and "where does each required README sentence come from, verbatim or near-verbatim, so 11-02 is assembly, not authoring."

**Recording:** Windows 11's built-in **Snipping Tool** (`Win+Shift+R`) is the correct and only zero-setup choice. It captures a selected screen region or the full screen (not a single app window), which is required because the demo path crosses Slack, Google Calendar, and the Next.js dashboard in separate windows/tabs. It supports **Pause/Resume** mid-recording without splitting the file — this is the mechanism that satisfies "no dead air longer than a few seconds" without any new code, editing tool, or ffmpeg dependency. Xbox Game Bar (`Win+Alt+R`) is confirmed **unsuitable**: it explicitly refuses to record the desktop/File Explorer and can only capture one app window at a time. OBS is correctly out per the no-setup-phase constraint — it is not installed and installing it during the window would itself be a setup phase.

**README:** Every required section has a named source file and, for several, exact quotable text. The competitive-comparison correction is web-verified this session: **Clockwise shut down 27 March 2026** (Salesforce acquihired the team; the product was discontinued and user data deleted — **not** "folded into Reclaim," which is an unverified claim in `.planning/research/FEATURES.md` that should not be used). **Relay.app**: wind-down announced 16 Jul 2026, free access ended 15 Aug 2026, **paid access ends 14 Sep 2026 — two days after the 12 Sep 2026 hackathon**, confirming `SUMMARY.md`'s reconciliation over `FEATURES.md`'s "day before" wording.

**Primary recommendation:** Record with Snipping Tool's Pause/Resume during the live run itself (no post-editing); draft the README's static sections (competitive comparison, batch-first, OAuth, `interrupt()` note, scope/non-goals) as agent work in parallel with the human's recording prep; run `/ponytail-debt` for real near the end of the window and paste its literal output — supplemented with a clearly-separated, non-verbatim paragraph of already-decided known shortcuts from planning docs, because the ponytail ledger will very plausibly come back empty and an empty ledger alone risks reading as a placeholder against success criterion 4.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scope and ownership**
- **D-01:** Files owned: `README.md` only. Every other file is off-limits, and explicitly **no new code**. Consequence: the recording file is **not committed to the repo** (it isn't `README.md`); it lives outside the working tree.
- **D-02:** Commits go **directly to `main`**. No new branch, no merge.
- **D-03:** Two plans, per the roadmap's suggestion: **11-01** screen-records one clean run; **11-02** finalizes the README (competitive section, batch-first, OAuth, `interrupt()` note, ponytail-debt, abandoned stretch).
- **D-04:** Impeccable: none. Ponytail: `/ponytail-debt` only (no `/ponytail-audit`, no `/ponytail-review` in this phase).

**Recording (DMO-03)**
- **D-05:** Record **one clean run** of the whole demo path on `main`: the flow Phase 10 rehearsed (ignored chatter → Friday 11:00 proposal → approve → B's 10:30 ask → conflict alternatives, or the CFL-05 static warning if Phase 7 degraded).
- **D-06:** Acceptance: played back once, the video shows the entire demo path start to finish with **no dead air longer than a few seconds**, and **no narration filling a gap**.
- **D-07:** Before recording, run the early-detection checks: `ping -c 3 8.8.8.8` (from WSL) and **one live Trigger.dev sanity call**. If wifi is visibly flaky, treat that as the signal this recording matters more than usual. The recording is the mitigation, not a code fix.
- **D-08:** Processes and ports are the **same as Phase 10**: Next.js dev :3000, Bolt (sole instance), Trigger.dev dev CLI, Postgres :5432. Keep them alive only long enough to record, and shut them down once the recording is confirmed good (confirmed = played back).

**README (DMO-04)**
- **D-09:** The README covers **every required section**, each with actual content and no placeholder or TODO left anywhere. That includes the FND-02 headings Phase 1 skeletoned: what it is, core functionality, how it differs, problems tackled, architecture, usage, scope/non-goals, production design notes.
- **D-10:** Competitive comparison names: **Slackbot, Reclaim/Motion, Clockwise, Slack calendar apps, Fireflies/Otter/Spinach, n8n/Zapier, Relay.app.**
  - **Clockwise** is cited as **shut down (27 Mar 2026)**, never as a live competitor.
  - **Relay.app** is cited as **winding down, with paid access lapsing 14 Sep 2026**, never as a live competitor.
  - The human-in-the-loop comparison **leads with n8n/Zapier** (PROJECT.md Key Decision).
- **D-11:** Batch-first detection is documented as the production design with the **~20x cost reasoning** (~30-token message vs ~700-token system prompt, amortized by batching a window). It must also explain **why regex/keyword pre-filtering fails** as the primary filter: "same time as last week", "after standup", typos, abbreviations and Cantonese-English code-switching, with silent and untunable misses.
- **D-12:** **Multi-workspace via OAuth** is documented: the schema is already multi-tenant (`Installation` by `team_id`, `@@unique([team_id, slack_user_id])`), and OAuth distribution itself wasn't built.
- **D-13:** Exactly **one line** notes where `interrupt()` *would* fit: a seconds-long pause that continues reasoning. It is not an approval gate that spans unbounded human time.
- **D-14:** **`/ponytail-debt` output is pasted verbatim** into a "known shortcuts" section.
- **D-15:** The README states the **abandoned stretch work and why**.

**Time pressure**
- **D-16:** Cut nothing. If time is nearly gone, the **recording takes priority over README polish**, but both must exist in at least draft form by 15:30.

### Claude's Discretion
- Which screen recorder to use, and the recording's resolution, format and location outside the repo.
- Whether to run Phase 10's `prisma/reset-demo.ts` before recording (running an existing script isn't new code).
- README section order, headings wording beyond the required set, and prose.
- Whether the README references the recording (e.g. a note that a demo video exists) without committing the file.
- How the verbatim ponytail-debt block is formatted (e.g. fenced so Markdown doesn't reflow it).
- Whether 11-01 and 11-02 run in parallel (the recording is hands-on for the human; README drafting is agent work).

### Deferred Ideas (OUT OF SCOPE)
None. The PRD covers the phase scope. v2 items (SCL-01..03, DST-01/02, STR-06..08) may be *described* in the README as roadmap, but none are built.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DMO-03 | One clean run screen-recorded as the wifi fallback | Snipping Tool (`Win+Shift+R`) confirmed as the only zero-setup tool that captures the multi-window flow; Pause/Resume confirmed to satisfy the no-dead-air requirement without editing |
| DMO-04 | Final README covers competitive comparison, batch-first reasoning, multi-workspace via OAuth, `interrupt()` note, ponytail-debt known shortcuts, abandoned stretch | Full README Content Source Map below; competitive dates web-verified this session; ponytail-debt mechanics confirmed by reading the skill file directly |

## Architectural Responsibility Map

This phase adds no runtime code, so this map records provenance rather than app-tier ownership.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Demo recording capture | OS/Client (Windows Snipping Tool) | — | Screen capture is an OS-level action outside any of the app's own processes; no app code is touched |
| README content | Static docs (repo root, no runtime tier) | — | Markdown consumed by humans/judges, not served by any process; not part of Next.js/Bolt/Trigger.dev |
| The demo flow being recorded | Spans Browser/Client (Slack, Calendar, dashboard tabs) → API/Backend (Bolt, Trigger.dev) → Database (Postgres) → external service (Google Calendar) | — | Already built in Phases 1–10; Phase 11 captures it, it does not add a tier responsibility |

## Standard Stack

**Not applicable.** This phase installs zero external packages. No `npm install`/`pip install`/`cargo add` of any kind occurs; the only "tool" used is a Windows 11 built-in application (Snipping Tool), which is not a package dependency of the repo.

## Package Legitimacy Audit

**Skipped — required only when a phase installs external packages, and this phase installs none.** Snipping Tool is a Windows OS component, not a registry package; there is nothing to check against npm/PyPI/crates.

## Architecture Patterns

### Recording Tool Comparison (verified this session)

| Tool | Captures desktop / multiple windows? | Setup required | Pause/Resume | Verdict |
|------|----------------------------------------|-----------------|---------------|---------|
| **Snipping Tool** (`Win+Shift+R`) | Yes — region or full-screen capture on the chosen monitor; not limited to one app window | None — ships with Windows 11 | Yes (added in app version 11.2212.24.0) | **Use this** |
| Xbox Game Bar (`Win+Alt+R`) | No — refuses to record the desktop/File Explorer ("Gaming features aren't available for the Windows desktop or File Explorer") and can only capture one app window at a time | None — ships with Windows 11 | No | Reject — cannot capture the cross-window demo flow |
| OBS Studio | Yes (unlimited) | Requires install | Yes | Reject — installing it during the window is itself a setup phase, forbidden by PROJECT.md's "no setup phases" constraint |

Sources: [Microsoft — How to Record Your Screen on Windows 11](https://www.microsoft.com/en-us/windows/learning-center/how-to-record-screen-windows-11) [CITED], [Windows Latest — Snipping Tool app-window recording](https://www.windowslatest.com/2025/08/19/windows-11-can-now-screen-record-specific-app-windows-using-win-s-r-snipping-tool/) [CITED], multi-monitor/single-display limitation confirmed via WebSearch aggregation [CITED — MEDIUM, cross-checked across itechguides.com and screensnap.pro], Pause/Resume confirmed via [DotNetKicks — Snipping Tool pause screen recording](https://dotnetkicks.com/stories/627835/snipping-tool-on-windows-11-can-now-pause-screen-recording) [CITED] and cross-checked against [screensnap.pro — Snipping Tool Screen Recording Guide 2026](https://www.screensnap.pro/blog/snipping-tool-screen-recording-windows) [CITED]; Xbox Game Bar limitation confirmed via [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5655019/how-to-fix-the-recording-on-xbox-game-bar) [CITED] and [VibrantSnap — Xbox Game Bar Guide](https://www.vibrantsnap.com/blog/xbox-game-bar-screen-recording) [CITED].

**Note on multi-monitor:** Snipping Tool's selection lives on a single display — pick the demo monitor first if the laptop is connected to a second screen/projector during rehearsal. This is a one-time check, not a blocker, since a hackathon laptop demo is typically single-display when recording (the projector connection happens live on stage, not during this 15:10–15:30 recording window).

### Recommended Sequencing Inside the 20-Minute Window (research question 5)

11-01 (human-driven recording) and 11-02 (agent README drafting) **should run concurrently**, because most required README prose is static and derivable from planning docs right now, while only two things are genuinely window-dependent: the live `/ponytail-debt` output, and the actual abandon/degrade outcome of Phases 7/8/9 (CFL-05 static-warning path or not; S1/S2 built or README-only). Recommended split, honoring D-16 (recording has priority):

| Time | Human (11-01) | Agent (11-02) |
|------|----------------|-----------------|
| 15:10–15:12 | Close notification-generating apps; enable Focus Assist; arrange the demo windows (Slack, Google Calendar, dashboard) cleanly on one monitor | Draft the window-independent sections: what it is, core functionality, problems tackled, competitive comparison (with the corrected dates below), scope/non-goals, batch-first reasoning, OAuth note, `interrupt()` one-liner |
| 15:12–15:14 | `ping -c 3 8.8.8.8` from WSL; one live Trigger.dev sanity call (D-07); optionally run `prisma/reset-demo.ts` once for a guaranteed-clean state | Draft architecture/usage sections from `PROJECT.md` |
| 15:14–15:20 | Start Snipping Tool (`Win+Shift+R`), run the seeded demo flow exactly as Phase 10 rehearsed it, using Pause during any wait > a few seconds and Resume the instant the next visible change appears; stop when the flow completes | Idle or drafting the abandoned-stretch section from whatever Phase 8/9 actually produced |
| 15:20–15:22 | Play back the recording once; confirm no dead air and no narration-filling-a-gap (D-06). Re-record only if 11-01 is still ahead of schedule — D-16 forbids sacrificing README time to chase a marginally better take | Idle, standing by |
| 15:22–15:23 | Copy the file to a second location (see Recording Hygiene below); shut down Next.js/Bolt/Trigger.dev/Postgres processes (D-08) | Run `/ponytail-debt`; paste its literal output plus the supplementary known-shortcuts paragraph (see Pitfall: Empty Ponytail Ledger, below) |
| 15:23–15:29 | Read through the assembled README against the FND-02 heading checklist and the four success criteria | Finish assembly; note the recording's existence in the README per Claude's Discretion, without committing the file |
| 15:29–15:30 | Commit: `git add README.md` (explicit path, never `-A`); commit directly to `main`, no branch (D-02) | — |

This ordering guarantees both deliverables exist in draft form well before 15:30 and lets the human's uninterruptible ~6-minute recording window happen without the agent blocking on it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Screen capture | A custom capture script, or installing a third-party recorder (OBS, Loom, ShareX) | Windows 11 Snipping Tool (`Win+Shift+R`) | Built-in, zero-install — satisfies the "no setup phases" constraint; region/full-screen capture plus Pause/Resume and audio cover every requirement here |
| Removing dead air after recording | An ffmpeg trim pipeline or a video editor pass | Snipping Tool's built-in Pause/Resume, used live during capture | Zero post-processing risk in a 20-minute box; one continuous file that never needs re-encoding or a second tool's correctness verified under time pressure |
| Formatting the "known shortcuts" section | Hand-writing a shortcuts list from memory | Actually run `/ponytail-debt` and paste its literal output verbatim in a fenced block, then add a clearly separate prose paragraph for planning-doc-sourced shortcuts | D-14 requires the ledger's output verbatim; paraphrasing it fails the requirement even if the paraphrase is more complete |

**Key insight:** every "tool" this phase needs is either already built into Windows 11 or already exists as prose in `.planning/`/`PROJECT.md`/`gsd-prompt-ai-secretary.md`. Nothing here needs a new dependency, a new script, or new code — building any of that would itself violate D-01 ("no new code").

## README Content Source Map (for 11-02 — assembly, not authoring)

| Required section (FND-02 / DMO-04) | Exact source | Notes |
|---|---|---|
| **What it is** | `PROJECT.md:5` ("What This Is" — read this session) | One paragraph, usable near-verbatim |
| **Core functionality** | `gsd-prompt-ai-secretary.md:34` ("unprompted intent detection... an approval gate before anything is written to a calendar, and a per-person knowledge layer that improves proposals over time") | Note: "per-person knowledge layer" only materialized if S1 shipped — phrase conditionally or move the caveat into "abandoned stretch" |
| **How it differs (competitive comparison)** | `.planning/research/FEATURES.md` §"Competitive Landscape: Verification Update" (table) + `.planning/research/SUMMARY.md` (Relay.app date reconciliation) + this document's web-verified corrections below | **Must apply the Clockwise correction below — do not repeat FEATURES.md's unverified "folded into Reclaim" claim** |
| **Problems tackled** | `gsd-prompt-ai-secretary.md:36` ("commitments made in chat evaporate into scrollback; scheduling costs a round trip of messages; an agent that acts without asking is untrustworthy; an agent that asks about everything is noise, which is why the confidence gate exists") | Usable verbatim |
| **Architecture** | `PROJECT.md:83-90` ("Runtime processes (who owns what)") + `PROJECT.md:148-159` (Data model block) + the message→proposal→approval→calendar flow already narrated in `PROJECT.md:136-146` ("Agent design") | Combine as: process list, data model table, one flow diagram/paragraph |
| **Usage** | Root `CLAUDE.md` and `package.json` scripts (both Phase-1-authored; read at execution time, not decided here) + `PROJECT.md:127-134` ("Services, connections, environments") for env var / compose shape | Executor must read the actual Phase 1 artifacts at execution time — this research cannot quote files that don't exist yet |
| **Scope and non-goals** | `.planning/REQUIREMENTS.md:123-140` ("Out of Scope" table, full text already reproduced below) | Table is already written; can be reformatted directly into prose or kept as a table |
| **Production design notes** (parent heading; nest the four DMO-04 sub-requirements below it, or use separate top-level headings — Claude's Discretion on structure) | — | — |
| — Batch-first detection + ~20x reasoning | `PROJECT.md:142` (full paragraph, quoted below) and `gsd-prompt-ai-secretary.md:175` (near-identical paragraph, either is authoritative) | Both sources agree; use `PROJECT.md`'s as primary since it is the project's own canonical doc |
| — Multi-workspace via OAuth | `PROJECT.md:212` (Key Decisions row, quoted below) + `PROJECT.md:54` ("Out of Scope" — "Public OAuth distribution... The schema is multi-tenant from the start, and the README documents multi-workspace via OAuth") | Two-sentence note: schema already multi-tenant, OAuth flow itself not built |
| — `interrupt()` one-liner | `gsd-prompt-ai-secretary.md:102` (exact sentence quoted below) | This is *the* one line — do not expand it into a design discussion, D-13 caps it at one line |
| — Known shortcuts (`/ponytail-debt`) | Live output of `/ponytail-debt`, run during 11-02 execution, **plus** a separate supplementary paragraph — see Pitfall below | See "Pitfall: Empty Ponytail Ledger" |
| — Abandoned stretch work and why | Whatever Phase 8/9 actually produced (read their phase artifacts at execution time) + `.planning/STATE.md:76-77` ("Stretch phases (8, 9) will very likely not complete on schedule per their own honest-arithmetic notes — treat as README-only unless the core finishes materially early") as the fallback framing if both stayed README-only | This is the one section this research genuinely cannot pre-fill — it is decided by what actually happened in the window |

### Exact quotable text

**Batch-first reasoning** [VERIFIED: PROJECT.md:142, read this session] —
> "a message is ~30 tokens vs a ~700-token system prompt, so batching a window amortizes the prompt for ~20× savings. Regex/keyword pre-filtering can't be the primary filter: it fails on 'same time as last week', 'after standup', typos, abbreviations and Cantonese-English code-switching, and its misses are silent and untunable. Production: a cheap local router for time-urgent messages only (poor recall allowed), a per-channel batch sweep over a bounded window as the workhorse, full extraction + conflict reasoning on candidates only; `dedupe_key` absorbs overlapping windows."

**Multi-workspace via OAuth** [VERIFIED: PROJECT.md:212, read this session] —
> "Multi-tenant schema (`Installation` by `team_id`, `@@unique([team_id, slack_user_id])`) without OAuth distribution | Slack user ids are workspace-scoped; README can credibly claim multi-workspace via OAuth"

**`interrupt()` one-liner** [VERIFIED: gsd-prompt-ai-secretary.md:102, read this session] —
> "The narrow case where `interrupt()` *would* fit — worth one line in the README, not in the build — is a pause measured in seconds where the resumption continues *reasoning*, such as an agent asking a clarifying question mid-analysis. An approval gate spanning unbounded human time is not that case."

**Scope and non-goals — full source table** [VERIFIED: REQUIREMENTS.md:123-140, read this session]:

| Feature | Reason |
|---------|--------|
| Autoreply / sending on the user's behalf | Breaks the approval-gate thesis; roadmap-only line in the README |
| Tests of any kind / test frameworks | User's explicit repo rule; testing is a later decision the user will raise |
| LangGraph `interrupt()` / durable checkpointer / Redis | Approval waits are unbounded; re-derive from the row instead |
| Subgraphs, multi-agent handoff, tool-calling loops | Hard ≤5-node scope cap |
| Unfiltered `message.channels` firehose | Only the env allowlist is processed |
| Sentiment analysis of colleagues | Reads as surveillance |
| Slack Marketplace distribution | One workspace on the day |
| Group-thread organizer election beyond default + tiebreak | Two-person demo |
| Recurring events; timezones beyond `Asia/Hong_Kong` | No stage payoff |
| Prettier / ESLint / second component library / `tailwind.config.js` / React Context for app state | Fixed stack and repo rules |
| npm / npx / yarn / pnpm commands | bun only |
| `/ponytail-audit`, `/impeccable init`, live browser iteration setup | Setup or whole-repo scans the window can't afford |
| Account or tooling setup phases | Done before the window |
| Zep Cloud; cloud graph DB during the window | No free tier; venue-wifi round trips |

**Known-shortcuts supplementary quotes** (not `/ponytail-debt` output, but candidate planning-doc-sourced shortcuts to describe in prose alongside the ledger):
- [VERIFIED: 01-CONTEXT.md:152, read this session] — "The local refresh token sits in Postgres in plaintext, seeded from env. This is acceptable for a one-laptop demo; it's a candidate for `/ponytail-debt` 'known shortcuts'."
- [VERIFIED: PROJECT.md:213, read this session] — "`prisma db push` for the whole window, serialized through `develop` | Migration history has no value in 4h; avoids drift/reset prompts"
- [VERIFIED: PROJECT.md:222, read this session] — "Only one Bolt process running across all worktrees at any time | Socket Mode load-balances events across every connection on an app token, so a second Bolt process in another worktree steals events"
- [VERIFIED: PROJECT.md:224, read this session] — "No tests; Biome only; TSDoc on every function | User's explicit repo rules; doc comments are a deliverable"
- Hand-seeded account linking (FND-10) and no account-linking UI — already covered under Scope and non-goals, cross-reference rather than duplicate.

## Common Pitfalls

### Pitfall 1: Dead air from real pipeline latency
**What goes wrong:** The demo path has genuine multi-second latency at three points: the Kilo Gateway model call, the Trigger.dev cloud-queue round trip, and the Google Calendar `events.insert` call. Recording start-to-finish with no intervention will show visible dead time at each of these, failing success criterion 1.
**Why it happens:** These are real network calls to cloud services the recording cannot speed up.
**How to avoid:** Use Snipping Tool's Pause/Resume live, during capture — pause the instant a wait begins, resume the instant the next visible UI change (card update, dashboard row, calendar event) appears. This produces one continuous file with no editing step and no dead air, satisfying D-06 without new tooling.
**Warning signs:** Watching the raw (unpaused) footage back and seeing more than a few seconds of static screen between an action and its visible result.

### Pitfall 2: Empty ponytail ledger reads as a placeholder, not "clean"
**What goes wrong:** `/ponytail-debt` (confirmed by reading `ponytail-debt/SKILL.md` this session) does one thing: `grep -rnE '(#|//) ?ponytail:' .` and reports either per-marker rows or the literal string `No ponytail: debt. Clean ledger.` if nothing matches. Nothing in this project's plan mandates writing `ponytail:` comment markers into code — the known shortcuts discussed in planning docs (plaintext refresh token, `db push` not migrations, no tests, single Bolt process) are documented in prose in `PROJECT.md`/`01-CONTEXT.md`, not marked with `ponytail:` comments in code. It is therefore plausible the ledger comes back clean, and a "known shortcuts" section containing only the one-line "Clean ledger" sentence risks reading as thin against success criterion 4 ("every required README heading has actual content, not a placeholder").
**Why it happens:** The grep pattern only finds markers that were actually written; it cannot retroactively discover shortcuts that were only ever discussed in planning prose.
**How to avoid:** Run `/ponytail-debt` for real and paste its literal output verbatim in a fenced code block (satisfies D-14 exactly, whatever it says). Immediately below that fenced block, in ordinary (non-verbatim) prose under a clearly distinct sub-heading such as "Other known shortcuts (design decisions, not ponytail markers)", list the planning-doc-sourced shortcuts quoted above. This keeps the verbatim requirement intact (nothing is added inside the fenced block) while still giving the section real content if the ledger is clean.
**Warning signs:** The known-shortcuts section is a single sentence with nothing else nearby.

**Second-order note on the grep pattern itself:** the skill's default pattern (`(#|//) ?ponytail:`) matches `//` line comments but **not** a TSDoc block-comment continuation line (`* ponytail: ...`) or a JSX comment (`{/* ponytail: ... */}`). This project mandates TSDoc on every function (FND-01); if any earlier phase wrote a `ponytail:` marker inside a TSDoc block using a leading `*` rather than `//`, the default grep will silently miss it and the ledger will under-report. The skill's own instructions say to "add other comment prefixes if your stack uses them" — at execution time, consider re-running the scan with a broadened pattern (e.g. `(#|//|\*) ?ponytail:`) via `git grep` (which respects `.gitignore` and skips `node_modules`/`.next`/`prisma/generated` automatically, unlike a raw `grep -r`) before trusting a "Clean ledger" result. This is a verification step, not new code — it changes nothing, it just widens what gets read.

### Pitfall 3: Secrets or tokens visible on screen during recording
**What goes wrong:** A terminal with `.env` contents printed from earlier debugging, or a log line that echoes a Slack token, ends up in the recorded video — which may be shared publicly as a GitHub README asset.
**Why it happens:** Terminal scrollback persists across a work session; nothing in the build explicitly prevents a token from appearing in a log line.
**How to avoid:** Before recording, open fresh terminal windows for each long-lived process (Next.js, Bolt, Trigger.dev CLI) rather than reusing ones with debugging history; do not `cat .env` or similar on camera; glance at each visible terminal's scrollback before starting the recording.
**Warning signs:** Any terminal pane visible in the recording that was used earlier in the day for anything other than starting that one process.

### Pitfall 4: Notification toasts interrupting the "clean run"
**What goes wrong:** A Windows notification (Slack desktop, Teams, Windows Update, email) pops up mid-recording, breaking the "no narration filling a gap" / visibly clean feel of the fallback video.
**How to avoid:** Enable Windows 11 Focus Assist / "Do not disturb" (Quick Settings, notification bell icon) before starting the recording. [ASSUMED — standard Windows 11 UX, not independently re-verified this session]
**Warning signs:** A toast visible in the recorded footage.

### Pitfall 5: Recording file accidentally entering the repo or the wrong commit
**What goes wrong:** D-01 requires the recording never be committed. Snipping Tool's default save location is `%USERPROFILE%\Videos\Screen Recordings\`, which is already outside `C:\coding_proj\ai-secretary` and therefore safe by default — but a habit of `git add -A` (rather than an explicit path) would still risk sweeping in an accidentally-saved copy, a stray `package-lock.json`, or any other untracked file that shouldn't be part of a README-only commit.
**How to avoid:** Confirm the save location is outside the repo tree before recording (it is, by default). Commit with the explicit path `git add README.md`, never `git add -A` or `git add .`, matching the same discipline this research task itself was run under.
**Warning signs:** `git status` before committing shows anything other than `README.md` as staged/modified.

### Pitfall 6: Venue wifi degrades mid-recording, and the recording is the only mitigation for exactly that scenario
**What goes wrong:** Per `PITFALLS.md` Pitfall 3, Trigger.dev's dev CLI depends on its hosted control plane even for "local" task execution; a flaky venue connection can stall or fail the very run being recorded as the fallback for a flaky venue connection.
**How to avoid:** D-07's pre-recording checks (`ping -c 3 8.8.8.8`, one live Trigger.dev sanity call) exist precisely to surface this before committing 6 minutes of the 20-minute box to a take that will fail partway through. If wifi is visibly degraded, this document flags — as a discretionary option, not a default — that `AGENT_TRANSPORT=inline` (the env-only flag built in Phase 4) would remove the Trigger.dev cloud dependency from this specific recorded take. **This is a deviation from D-08's "same processes as Phase 10"** and should be a human judgment call made only if the ping/sanity-check genuinely shows trouble, not a default plan — the roadmap's own design intent is that the recording reflect the same flow and process set actually rehearsed.
**Warning signs:** The sanity-check task takes noticeably longer than expected, or the `trigger dev` terminal shows reconnect/retry noise.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Snipping Tool | DMO-03 recording | ✓ — built into Windows 11 | Native app, confirmed to support Pause/Resume as of app version 11.2212.24.0+ | — |
| Xbox Game Bar | — | ✓ but unsuitable (confirmed: single-app-window only, cannot record desktop) | Native | Not used — Snipping Tool is the choice |
| OBS Studio | — | Not verified installed; assume ✗ | — | Do not install — violates the no-setup-phase constraint; not needed given Snipping Tool covers the requirement |
| Windows Focus Assist | Notification suppression during recording | ✓ — built into Windows 11 | Native | — |
| ffmpeg (WSL, optional post-hoc trim) | Not needed if Pause/Resume is used during capture | Unverified — not checked this session | — | Not required; Pause/Resume during recording makes a trim step unnecessary |

**Missing dependencies with no fallback:** None — every tool this phase needs is a Windows 11 built-in.

**Missing dependencies with fallback:** None applicable; ffmpeg is listed only as an unneeded contingency, not a requirement.

## State of the Art

### Competitive-comparison dates (web-verified this session, 2026-09-11)

| Competitor | `gsd-prompt-ai-secretary.md`'s original claim | Verified 2026-09-11 status | Safe README wording |
|---|---|---|---|
| **Clockwise** | Named as a live competitor alongside Reclaim/Motion | **Shut down 27 March 2026.** Salesforce acquihired the Clockwise *team* (not the product); the product itself was discontinued, user data was deleted, prepaid customers received prorated refunds. `.planning/research/FEATURES.md`'s claim that Clockwise "folded into Reclaim"/was "acquired/absorbed" by Reclaim is **not supported by this session's search results** — the acquirer was Salesforce, and it was an acquihire of engineering talent for an unrelated agentic-AI product line, not a Reclaim feature-space absorption. | "Clockwise — shut down 27 March 2026 (the team joined Salesforce in an acquihire; the product itself was discontinued). Never cite as a live competitor." Do **not** repeat the "folded into Reclaim" framing. |
| **Relay.app** | Named as a live generic-HITL competitor alongside n8n/Zapier | Wind-down announced 16 Jul 2026. Free-tier access ended 15 Aug 2026. **Paid-customer access ends 14 Sep 2026 — two days after this hackathon (12 Sep 2026)**, confirming `SUMMARY.md`'s reconciliation over `FEATURES.md`'s "the day before" wording. | "Relay.app — winding down; paid access lapses 14 Sep 2026, two days after this demo. Lead the human-in-the-loop comparison with n8n and Zapier, both still active." |

Sources: [Doodle — Clockwise is shutting down](https://doodle.com/en/clockwise-is-shutting-down-what-to-do-next-in-2026/) [CITED], [usecarly.com — Clockwise Shut Down in March 2026](https://www.usecarly.com/blog/clockwise-shut-down/) [CITED], [thedailyclaws.com — Clockwise Shuts Down After Salesforce Acquisition](https://thedailyclaws.com/blog/2026-03-20-news-clockwise-shutdown-salesforce/) [CITED — names Salesforce, not Reclaim, as acquirer], [Relay.app's own shutdown notice](https://relay.app/) [CITED — primary source], [docs.relay.app — Relay.app is shutting down](https://docs.relay.app/) [CITED — primary source], [usecarly.com — Relay.app Is Shutting Down: Aug 15 for Free, Sep 14 for Paid](https://www.usecarly.com/blog/relay-app-shutting-down/) [CITED], [getinboxzero.com — Relay.app Is Shutting Down](https://www.getinboxzero.com/blog/post/relay-app-shutting-down) [CITED]. Multiple independent sources agree on both date sets — this is a MEDIUM-HIGH confidence finding (vendor/aggregator blogs plus Relay.app's own primary shutdown notice, cross-checked).

**Deprecated/outdated:** `.planning/research/FEATURES.md`'s specific phrase "Reclaim acquired/absorbed the space" for Clockwise should not be reused in the README — this session's verification points to Salesforce as the acquirer, of the team, not the product. `CONTEXT.md` D-10 already avoids this trap (it says only "shut down," no acquirer claim), so this is a note for the researcher/planner, not a conflict with a locked decision.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Windows 11 Focus Assist / "Do not disturb" suppresses notification toasts and is accessible from Quick Settings | Pitfall 4 | Low — worst case a toast appears in the recording and the take is re-shot; does not block the phase |
| A2 | Snipping Tool's default save location (`%USERPROFILE%\Videos\Screen Recordings\`) remains outside the repo directory on the actual demo laptop | Pitfall 5 / Environment Availability | Low-medium — if the save location was ever reconfigured to somewhere inside `C:\coding_proj\ai-secretary`, the file could risk being swept into a careless `git add`; mitigated regardless by using an explicit `git add README.md` |

**If this table is empty:** N/A — two low-risk assumptions are logged above; both are cheap to confirm by eye during 11-01 and neither blocks planning.

## Open Questions

1. **Will Phase 7 finish on the direct path or degrade to CFL-05 (static conflict warning)?**
   - What we know: The roadmap's cut-line table gives Phase 7 a hard 14:15 start requirement for the conflict work, degrading to a static warning otherwise (D-05 already accounts for both outcomes).
   - What's unclear: Which one actually happened, since this research runs before the build window opens.
   - Recommendation: 11-01's plan should record whichever flow is actually live on `main` at 15:10 — this is a runtime fact-check at execution time, not a planning-time decision.

2. **Did S1 (Graphiti) or S2 (CopilotKit) ship, or are both README-only?**
   - What we know: `STATE.md` and `SUMMARY.md` both flag this as the realistic ("honest arithmetic") outcome — both stretch phases are gated on Phase 7 finishing early, and the schedule makes that unlikely.
   - What's unclear: The actual outcome, again only knowable at execution time.
   - Recommendation: 11-02's "abandoned stretch work and why" section should read Phase 8/9's actual phase artifacts (their PLAN.md/completion state) at execution time rather than assume README-only; if genuinely nothing was attempted, state that plainly with the scheduling reason from `STATE.md`, rather than describing a fictional abandonment.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/11-freeze-and-record/11-CONTEXT.md` — read this session, locked decisions
- `.planning/REQUIREMENTS.md` — read this session, DMO-03/DMO-04, Out of Scope table
- `.planning/STATE.md` — read this session
- `.planning/PROJECT.md` — read this session, Key Decisions, Agent design, Runtime processes, Data model, Out of Scope
- `gsd-prompt-ai-secretary.md` — read this session, README section list, `interrupt()` section, batch-first/ponytail-debt conventions
- `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md` — read this session, README skeleton (D-20), plaintext-refresh-token note (specifics)
- `.planning/ROADMAP.md` — read this session, Phase 11 detail, Process & Port Map, Cut-Line Table, File Ownership Matrix
- `.planning/config.json` — read this session, confirmed `nyquist_validation: false`
- `~/.claude/plugins/cache/ponytail/ponytail/4.9.0/skills/ponytail-debt/SKILL.md` — read this session, exact grep pattern and output contract
- `docs.relay.app` / `relay.app` — Relay.app's own primary shutdown notice, fetched via WebSearch this session

### Secondary (MEDIUM confidence)
- `.planning/research/FEATURES.md`, `.planning/research/SUMMARY.md`, `.planning/research/PITFALLS.md` — read this session
- Microsoft's own Snipping Tool / screen-recording documentation, fetched via WebSearch this session
- Multiple independent vendor/aggregator blogs on the Clockwise and Relay.app shutdown timelines, cross-checked against each other and against Relay.app's own notice

### Tertiary (LOW confidence)
- Windows Focus Assist accessibility claim (A1 in Assumptions Log) — from training knowledge, not independently re-verified this session

## Metadata

**Confidence breakdown:**
- Recording tool choice: HIGH — Snipping Tool vs. Xbox Game Bar capability differences confirmed via multiple independent sources this session, including Microsoft's own docs
- README content sourcing: HIGH — every required section traced to a specific file and, for several, an exact verbatim quote read this session
- Competitive-comparison dates: MEDIUM-HIGH — cross-checked across multiple independent sources including Relay.app's own primary notice; Clockwise's acquirer (Salesforce, not Reclaim) is a correction to existing project research, not a locked decision, flagged for the planner
- Ponytail-debt mechanics: HIGH — the skill file itself was read directly this session, not inferred

**Research date:** 2026-09-11
**Valid until:** 2026-09-12 (the hackathon demo day itself) — this research is single-use for a one-day event; the competitive-comparison dates in particular will continue to age and should not be reused for any future milestone without re-verification
