---
phase: 06-dashboard
plan: 02
status: complete
requirements: [DSH-04, DSH-05, DSH-06]
---

# 06-02 Summary — Retro dark theme

## Token contract (Phase 8 reuses these names; all values live only in `app/globals.css`)
| Token | Value | Role |
|---|---|---|
| `--background` | `#0b0b0c` | page ground |
| `--card` / `--card-foreground` | `#141416` / `#ededef` | panel surface |
| `--elevated` | `#1c1c20` | sidebar, raised surfaces; also `--popover`, `--muted`, `--accent` |
| `--border` / `--input` | `#2e2e33` | hard 1px borders |
| `--foreground` | `#ededef` | primary text |
| `--muted-foreground` | `#8a8a93` | micro-labels, secondary text (≥4.96:1 on every surface, measured) |
| `--primary` / `--primary-foreground` | `#f2a93b` / `#0b0b0c` | amber: pending, active nav, NEW marker |
| `--secondary` / `--secondary-foreground` | `#4ec9e0` / `#0b0b0c` | cyan: already_scheduled |
| `--success` / `--success-foreground` | `#46c07a` / `#0b0b0c` | confirmed, acted, live dot |
| `--destructive` | `#e5544b` | error states |
| `--ring` | `var(--primary)` | focus ring for every primitive |
| `--shadow-retro` | `4px 4px 0 0 var(--border)` | `shadow-retro` utility on panels and the retry button |
| `--radius` | `4px` | `rounded-lg` = 4px; `rounded-sm` = 2.4px on chips |
| `--sidebar-*` | re-pointed to the tokens above | shadcn sidebar primitives, if ever added |
| `--font-sans` / `--font-mono` | Inter / JetBrains Mono via `next/font` (`--font-inter`, `--font-jetbrains-mono`) | prose / data |

`.dark` block deleted (single theme, `color-scheme: dark`). `tw-animate-css` import removed (no-motion brief). Selection and scrollbar colours themed from tokens.

## Devices
Hard 1px borders, `shadow-retro` on the grid frame, 4px radii, mono tabular numerals on time/confidence, uppercase tracked micro-labels for headers and the status strip, chip = fill token + its own dark foreground + glyph (● ✓ ✕ → —). Muted chips (dismissed/ignored) carry a `border-border` so they read on the dark card.

## Focus (ROADMAP criterion 4)
Exactly two focusables on each view (QUEUE, DECISIONS), measured via CDP. Both: `focus-visible:outline-2 outline-offset-2 outline-ring` (amber). No `tabIndex` anywhere; rows take no focus. `app/error.tsx` adds one Retry button with the same treatment when it renders.

## Impeccable
Typeset and colorize were folded into the layout → critique → polish sequence (see 06-03). No token value was changed by impeccable; the D-11 values are kept verbatim.

## Gates
Mappings for elevated / success / success-foreground present · `--ring: var(--primary)` · no `.dark` block · no hex outside `globals.css` · no `animate-` / `transition-` / `gradient` / `tabIndex` in app or components · biome and tsc clean.
