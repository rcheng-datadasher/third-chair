# Phase 6: Dashboard - Research

**Researched:** 2026-09-11
**Domain:** Next.js 16 App Router dashboard (Server Component first paint + thin route handlers + TanStack Query polling) over Prisma/Postgres; Tailwind v4 + shadcn CSS-variable theming; WCAG contrast; `impeccable` design-plugin invocation
**Confidence:** HIGH (Next.js 16 route-handler caching default, TanStack Query polling defaults, shadcn Tailwind v4 `@theme inline` shape, WCAG contrast — all confirmed this session against current official docs or computed directly); MEDIUM (shadcn CLI 4.21.0 exact `table`/`badge`/`card` prop shapes — not independently re-verified against the pinned version this session, low risk)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scope and ownership**
- D-01: Files owned: `app/**` (dashboard routes), `components/**` (dashboard components; `components/ui/` stays shadcn-unmodified), `app/globals.css`.
- D-02: Files must not touch: `lib/agent/**`, `lib/ai/**`, `lib/slack/**`, `lib/calendar/**`.
- D-03: Named overlaps: `types/` is read, never forked (Phase 5 may extend it in parallel). `package.json` + `bun.lock`: shadcn component adds (and any dep not already installed upstream) are regenerated via `bun install` at merge, never hand-merged.
- D-04: Schema is read-only for this phase. Postgres :5432 shared, read-only. No `db push` planned; if one proves unavoidable, it follows the merge-latest-`develop`-first rule.

**Data display (DSH-01, DSH-02)**
- D-05: Proposal queue shows, per row: status (pending, confirmed, dismissed, already scheduled), start time in HKT, and confidence.
- D-06: The Decision log is a **separate view** from the proposal queue (ROADMAP success criterion 1) and shows verdict, confidence and reason; it must visibly include at least one `ignored` row.
- D-07: Dashboard is read-only on the critical path: no mutations, no approve/reject buttons (approval lives on the Slack card).

**Live updates (DSH-03)**
- D-08: TanStack Query polling (adopted from research/ARCHITECTURE.md §"Dashboard: How It Reads Data"): Server Component first paint reading Prisma via the shared `lib/db.ts` client, thin route handlers wrapping the same queries, a small `"use client"` list consuming them with `refetchInterval` in the 3–5s range. A manually-inserted row must appear within ~5s without reload.
- D-09: No websockets/SSE.

**Theme (DSH-04, DSH-05, DSH-06)**
- D-10: Retro dark theme defined once as shadcn CSS variables in `app/globals.css`; custom tokens (`--elevated`, `--success`, and any others) mapped inside `@theme inline`. No component contains a colour literal (hex grep outside `globals.css` returns nothing).
- D-11: Starting palette (PROJECT.md, source doc; impeccable may improve it as long as it stays dark, retro and projector-legible): `--background #0B0B0C`, `--card #141416`, `--elevated #1C1C20`, `--border #2E2E33`, `--foreground #EDEDEF`, `--muted #8A8A93`, `--primary #F2A93B` (amber), `--secondary #4EC9E0` (cyan), `--success #46C07A`, `--destructive #E5544B`.
- D-12: Retro devices, applied consistently: 1–2px hard borders; `4px 4px 0` unblurred offset shadows; 2–4px radii; monospace (JetBrains Mono or IBM Plex Mono) for data, timestamps, confidence, chips and table columns with tabular numerals; proportional sans for prose; uppercase letter-spaced micro-labels; status encoded in form (chip / left stripe / symbol) as well as colour. No gradients, glass or soft elevation.
- D-13: Amber and cyan pass contrast on the near-black ground; every interactive element has a visible focus state.

**Process and tooling**
- D-14: Next.js dev runs on its own workspace port **:3002** (separate from `main`'s :3000). The `dev` script stays plain `next dev`; never `--bun`. First minutes: confirm a single save produces one BUILDING/BUILT pair.
- D-15: Impeccable runs inline in this order: `layout` while structure is written → `typeset` + `colorize` as type and colour are applied → `critique` then `polish` once functionally complete. No `/impeccable init`, no live-browser setup. Feed theme direction inline.
- D-16: Early check within the first minutes: one element using `bg-elevated` renders visibly styled in devtools (catches a custom token declared in `:root` but not mapped in `@theme inline`).
- D-17: Suggested plan split (ROADMAP): 06-01 layout (queue + Decision log structure, impeccable layout); 06-02 theme + retro devices + TanStack Query polling (typeset/colorize); 06-03 critique + polish.
- D-18: Biome `check --write` before the phase is done; run it right after each `shadcn add`.

**Cut order (ROADMAP)**
- D-19: If overrunning: cut the exhaustive focus-state audit to "checked on the three elements that matter" (buttons, table rows, nav); keep the theme. `critique` + `polish` survive even if `layout`/`typeset`/`colorize` were rushed.

**Repo rules that bind this phase (PROJECT.md)**
- D-20: Server Components by default, `"use client"` only where interactivity demands it; no secrets in client components; thin route handlers with logic in `lib/`; TanStack Query, not ad-hoc `useEffect` fetching.
- D-21: Folder rules: `components/` presentational shadcn-based, `components/ui/` unmodified, `hooks/`, `stores/` (Zustand, one store per domain, narrow selectors). No React Context for changing app state. No second component library; no hand-rolled components shadcn already provides.
- D-22: kebab-case files, PascalCase components, camelCase functions, named exports, no `any`, TSDoc on every function. No test files. Reuse before writing (search `lib/` and `utils/` first).
- D-23: Everything displayed in `Asia/Hong_Kong`.

### Claude's Discretion

- Routing shape for the two views (two routes vs. one page with nav), and which shadcn primitives to add.
- Exact poll interval inside 3–5s; whether a Zustand store is needed at all (only if real shared client state appears).
- Where the Prisma read queries live (a `lib/` dashboard query module vs. inline in the route handler), provided route handlers stay thin and the same query feeds first paint and polling.
- Font loading mechanism for the monospace/sans pair.
- Row ordering, empty states, and how "already scheduled" and confidence are visualised, within D-12.
- Final palette values if impeccable proposes stronger ones that keep D-11's constraints.

### Deferred Ideas (OUT OF SCOPE)

- `/impeccable audit` on the running app: Phase 10 (completes DSH-07).
- Dashboard mutations (approve/nudge buttons): not in core; S2 (Phase 8) would add one POST route + `useMutation` if attempted.
- CopilotKit surface: Phase 8 only.
- In-dashboard graph render (`react-force-graph-2d`, STR-08): v2.
- Showing real extracted rows end to end: Phase 7 integration.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DSH-01 | Proposal/action-item queue with status, HKT time, confidence | §Architecture Patterns "Data flow"; §Code Examples "queries.ts", "status→token map" |
| DSH-02 | Decision log view, including ignored rows with confidence + reason | Same query module, second Server Component route (`app/decisions/page.tsx`) |
| DSH-03 | TanStack Query polling, new rows appear without reload | §Architecture Patterns "Polling pattern"; §Common Pitfalls (background-tab pause, hydration mismatch) |
| DSH-04 | Retro theme as shadcn CSS vars + `@theme inline`, zero colour literals | §Code Examples "globals.css"; verification grep command |
| DSH-05 | Retro devices applied consistently | §Code Examples "status chip", "table row" pattern |
| DSH-06 | Amber/cyan contrast + focus states | §Contrast Findings (computed) |
</phase_requirements>

## Summary

This phase is almost entirely a *composition* problem, not a *new-technology* problem: every library involved (Next.js 16, TanStack Query v5, shadcn/Tailwind v4) is already pinned and installed by Phase 1 (`@tanstack/react-query` and `zustand` are in Phase 1's Phase-1-installs-everything batch, D-21 of `01-CONTEXT.md` — **this phase adds zero new npm packages**, only shadcn-generated component files). The three things worth getting right before planning tasks:

1. **GET route handlers are dynamic by default** (changed in v15.0.0 per the Next.js 16.3.4 `route.js` reference version history: "The default caching for `GET` handlers was changed from static to dynamic"). The two polling route handlers (`app/api/proposals/route.ts`, `app/api/decisions/route.ts`) need **no** `export const dynamic = "force-dynamic"`. **Pages are different:** a Server Component page that only reads Prisma (no `fetch`, cookies or headers) can be prerendered as static at `next build`. `next dev` renders per request, so the demo isn't affected, but add `await connection()` (from `next/server`) as the first line of both pages. It's one line, works with or without `cacheComponents`, and stops a production build from freezing seed data or hitting the DB at build time. See §"Orchestrator Verification Corrections".
2. **Date formatting must happen once, server-side, inside the shared query module** — not in a component, not separately on the client. Because the Server Component first paint and the client polling component pull from the *same* `lib/dashboard/queries.ts` functions but arrive through two different transports (direct call vs. JSON over HTTP), the only way to guarantee identical output (and avoid a hydration mismatch on the very first render) is for the query functions to return an already-HKT-formatted display string using the existing `utils/time.ts` formatter — never a raw `Date`, and never a client-side `Intl` call. This is the single most important architectural rule for this phase.
3. **Never put white/`--foreground` text on a filled amber, cyan, success, or destructive chip.** Computed contrast (below) shows `--foreground` on `--primary` (amber) is 1.71:1 and on `--secondary` (cyan) is 1.67:1 — both fail badly. Dark text (`--background`, 0B0B0C) on those same fills is 8.5–10:1. Every filled/solid status chip must use dark text; only text-on-neutral-surface should use `--foreground`.

**Primary recommendation:** Two routes (`app/page.tsx` = queue, `app/decisions/page.tsx` = log) sharing one `lib/dashboard/queries.ts` module that returns pre-formatted rows; a thin `"use client"` list component per view using `useQuery({ initialData, refetchInterval: 4000, refetchIntervalInBackground: true })` against the matching route handler; shadcn `table`/`badge`/`card` primitives only; no Zustand store (nothing shared beyond what TanStack Query's own cache already handles).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Proposal/Decision first paint | Frontend Server (Next.js Server Component) | Database | Direct Prisma call from an `async` Server Component — no route handler needed for first paint (ARCHITECTURE.md's already-locked pattern) |
| Live polling updates | Browser/Client (TanStack Query) | API/Backend (route handler) | Client re-fetches via a thin route handler on an interval; no websocket/SSE (D-09) |
| Query logic (Prisma + HKT formatting) | Backend/domain (`lib/dashboard/queries.ts`) | Database | Single source of truth consumed identically by the Server Component and the route handler — this is what prevents the hydration-mismatch pitfall below |
| Retro theme tokens | Browser/Client (CSS, compiled by Tailwind v4 at build time) | — | `app/globals.css` only (D-10); no component ships a colour literal |
| HKT time formatting | Backend/domain (`utils/time.ts`, called only inside `queries.ts`) | — | Formatting happens once, server-side; neither the Server Component nor the client component reformats a date — see Common Pitfalls |
| Approval / mutation | Out of scope this phase | Slack card (Phase 2/4) | Dashboard is read-only (D-07); no POST route, no `useMutation` |

## Standard Stack

### Core

No new packages. Everything below is already pinned and installed as of Phase 1 (`.planning/research/STACK.md`, confirmed via `01-CONTEXT.md` D-21: "Install all core-window dependencies in Phase 1 at exact pins — everything in STACK.md except CopilotKit and the Python side").

| Library | Version | Purpose | Already installed |
|---------|---------|---------|--------------------|
| `next` | 16.3.4 `[VERIFIED: STACK.md, npm registry 2026-09-11]` | App Router, Server Components, route handlers | Phase 1 |
| `@tanstack/react-query` | 5.102.8 `[VERIFIED: STACK.md, npm registry 2026-09-11]` | Client polling, cache | Phase 1 |
| `zustand` | 5.0.15 `[VERIFIED: STACK.md, npm registry 2026-09-11]` | Client state — **not used this phase** (see Discretion below) | Phase 1 |
| `tailwindcss` / `@tailwindcss/postcss` | 4.3.3 | CSS-first theming | Phase 1 |
| shadcn CLI | 4.21.0 (pinned, run as `bunx shadcn@4.21.0 add …`, not `@latest`) | Component scaffolding | Phase 1 (init only; no components added yet) |
| `@prisma/client` (generated to `prisma/generated/`) | 7.10.0 | DB entity types + queries | Phase 1 |

### shadcn components to add this phase

```bash
bunx shadcn@4.21.0 add table badge card
bunx --bun @biomejs/biome check --write   # per D-18, right after the add
```

`table`, `badge`, `card` are the minimal set: `table` for both the queue and the log (semantic rows, not a hand-rolled `<div>` grid — CLAUDE.md forbids hand-rolling what shadcn already provides), `badge` for the status/verdict chip, `card` for the bordered/offset-shadow panel shell the retro devices need. No `tabs` — a two-route + simple nav pattern (below) covers "separate view" (D-06) without an extra primitive.

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Two routes (`/`, `/decisions`) with a plain nav | shadcn `tabs` on one route | Tabs would need client-side state and a third primitive for zero benefit — D-06 already wants "separate view," which a route *is*; two static Server Component routes is fewer moving parts |
| `useQuery` inline in two list components | A `hooks/use-proposals.ts` / `use-decisions.ts` wrapper | Only one call site each; a wrapper hook adds a file with no present reuse. Skip per ponytail — add if a third consumer appears |
| Zustand store for dashboard UI state | None — no store this phase | Nothing is shared across components beyond what TanStack Query's own cache already provides (query key = shared cache). D-21 installed Zustand for the *whole project*, not a mandate to use it in every phase |

## Package Legitimacy Audit

**Not applicable this phase.** No new npm packages are installed — `@tanstack/react-query` and `zustand` were already verified `[VERIFIED: npm registry]` in `.planning/research/STACK.md` and installed in Phase 1. The three shadcn component adds (`table`, `badge`, `card`) are generated source files copied into `components/ui/` by the already-pinned `shadcn@4.21.0` CLI, not a registry package resolution — no legitimacy check applies to them.

## Architecture Patterns

### System Architecture Diagram

```
Browser (dashboard tab, :3002)
   │
   │  1. GET / (first load)
   ▼
┌─────────────────────────────────────────────┐
│ app/page.tsx — async Server Component         │
│   calls lib/dashboard/queries.ts              │
│   getProposalRows() → Prisma → HKT-formatted  │
│   rows, rendered server-side                  │
└──────────────┬─────────────────────────────────┘
               │ renders <ProposalQueue initialData={rows} />
               ▼
┌─────────────────────────────────────────────┐
│ components/proposal-queue.tsx — "use client"  │
│   useQuery({                                   │
│     queryKey:["proposals"], initialData,       │
│     queryFn: fetch("/api/proposals"),          │
│     refetchInterval: 4000,                     │
│     refetchIntervalInBackground: true })        │
└──────────────┬─────────────────────────────────┘
               │ every 4s, GET /api/proposals
               ▼
┌─────────────────────────────────────────────┐
│ app/api/proposals/route.ts — thin handler      │
│   return NextResponse.json(                   │
│     await getProposalRows())                  │
│   (not cached by default in Next.js 16 —       │
│    no force-dynamic needed)                    │
└──────────────┬─────────────────────────────────┘
               │ same function as first paint
               ▼
┌─────────────────────────────────────────────┐
│ lib/dashboard/queries.ts                       │
│   getProposalRows() / getDecisionRows()        │
│   prisma.proposal.findMany({orderBy:           │
│     {created_at:"desc"}})                      │
│   → maps each row through utils/time.ts's      │
│     HKT formatter ONCE, here, server-side      │
└──────────────┬─────────────────────────────────┘
               │ Prisma read (lib/db.ts singleton, read-only)
               ▼
        Postgres (Docker, :5432, shared)

app/decisions/page.tsx follows the identical shape against
getDecisionRows() / DecisionLog / /api/decisions — a parallel,
independent branch of the same diagram, not shown twice.
```

### Recommended Project Structure

```
app/
  page.tsx                 # Proposal queue — Server Component first paint (replaces Phase 1's placeholder)
  decisions/
    page.tsx                # Decision log — Server Component first paint
  api/
    proposals/route.ts       # GET, thin — wraps lib/dashboard/queries.ts
    decisions/route.ts        # GET, thin — wraps lib/dashboard/queries.ts
  providers.tsx               # "use client" — QueryClientProvider, one instance via useState
  layout.tsx                   # root layout — font vars (next/font), globals.css, <Providers>, <Nav>
  globals.css                   # retro theme tokens + @theme inline (DSH-04)
components/
  nav.tsx                        # 2-link nav: Queue / Decisions (plain <Link>, no tabs primitive)
  proposal-queue.tsx               # "use client" — useQuery + table rows
  decision-log.tsx                   # "use client" — useQuery + table rows
  status-chip.tsx                      # presentational: status → token + symbol (shared by both views' badge)
  ui/                                   # shadcn: table, badge, card — unmodified, Biome-excluded
lib/
  dashboard/
    queries.ts                          # getProposalRows(), getDecisionRows() — Prisma + HKT formatting, single source
```

No new `types/`, `hooks/`, or `stores/` files this phase — DB row shapes come from the generated Prisma client per Phase 1's D-07; the display-row shape (with pre-formatted HKT string) is a small interface exported directly from `lib/dashboard/queries.ts`, not worth a separate `types/` file for two consumers.

### Route handlers do not need `force-dynamic`; pages get `await connection()`

`[VERIFIED: nextjs.org/docs/app/api-reference/file-conventions/route, docs version 16.3.4, fetched by orchestrator]`: version history row `v15.0.0-RC`: "The default caching for `GET` handlers was changed from static to dynamic". A plain `NextResponse.json(...)` GET handler is fresh on every request. Don't add `force-dynamic`.

Pages are a separate case. `[VERIFIED: nextjs.org/docs/app/guides/environment-variables, 16.3.4]` documents `await connection()` from `next/server` as the way to opt a Server Component into request-time rendering. Put it first in `app/page.tsx` and `app/decisions/page.tsx`.

### Polling pattern: `initialData` prop, not `HydrationBoundary`

Two ways exist to seed a client `useQuery` from server-fetched data:
1. The full TanStack SSR pattern: `dehydrate(queryClient)` on the server, `<HydrationBoundary state={dehydratedState}>` on the client, `useQuery` picks up the cache automatically.
2. Pass the server-fetched rows straight through as a prop and use `useQuery`'s own `initialData` option.

**Use option 2.** `HydrationBoundary`/`dehydrate` exists to share one `QueryClient`'s cache across many components/queries with cache-key coordination at scale; this phase has exactly one query per view, one consumer, and no need for query-key coordination across a tree. Passing `initialData={rows}` into `<ProposalQueue initialData={rows} />` and using it as `useQuery({ queryKey: ["proposals"], queryFn, initialData })` gets the same result with far less code.

**Correction (orchestrator-verified against tanstack.com/query/v5 "Initial Query Data"):** with the default `staleTime: 0`, a query with `initialData` "will immediately refetch when it mounts". So there is one extra fetch on mount, and after that the `refetchInterval` ticks take over. That's harmless here, and it's also the first check that `/api/proposals` actually works. Don't add `staleTime` just to suppress it.

### Code Examples

`lib/dashboard/queries.ts` (shared query module — single source of truth for both transports):

```typescript
// Source: pattern from .planning/research/ARCHITECTURE.md §"Dashboard: How It Reads Data"
import { prisma } from "@/lib/db";
import { formatHkt } from "@/utils/time"; // Phase 1 D-08's Intl.DateTimeFormat wrapper

/** A Proposal row shaped for display — dates are pre-formatted, never re-formatted client-side. */
export interface ProposalRow {
  id: string;
  title: string;
  status: string; // ProposalStatus enum value, rendered via status-chip's token map
  startHkt: string; // already formatted, e.g. "Thu 17 Sep 15:00"
  confidence: number;
}

/**
 * Reads the proposal queue for the dashboard.
 * @returns rows ordered newest-created first, so a freshly polled row appears at the top
 */
export async function getProposalRows(): Promise<ProposalRow[]> {
  const rows = await prisma.proposal.findMany({
    orderBy: { created_at: "desc" },
  });
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    startHkt: formatHkt(p.start),
    confidence: p.confidence,
  }));
}

// getDecisionRows() follows the identical shape against prisma.decision.findMany(),
// mapping verdict/confidence/reason/message_text — same pre-formatting rule for source_ts.
```

`app/api/proposals/route.ts` (thin — no caching config needed, see above):

```typescript
import { NextResponse } from "next/server";
import { getProposalRows } from "@/lib/dashboard/queries";

export async function GET() {
  return NextResponse.json(await getProposalRows());
}
```

`app/page.tsx` (Server Component first paint):

```typescript
import { connection } from "next/server";
import { getProposalRows } from "@/lib/dashboard/queries";
import { ProposalQueue } from "@/components/proposal-queue";

export default async function DashboardPage() {
  await connection(); // request-time render; never prerender seed rows at build
  const rows = await getProposalRows();
  return <ProposalQueue initialData={rows} />;
}
```

`components/proposal-queue.tsx` (`"use client"` — polling list):

```typescript
"use client";
import { useQuery } from "@tanstack/react-query";
import type { ProposalRow } from "@/lib/dashboard/queries";

/** Renders the proposal queue, polling for new rows every 4s. */
export function ProposalQueue({ initialData }: { initialData: ProposalRow[] }) {
  const { data } = useQuery({
    queryKey: ["proposals"],
    queryFn: () => fetch("/api/proposals").then((r) => r.json() as Promise<ProposalRow[]>),
    initialData,
    refetchInterval: 4000,
    refetchIntervalInBackground: true, // demo safety: keep polling if the presenter tabs away and back
  });
  // ...render shadcn <Table> rows from `data`, status via <StatusChip status={row.status} />
}
```

`app/providers.tsx` (`"use client"` QueryClientProvider — library provider injection, not app state; the repo's "no Context for changing app state" rule is about `stores/`-shaped state, not this):

```typescript
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

`app/globals.css` (retro tokens; one dark theme, so no `.dark` class toggle):

**Orchestrator correction: re-value shadcn's full token set, don't replace it with a reduced one.** `[VERIFIED: ui.shadcn.com/docs/theming]` shadcn's generated `globals.css` defines paired tokens: `--card`/`--card-foreground`, `--popover`/`--popover-foreground`, `--primary`/`--primary-foreground`, `--secondary`/`--secondary-foreground`, `--muted`/`--muted-foreground`, `--accent`/`--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`, `--chart-1..5`, `--sidebar-*`, plus `--radius`. The generated `@theme inline` derives `--radius-sm..4xl` from `--radius`. The generated `components/ui/*` files use these names: `text-muted-foreground` in `TableHead`, `hover:bg-muted/50` on `TableRow`, `bg-primary text-primary-foreground` on `Badge`, and `focus-visible:ring-ring` / `border-ring` for focus. The traps:
- **The PROJECT.md palette's `--muted #8A8A93` ("secondary text and labels") maps to shadcn's `--muted-foreground`, not `--muted`.** In shadcn, `--muted` is a subtle surface. Set `--muted` to a surface such as `#1C1C20`, the same value as `--elevated`. If you put `#8A8A93` in `--muted`, every table-row hover turns into a grey wash.
- Set `--primary-foreground`, `--secondary-foreground`, and the foreground for any filled success/destructive chip to `#0B0B0C` (dark text). See Contrast Findings.
- Set `--ring` to the amber value. That gives every shadcn primitive a 9.85:1 focus ring for free (DSH-06).
- Set `--card-foreground`/`--popover-foreground` to the foreground value, `--popover`/`--accent` to the elevated value, and `--input` to the border value. Leave `--chart-*`/`--sidebar-*` as generated; they're unused.
- Keep the generated `--radius-*` derivation but lower the base. shadcn 4.x derives the scale as a percentage of `--radius`. Check the generated file: if it uses `calc(var(--radius) - 4px)` it will clamp to 0 at small bases. With `--radius: 0.25rem`, `rounded-xl`+ can still exceed 4px, so use `rounded-sm`/`rounded-md`/`rounded-lg` only.
- Edit the values inside the existing `:root` block that Phase 1's `shadcn init` generated, and delete the generated `.dark` block (there is no toggle). Don't write a second `:root`.

Additions on top of the generated file (the only new lines):

```css
:root {
  /* ...generated shadcn tokens, re-valued as above... */
  --elevated: #1c1c20;
  --success: #46c07a;
  --success-foreground: #0b0b0c;
  --radius: 0.25rem; /* 4px base */
}

@theme inline {
  /* ...generated --color-* and --radius-* mappings kept... */
  --color-elevated: var(--elevated);        /* REQUIRED, or bg-elevated silently renders unstyled (D-16) */
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --font-mono: var(--font-jetbrains-mono);  /* var name set by next/font `variable` on <html>; do NOT also declare it in :root */
  --font-sans: var(--font-sans-body);
  --shadow-retro: 4px 4px 0 0 var(--border); /* -> `shadow-retro` utility; no blur (DSH-05) */
}
```

Don't declare `--font-jetbrains-mono`/`--font-sans-body` in `:root`. next/font sets them through a class on `<html>`, and a `:root` declaration has equal specificity, so it can override them and silently drop the font. The shadow colour is a judgement call: `var(--border)` is subtle on near-black, and `impeccable colorize` may prefer a darker or amber-tinted offset. Either way it stays a token, not a literal.

`app/layout.tsx` font wiring:

```typescript
// Source: WebSearch this session, next/font/google docs pattern.
// JetBrains Mono is a true variable font (one weight axis) — no explicit `weight` array needed.
// IBM Plex Mono (the D-12 alternative) is NOT fully variable on Google Fonts and needs
// weight: ["400","500","600","700"] explicitly if chosen instead.
import { JetBrains_Mono, Inter } from "next/font/google";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans-body" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

Check whether Phase 1's `create-next-app` scaffold already put a default font (commonly Geist) in `app/layout.tsx` — replace that block rather than adding a second font-loading block alongside it.

### Status → token + symbol map (D-12: status encoded in form, not colour alone)

| `ProposalStatus` (Phase 1 D-11 enum) | Token | Symbol/form |
|---|---|---|
| `pending` | `--primary` (amber) | filled dot `●` |
| `confirmed` | `--success` | check `✓` |
| `dismissed` | `--muted` | cross `✕` |
| `already_scheduled` | `--secondary` (cyan) | arrow `→` |

| `DecisionVerdict` (Phase 1 D-11 enum) | Token | Symbol/form |
|---|---|---|
| `acted` | `--success` | check `✓` |
| `ignored` | `--muted` | dash `—` |

Every filled chip uses **dark text** (`--background`, not `--foreground`) — see Contrast Findings below.

## Contrast Findings (computed this session, WCAG relative-luminance formula)

`[VERIFIED: computed directly from the WCAG 2.x contrast formula — srgb→linear→relative-luminance→(L1+0.05)/(L2+0.05) — against the D-11 hex values, via a local script this session, not a third-party tool]`. Formula source: WCAG 2.1 §1.4.3/1.4.11 contrast algorithm (well-established, standard).

| Pair | Ratio | WCAG 4.5:1 (body text) | WCAG 3:1 (large text / UI component) |
|---|---|---|---|
| `--foreground` on `--background` | 16.83:1 | pass | pass |
| `--foreground` on `--card` | 15.74:1 | pass | pass |
| `--foreground` on `--elevated` | 14.53:1 | pass | pass |
| `--muted` on `--background` | 5.75:1 | pass | pass |
| `--muted` on `--card` | 5.38:1 | pass | pass |
| `--primary` (amber) on `--background` | 9.85:1 | pass | pass |
| `--secondary` (cyan) on `--background` | 10.08:1 | pass | pass |
| `--success` on `--background` | 8.51:1 | pass | pass |
| `--destructive` on `--background` | 5.34:1 | pass | pass |
| `--border` on `--background` | 1.46:1 | **fail** | **fail** |
| `--foreground` (white text) on filled `--primary` chip | 1.71:1 | **fail** | **fail** |
| `--foreground` (white text) on filled `--secondary` chip | 1.67:1 | **fail** | **fail** |
| `--background` (dark text) on filled `--primary` chip | 9.85:1 | pass | pass |
| `--background` (dark text) on filled `--secondary` chip | 10.08:1 | pass | pass |
| `--background` (dark text) on filled `--success` chip | 8.51:1 | pass | pass |
| `--background` (dark text) on filled `--destructive` chip | 5.34:1 | pass | pass |
| `--foreground` (white text) on filled `--destructive` chip | 3.15:1 | fail (body text) | pass (large text / UI component only) |

**Two actionable findings:**

1. **Every filled/solid status or verdict chip must use dark text (`--background`), never `--foreground`.** White text on amber, cyan, or destructive fills fails badly or borderline-fails; dark text on the same fills passes at 5.3–10:1 across the board. This is a hard rule for `status-chip.tsx`, not a style preference.
2. **`--border` at 1.46:1 against `--background`/`--card` fails the WCAG 1.4.11 non-text 3:1 minimum for UI-component boundaries**, even though D-11's prose calls it "visible, structural, never hairline-faint." This is fine for purely decorative panel dividers (not itself an accessibility requirement), but if a border is the *only* visual cue that something is interactive (e.g. an unstyled clickable row outline), it will not meet the non-text contrast bar. DSH-06's actual accessibility requirement — visible focus states — is covered separately by the amber focus ring (9.85:1), which is unaffected by this. Flag for `/impeccable colorize`/`critique` as a candidate to lighten slightly (e.g. toward `#3A3A42`) if it proposes a stronger palette; not a blocker for DSH-06 as locked.

## Common Pitfalls

### Pitfall: Hydration mismatch from formatting dates twice, in two places

**What goes wrong:** The Server Component renders the initial HTML with times formatted one way; if the client component (or its route-handler fetcher) ever reformats a raw `Date`/ISO string independently — especially using the browser's local `Intl` without an explicit `timeZone` — the server-rendered and client-rendered text can differ, producing a React hydration warning and, worse, a wrong displayed time if the demo laptop's OS timezone isn't HKT.

**How to avoid:** Format HKT display strings exactly once, inside `lib/dashboard/queries.ts`, using the existing `utils/time.ts` formatter (which hardcodes `timeZone: "Asia/Hong_Kong"` per Phase 1 D-08). Both the Server Component (direct call) and the route handler (JSON response) go through the same function, so both paths emit the identical pre-formatted string — nothing downstream ever calls `Intl`/`Date` again. Never pass a raw `Date` across the Server Component → Client Component prop boundary or through the route handler's JSON body.

**Phase to address:** Plan 06-01/06-02 — bake this into `queries.ts`'s return type (`startHkt: string`, not `start: Date`) from the first draft.

### Pitfall: TanStack Query pauses polling when the tab loses focus (default behavior)

**What goes wrong:** `[CITED: TanStack Query v5 docs, WebSearch-verified this session]` — by default, `refetchInterval` pauses while the browser tab is not focused/visible. If the presenter alt-tabs to Slack to trigger the demo row and back to the dashboard tab, the poll may have been paused the whole time, and the "appears within ~5s" exit criterion could look broken even though the code is correct.

**How to avoid:** Set `refetchIntervalInBackground: true` explicitly on both `useQuery` calls (already in the code example above). This is a one-line, zero-risk addition for a two-view dashboard with a handful of rows.

**Phase to address:** Plan 06-02, when the polling is wired.

### Pitfall: Custom shadcn tokens unstyled with no console error (already flagged, PITFALLS.md/D-16)

**What goes wrong:** `--elevated`, `--success`, etc. declared only in `:root` don't produce `bg-elevated`/`text-success` utilities — Tailwind v4 only generates a utility for names inside `@theme inline`. No error, just an unstyled element.

**How to avoid:** Every custom token added to `:root` gets a matching line in `@theme inline` in the same edit (see the `globals.css` code example — every `--color-*` line has a `:root` counterpart). D-16's smoke test (one element using `bg-elevated`, checked in devtools within the first minutes) is the fast way to catch a forgotten mapping.

**Phase to address:** Plan 06-02, first thing.

### Pitfall: `bun --bun next dev` causes excessive Fast Refresh rebuilds (PITFALLS.md Pitfall 14)

**What goes wrong:** Forcing bun's own runtime for the Next.js dev server (`bun --bun next dev`, or `bun --bun` anywhere near the `dev` script) has a documented Turbopack interaction causing repeated BUILDING/BUILT cycles per save — worse as the app grows, which is exactly this phase's trajectory (multiple components added across three plans).

**How to avoid:** `package.json`'s `dev` script must stay plain `next dev` (bun still runs it via `bun run dev`, just not forcing bun's runtime for the script itself). Confirm a single save produces one BUILDING/BUILT pair in the first minutes (D-14's own check).

**Phase to address:** Plan 06-01, before writing real components.

### Pitfall: `impeccable` commands read `DESIGN.md`/brand context that doesn't exist here

**What goes wrong:** `colorize.md`'s own header says "Additional context needed: existing brand colors" and its first step is "Read DESIGN.md, tokens, assets, current themes." No `/impeccable init` has run (deliberately, per D-15) and no `DESIGN.md` exists in this repo.

**How to avoid:** Feed the theme direction inline when invoking each command — the D-11 palette, D-12's retro-device list, and this RESEARCH.md's contrast findings are the "brand color"/context input that would otherwise come from `DESIGN.md`. Do not stop to write a `DESIGN.md` file or run `/impeccable init`; that's explicitly out of scope (PROJECT.md, "Out of Scope").

**Phase to address:** Every impeccable invocation (06-01 through 06-03).

### Pitfall: `/impeccable critique` ends by asking the user questions — budget real time for it

**What goes wrong:** `critique.md`'s protocol is not fire-and-forget: after the structured report, it is required to call `AskUserQuestion` and the run is "incomplete" until the user answers (or a documented skip-line applies, only when fewer than 3 Priority Issues were found). Treating `critique` as a deterministic, instant step and moving straight to `polish` without the exchange is a protocol violation and also means the polish pass loses its prioritized issue list.

**How to avoid:** Plan 06-03 should budget a few real minutes of back-and-forth for `critique`'s question, not assume it's a single tool call. `polish` (immediately after) reads the persisted `.impeccable/critique/` snapshot automatically — no extra wiring needed on the plan's side.

**Phase to address:** Plan 06-03.

## Orchestrator Verification Corrections

The orchestrator checked these against the Next.js 16.3.4 docs, the TanStack Query v5 docs and the shadcn theming docs before committing. They override anything above that contradicts them.

1. **`PORT` in `.env` is not read by Next.js.** `[VERIFIED: nextjs.org/docs/app/api-reference/cli/next, 16.3.4]`: "`PORT` cannot be set in `.env` as booting up the HTTP server happens before any other code is initialized." Phase 1's D-16 depends on `bun run` injecting `.env` into the child process environment before `next dev` starts. Bun does auto-load `.env`, but that's not verified for this exact path (`[ASSUMED]`). **Plan 06-01's first check:** run `bun run dev` and confirm the banner prints `:3002`. If it doesn't, use `bun run dev -p 3002` (bun forwards flags without `--`) or `PORT=3002 bun run dev`. Don't edit the shared `dev` script in `package.json`, because `main` uses :3000.
2. **Route handler caching.** GET handlers have been dynamic by default since v15, not v16. The conclusion still holds: no `force-dynamic`. Pages get `await connection()` (see Summary item 1).
3. **`initialData` refetches on mount** with the default `staleTime: 0`. This is harmless (see Polling pattern).
4. **The shadcn token set is paired** (`--muted` is a surface, `--muted-foreground` is the text). Re-value the generated tokens rather than replacing them (see the `globals.css` section).
5. **Focus states (DSH-06) mostly come for free.** Setting `--ring` to amber covers shadcn primitives. Only two kinds of element are hand-styled and interactive: nav `<Link>`s, and any link inside a row such as a Calendar/Meet link. Give them `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`. Table rows are **not** interactive (the dashboard is read-only, D-07), so they must not get `tabIndex`. Making them focusable would put non-interactive stops in the tab order, and ROADMAP success criterion 4 only requires a focus outline on interactive elements. The cut-order "table rows" item then comes down to "rows contain no unfocusable interactive children".
6. **`lib/dashboard/queries.ts` is outside the ROADMAP's Phase 6 "Files owned" list** (`app/**`, `components/**`, `app/globals.css`), but it isn't in the must-not-touch list either, and PROJECT.md's "thin route handlers with logic in `lib/`" rule points to `lib/`. It's a new directory with no overlap with Phase 5's `lib/agent/**`/`lib/ai/**`. The planner should list it explicitly in `files_modified`. If strict ownership matters more, the fallback is to inline the two `findMany` calls in the route handlers and call them from the pages. That's a small duplication, but it stays inside `app/**`.
7. **Serialization of numeric columns.** If Phase 1's schema makes `confidence` a Prisma `Decimal` rather than `Float`, `NextResponse.json` emits it as a string while the RSC prop path passes a `Decimal` object, which can't cross the client boundary. Map it with `Number(...)` inside `queries.ts` either way, so both transports carry a plain `number`. Check the actual type in `prisma/schema.prisma` at plan time.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Table rows for the queue/log | A hand-rolled `<div>` grid | shadcn `table` primitives (`Table`, `TableHeader`, `TableRow`, `TableCell`) | CLAUDE.md: no hand-rolled components shadcn already provides |
| Status/verdict pill | A custom styled `<span>` | shadcn `badge` + the status→token map above | Same rule; `badge` already handles the shape, only the token/symbol mapping is product-specific |
| Client-side data fetching | `useEffect` + `fetch` + manual loading state | `useQuery` from `@tanstack/react-query` | Explicit repo rule (D-20): "TanStack Query, not ad-hoc `useEffect` fetching" |
| Server/client cache sharing | `dehydrate`/`HydrationBoundary` | `initialData` prop into `useQuery` | Right-sized for one query per view; `HydrationBoundary` solves a coordination problem this phase doesn't have |
| HKT formatting | A new date/Intl call in a component | `utils/time.ts`'s existing formatter (Phase 1 D-08), called once inside `queries.ts` | Reuse-before-writing rule, and the only way to avoid the hydration-mismatch pitfall above |

**Key insight:** every "don't hand-roll" in this phase already has an installed, already-decided answer from Phase 1 or the repo rules — there is no new abstraction to design here, only correct composition.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Postgres (Docker, :5432) | All Prisma reads (DSH-01/02) | ✓ (running since Phase 1/4) | postgres:16-alpine | — |
| bun / Next.js dev server | `bun run dev` on :3002 | ✓ (verified Phase 1) | bun 1.4.x, next 16.3.4 | — |
| shadcn CLI | Component adds | ✓ (pinned 4.21.0, used for init in Phase 1) | 4.21.0 | — |

**Missing dependencies:** none. This phase introduces no new external dependency — everything needed is already installed, running, or pinned by Phase 1/4.

## Security Domain

`security_enforcement` is on (ASVS level 1) per `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | No | No login in this phase; dashboard has no auth surface (single-laptop demo, not addressed here or anywhere in this build) |
| V3 Session Management | No | No sessions created |
| V4 Access Control | No | Read-only, no per-user filtering, single-tenant demo |
| V5 Input Validation | Minimal | No user input this phase — both route handlers are parameterless `GET`s; no query-string filtering is added (keep it that way — it removes an entire injection surface for free) |
| V6 Cryptography | No | No secrets touched by this phase's code (the Google refresh token exists in the DB from Phase 1 but is never read or rendered here) |
| V7 (XSS / Output Encoding, cross-cutting) | Yes | `Decision.message_text` and `Decision.reason` come from real Slack message content and an LLM-generated string (Phase 5) — both are rendered as plain React children, never via `dangerouslySetInnerHTML`. React's default JSX text-node escaping is the only control needed and is already the default; just don't introduce raw HTML rendering for these two fields |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Stored-XSS via rendered Slack/LLM text | Tampering / Information Disclosure | Render `message_text`/`reason` as plain JSX text (React auto-escapes); never `dangerouslySetInnerHTML` |
| Secret leakage via client bundle | Information Disclosure | This phase's client components (`proposal-queue.tsx`, `decision-log.tsx`, `providers.tsx`) import no `lib/config.ts`/env values at all — `queries.ts` (server-only) is the only file that touches Prisma/DB config, and it never runs in the browser bundle |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | shadcn CLI 4.21.0's exact `Table`/`Badge`/`Card` component prop shapes match general current shadcn docs (not independently re-verified against the pinned version this session) | Standard Stack, Code Examples | Low — worst case a prop name differs slightly; `bunx shadcn@4.21.0 add table badge card --help`/reading the generated file at implementation time resolves it in seconds |
| A2 | IBM Plex Mono (D-12's named alternative to JetBrains Mono) requires an explicit `weight` array in `next/font/google` because it is not a fully variable Google Font | Code Examples (font wiring) | Low — JetBrains Mono (the recommended primary pick) is confirmed variable and needs no weight array either way; this only matters if the alternative is chosen |
| A3 | Phase 1's `create-next-app` scaffold left a default font block (commonly Geist) in `app/layout.tsx` that this phase's font wiring should replace rather than duplicate | Code Examples (font wiring) | Low — repo isn't scaffolded yet at research time so this can't be grepped; a duplicate font-loading block is a harmless, easily-spotted cleanup item, not a functional break |

**If this table is empty:** N/A — three low-risk assumptions logged above; none affect DSH-01..06's exit criteria.

## Verification Commands (for the plan's own checks)

```bash
# DSH-04: no colour literal outside globals.css
grep -rEn "#[0-9a-fA-F]{3,8}" app components --include="*.tsx" --include="*.ts" | grep -v "app/globals.css"
# Expect: no output

# D-16 smoke test: confirm @theme inline mapping took effect
# (visual check — one element with className="bg-elevated", inspect computed background-color in devtools)

# Biome after each shadcn add (D-18)
bunx --bun @biomejs/biome check --write
```

## Sources

### Primary (HIGH confidence)
- `ui.shadcn.com/docs/tailwind-v4` — fetched this session (WebFetch) — `@theme inline` mapping shape, custom-token pattern, `@custom-variant dark` structure
- `nextjs.org/docs/app/api-reference/file-conventions/route` (docs v16.3.4, orchestrator WebFetch): GET handlers are dynamic by default since v15.0.0-RC
- `nextjs.org/docs/app/api-reference/cli/next` (docs v16.3.4, orchestrator WebFetch): `PORT` cannot be set in `.env`
- `nextjs.org/docs/app/guides/environment-variables` (docs v16.3.4, orchestrator WebFetch): `await connection()` opts a page into request-time rendering
- `tanstack.com/query/v5/docs/framework/react/guides/initial-query-data` (orchestrator WebFetch): `initialData` + default `staleTime` refetches on mount
- `ui.shadcn.com/docs/theming` (orchestrator WebFetch): full paired token list and radius scale
- WCAG 2.1 contrast algorithm — computed directly this session via a local script against the D-11 hex values (not a third-party tool; the formula itself is the well-established srgb→linear→relative-luminance standard)
- `.planning/research/ARCHITECTURE.md` §"Dashboard: How It Reads Data" — already-locked pattern this research implements concretely
- `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md`, `01-RESEARCH.md` — schema (D-09/D-11), `lib/db.ts` singleton (D-12), `utils/time.ts` (D-08), dependency install batch (D-21), `app/page.tsx` placeholder (D-25)

### Secondary (MEDIUM confidence)
- TanStack Query v5 `refetchIntervalInBackground` default-pause behavior — WebSearch-verified this session against `tanstack.com/query` docs summaries, not the raw doc page fetched directly
- `next/font/google` JetBrains Mono (variable) vs. IBM Plex Mono (weight array) — WebSearch-aggregated this session, not a single official page fetch

### Tertiary (LOW confidence)
- None beyond what's logged in the Assumptions Log above.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages, all pins already verified in Phase 1
- Architecture (polling, route-handler caching, hydration-mismatch avoidance): HIGH — Next.js 16 behavior and TanStack defaults confirmed via search this session
- Contrast findings: HIGH — computed directly from the standard WCAG formula against the exact D-11 hex values, not eyeballed
- shadcn component prop shapes: MEDIUM — not independently re-verified against the exact pinned CLI version this session

**Research date:** 2026-09-11
**Valid until:** This build window only (Sat 12 Sep 2026) — one-day hackathon build, not intended to outlive Phase 6's execution.
