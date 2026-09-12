# Phase 8: [optional] S2 — Commitment Ledger - Pattern Map

**Mapped:** 2026-09-12
**Files analyzed:** 9
**Analogs found:** 9 / 9 (all analogs are planning-doc contracts — repo is greenfield, Phases 1-7 not yet executed)

**Repo-state note:** `git ls-files` contains only `.planning/**` and `.claude/**`. No application source exists. Every "analog" below cites the upstream planning doc (CONTEXT/RESEARCH) that fixes the contract Phase 8 must build against, per 05-/06- sibling precedent. Executor MUST re-verify each cited interface against the real, executed file at Phase 8 start (13:45+) — do not trust this doc's copied signatures if the real file differs (see 08-RESEARCH Assumptions A2/A4).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog (contract source) | Match Quality |
|---|---|---|---|---|
| `lib/agent/<extraction-schema-file>.ts` (additive edit) | model/schema | transform | 05-RESEARCH "Structured Output Call" + `ExtractedIntentSchema` orchestrator corrections; ARCHITECTURE.md:96 | role-match (extend existing discriminated schema) |
| `lib/ai/provider.ts` (additive edit) | service | request-response | 01-RESEARCH:261 `complete<T>(opts): Promise<T>` stub | role-match (additive export beside existing wrapper) |
| `app/api/copilotkit/route.ts` | route | request-response | 06-PATTERNS thin `app/api/*/route.ts` GET handler precedent (Phase 6, not yet built — cite 06-CONTEXT/06-RESEARCH route-handler rule) + CopilotKit runtime contract in 08-RESEARCH Code Examples | role-match (thin route, logic stays in lib/) |
| `app/api/commitment-ledger/nudge/route.ts` | route | CRUD (Proposal create) + event-driven (Slack post) | `lib/slack/post-proposal-card.ts` interface (01-RESEARCH interface table: `postProposalCard(proposal): Promise<{channel, ts}>`) + Proposal model (01-CONTEXT D-09..D-11) | exact (calls existing fn, writes existing model) |
| `lib/commitment-ledger/select-component.ts` | utility | transform | `lib/agent/dedupe.ts` precedent — pure function, no I/O (01-CONTEXT/05-CONTEXT dedupe contract) | role-match (pure deterministic function) |
| `lib/commitment-ledger/seed-rows.ts` | utility/fixture | batch | 08-RESEARCH "Persistence" recommendation — hardcoded rows, no DB round trip | new pattern, no strong analog (first hand-seeded fixture in repo) |
| `app/commitments/page.tsx` (or wherever ledger mounts) | component (Server/Client boundary) | request-response | 06-CONTEXT dashboard page pattern: Server Component default, `"use client"` boundary only where CopilotKit interactivity demands it (D-21) | role-match |
| `components/commitment-ledger/{deadline-chip,draft-nudge,chase,clarify-card}.tsx` | component | transform (render) | `components/status-chip.tsx` (06-PATTERNS) — status-driven small presentational component, theme tokens only | role-match |
| `package.json` / `bun.lock` (edit) | config | — | CLAUDE.md Installation section — `bun add` with exact pins | exact |

## Pattern Assignments

### `lib/agent/<extraction-schema-file>.ts` (model/schema, transform)

**Analog:** 05-RESEARCH orchestrator corrections + ARCHITECTURE.md:96 (`ExtractedIntent.type: "meeting" | "commitment"`)

**Contract tension to flag to planner (do not silently resolve):** 08-RESEARCH's own illustrative example uses camelCase fields (`messageIndex`, `startIso`, `whenPromisedIso`) and a bare `z.discriminatedUnion`. But the actual Phase 5 contract (per 08-RESEARCH's own citation of "orchestrator corrections #1/#2") uses **snake_case** fields, and the LLM root schema is `z.object({ intents: z.array(ExtractedIntentSchema) })`, not a bare array/union returned directly. Phase 8 must:
1. Locate the real file Phase 5 creates (search `lib/agent/` at execution time for the file exporting `ExtractedIntentSchema`).
2. Match its actual casing convention (snake_case, per Phase 5 contract) — the 08-RESEARCH camelCase illustration is aspirational, not authoritative.
3. Add the `commitment` branch as a new arm in the existing discriminated union (or equivalent), touching zero lines of the `meeting` branch.

**Core pattern** (structure, adapt casing to what's actually on disk):
```typescript
// ADDITIVE — new branch only, meeting branch untouched
const CommitmentIntentSchema = z.object({
  // match existing snake_case convention, e.g. message_index, type: z.literal("commitment")
  direction: z.enum(["owed_by_me", "owed_to_me"]),
  what: z.string(),
  who: z.string(),
  // when_promised, due (nullable), source_link, status enum — per 08-CONTEXT D-06
  status: z.enum(["open", "done", "overdue", "dropped"]),
  confidence: z.number(),
  is_actionable: z.boolean(),
  reason: z.string().optional(),
});
```

---

### `lib/ai/provider.ts` (service, request-response) — additive export

**Analog:** 01-RESEARCH:261 locked stub `complete<T>(opts): Promise<T>`

**Pattern:** add one named export beside the existing wrapper; do not touch `complete<T>`.
```typescript
// lib/ai/provider.ts — additive
import OpenAI from "openai";
import { config } from "@/lib/config";

export const openaiClient = new OpenAI({
  apiKey: config.ai.apiKey,
  baseURL: config.ai.baseUrl,
});
// existing: export async function complete<T>(opts): Promise<T> { ... }
```
Source: 08-RESEARCH "Architecture Patterns — lib/ai/provider.ts addition" (verbatim recommendation, Pitfall 3).

---

### `app/api/copilotkit/route.ts` (route, request-response)

**Analog:** repo rule "thin route handlers with logic in `lib/`" (08-CONTEXT D-21) + CopilotKit default-export API (08-RESEARCH, NOT `/v2`).

**Import pattern:**
```typescript
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime"; // default export — never "@copilotkit/runtime/v2"
import { openaiClient } from "@/lib/ai/provider";
import { config } from "@/lib/config";
```

**Core pattern:**
```typescript
const serviceAdapter = new OpenAIAdapter({ openai: openaiClient, model: config.ai.modelFast });
const runtime = new CopilotRuntime();
export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({ runtime, serviceAdapter, endpoint: "/api/copilotkit" });
  return handleRequest(req);
};
```

**Anti-pattern (must avoid):** mixing `/v2` hooks (`CopilotKitProvider`, `useFrontendTool`, `BuiltInAgent`) with this default-export backend, or vice versa — no cross-generation compatibility confirmed (08-RESEARCH "Anti-Patterns to Avoid").

---

### `app/api/commitment-ledger/nudge/route.ts` (route, CRUD + event-driven)

**Analog:** `lib/slack/post-proposal-card.ts` interface (01-RESEARCH: `postProposalCard(proposal): Promise<{channel: string; ts: string}>`) + Proposal model (01-CONTEXT D-09..D-11).

**Core pattern:**
```typescript
import { prisma } from "@/lib/db";
import { postProposalCard } from "@/lib/slack/post-proposal-card"; // CALL, never edit
import { config } from "@/lib/config";

export async function POST(req: Request) {
  const { who, what, sourceChannelId } = await req.json();
  // TODO: Zod-validate who/what before writing (08-RESEARCH Security V5 — title flows into Slack Block Kit verbatim)

  const proposal = await prisma.proposal.create({
    data: {
      team_id: config.slack.teamId,
      dedupe_key: `nudge:${who}:${what}:${Date.now()}`,
      title: `Nudge: ${who} re: ${what}`,
      start: new Date(),                          // placeholder — verify against real schema nullability
      end: new Date(Date.now() + 15 * 60 * 1000),  // placeholder — keep clearly outside Fri 18 Sep demo window (07-RESEARCH CFL-01 union risk)
      tz: "Asia/Hong_Kong",
      status: "pending",
      source_channel: sourceChannelId,
    },
  });

  const { channel, ts } = await postProposalCard(proposal);
  await prisma.proposal.update({ where: { id: proposal.id }, data: { card_channel: channel, card_ts: ts } });
  return Response.json({ proposalId: proposal.id });
}
```

**Must verify before writing:** real `prisma/schema.prisma` field list/nullability (Phase 1 executes before 13:45) — do not trust this copied field list blindly (08-RESEARCH Pitfall 4, Assumption A4). Also verify placeholder `start`/`end` don't land inside Phase 7's conflict-detection window (07-RESEARCH `findMany({ where: { status: "pending", start: { lt }, end: { gt } } })` unions ALL pending Proposals — a nudge row could pollute the conflict demo, Open Question 3).

**Residual risk to document, not fix:** clicking Approve on a nudge card runs the existing calendar-shaped `approve_proposal` handler (04-RESEARCH), which Phase 8 cannot edit (D-16). Add a demo-script note: don't click Approve on nudge cards.

---

### `lib/commitment-ledger/select-component.ts` (utility, transform)

**Analog:** `lib/agent/dedupe.ts` — pure function precedent (`computeDedupeKey(teamId, channelId, threadOrMessageTs, normalizedIntent)`), no I/O, called from multiple sites.

**Core pattern** (verbatim from 08-RESEARCH, already concrete):
```typescript
export type CommitmentComponentKind = "deadline-chip" | "draft-nudge" | "chase" | "clarify";

export function selectCommitmentComponent(row: CommitmentRow): CommitmentComponentKind {
  if (row.status === "open" && row.direction === "owed_by_me" && row.dueIso) return "deadline-chip";
  if (row.status === "overdue" && row.direction === "owed_by_me") return "draft-nudge";
  if (row.direction === "owed_to_me" && (row.status === "open" || row.status === "overdue")) return "chase";
  return "clarify";
}
```
Deterministic — never delegate this decision to the model (D-9/D-10 exit criterion depends on it being reliable on stage).

---

### `components/commitment-ledger/*.tsx` (component, render)

**Analog:** `components/status-chip.tsx` (06-PATTERNS) — small presentational component driven by a status enum, theme tokens only, no colour literals (D-20).

**Constraints carried over from Phase 6 theme contract:** retro dark theme devices (hard borders, offset shadows, monospace data, uppercase micro-labels), status expressed in form/label not colour alone, all colours via `app/globals.css` CSS variables — do not edit `app/globals.css` itself (out of Phase 8's ownership).

---

## Shared Patterns

### Single AI client / config boundary
**Source:** `lib/ai/provider.ts` (01-RESEARCH stub) + `lib/config.ts` (one typed reader of `process.env`, D-21)
**Apply to:** `app/api/copilotkit/route.ts`, `app/api/commitment-ledger/nudge/route.ts` — never construct a second `OpenAI` client or read `process.env` directly.

### Call-not-edit boundary for `lib/slack/**`
**Source:** `lib/slack/post-proposal-card.ts` interface (01-RESEARCH)
**Apply to:** nudge route only. D-13/D-16 lock this — no plan step may touch `lib/slack/**` internals.

### Additive-only extraction schema
**Source:** 01-CONTEXT/05-CONTEXT `ExtractedIntentSchema`/`meeting` branch
**Apply to:** `lib/agent/<extraction-schema-file>.ts` — new `commitment` arm only, zero-diff on `meeting`.

### Thin route handlers, logic in `lib/`
**Source:** D-21 repo rule
**Apply to:** both new `app/api/**/route.ts` files — route wires runtime/adapter or Prisma+Slack call; no business logic inline.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/commitment-ledger/seed-rows.ts` | fixture | batch | First hand-seeded demo-data module in the repo; no prior fixture pattern exists. Use plain exported const array of 4-6 typed rows, no framework. |

## Metadata

**Analog search scope:** `.planning/phases/01..07/*-CONTEXT.md`, `*-RESEARCH.md` (all cited sources are planning docs; no source tree exists yet to Glob/Grep).
**Files scanned:** 9 planning docs cross-referenced (01, 04, 05, 06, 07, 08 CONTEXT/RESEARCH).
**Pattern extraction date:** 2026-09-12
