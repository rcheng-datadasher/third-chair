# API Coverage — Phase 5 (Agent + Confidence Gate)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Two external surfaces are integrated in this phase: **Kilo Gateway** (OpenAI-compatible
> endpoint, via `lib/ai/provider.ts`, plans 05-01) and the **Slack Web API** (card variant
> and modal round trip, plan 05-03). Google Calendar is **not** integrated here — `lib/calendar/**`
> is Phase 3/4-owned and D-23 forbids touching it.

## Kilo Gateway (OpenAI-compatible chat surface)

| capability | decision | reason |
|---|---|---|
| `chat.completions.parse` + `zodResponseFormat` (structured output) | INTEGRATE | |
| `chat.completions.create` with `response_format: json_object` (fallback) | INTEGRATE | |
| provider routing (`provider.require_parameters`) | INTEGRATE | |
| model selection by tier (`MODEL_FAST` / `MODEL_SMART`) | INTEGRATE | |
| tool / function calling | OPT-OUT | D-01 forbids tool-calling loops; the graph is a fixed 5-node path |
| streaming responses | OPT-OUT | not needed — one bounded extraction call per message, no streamed surface to render |
| embeddings | OPT-OUT | no retrieval in this milestone; any embedding need belongs to the S1 Graphiti stretch (Phase 9) |
| `GET /models` capability probe | OPT-OUT | not needed at runtime — model ids are verified by hand in the Pre-Window Checklist and swapped by env only (D-07) |
| image / audio modalities | OPT-OUT | explicitly out of scope — Slack message text is the only input |
| generation cost / credits lookup | OPT-OUT | not needed for a one-day build; spend is bounded by the single watched channel |

## Slack Web API (surface this phase adds; Phase 2 owns the rest)

| capability | decision | reason |
|---|---|---|
| `chat.postMessage` (approve/reject card, Edit & approve card) | INTEGRATE | |
| `chat.update` (in-place re-render after an edit, SLK-06) | INTEGRATE | |
| `views.open` (AGT-05 edit modal) | INTEGRATE | |
| `view_submission` with `response_action: "errors"` | INTEGRATE | |
| `conversations.history` | INTEGRATE | verification only — reads back the posted card to prove the branch |
| `users.info` (email resolution) | INTEGRATE | Phase 2 SLK-08, consumed unchanged |
| `views.update` / `views.push` | OPT-OUT | not needed — the edit modal is a single step, not a wizard |
| `response_action: "update"` / `"clear"` | OPT-OUT | not needed — validation failure re-shows errors, success closes the modal |
| `chat.postEphemeral` | OPT-OUT | explicitly out of scope — D-16 requires low-confidence messages to be **silent**, not ephemerally acknowledged |
| `reactions.add` | OPT-OUT | same reason — precision over recall means no unprompted reaction on a message the agent ignored |
| `chat.delete` | OPT-OUT | not needed — cards are updated in place, never removed |
| `files.upload` | OPT-OUT | not needed — no attachment surface in this milestone |
| `chat.scheduleMessage` | OPT-OUT | not needed — the calendar event carries the timing, not a scheduled Slack post |

## Google Calendar

No external Calendar integration in Phase 5: the agent run ends at proposal creation, and the
calendar write stays behind Phase 4's Approve handler (`lib/calendar/**` untouched, D-23).
