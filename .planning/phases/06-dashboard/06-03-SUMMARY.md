---
phase: 06-dashboard
plan: 03
status: complete
requirements: [DSH-01, DSH-02, DSH-03, DSH-04, DSH-05, DSH-06]
---

# 06-03 Summary — Critique and polish

## Critique (dual-agent, `.impeccable/critique/2026-09-12T05-51-03Z__app-page-tsx.md`)
Score 19/32 (H3, H5 n/a). Verdict: authored palette on a category-interchangeable shell.
P0: phone layout collapsed the text columns to 0px (`table-fixed` + fixed widths with no floor); no PostHog-style shell and a 1440px container cap.
P1: raw `<@U123>` mention in a proposal title; live changes invisible.
P2: differing column grammar between the two tables, confidence repeated in the reason prose, no `error.tsx` / `loading.tsx`.
Detector: source scan clean; the in-browser scan flagged header line-length and the `p-0` card.

User scope: all issues; left sidebar; NEW marker + timestamp.

## Polish applied
- **Shell (PostHog pattern):** `components/nav.tsx` is a 224px sticky sidebar (wordmark, icon links, read-only note) that becomes a top bar below `md`. The content column is `flex-1 min-w-0` and takes 100% of the remaining width; no `max-w` anywhere on the shell. Active link = filled row + amber text (the side-rule version was flagged by the detector and replaced).
- **Scene header:** `components/scene-header.tsx` — h1 plus a `max-w-prose` description above a hard rule; per-route `<title>` via the metadata template.
- **Grid:** `components/data-grid.tsx` — `GridFrame` is `flex-1 min-h-0 overflow-auto`, so each table fills the remaining viewport and scrolls on both axes; `min-w-[880px]` (queue) / `min-w-[1040px]` (decisions) floor with `table-fixed`; sticky `th` (`border-separate` so the header rule survives); `<caption class="sr-only">` on both tables. Measured via CDP: page scrollWidth equals clientWidth at 390 / 1280 / 1366 / 1920; at 390 the frame scrolls 1040px of intact columns; at 1366 and above the decisions table fits without a scrollbar.
- **Column grammar:** both tables read chip → primary text → (secondary text) → time → confidence, with confidence right-aligned last.
- **Live signal:** `FeedStatus` shows `UPDATED hh:mm:ss` (HKT, client-only, rendered after the first poll) and is an `aria-live="polite"` region; `hooks/use-new-rows.ts` flags rows absent from the previous poll with a `NEW` micro-label for one cycle. DSH-03 measured: a row inserted via Prisma appeared in an open headless tab after 3.9s with the marker, which cleared on the next poll.
- **Data hygiene:** `lib/dashboard/queries.ts` renders Slack mentions as `@id` and splits the agent's `low|medium|high confidence 0.xx:` prefix into a `band` field shown beside the number.
- **States:** `app/error.tsx` (product-styled "Feed unavailable" + Retry) and `app/loading.tsx`.
- **Tokens:** `--sidebar-*` re-pointed to the dark tokens; `tw-animate-css` import removed.

## Declined
- One-scene layout (critique Q1): the two views stay, per D-06.
- Sorting, filters, keyboard shortcuts: read-only demo, out of scope.
- Shortening the shared HKT date format: `utils/time.ts` is shared with Phases 2 and 5 and must not fork.

## Gates
tsc, biome and `impeccable detect` clean on app / components / hooks · no hex outside `globals.css` · no motion utilities, tab stops, `onClick` or raw HTML in components · no env / config / db in client files · no JS truncation · focus outline with offset on the nav links.
