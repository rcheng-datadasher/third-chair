---
phase: 08-optional-s2-commitment-ledger
plan: 01
subsystem: ai
tags: [copilotkit, generative-ui, zod, openai-sdk, kilo-gateway, extraction]

requires:
  - phase: 05-agent-confidence-gate
    provides: "lib/agent/extract-intents.ts's ExtractedIntentSchema, extractIntents, renderNumberedLines (meeting extraction, untouched)"
  - phase: 01-foundation-hardcoded-round-trip
    provides: "lib/ai/provider.ts's complete<T>() wrapper and module-scope OpenAI client; lib/config.ts's typed env reader"
provides:
  - "openaiClient named export from lib/ai/provider.ts (raw client for CopilotKit's adapter)"
  - "app/api/copilotkit/route.ts — thin CopilotKit runtime endpoint on the default (non-/v2) API generation"
  - "app/commitments/page.tsx + components/commitment-ledger/ledger-surface.tsx — URL-only ledger chat surface"
  - "lib/agent/commitment-schema.ts, lib/agent/extract-commitments.ts — additive commitment intent type + extractor (STR-04)"
  - "lib/commitment-ledger/select-component.ts, lib/commitment-ledger/seed-rows.ts — deterministic component selector + 6 seed rows"
affects: [08-02-ledger-surface-nudge-wiring]

actuals:
  tokens: 5460
  tasks: 3
  commits: 3
  plan_head_before: 8c0e488d862be9c8043b63bf002fd9700adc0fa9

tech-stack:
  added: ["@copilotkit/react-core@1.71.0", "@copilotkit/react-ui@1.71.0", "@copilotkit/runtime@1.71.0"]
  patterns:
    - "CopilotKit default (non-/v2) API generation: CopilotRuntime + OpenAIAdapter + copilotRuntimeNextJSAppRouterEndpoint, constructed from a caller-supplied OpenAI-SDK client so Kilo Gateway's custom baseURL is reachable"
    - "Deterministic row-to-component selection as a pure function, kept out of the model's hands entirely"
    - "Additive Zod schema beside an existing one (new file, new root wrapper), never editing the original"

key-files:
  created:
    - lib/agent/commitment-schema.ts
    - lib/agent/extract-commitments.ts
    - lib/commitment-ledger/select-component.ts
    - lib/commitment-ledger/seed-rows.ts
    - app/api/copilotkit/route.ts
    - app/commitments/page.tsx
    - components/commitment-ledger/ledger-surface.tsx
  modified:
    - lib/ai/provider.ts
    - package.json
    - bun.lock

key-decisions:
  - "D-01 time/dry-run precondition (13:45 HKT latest start, Phase 7 dry run passed on main) explicitly waived by user decision at ~13:55 HKT 2026-09-12; the branch-existence half of D-01 (gsd/phase-8-s2-commitment-ledger) still held and was verified before every commit"
  - "Task 0 package-legitimacy checkpoint pre-approved by user/orchestrator before this executor started; all three CopilotKit packages installed at exact pin 1.71.0 with no exclusions"
  - "MODEL_FAST (anthropic/claude-haiku-4.5) confirmed to support tool calling via the Kilo Gateway /models?supported_parameters=tools check — no model swap needed"
  - "CopilotKit's default (non-/v2) API generation confirmed present and exactly matching 08-RESEARCH/08-PATTERNS' documented shapes (CopilotRuntime, OpenAIAdapter, copilotRuntimeNextJSAppRouterEndpoint, CopilotKit, useCopilotAction, CopilotChat) — no correction against installed type definitions was needed (FA-3 resolved cleanly)"
  - "Fixed a prompt bug found during Task 2's own hand-check: the initial commitment-extraction prompt over-extracted, treating a meeting-scheduling request ('let's have a talk next Friday at 11am') as also a commitment. Added an explicit exclusion rule; re-verified 1 commitment + 1 actionable meeting from the two-message test"
  - "The plan's own Task 2 verify script asserts r.meetings.length===1 over a 2-message input; extractIntents's own system prompt requires 'exactly one intent object per numbered message', so meetings.length is always 2 for 2 input messages, never 1. Corrected the local hand-check to assert on the actionable-meeting subset (matches the plan's own <fails_when> license to adjust the script at execution time) rather than editing extractIntents' documented behaviour"
  - "extractIntents itself is git-diff-verified byte-unchanged (D-05); the two live calls to it (standalone vs. inside extractAllIntents) return structurally identical but not byte-identical output (title wording, confidence, day_offset differ slightly) because they are two separate live model invocations, not a deterministic function — recorded per plan's <output> instruction, not treated as a bug"
  - "Two TSDoc comments (in ledger-surface.tsx and the commitment-extraction prompt) originally used literal substrings the plan's own acceptance greps treat as violations (an import-path-shaped string in prose, and the word 'reliability' inside a prohibition sentence); reworded both without changing their meaning so the acceptance greps read the actual code/prompt correctly"
  - "Restricted every Biome invocation to the plan's own file list, never a bare directory (app/, components/, lib/) — the repo checks out CRLF (core.autocrlf=true) while Biome writes LF, so a directory-wide --write silently touches every sibling file's line endings and git flags them all as modified even with zero content change. Caught and reverted twice (app/globals.css + app/layout.tsx once, ~20 lib/*.ts files once) before adopting exact-path invocations for the rest of the plan"

requirements-completed: [STR-04, STR-05]

coverage:
  - id: D1
    description: "Additive commitment intent type + extractor, additive beside the untouched meeting schema (STR-04)"
    requirement: "STR-04"
    verification:
      - kind: manual_procedural
        ref: "bun -e hand-check: extractAllIntents over 'I will send the deck by Friday' + 'Lets have a talk next Friday at 11am' -> 1 commitment (all 7 D-06 fields present) + 1 actionable meeting"
        status: pass
      - kind: manual_procedural
        ref: "git diff --stat against merge-base for lib/agent/ names only the two new files; lib/agent/extract-intents.ts and lib/agent/graph.ts unchanged"
        status: pass
    human_judgment: false
  - id: D2
    description: "CopilotKit runtime completes a real tool-calling round trip against Kilo Gateway through the single openaiClient"
    verification:
      - kind: manual_procedural
        ref: "direct openaiClient.chat.completions.create({model: config.ai.modelFast, tools:[queryCommitments]}) against Kilo Gateway returned a real tool_call"
        status: pass
      - kind: manual_procedural
        ref: "node fetch POST /api/copilotkit with an empty body returns 400 invalid_request (route mounts, does not 404 or throw a constructor error)"
        status: pass
    human_judgment: true
    rationale: "The gateway-level tool-calling capability and the route's mounting are proven directly, but the CopilotKit-mediated GraphQL protocol round trip through the actual browser chat UI (and whether the #3317 second-request bug reproduces at 1.71.0) could not be driven from this executor session — no browser automation tool was available. A human must open http://localhost:3003/commitments and confirm the full round trip, per this SUMMARY's Verification Notes."
  - id: D3
    description: "Deterministic component selection covers all four kinds across the seed set, guaranteeing 08-02's two-questions-two-components exit criterion by data shape"
    requirement: "STR-05"
    verification:
      - kind: manual_procedural
        ref: "bun -e hand-check: all 4 kinds present across 6 seed rows; owed_by_me yields deadline-chip/draft-nudge not shared with owed_to_me's chase/clarify"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-12
status: complete
---

# Phase 8 Plan 1: CopilotKit Round Trip + Commitment Type + Component Selector Summary

**CopilotKit 1.71.0 wired to Kilo Gateway through the shared `openaiClient`, an additive `commitment` intent type extracted via its own MODEL_FAST call, and a pure 4-branch component selector proven over 6 schema-parsed seed rows — all three committed on `gsd/phase-8-s2-commitment-ledger`, meeting extraction untouched.**

## Performance

- **Duration:** ~45 min (session was interrupted once mid-Task-1 before any commit landed; resumed from a clean, unmodified worktree per the coordinator's re-verification — Task 1 restarted from scratch)
- **Completed:** 2026-09-12
- **Tasks:** 3 (Task 0 pre-approved by user/orchestrator before this executor started)
- **Files:** 7 created, 3 modified

## Accomplishments

- Installed `@copilotkit/react-core`, `@copilotkit/react-ui`, `@copilotkit/runtime` at exact pin `1.71.0`; verified via `npm`-style `node -e` introspection that the default (non-`/v2`) API's `CopilotRuntime`, `OpenAIAdapter`, `copilotRuntimeNextJSAppRouterEndpoint`, `CopilotKit`, `useCopilotAction` and `CopilotChat` all exist and match 08-RESEARCH/08-PATTERNS' documented shapes exactly — no type-definition correction needed
- Added one named export, `openaiClient`, to `lib/ai/provider.ts` beside the untouched `complete<T>()`; confirmed via `git diff` against `merge-base` that `complete`'s signature is byte-unchanged
- Built the thin `app/api/copilotkit/route.ts` and the client `components/commitment-ledger/ledger-surface.tsx` (queryCommitments frontend action, closed `direction`/`status` enum params, `New question` remount control for the #3317 mitigation) plus `app/commitments/page.tsx` (URL-only route, no nav link)
- Directly proved a real tool-calling round trip against Kilo Gateway using the exact `openaiClient` instance the route uses (separately from the CopilotKit-mediated protocol — see Verification Notes)
- Added `lib/agent/commitment-schema.ts` (`CommitmentIntentSchema`, `CommitmentExtractionSchema`, `CommitmentIntent`) and `lib/agent/extract-commitments.ts` (`extractCommitments`, `extractAllIntents`), additive beside the meeting extraction path, which is git-diff-verified untouched
- Added `lib/commitment-ledger/select-component.ts` (pure `selectCommitmentComponent`) and `lib/commitment-ledger/seed-rows.ts` (6 schema-parsed demo rows covering all four component kinds), and rewired the ledger surface's `queryCommitments` handler/render to use them

## Task Commits

1. **Task 1: CopilotKit round trip + Kilo Gateway wiring** - `29452a1` (feat)
2. **Task 2: additive commitment intent type + extractor** - `78db88b` (feat)
3. **Task 3: deterministic component selection + seed rows, wired into ledger** - `26769bb` (feat)

**Plan metadata:** commit to follow (this SUMMARY)

## Files Created/Modified

- `lib/ai/provider.ts` - additive `openaiClient` export beside untouched `complete<T>()`
- `app/api/copilotkit/route.ts` - thin CopilotKit runtime endpoint (`POST`), default API generation
- `app/commitments/page.tsx` - Server Component route, URL-only
- `components/commitment-ledger/ledger-surface.tsx` - client chat surface, `queryCommitments` action + render, `New question` remount
- `lib/agent/commitment-schema.ts` - additive `CommitmentIntentSchema`/`CommitmentExtractionSchema`/`CommitmentIntent`
- `lib/agent/extract-commitments.ts` - `extractCommitments`, `extractAllIntents`
- `lib/commitment-ledger/select-component.ts` - pure `selectCommitmentComponent`
- `lib/commitment-ledger/seed-rows.ts` - 6 schema-parsed demo rows
- `package.json`, `bun.lock` - three CopilotKit deps at exact pin `1.71.0`

## Decisions Made

See `key-decisions` in frontmatter for the full list. Summary: D-01's time/dry-run gate was explicitly waived by the user; the model-support, API-generation-shape and file-ownership risks 08-RESEARCH flagged as open all resolved cleanly on the first attempt; one real bug was found and fixed during Task 2's own hand-check (prompt over-extraction on meeting-shaped messages); one assumption in the plan's own Task 2 verify script (`meetings.length===1`) proved incompatible with `extractIntents`'s documented one-intent-per-message contract and was corrected in the hand-check rather than in the untouched meeting extractor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Commitment-extraction prompt over-extracted meeting-shaped messages as commitments**
- **Found during:** Task 2 step 3 (STR-04 hand-check)
- **Issue:** "Lets have a talk next Friday at 11am" was returned as a second commitment alongside "I will send the deck by Friday", failing the "exactly one commitment" check
- **Fix:** Added an explicit prompt rule: a message that only proposes/requests a meeting, call or talk is not a commitment, even if it names a date/time
- **Files modified:** `lib/agent/extract-commitments.ts`
- **Verification:** Re-ran the hand-check — exactly 1 commitment, 1 actionable meeting
- **Committed in:** `78db88b` (Task 2 commit)

**2. [Rule 3 - Blocking] Two acceptance-grep false positives from prose, not code**
- **Found during:** Task 1 and Task 2 self-verification
- **Issue:** `ledger-surface.tsx`'s TSDoc literally wrote `@/lib/ai/provider` / `@/lib/config` as prose, tripping the "no config/provider import in client dir" grep; `extract-commitments.ts`'s prompt literally contained the word "reliability" inside a prohibition sentence, tripping the "no sentiment/reliability language" grep
- **Fix:** Reworded both comments to convey the same meaning without the literal trigger substrings
- **Files modified:** `components/commitment-ledger/ledger-surface.tsx`, `lib/agent/extract-commitments.ts`
- **Verification:** Both greps print nothing after the fix
- **Committed in:** `29452a1`, `78db88b`

**3. [Rule 3 - Blocking] Biome directory-wide `--write` touched out-of-scope files' line endings**
- **Found during:** Task 1 verify step, then again entering Task 2
- **Issue:** Running `bunx @biomejs/biome check --write app components lib` (as the plan's action text literally specifies) rewrote every file under those directories with LF endings, while the repo checks out CRLF (`core.autocrlf=true`). Git then flagged ~20 out-of-scope files (`app/globals.css`, `app/layout.tsx`, all of `lib/calendar/`, `lib/slack/`, `lib/db.ts`, `lib/utils.ts`, etc.) as modified with zero actual content change — a direct violation of D-16's untouched-files list and this plan's own file-ownership scope
- **Fix:** `git checkout --` every out-of-scope file both times it happened; adopted exact-file-path Biome invocations (never a bare directory) for the remainder of the plan
- **Files modified:** none (reverted, not committed)
- **Verification:** `git status --porcelain app/globals.css app/layout.tsx components/nav.tsx components/ui app/providers.tsx` prints nothing at every commit point; `git diff --stat` against `merge-base` names only this plan's 10 files
- **Committed in:** n/a (caught before commit both times)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking — one of which was a repeated environment gotcha, not a code issue)
**Impact on plan:** All three were necessary for correctness (extraction accuracy) or to prevent scope-violating side effects (file-ownership). No feature scope creep; the file-ownership near-miss is the only one worth flagging loudly for 08-02's executor: **never pass a bare directory to `biome --write` in this worktree — always list the exact files this plan touches.**

## Known Stubs

- **`source_link` format is a placeholder, not a real Slack permalink.** `lib/agent/extract-commitments.ts` and `lib/commitment-ledger/seed-rows.ts` both use a `slack://channel/{channelId}/{ts}` deep-link-shaped string rather than a real `https://…slack.com/archives/…` permalink, because building a real one requires either the workspace subdomain (not available from `config`) or a `chat.getPermalink` API call this throwaway phase didn't budget for. Every row still carries a non-null, traceable `source_link` per the schema requirement (T-08-06's mitigation). If 08-02 or a future phase needs a clickable link, swap this one call site for a real `chat.getPermalink` call.

## Threat Flags

None beyond what the plan's own `<threat_model>` already registers (T-08-SC, T-08-01, T-08-02, T-08-05 all verified via the acceptance greps above; T-08-03/T-08-04/T-08-06 accepted per the plan). No new surface introduced beyond what the plan specified.

## Verification Notes (for the human, per `human_verify_mode: end-of-phase`)

This executor session had no browser automation tool available, so the following could **not** be driven end-to-end and need a human check at `http://localhost:3003/commitments` (start with `PORT=3003 bun run dev`, or `bun run dev -- -p 3003`):

1. **The #3317 outcome at 1.71.0 is UNKNOWN.** Ask two commitment-shaped questions in the *same* chat session (e.g. "what do I owe people?" then "what am I owed?"). If both answer, the bug is not present — the `New question` button is belt-and-braces. If the second errors, press `New question` between questions; the mitigation is already built either way.
2. **`MODEL_FAST` did not need swapping** — confirmed programmatically (`anthropic/claude-haiku-4.5` is in Kilo Gateway's `tools`-supporting model list) and directly (a raw tool-calling round trip against Kilo Gateway via `openaiClient` returned a real `tool_call`). This is proof at the gateway/SDK level, not proof that CopilotKit's own GraphQL-mediated protocol completes the same round trip through the browser — that layer is what needs the human check above.
3. **Task 2's second hand-check (extractIntents alone vs. inside extractAllIntents):** the two calls returned structurally identical shapes (same weekday/time_of_day/is_actionable classification for the actionable message) but not byte-identical field values — `title` wording, `confidence` (0.92 vs 0.88 in one run) and `day_offset` (6 vs 7 in one run) differed slightly. This is expected LLM sampling variance across two separate live model invocations, not a code-path difference — `extractIntents` itself is git-diff-verified byte-unchanged and was called with the identical arguments both times.
4. `ctx`'s real shape for `extractIntents`/`extractCommitments`/`extractAllIntents` is `{ now: Date }`, confirmed from `lib/agent/graph.ts`'s own call site (`extractIntents([state.message], { now: state.now })`).

## Issues Encountered

- Session was interrupted once mid-Task-1, before any commit landed (the `bun add` for the CopilotKit packages had timed out mid-postinstall in the background). The coordinator's resume message correctly identified the worktree was clean at `main`'s fork point with no commits, so Task 1 restarted cleanly with no duplicate work.
- See "Deviations from Plan" above for the Biome directory-scope issue, which cost two rounds of detection-and-revert but landed no incorrect commits.

## User Setup Required

None — no external service configuration required. `AI_BASE_URL`/`AI_API_KEY`/`MODEL_FAST` already existed and were sufficient; no `.env` changes were made.

## Next Phase Readiness

- 08-02 (ledger surface + nudge wiring) can proceed: the `queryCommitments` action, `selectCommitmentComponent` and `seedCommitments` are all in place and verified; 08-02 only needs to swap the current plain-text row rendering for the four real presentational components and add the nudge route
- **Read before starting 08-02:** the Biome directory-scope gotcha above — use exact file paths, never a bare `app`/`components`/`lib` directory, when running `biome --write` in this worktree
- The #3317 CopilotKit second-request behavior at 1.71.0 remains unconfirmed by a human; 08-02's demo-script should account for both outcomes (both work, or `New question` is required between questions) until that check is done
- D-02's abandon criterion did not trigger: the ledger renders (at minimum, programmatically verified) more than two distinct component kinds via the deterministic selector, satisfying the merge-eligibility bar pending the human UI check above

---
*Phase: 08-optional-s2-commitment-ledger*
*Completed: 2026-09-12*
