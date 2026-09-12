---
phase: 06-dashboard
plan: 01
status: complete
requirements: [DSH-01, DSH-02, DSH-03]
---

# 06-01 Summary — Dashboard tracer slice

## What shipped
- `lib/dashboard/queries.ts` — single read path: `ProposalRow`, `DecisionRow`, `getProposalRows`, `getDecisionRows`; HKT formatted once here.
- `app/api/proposals/route.ts`, `app/api/decisions/route.ts` — parameterless GET poll endpoints.
- `app/providers.tsx` — one `QueryClient` in `useState`; `app/layout.tsx` wraps `Providers` + `Nav`.
- `app/page.tsx`, `app/decisions/page.tsx` — `await connection()` then server-fetch rows as `initialData`.
- `components/proposal-queue.tsx`, `components/decision-log.tsx` — `useQuery`, `refetchInterval: 4000`, `refetchIntervalInBackground: true`, empty/error rows, `data-status` / `data-verdict` markers.
- `components/status-chip.tsx` (six enum values → token + symbol), `components/nav.tsx` (two links, focus-visible ring).
- `components/ui/{table,badge,card}.tsx` via `bunx shadcn@4.21.0 add`, unmodified.

## Recorded facts
- **Port:** dev server already running from this worktree on :3002 (`next dev -p 3002`); shared `dev` script untouched.
- **package.json / bun.lock after shadcn add:** unchanged (`git status --porcelain` empty).
- **HKT formatter:** `formatHkt(value: Date | string): string` from `utils/time.ts`; also exports `HKT_TIME_ZONE`.
- **confidence:** Prisma `Float`, non-nullable on both models. Null guard kept anyway so the row contract is `number | null`.
- **Decision time:** derived from `source_ts` (epoch-seconds string); unparseable → em dash.

## Deviation
- Added `--success` / `--success-foreground` to `app/globals.css` (`:root`, `.dark`, `@theme inline`) so the chip's `bg-success` class exists. 06-02 re-values it with the retro palette.
- Font: the scaffold mapped `--font-sans` to an undefined variable (serif fallback). Resolved in 06-02 with Inter / JetBrains Mono.

## Task 3 layout pass
No impeccable skill is exposed in this session, so no `/impeccable layout` call was made. Applied by hand within the time box: page shell (`main` p-6, gap-4), uppercase mono micro-label headings, mono tabular numerals on time/confidence, right-aligned confidence, `max-w-md` wrapped reason, `max-w-xs` CSS-truncated message. Declined: nothing else proposed. Verified at 1280×720 — no overflow.

## Gates
tsc clean · biome clean · `/` 200 with 15 `data-status` rows · `/decisions` 200 with 7 `data-verdict="ignored"` rows · endpoints return pre-formatted rows with numeric confidence · no `process.env`/config/db in client files · no `dangerouslySetInnerHTML`, no `onClick`, no hex literals.

DSH-03 check: measured in 06-03 (row appeared in 3.9 s with the NEW marker).
