# Phase 1: Foundation + Hardcoded Round Trip - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-11
**Phase:** 01-foundation-hardcoded-round-trip
**Mode:** `--auto`. Every question was answered with the recommended option; nothing was asked interactively.
**Areas discussed:** Hardcoded trigger, Round-trip depth, Transport scope, Stub set and layout, Shared shapes, Schema completeness, Field naming, Seed data, Config/env, CLAUDE.md location, Dependency install timing, Git branches

---

## Hardcoded trigger
| Option | Description | Selected |
|--------|-------------|----------|
| `app_mention` | Scope already installed; bot's card can't retrigger it | ✓ |
| `message` in watched channel | Needs tonight's scope + bot-message filtering (Phase 2 work) | |
| Script posts card directly | Skips Bolt; doesn't prove SLK-01 | |

**Choice:** `[auto]` app_mention (D-01)

## Round-trip depth
| Option | Description | Selected |
|--------|-------------|----------|
| Through DB | Proposal row, stored card channel/ts, Approve reads id from `value` | ✓ |
| Payload-only | Update using `body.container` channel/ts, no row | |

**Choice:** `[auto]` Through DB. It doubles as the "one real query" and proves the block_actions link (D-02)

## Transport scope
| Option | Description | Selected |
|--------|-------------|----------|
| Inline only, Trigger.dev entirely in Phase 4 | No `trigger.config.ts` skeleton | ✓ |
| Skeleton `trigger.config.ts` now | Matches roadmap files-owned note, but Phase 4 rewrites it | |

**Choice:** `[auto]` Inline only (D-04)

## Stub set and layout
| Option | Description | Selected |
|--------|-------------|----------|
| Parallel-seam stubs only, kebab-case, PROJECT.md paths | Skip `buildConflictBlocks` | ✓ |
| Full ARCHITECTURE.md table verbatim | camelCase files, root `bolt.ts`, `trigger/` dir (contradict PROJECT.md) | |

**Choice:** `[auto]` Parallel-seam stubs (D-05, D-06)

## Shared shapes
| Option | Description | Selected |
|--------|-------------|----------|
| Prisma types for entities; `types/` runtime-free; Zod in `lib/agent/`; `utils/time.ts` HKT formatter | Prevents Wave A/B forks | ✓ |
| Re-declare entity interfaces in `types/` | Drift vs schema | |

**Choice:** `[auto]` Option 1 (D-07, D-08)

## Schema completeness
| Option | Description | Selected |
|--------|-------------|----------|
| All core-phase columns now | No `db push` needed on parallel tracks | ✓ |
| PROJECT.md minimum, tracks extend | More serialized pushes during the window | |

**Choice:** `[auto]` All core columns (D-09, D-11)

## Field naming
| Option | Description | Selected |
|--------|-------------|----------|
| snake_case verbatim, no `@map` | APR-02 raw SQL works as written | ✓ |
| camelCase + `@map` | More code, doc/code mismatch | |

**Choice:** `[auto]` snake_case (D-10)

## Seed data
| Option | Description | Selected |
|--------|-------------|----------|
| Idempotent `prisma/seed.ts` from env: A, B, Installation, 1 pending Proposal (Thu 17 Sep 15:00), 2 Decisions | Covers Phase 3 and 6 needs, avoids demo slots | ✓ |
| Users only | Phases 3/6 would seed ad hoc | |

**Choice:** `[auto]` Full seed (D-13, D-14)

## Config/env
| Option | Description | Selected |
|--------|-------------|----------|
| One Zod parse, required core / optional stretch, one root `.env`, `PORT` per worktree | | ✓ |
| Per-process lazy config sections | More code for no demo benefit | |

**Choice:** `[auto]` Option 1 (D-15, D-16, D-17)

## CLAUDE.md location
| Option | Description | Selected |
|--------|-------------|----------|
| Root `CLAUDE.md`; leave GSD `.claude/CLAUDE.md` alone | Avoids tool regeneration clobbering rules | ✓ |
| Write rules into `.claude/CLAUDE.md` | GSD-managed sections | |

**Choice:** `[auto]` Root (D-18)

## Dependency install timing
| Option | Description | Selected |
|--------|-------------|----------|
| All core deps in Phase 1 | No parallel `bun.lock` edits | ✓ |
| Each track adds its own | Lockfile conflicts at merges | |

**Choice:** `[auto]` All in Phase 1 (D-21)

## Git branches
| Option | Description | Selected |
|--------|-------------|----------|
| Rename `master`→`main`, `develop` after Phase 1, commit source doc | Worktrees need the doc tracked | ✓ |
| Keep `master` | Mismatches roadmap branch model | |

**Choice:** `[auto]` Option 1 (D-26, D-27)

---

## Claude's Discretion
Proposal id strategy, hardcoded card copy, Bolt log level, config nesting, Participant/ActionItem keys, which Slack client the Approve handler uses.

## Deferred Ideas
Trigger.dev config/task/transport flag (Phase 4); Reject + message listener (Phase 2); conflict blocks (Phase 7); shadcn components + theme (Phase 6).
