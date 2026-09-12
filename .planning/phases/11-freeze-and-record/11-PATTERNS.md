# Phase 11: Freeze-and-Record - Pattern Map

**Mapped:** 2026-09-11
**Files analyzed:** 1 (`README.md`)
**Analogs found:** 0 code analogs / 1 (this phase writes no code; `README.md` is assembled from planning-doc content sources, not modeled on any code file)

## Scope note

This phase adds zero runtime code (per CONTEXT.md D-01, D-09). The only file
touched is `README.md`. There is nothing in the repo to pattern-match against
for *code* structure — the repo is currently unscaffolded (only `.planning/`,
`.claude/`, and root `gsd-prompt-ai-secretary.md` exist; `README.md` itself
does not exist yet and will first appear as a Phase 1 skeleton at build time,
which this phase then finalizes). So instead of code analogs, this maps
`README.md`'s required sections to their exact **content-source** files and
line anchors, verified tracked in git.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `README.md` | docs (no code) | n/a — static content assembly | No code analog; content sourced from `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `gsd-prompt-ai-secretary.md`, `.planning/research/{FEATURES,SUMMARY}.md`, plus a Phase 1 skeleton (not yet on disk) | content-source-map (not a code pattern) |

## Content Source Map for `README.md`

All paths below verified via `git ls-files` — tracked, not mirrors — **except**
`gsd-prompt-ai-secretary.md`, which is a real root file but currently
**untracked** (shows `??` in `git status`; it is the author's own working
prompt doc, not a gitignored plugin/install mirror). Cite it for content as
research does, but do not present it as a "tracked analog."

### What it is
**Source:** `.planning/PROJECT.md:5` (opening "What This Is" line) — usable near-verbatim, one paragraph.

### Core functionality
**Source:** `gsd-prompt-ai-secretary.md:34` —
> "unprompted intent detection... an approval gate before anything is written to a calendar, and a per-person knowledge layer that improves proposals over time"

Caveat: the "per-person knowledge layer" phrase only holds if S1 (Graphiti) shipped. Phrase conditionally, or fold the caveat into the abandoned-stretch section — check Phase 8/9 artifacts at execution time before using this verbatim.

### How it differs (competitive comparison) — CORRECTION REQUIRED
**Sources:**
- `.planning/research/FEATURES.md` §"Competitive Landscape: Verification Update" — table of competitors, **but its Clockwise wording is WRONG and must not be copied verbatim.**
- `.planning/research/SUMMARY.md` — supersedes FEATURES.md's Relay.app date wording ("the day before" → corrected below).

**Do NOT copy:** FEATURES.md's claim that Clockwise "folded into Reclaim" / was "acquired/absorbed by Reclaim." That claim is unverified and contradicted by this phase's research (RESEARCH.md lines 232-241): the acquirer was **Salesforce** (an acquihire of the team for an unrelated product line), not Reclaim, and the Clockwise product itself was discontinued, not merged.

**Correct wording to use instead** (from RESEARCH.md:236-237):
- Clockwise: "shut down 27 March 2026 (the team joined Salesforce in an acquihire; the product itself was discontinued). Never cite as a live competitor."
- Relay.app: "winding down; paid access lapses 14 September 2026, two days after this demo (12 Sep 2026). Lead the human-in-the-loop comparison with n8n and Zapier, both still active." — per CONTEXT.md D-10, n8n/Zapier lead this comparison (PROJECT.md Key Decision), not Relay.app.

Competitor name list required (CONTEXT.md D-10): Slackbot, Reclaim/Motion, Clockwise, Slack calendar apps, Fireflies/Otter/Spinach, n8n/Zapier, Relay.app.

### Problems tackled
**Source:** `gsd-prompt-ai-secretary.md:36` — usable verbatim:
> "commitments made in chat evaporate into scrollback; scheduling costs a round trip of messages; an agent that acts without asking is untrustworthy; an agent that asks about everything is noise, which is why the confidence gate exists"

### Architecture
**Sources:** `.planning/PROJECT.md:83-90` ("Runtime processes") + `.planning/PROJECT.md:148-159` (Data model block) + `.planning/PROJECT.md:136-146` ("Agent design" flow narration). Combine as: process list, data model table, one flow paragraph.

### Usage
**Sources:** Phase-1-authored root `CLAUDE.md`/`package.json` scripts (read at execution time — these don't exist in this session's tree yet) + `.planning/PROJECT.md:127-134` ("Services, connections, environments") for env var / compose shape.

### Scope and non-goals
**Source:** `.planning/REQUIREMENTS.md:123-140` — "Out of Scope" table, already fully written; reformat as prose or keep as a table. Full table text is reproduced in RESEARCH.md:153-170 for convenience.

### Production design notes

**Batch-first detection (~20x cost reasoning)** — `.planning/PROJECT.md:142`, quoted exactly in RESEARCH.md:144-145:
> "a message is ~30 tokens vs a ~700-token system prompt, so batching a window amortizes the prompt for ~20× savings. Regex/keyword pre-filtering can't be the primary filter: it fails on 'same time as last week', 'after standup', typos, abbreviations and Cantonese-English code-switching, and its misses are silent and untunable. Production: a cheap local router for time-urgent messages only (poor recall allowed), a per-channel batch sweep over a bounded window as the workhorse, full extraction + conflict reasoning on candidates only; `dedupe_key` absorbs overlapping windows."

**Multi-workspace via OAuth** — `.planning/PROJECT.md:212` (Key Decisions row), quoted in RESEARCH.md:147-148:
> "Multi-tenant schema (`Installation` by `team_id`, `@@unique([team_id, slack_user_id])`) without OAuth distribution | Slack user ids are workspace-scoped; README can credibly claim multi-workspace via OAuth"

**`interrupt()` one-liner (exactly one line, D-13)** — `gsd-prompt-ai-secretary.md:102`, quoted in RESEARCH.md:150-151:
> "The narrow case where `interrupt()` *would* fit — worth one line in the README, not in the build — is a pause measured in seconds where the resumption continues *reasoning*, such as an agent asking a clarifying question mid-analysis. An approval gate spanning unbounded human time is not that case."

**Known shortcuts (`/ponytail-debt`)** — run `/ponytail-debt` live during 11-02 execution; paste its literal output verbatim inside a fenced code block (satisfies D-14 exactly, whatever it says — do not paraphrase). Immediately below, in ordinary prose under a distinct sub-heading (e.g. "Other known shortcuts (design decisions, not ponytail markers)"), list planning-doc-sourced shortcuts not captured by the grep:
- `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md:152` — plaintext refresh token in Postgres, seeded from env; acceptable for a one-laptop demo.
- `.planning/PROJECT.md:213` — `prisma db push` for the whole window, no migration history.
- `.planning/PROJECT.md:222` — only one Bolt process across all worktrees (Socket Mode load-balances events; a second process steals them).
- `.planning/PROJECT.md:224` — no tests, Biome only, TSDoc on every function.

If `/ponytail-debt`'s grep pattern (`(#|//) ?ponytail:`) might miss TSDoc-block (`* ponytail:`) or JSX-comment markers, re-run with a broadened pattern via `git grep -nE '(#|//|\*) ?ponytail:'` before trusting a "Clean ledger" result (RESEARCH.md:193).

**Abandoned stretch work and why** — read Phase 8/9's actual phase artifacts at execution time (their PLAN.md / completion state); fall back to `.planning/STATE.md:76-77`'s "both stretch phases are gated on Phase 7 finishing early, and the schedule makes that unlikely" framing only if genuinely nothing was attempted.

## Shared Patterns

### Verbatim-block formatting for `/ponytail-debt`
**Source:** CONTEXT.md D-14, D-uses discretion for exact fencing.
**Apply to:** the "Known shortcuts" section only.
```markdown
## Known shortcuts

### `/ponytail-debt` output (verbatim)
```text
<paste literal command output here, unedited>
```

### Other known shortcuts (design decisions, not ponytail markers)
<prose paragraph, not fenced>
```

### Git commit discipline
**Source:** RESEARCH.md Pitfall 5 / CONTEXT.md D-02.
**Apply to:** the single commit this phase makes.
```
git add README.md   # explicit path, never -A or .
git commit -m "..."  # directly to main, no branch, no merge
```

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `README.md` (as a code-pattern target) | docs | n/a | No prior README or docs file exists in the tracked tree to model structure on; Phase 1's skeleton (FND-02 headings) is the nearest thing but is a cross-phase artifact not yet present in this session's tree — read it at execution time rather than treat it as a stand-in analog here. |

## Metadata

**Analog search scope:** repo root (`git ls-files`), `.planning/`, `.claude/CLAUDE.md`
**Files scanned:** `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/research/FEATURES.md`, `.planning/research/SUMMARY.md`, `.planning/research/PITFALLS.md`, `gsd-prompt-ai-secretary.md`, `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md`
**Pattern extraction date:** 2026-09-11
