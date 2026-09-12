# Phase 6: Dashboard - Pattern Map

**Mapped:** 2026-09-11
**Files analyzed:** 11 new files (no modifications — repo is greenfield)
**Analogs found:** 0 in-repo code analogs (repo has zero source files outside `.planning/`/`.claude/` — Phase 1 scaffold hasn't executed). All analogs below are **upstream contract analogs**: interfaces/paths fixed by lower-numbered phases' planning docs, not runnable code. Cite the planning doc, not a source file, when using these.

## File Classification

| New File | Role | Data Flow | Closest Analog (contract, not code) | Match Quality |
|---|---|---|---|---|
| `app/page.tsx` | route (Server Component) | request-response | RESEARCH.md §"Code Examples" `app/page.tsx` block (Phase 6 research itself, already concrete); replaces Phase 1 D-25 placeholder | exact (research gives full code) |
| `app/decisions/page.tsx` | route (Server Component) | request-response | Same shape as `app/page.tsx`, parallel branch per RESEARCH.md diagram | exact |
| `app/api/proposals/route.ts` | route (handler) | request-response | RESEARCH.md §"Code Examples" `app/api/proposals/route.ts` block | exact |
| `app/api/decisions/route.ts` | route (handler) | request-response | Same shape, swap `getDecisionRows()` | exact |
| `lib/dashboard/queries.ts` | service (data-read module) | CRUD (read-only) | RESEARCH.md §"Code Examples" `lib/dashboard/queries.ts` block; imports `lib/db.ts` (01-CONTEXT.md D-12) + `utils/time.ts` formatHkt (01-CONTEXT.md D-08, 02-RESEARCH.md "Orchestrator Review Notes" item 4 fixes `@/utils/time`) | exact |
| `components/proposal-queue.tsx` | component (client list) | request-response (poll) | RESEARCH.md §"Code Examples" `components/proposal-queue.tsx` block | exact |
| `components/decision-log.tsx` | component (client list) | request-response (poll) | Same shape as `proposal-queue.tsx`, swap query key/endpoint | exact |
| `components/status-chip.tsx` | component (presentational) | transform | RESEARCH.md §"Status → token + symbol map" table; shadcn `badge` primitive as base | role-match |
| `components/nav.tsx` | component (presentational) | request-response | No analog needed — trivial 2-link `<Link>` nav; RESEARCH.md "Recommended Project Structure" names it | none (trivial) |
| `app/providers.tsx` | provider | event-driven (client cache) | RESEARCH.md §"Code Examples" `app/providers.tsx` block | exact |
| `app/globals.css` | config (theme tokens) | transform | RESEARCH.md §"Code Examples" `globals.css` block + shadcn's Phase 1 `shadcn init`-generated `:root`/`@theme inline` (01-CONTEXT.md D-22) — re-value in place, don't replace | exact |
| `app/layout.tsx` (modified) | route (root layout) | request-response | RESEARCH.md §"Code Examples" `app/layout.tsx` font-wiring block; check Phase 1's `create-next-app` default font block first (Assumption A3) | exact |

## Pattern Assignments

### `lib/dashboard/queries.ts` (service, CRUD read-only)

**Analog:** 06-RESEARCH.md §"Code Examples" (concrete, already-written pattern — this phase's own research is the analog since no in-repo file exists).

**Imports pattern:**
```typescript
import { prisma } from "@/lib/db";        // 01-CONTEXT.md D-12 singleton, @/ alias per 02-RESEARCH.md
import { formatHkt } from "@/utils/time"; // 01-CONTEXT.md D-08 HKT formatter
```

**Core read pattern:**
```typescript
export interface ProposalRow {
  id: string;
  title: string;
  status: string;
  startHkt: string; // pre-formatted, never a raw Date — avoids hydration mismatch
  confidence: number; // Number(...) if schema uses Prisma Decimal — check prisma/schema.prisma
}

export async function getProposalRows(): Promise<ProposalRow[]> {
  const rows = await prisma.proposal.findMany({ orderBy: { created_at: "desc" } });
  return rows.map((p) => ({
    id: p.id, title: p.title, status: p.status,
    startHkt: formatHkt(p.start), confidence: Number(p.confidence),
  }));
}
// getDecisionRows() — identical shape against prisma.decision.findMany()
```

**Rule enforced:** date formatting happens exactly once, here, server-side. Neither the Server Component nor the client `"use client"` list component may call `Intl`/`Date` again — both consume this module's pre-formatted `startHkt` string.

---

### `app/page.tsx` / `app/decisions/page.tsx` (route, request-response)

**Analog:** 06-RESEARCH.md §"Code Examples" `app/page.tsx` block; replaces Phase 1 D-25's placeholder.

```typescript
import { connection } from "next/server";
import { getProposalRows } from "@/lib/dashboard/queries";
import { ProposalQueue } from "@/components/proposal-queue";

export default async function DashboardPage() {
  await connection(); // request-time render; stops build-time DB hit / frozen seed data
  const rows = await getProposalRows();
  return <ProposalQueue initialData={rows} />;
}
```
`app/decisions/page.tsx` is the identical shape against `getDecisionRows()`/`<DecisionLog>`.

---

### `app/api/proposals/route.ts` / `app/api/decisions/route.ts` (route handler, request-response)

**Analog:** 06-RESEARCH.md §"Code Examples".

```typescript
import { NextResponse } from "next/server";
import { getProposalRows } from "@/lib/dashboard/queries";

export async function GET() {
  return NextResponse.json(await getProposalRows());
}
```
No `export const dynamic = "force-dynamic"` — GET handlers are dynamic by default since Next.js v15 (verified against 16.3.4 docs).

---

### `components/proposal-queue.tsx` / `components/decision-log.tsx` (client component, poll)

**Analog:** 06-RESEARCH.md §"Code Examples".

```typescript
"use client";
import { useQuery } from "@tanstack/react-query";
import type { ProposalRow } from "@/lib/dashboard/queries";

export function ProposalQueue({ initialData }: { initialData: ProposalRow[] }) {
  const { data } = useQuery({
    queryKey: ["proposals"],
    queryFn: () => fetch("/api/proposals").then((r) => r.json() as Promise<ProposalRow[]>),
    initialData,
    refetchInterval: 4000,
    refetchIntervalInBackground: true, // demo safety: presenter alt-tabs to Slack and back
  });
  // render shadcn <Table> rows, status via <StatusChip status={row.status} />
}
```
Use `initialData` prop, not `dehydrate`/`HydrationBoundary` — one query per view, no cross-tree coordination needed.

---

### `app/providers.tsx` (provider)

**Analog:** 06-RESEARCH.md §"Code Examples".

```typescript
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

---

### `app/globals.css` (config, theme tokens)

**Analog:** shadcn's Phase 1 `shadcn init`-generated `:root`/`.dark`/`@theme inline` block (01-CONTEXT.md D-22 "shadcn init only") + 06-RESEARCH.md §"Code Examples" `globals.css` corrections.

**Pattern:** re-value the existing generated `:root` tokens in place (don't write a second `:root`, delete `.dark` — one theme, no toggle). Paired tokens matter: PROJECT.md's `--muted #8A8A93` maps to shadcn's `--muted-foreground`, not `--muted` (`--muted` is a surface, set it to `#1C1C20`). Every custom token needs both a `:root` declaration AND an `@theme inline` mapping line, or the utility silently renders unstyled:
```css
:root {
  --elevated: #1c1c20;
  --success: #46c07a;
  --success-foreground: #0b0b0c;
  --radius: 0.25rem;
}
@theme inline {
  --color-elevated: var(--elevated);   /* REQUIRED or bg-elevated is unstyled */
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --font-mono: var(--font-jetbrains-mono);
  --font-sans: var(--font-sans-body);
  --shadow-retro: 4px 4px 0 0 var(--border);
}
```
`--primary-foreground`/`--secondary-foreground`/`--success-foreground` → dark (`#0B0B0C`), never `--foreground` — see Contrast Findings (white text on amber/cyan fails). `--ring` → amber, gives free 9.85:1 focus ring.

---

### `components/status-chip.tsx` (presentational)

**Analog:** shadcn `badge` primitive (added this phase via `bunx shadcn@4.21.0 add badge`) + RESEARCH.md status→token table.

**Core pattern:** map `ProposalStatus`/`DecisionVerdict` enum values (01-CONTEXT.md D-09/D-11) to `{token, symbol}` pairs, render via shadcn `<Badge>` with dark text on filled color, symbol always present (not color-only, per D-12/D-13):
```
pending → --primary, ●   |  confirmed → --success, ✓
dismissed → --muted, ✕   |  already_scheduled → --secondary, →
acted → --success, ✓     |  ignored → --muted, —
```

## Shared Patterns

### DB access singleton
**Source:** `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md` D-12 (`lib/db.ts` exports `prisma`, generated client at `prisma/generated/`)
**Apply to:** `lib/dashboard/queries.ts` only (the single Prisma touchpoint this phase; route handlers and pages never import `prisma` directly).

### HKT time formatting
**Source:** `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md` D-08 (`utils/time.ts`, exported as `formatHkt` per `.planning/phases/02-slack-surface/02-RESEARCH.md` "Orchestrator Review Notes" item 4)
**Apply to:** `lib/dashboard/queries.ts` exclusively — called once per row, server-side. No other file calls `Intl`/`Date`.

### Import aliasing
**Source:** `.planning/phases/02-slack-surface/02-RESEARCH.md` "Orchestrator Review Notes" item 4
**Apply to:** all new files — use `@/lib/db`, `@/utils/time`, `@/lib/dashboard/queries`, `@/components/...`, never relative `../../`.

### Read-only, no mutation
**Source:** 06-CONTEXT.md D-07/D-09
**Apply to:** every route handler and page — GET only, no POST/PATCH, no websockets/SSE.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `components/nav.tsx` | component | request-response | Trivial 2-link `<Link>` nav, no shadcn primitive or pattern needed — RESEARCH.md names the file directly, no code excerpt required |
| `app/layout.tsx` font wiring | route | request-response | RESEARCH.md provides a full concrete example (next/font/google `JetBrains_Mono` + `Inter`) but instructs checking what Phase 1's `create-next-app` scaffold left behind first (Assumption A3) — verify at execution time, not plannable further now |

## Metadata

**Analog search scope:** `git ls-files` (repo-wide) — zero source files found outside `.planning/`/`.claude/`. All patterns sourced from `.planning/phases/01-foundation-hardcoded-round-trip/01-CONTEXT.md`, `01-RESEARCH.md`, `.planning/phases/02-slack-surface/02-RESEARCH.md`, and this phase's own `06-RESEARCH.md` (which contains fully-written code examples in lieu of in-repo analogs).
**Files scanned:** 0 (greenfield repo confirmed via `git ls-files`)
**Pattern extraction date:** 2026-09-11
