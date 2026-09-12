# Phase 8: [optional] S2 — Commitment Ledger - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning
**Source:** PRD Express Path (.planning/ROADMAP.md, Phase 8 section only) + STR-04/STR-05 in .planning/REQUIREMENTS.md + .planning/PROJECT.md constraints

<domain>
## Phase Boundary

Optional, throwaway, time-gated stretch phase. A CopilotKit surface in the Next.js app renders a **heterogeneous commitment ledger** ("what you promised, what you're owed"), proving generative UI: the rendered component visibly changes with the question/data. Delivers (only if attempted):

- A `commitment` type added to the extraction schema beside `meeting` (STR-04), carrying direction (owed by me / owed to me), what, who, when promised, due, source link and status (open / done / overdue / dropped).
- A CopilotKit surface that renders the ledger with a different component per row type: deadline chip + "block time", draft-nudge, chase, clarify (STR-05).
- Nudges route through the existing Slack approval card; nothing is sent directly.

Requirements: STR-04, STR-05. Nothing else depends on this phase. On schedule it is **README-only** (documented as designed, not built): Phase 7 is boxed 13:50–14:45, so its dry run can't pass before this phase's 13:45 latest start unless earlier phases ran ≥30 min ahead.

</domain>

<decisions>
## Implementation Decisions

### Gating and time box (locked by roadmap)
- **D-01:** Latest start **13:45 HKT**, and only if Phase 7's full dry run has already passed on `main`. Budget ~45–60 min. Must be merged to `main` demo-ready by **14:40** (before Phase 10 rehearsal).
- **D-02:** Abandon criterion: if the ledger isn't rendering **at least two different component types by 14:40**, abandon — do not merge, do not spend more time. Abandoned work becomes a README line (Phase 11 owns the README).
- **D-03:** Branch `gsd/phase-8-s2-commitment-ledger`, labelled `[throwaway]`: never merges unless demo-ready. This branch rebases on any late Phase 7 change, never the reverse.
- **D-04:** Runs alongside **nothing**. Never alongside Phase 9 or Phase 10.

### Extraction schema (STR-04)
- **D-05:** Add a `commitment` intent type **beside** `meeting` in `lib/agent/**`'s extraction schema. Additive only: never edit the `meeting` shape. Existing meeting extraction must keep working (success criterion 1).
- **D-06:** Commitment fields: direction (`owed_by_me` / `owed_to_me`), what, who, when promised, due, source link, status (`open` / `done` / `overdue` / `dropped`), per PROJECT.md "Stretch detail — S2".
- **D-07:** Validation stays Zod: one schema per LLM output, shared by the extraction call and the DB write (PROJECT.md stack rule). All model calls go through `lib/ai/provider.ts`.

### Generative UI surface (STR-05)
- **D-08:** CopilotKit is the chosen tool (fixed stack). Its dependency (`@copilotkit/react-core`, `@copilotkit/react-ui`, plus whatever runtime package the route needs) is **installed only now**, in this phase, per the PROJECT.md key decision. CLAUDE.md pins `@copilotkit/react-core`/`react-ui` at 1.71.0.
- **D-09:** Heterogeneous rows pick different components: **deadline chip + "block time"** (dated promise), **draft-nudge** (overdue on my side), **chase** (owed to me, drafts the message), **clarify card** (ambiguous). Minimum bar for merge: two visibly different component types.
- **D-10:** Two different commitment-shaped questions render two visibly different components (exit criterion).
- **D-11:** CopilotKit is a frontend/runtime layer, not an agent framework; do not build a second agent loop in it (source doc "Agent orchestration").

### Nudge → approval card
- **D-12:** Sending a nudge is an action, so it goes through the **same approval-card flow as scheduling**. Sending a nudge produces a Slack approval card, never a message sent directly (success criterion 3; PROJECT.md out-of-scope "Autoreply").
- **D-13:** Phase 8 may only **call** the existing approval-card function in `lib/slack/**`; it must not edit `lib/slack/**` internals.

### Suggested plan split (roadmap recommendation, adopted)
- **D-14:** 2 plans:
  - 08-01: `commitment` extraction type + heterogeneous component selection logic.
  - 08-02: CopilotKit ledger surface + nudge-through-approval-card wiring.

### File ownership (locked by roadmap)
- **D-15:** Owns `app/api/copilotkit/**` (or equivalent runtime route), `components/commitment-ledger/**`, and additive-only changes to `lib/agent/**`'s extraction schema.
- **D-16:** Must not touch `lib/slack/**` internals (beyond calling the existing approval-card function) or `lib/calendar/**`.
- **D-17:** Named overlap: `lib/agent/**` extraction schema, additive field only.

### Processes / ports (locked by roadmap)
- **D-18:** Next.js dev on its own workspace port **:3003** (`bun run dev`, plain `next dev`, no `--bun`); Postgres :5432 shared.

### Project constraints that apply (PROJECT.md)
- **D-19:** No test files; Biome only (`biome check --write` before done); TSDoc on every function; kebab-case files, PascalCase components, named exports, no `any`.
- **D-20:** Colours only through shadcn CSS variables in `app/globals.css`; no colour literals in components. Retro dark theme devices (hard borders, offset shadows, monospace data, uppercase micro-labels, status in form not colour alone).
- **D-21:** Server Components by default, `"use client"` only where interactivity demands it; no secrets in client components; thin route handlers with logic in `lib/`; one typed config module is the only reader of `process.env`.
- **D-22:** Impeccable is in scope for this phase (it touches `app/` and `components/`), but only as much as the time box allows.
- **D-23:** bun only: `bun add` with exact pins, never `bunx --bun` / `bun --bun`; never hand-merge `bun.lock`.

### Claude's Discretion
- Where commitment rows persist: a new Prisma model via `db push` on the throwaway branch, reuse of an existing table, or no persistence (render from extraction/seed). Any schema change follows the `develop`-serialized `db push` rule and is `[throwaway]`-scoped.
- Which CopilotKit mechanism renders per-row components (e.g. frontend actions with `render`, tool-call rendering) and which CopilotKit runtime service adapter is used, provided model traffic still goes through `lib/ai/provider.ts` / Kilo Gateway env.
- How "block time" works (it may reuse the existing scheduling proposal flow) and how the nudge approval card is expressed without editing `lib/slack/**` internals (the existing card is proposal-shaped; researcher/planner must resolve this tension).
- Where the ledger page lives under `app/` and how it fetches data (TanStack Query per repo rules).
- How commitment rows get into the demo (live extraction vs hand-seeded rows) within the time box.
- Where the "component selection logic" lives (pure function in `lib/` or `utils/`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` — Phase 8 section (goal, time box, gating, files owned/not-touched, abandon + exit criteria, success criteria, suggested plans); also "Concurrency & Waves", "File Ownership Matrix", "Cut-Line Table" rows for Phase 8
- `.planning/REQUIREMENTS.md` — STR-04, STR-05 (and STR-06/07 as deferred follow-ons)
- `.planning/PROJECT.md` — "Stretch detail" (S2), "Tech stack", "Repo rules", "Theme direction", Key Decision "CopilotKit dependency added only when S2 starts", Out of Scope (Autoreply)

### Source document
- `gsd-prompt-ai-secretary.md` — "S2. CopilotKit analytics dashboard with generative UI" (authoritative S2 specifics) and "Agent orchestration — LangGraph, Trigger.dev, CopilotKit" (CopilotKit is a frontend/runtime layer, not an agent framework)

### Stack and repo rules
- `.claude/CLAUDE.md` — Technology Stack (CopilotKit 1.71.0 pins, zod 4.6.2 compatibility, openai SDK against Kilo Gateway)
- `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md` — project-level research

### Upstream phase artifacts (interfaces this phase builds on; read, don't re-decide)
- `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md` — schema, stub interfaces, type locations (Zod schemas in `lib/agent/`, DB types from generated Prisma client)
- Phase 2/4/5/6/7 CONTEXT/RESEARCH/PLAN files under `.planning/phases/` once they exist — approval-card function, extraction schema, dashboard structure, theme tokens

</canonical_refs>

<specifics>
## Specific Ideas

- Example commitments from the source doc: "I'll send the deck by Friday", "can you review the PR today?", "I'll look into it after lunch".
- "Chase Bob" action drafts the message for a commitment owed to me; the draft is approved via the card before anything is sent.
- The point of generative UI: "the shape of the answer isn't known in advance — the agent picks the component. If every answer is the same bar chart, it is a dashboard, not generative UI."
- Exit check (hand, <1 min): ask two different commitment-shaped questions → two visibly different components; send a nudge → a Slack approval card appears, no direct message.

</specifics>

<deferred>
## Deferred Ideas

- S2 priority (2) Relationship and cadence brief (STR-06) and (3) Time-allocation reality check (STR-07): v2, not this phase.
- Sentiment analysis of colleagues: deliberately dropped, never reintroduce.
- Batch sweep over a window for commitment detection: documented production design only.

</deferred>

---

*Phase: 08-optional-s2-commitment-ledger*
*Context gathered: 2026-09-11 via PRD Express Path*
