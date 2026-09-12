# Phase 6: Dashboard - Context

**Gathered:** 2026-09-11
**Status:** Ready for planning
**Source:** PRD Express Path (.planning/ROADMAP.md, Phase 6 section only) + REQUIREMENTS.md DSH-01..06 + PROJECT.md constraints

<domain>
## Phase Boundary

Wave B track B, 13:05–13:50 (45 min), concurrent with Phase 5 (Agent). Branch `gsd/phase-6-dashboard`. Depends on Phase 4.

Delivers a read-only Next.js dashboard that shows live `Proposal` and `Decision` data in the retro dark theme:
- Proposal / action-item queue with status, HKT time and confidence (DSH-01)
- Decision log view, including considered-and-ignored rows with confidence and reason (DSH-02)
- TanStack Query polling so new rows appear without reload (DSH-03)
- Retro theme as shadcn CSS variables in `app/globals.css` with `@theme inline` mappings, zero colour literals in components (DSH-04)
- Retro devices applied consistently (DSH-05)
- Amber/cyan contrast on near-black and visible focus states on every interactive element (DSH-06)

Builds against Phase 1/4 hand-seeded rows; does not wait on Phase 5. No Slack, Calendar, agent or AI code. Approval never happens from the dashboard.

Requirements: DSH-01, DSH-02, DSH-03, DSH-04, DSH-05, DSH-06. (DSH-07 is completed in Phase 10; this phase applies `critique` + `polish` inline, Phase 10 runs `audit`.)

</domain>

<decisions>
## Implementation Decisions

### Scope and ownership (from ROADMAP Phase 6)
- **D-01:** Files owned: `app/**` (dashboard routes), `components/**` (dashboard components; `components/ui/` stays shadcn-unmodified), `app/globals.css`.
- **D-02:** Files must not touch: `lib/agent/**`, `lib/ai/**`, `lib/slack/**`, `lib/calendar/**`.
- **D-03:** Named overlaps: `types/` is read, never forked (Phase 5 may extend it in parallel). `package.json` + `bun.lock`: shadcn component adds (and any dep not already installed upstream) are regenerated via `bun install` at merge, never hand-merged.
- **D-04:** Schema is read-only for this phase. Postgres :5432 shared, read-only. No `db push` planned; if one proves unavoidable, it follows the merge-latest-`develop`-first rule.

### Data display (DSH-01, DSH-02)
- **D-05:** Proposal queue shows, per row: status (pending, confirmed, dismissed, already scheduled), start time in HKT, and confidence.
- **D-06:** The Decision log is a **separate view** from the proposal queue (ROADMAP success criterion 1) and shows verdict, confidence and reason; it must visibly include at least one `ignored` row.
- **D-07:** Dashboard is read-only on the critical path: no mutations, no approve/reject buttons (approval lives on the Slack card).

### Live updates (DSH-03)
- **D-08:** TanStack Query polling (adopted from research/ARCHITECTURE.md §"Dashboard: How It Reads Data"): Server Component first paint reading Prisma via the shared `lib/db.ts` client, thin route handlers wrapping the same queries, a small `"use client"` list consuming them with `refetchInterval` in the 3–5s range. A manually-inserted row must appear within ~5s without reload.
- **D-09:** No websockets/SSE.

### Theme (DSH-04, DSH-05, DSH-06)
- **D-10:** Retro dark theme defined once as shadcn CSS variables in `app/globals.css`; custom tokens (`--elevated`, `--success`, and any others) mapped inside `@theme inline`. No component contains a colour literal (hex grep outside `globals.css` returns nothing).
- **D-11:** Starting palette (PROJECT.md, source doc; impeccable may improve it as long as it stays dark, retro and projector-legible): `--background #0B0B0C`, `--card #141416`, `--elevated #1C1C20`, `--border #2E2E33`, `--foreground #EDEDEF`, `--muted #8A8A93`, `--primary #F2A93B` (amber), `--secondary #4EC9E0` (cyan), `--success #46C07A`, `--destructive #E5544B`.
- **D-12:** Retro devices, applied consistently: 1–2px hard borders; `4px 4px 0` unblurred offset shadows; 2–4px radii; monospace (JetBrains Mono or IBM Plex Mono) for data, timestamps, confidence, chips and table columns with tabular numerals; proportional sans for prose; uppercase letter-spaced micro-labels; status encoded in form (chip / left stripe / symbol) as well as colour. No gradients, glass or soft elevation.
- **D-13:** Amber and cyan pass contrast on the near-black ground; every interactive element has a visible focus state.

### Process and tooling
- **D-14:** Next.js dev runs on its own workspace port **:3002** (separate from `main`'s :3000). The `dev` script stays plain `next dev`; never `--bun`. First minutes: confirm a single save produces one BUILDING/BUILT pair.
- **D-15:** Impeccable runs inline in this order: `layout` while structure is written → `typeset` + `colorize` as type and colour are applied → `critique` then `polish` once functionally complete. No `/impeccable init`, no live-browser setup. Feed theme direction inline.
- **D-16:** Early check within the first minutes: one element using `bg-elevated` renders visibly styled in devtools (catches a custom token declared in `:root` but not mapped in `@theme inline`).
- **D-17:** Suggested plan split (ROADMAP): 06-01 layout (queue + Decision log structure, impeccable layout); 06-02 theme + retro devices + TanStack Query polling (typeset/colorize); 06-03 critique + polish.
- **D-18:** Biome `check --write` before the phase is done; run it right after each `shadcn add`.

### Cut order (ROADMAP)
- **D-19:** If overrunning: cut the exhaustive focus-state audit to "checked on the three elements that matter" (buttons, table rows, nav); keep the theme. `critique` + `polish` survive even if `layout`/`typeset`/`colorize` were rushed.

### Repo rules that bind this phase (PROJECT.md)
- **D-20:** Server Components by default, `"use client"` only where interactivity demands it; no secrets in client components; thin route handlers with logic in `lib/`; TanStack Query, not ad-hoc `useEffect` fetching.
- **D-21:** Folder rules: `components/` presentational shadcn-based, `components/ui/` unmodified, `hooks/`, `stores/` (Zustand, one store per domain, narrow selectors), `utils/` pure helpers. No React Context for changing app state. No second component library; no hand-rolled components shadcn already provides.
- **D-22:** kebab-case files, PascalCase components, camelCase functions, named exports, no `any`, TSDoc on every function. No test files. Reuse before writing (search `lib/` and `utils/` first).
- **D-23:** Everything displayed in `Asia/Hong_Kong`.

### Claude's Discretion
- Routing shape for the two views (two routes vs. one page with nav), and which shadcn primitives to add.
- Exact poll interval inside 3–5s; whether a Zustand store is needed at all (only if real shared client state appears).
- Where the Prisma read queries live (a `lib/` dashboard query module vs. inline in the route handler), provided route handlers stay thin and the same query feeds first paint and polling.
- Font loading mechanism for the monospace/sans pair.
- Row ordering, empty states, and how "already scheduled" and confidence are visualised, within D-12.
- Final palette values if impeccable proposes stronger ones that keep D-11's constraints.

### Pre-applied scope cut (decided 2026-09-12, before the window)
- **Phase 4 is NOT a prerequisite.** The plan precondition says "Phase 1 and Phase 4 are merged", but every artifact it lists is a Phase 1 artifact. This phase runs in R2 beside Phase 4, against main after the R1 merge. If a Phase 4 file is genuinely missing, read `Proposal`/`Decision` straight from Prisma — do not wait for or stub the approve handler.
- **One `/impeccable critique` pass only.** Run `/impeccable layout`, `typeset`, `colorize` and a single `critique`; skip the `polish` iteration loop and the exhaustive focus-state audit. Apply only the critique findings that are one-line fixes.
- Keep the retro theme tokens in `globals.css`, the action-item queue and the `Decision` log. Those are the demo assets.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` §"Phase 6: Dashboard": deliverables, files owned/must-not-touch, exit criterion, cut order, time-eaters, success criteria. Also §"File Ownership Matrix" (`app/globals.css` owned by Phase 6) and §"Process & Port Map".
- `.planning/REQUIREMENTS.md`: DSH-01..06 (DSH-07 context).
- `.planning/PROJECT.md`: "Repo rules", tech stack table (bun run commands, never `--bun`), "Theme direction", data model, Constraints.

### Theme and design
- `gsd-prompt-ai-secretary.md` §"Frontend look and feel — driven by `impeccable`": impeccable command order, theme direction, palette, retro devices, accessibility requirement.

### Research
- `.planning/research/ARCHITECTURE.md` §"Dashboard: How It Reads Data" (Server Component first paint + route handlers + TanStack Query poll) and §"File Ownership Per Track".
- `.planning/research/PITFALLS.md` Pitfall 14 (forced bun runtime Fast Refresh thrash); Minor: custom tokens missing `@theme inline`, Biome Tailwind at-rules, Biome reformatting shadcn files.
- `.planning/research/STACK.md`: pins for next, react, tailwindcss, @tailwindcss/postcss, shadcn CLI, @tanstack/react-query, zustand.

### Upstream phase context (read, don't re-decide)
- `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md`: D-07 (DB types from generated Prisma client), D-08 (`utils/time.ts` HKT formatter), D-09/D-11 (Proposal/Decision columns and enums), D-12 (`lib/db.ts` singleton, generated client path), D-13/D-14 (seed rows), D-16 (`.env` + `PORT`), D-21/D-22 (deps installed, shadcn init only), D-25 (`app/page.tsx` placeholder Phase 6 replaces).

</canonical_refs>

<specifics>
## Specific Ideas

- Exit criterion: dashboard shows hand-seeded proposals with correct status/HKT time/confidence and the Decision log with at least one ignored entry; a manually-inserted row appears via polling within ~5s without reload.
- Success criteria: (1) proposals list with status, HKT time, confidence + separate Decision log view with an ignored row and reason; (2) manually-inserted row appears within one polling interval; (3) grepping components for hex colour codes outside `globals.css` returns nothing; (4) tabbing once shows a visible focus outline on every interactive element.
- Time-eaters: custom tokens unstyled if not in `@theme inline` (check `bg-elevated` early); `--bun` on the dev script causing Fast Refresh thrash.
- Must be legible on a projector.

</specifics>

<deferred>
## Deferred Ideas

- `/impeccable audit` on the running app: Phase 10 (completes DSH-07).
- Dashboard mutations (approve/nudge buttons): not in core; S2 (Phase 8) would add one POST route + `useMutation` if attempted.
- CopilotKit surface: Phase 8 only.
- In-dashboard graph render (`react-force-graph-2d`, STR-08): v2.
- Showing real extracted rows end to end: Phase 7 integration.

</deferred>

---

*Phase: 06-dashboard*
*Context gathered: 2026-09-11 via PRD Express Path*
