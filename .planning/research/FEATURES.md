# Feature Research

**Domain:** Approval-gated AI Slack scheduling agent (hackathon demo, 4h15m solo window)
**Researched:** 2026-09-11
**Confidence:** MEDIUM-HIGH (competitive landscape verified against Sep 2026 sources; Block Kit UX patterns HIGH — official Slack docs)

## Competitive Landscape: Verification Update (read this before touching the README)

The source doc's "how it differs" paragraph names six comparison points. Checked each against Sep 2026 state. **Two of six need a README edit before judging** — one competitor is dead, one is gone entirely. The core differentiation claim itself gets *stronger*, not weaker.

| Claim in source doc | Status Sep 2026 | Action |
|---|---|---|
| "Slack's own Slackbot extracts action items and checks availability, but you ask it — invoked, workspace-scoped, gated to paid plans" | **Still true, confirmed current.** Slackbot/AI action-item extraction runs on-demand (user prompts it, or triggers on huddle audio) — not unprompted scanning of ordinary channel text. Gating confirmed: Pro gets summaries/huddle notes, **Business+ gets workflow AI and "ongoing Slackbot access."** Slack's "Later" list and channel "Recaps" are also pull-based (user opens them or schedules a digest), not a live unprompted-detection loop. | Keep claim, tighten wording: cite Business+ gating specifically, and note Recap/Later are still user-invoked, not passive. |
| "Reclaim, Clockwise and Motion schedule from natural language but do not read conversations to find intent" | **Half broken — Clockwise is gone.** Clockwise's app was **shut down entirely as of 27 March 2026** (Reclaim acquired/absorbed the space). Reclaim and Motion are the two live competitors now. Confirmed for both: neither reads Slack for intent. Motion is explicitly documented as *"does not scan your Slack messages for commitments... an output scheduler, not an input processor."* Reclaim's 2026 conversational AI is a chat interface the user types into, not passive monitoring. | **Must edit**: drop Clockwise or mark past-tense ("Clockwise, since folded into Reclaim, and Motion"). Do not name it as a live competitor — a judge who knows the space will catch this. |
| "Fireflies, Otter, Spinach extract action items from meeting audio, not chat" | **Still true.** All three remain transcript/audio-based. Spinach now routes owner-tagged action items to Slack/Jira/Linear post-meeting — sharper than the doc gives it credit for, but the input is still meeting audio, never passive channel text. | Keep. Optionally strengthen Spinach's description (it does more than "extract," it routes with owners) — makes the comparison look more current, not less.|
| "Relay.app, n8n and Zapier offer generic human-in-the-loop approval but no calendar/habit understanding" | **Relay.app is dead.** Wound down starting 16 July 2026 (founder hired by Google); free accounts deleted 15 Aug 2026; **paying customers lost access 14 Sep 2026 — the day before this hackathon.** Citing it as a live product is an immediate credibility hit if a judge checks. n8n and Zapier are both still active and the "generic, no calendar/habit understanding" claim holds for both: n8n's Slack HITL node (built into its AI Agent tool-call flow since v2.6, Jan 2026) and Zapier's "Zap pauses" are both content-agnostic approval gates with no scheduling domain model. | **Must edit**: remove Relay.app from the comparison entirely, or cite it only as "since shut down (2026), illustrating how commodity the generic-approval-step pattern is." Lead with n8n + Zapier. |
| Overall gap claim: "nothing in that list watches an ordinary conversation and decides, unprompted, that something needs doing" | **Verified true, and got easier to defend** since Motion's own docs now explicitly disclaim conversation-reading and Clockwise (which might have grown into this) is gone. | Keep as the headline differentiation line — it's the strongest part of the README and nothing surveyed contradicts it. |

**Bottom line for the README edit:** swap Clockwise for "Reclaim and Motion" (or footnote it), swap Relay.app out in favor of leading with n8n/Zapier, tighten the Slackbot line to name Business+ gating specifically. The core thesis is unweakened — if anything, two competitors disappearing during 2026 supports "this category is unsettled and nobody owns the unprompted-detection angle."

---

## Feature Landscape

### Table Stakes (Demo Credibility — Users/Judges Expect These)

A judge who has seen five other Slack-bot demos today will read a missing item below as unfinished, not as scoped-out.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Pending approval card renders with visible action buttons | Baseline of any approval-gated bot; a card with no visible next step reads as broken | LOW (~15 min) | Already in build-order requirement: hardcode → card → button → `chat.update` before any LLM/calendar code |
| Approve → `chat.update` to a confirmed state in place | The proof that "gated" means something — same message transforms, not a new message appended | LOW–MED (~20 min) | Requires persisting the original `ts` (in `Proposal.source_ts` or the button's own `value`); do not rely on `response_url` past ~30 min per Slack's own guidance |
| Event link + Meet link surfaced on the confirmed card | "It actually happened" — the card must prove the calendar write occurred, not just say so | LOW (~10 min) | `conferenceDataVersion=1` on `events.insert`; render `htmlLink` as a link block |
| Invite sent to the other participant automatically | Judges expect a scheduling bot to actually invite people, not just self-book | LOW (already covered by `events.insert` attendees) | Email resolved via `users.info` on B's Slack profile |
| "Already scheduled" state (no double-book on double-approve) | Two clicks / two approvers is the first thing an on-stage tester will try | LOW (~10 min, mostly free from the design) | Conditional `UPDATE ... WHERE organizer_user_id IS NULL`; no-row-back renders as a UI state, not an error toast |
| Idempotent approve (safe to click twice, safe on Slack's automatic retries) | Slack retries `block_actions` delivery on slow acks; a non-idempotent handler double-books live on stage | LOW–MED (~15 min) | Deterministic `events.insert` `id` derived from proposal id; catch HTTP 409 → `events.get` → treat as success |
| Reject / dismiss action on the card | **Gap in the current Active list.** A card that only offers Approve looks like a toy that can't say no; a real approval gate needs a rejection path | LOW (~10 min) | Second button, distinct `action_id`, `chat.update` to a visually distinct "dismissed" state (left-stripe/chip, not just text change per the retro theme rules). Trivially cheap — add it even if not explicitly required, because its absence is the first thing a skeptical judge probes |
| Ignored-message / Decision log visible in dashboard | "Considered and ignored" is explicitly called out as a demo asset — it's the proof the agent isn't a keyword firehose | LOW (already required) | `Decision` row per non-actionable message with `verdict`, `confidence`, `reason` |
| Edit-before-approve for medium-confidence intents | Prevents "wrong slot, dumb bot" moments; also the natural place to demonstrate the confidence gate live | MED (~20–25 min, shared with the confidence-gate feature) | `views.open` with `trigger_id` (3-second expiry — must fire from the button click, not a later async step); pass the draft intent via `private_metadata` (3000-char limit, fine for one proposal) |
| Two-slot conflict alternative rendered as buttons with reasons | This is named the headline demo moment in PROJECT.md — without it there's no differentiator, only a scheduler | MED (~45 min, already budgeted) | See Block Kit pattern below |

### Differentiators (Competitive Advantage — What This Wins On)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Confidence gate (`is_actionable` + `confidence` on extraction) | This *is* the product's credibility mechanism: nothing in the surveyed landscape gates unprompted proposals on a confidence threshold before bothering the user. Precision, not cost, decides usability — 1% false-positive rate at real volume is an uninstall | LOW–MED (~20 min, sequence first per PROJECT.md) | Three-way branch: high→card, medium→card that opens edit modal, low→silent + `Decision` row |
| Conflict-aware counter-proposal with stated reason | No competitor surveyed does calendar-aware, reasoned alternative-slot proposal from a chat-detected intent — Reclaim/Motion schedule from explicit instructions, they don't resolve chat-triggered clashes with an explained alternative | MED (~45 min, one extra `MODEL_SMART` call) | Feed `freebusy.query` result + any known `Preference` rows; model returns exactly two `{start, end, reason}` objects |
| Per-user preference memory (Graphiti/Neo4j) — **stretch S1** | "Learns your habits and it's visible" is the single biggest gap vs. Reclaim/Clockwise-style tools, which optimize a calendar but don't reason from an explicit, inspectable preference graph | HIGH (~60–90 min all-in; only start after core is rehearsed) | Demo requirement per PROJECT.md: same input must visibly produce a *different* proposal after a preference is ingested, shown before/after in Neo4j Browser. If that can't be shown live, cut it — a graph nobody watches change is worth nothing on stage |
| Commitment ledger with generative UI — **stretch S2** | Extends the approval-gate thesis beyond meetings ("what you promised, what you're owed") — no surveyed competitor tracks chat-native non-meeting commitments at all, so this is greenfield relative to the whole landscape, not just calendar tools | MED–HIGH (~45–60 min for the ledger table + one heterogeneous-component render; commitment extraction itself is nearly free, riding the same batch schema) | Nudges must route through the same approval card — do not let this become a silent autoreply path |

### Anti-Features (Do Not Build — Explicitly Out)

| Feature | Why It Seems Appealing | Why Problematic | Alternative |
|---------|------------------------|------------------|-------------|
| Autoreply / agent sends messages on the user's behalf | "Fully autonomous secretary" sounds more impressive | Breaks the entire product thesis — the approval gate is the differentiator; an agent that sometimes acts without asking undermines trust in every other proposal it makes | Roadmap-only line in README; every action, including S2 nudges, goes through the same approval card |
| Sentiment analysis of colleagues | Could "add intelligence" to preference/relationship features | Reads as surveillance of coworkers from their own messages, not assistance — already explicitly dropped in PROJECT.md | Stick to scheduling-relevant preference facts only (closed vocabulary: `working_hours`, `default_meeting_duration`, etc.) |
| Firehose processing (`message.channels` with no allowlist) | "Just watch everything" seems like the natural way to be unprompted | Unbounded volume, unbounded LLM cost, and turns the confidence gate into the only thing standing between the bot and spamming every channel it's in | Already correctly scoped in PROJECT.md: `message.channels` subscribed but filtered to `SLACK_WATCH_CHANNEL_IDS` allowlist — bounded, still "unprompted" within the demo channel |
| Asking about everything (no confidence threshold, or a threshold so low it fires constantly) | More proposals = more visible "AI-ness" | This is the exact failure mode the confidence gate exists to prevent — a bot that nudges about ambiguous chatter gets muted/uninstalled, which is precisely the PROJECT.md rationale for sequencing the confidence gate first | Three-tier gate (high/medium/low) with silent-but-logged low-confidence path |
| Batch sweep / scheduled detection for the demo itself | Feels more "production-grade" to show | Adds latency and a scheduler dependency the 4h window doesn't need — per-message detection is simpler, lower-latency, and deterministic for a scripted demo with one seeded channel | Build per-message now (`extractIntents([oneMessage])`), document batch-first as the production design in the README with the ~20x prompt-amortization reasoning already spelled out in PROJECT.md |
| Recurring events, timezone handling beyond one zone, account-linking UI | "Real products have these" | None are demoable value in a 2-person, 1-timezone, pre-seeded demo; each adds edge-case surface with zero stage payoff | Explicitly out of scope; document as roadmap in README |
| A generic "wait for any Slack reply" approval step (the n8n/Zapier pattern) | It's the pattern the closest competitors use, so it must be sufficient | It has no calendar or preference awareness — exactly the gap this project is filling; copying it would erase the differentiator | Keep the approval card scheduling-domain-specific: buttons carry structured proposal state (`value`/`private_metadata`), not a free-text reply parsed after the fact |

## Block Kit Approval UX Patterns (verified against current Slack developer docs)

**Button payload shape.** Each interactive element needs a unique `action_id` (routes the `block_actions` payload to a handler) and can carry an opaque `value` string (e.g. the proposal id, or `proposalId:slotIndex` for the two alternative-slot buttons). Buttons live inside an `actions` block; `style: "primary"` for Approve, default/no style or `"danger"` for Reject.

```
{ type: "actions", block_id: "proposal_actions", elements: [
  { type: "button", text: {type:"plain_text", text:"Approve"}, style:"primary",
    action_id: "proposal_approve", value: proposalId },
  { type: "button", text: {type:"plain_text", text:"Reject"},
    action_id: "proposal_reject", value: proposalId }
]}
```

**In-place state transitions via `chat.update`.** Persist the message `ts` returned from the original `chat.postMessage` (store on `Proposal.source_ts`, or the channel is already known from `source_channel`) — without it the message can never be updated later. On approve/reject, rebuild the *same* block layout with buttons removed and a status section added (chip/left-stripe per the retro theme, not just a color change, so it survives a bad projector). **Always replace the interactive blocks on decision** — leaving Approve/Reject live after a decision lets a second click re-fire the handler and confuses whoever looks at the card next; this is the most-cited Block Kit approval mistake in current guidance.

**3-second ack, then update.** Acknowledge the `block_actions` payload immediately (Bolt does this automatically when the listener returns/resolves quickly); do the actual calendar write and `chat.update` asynchronously after. Slack retries delivery if it doesn't see the ack in time, which is the other source of the idempotency requirement above — a slow handler can receive the same click twice.

**Medium-confidence → modal-first edit.** Fire `views.open` directly from the button-click's `trigger_id` (expires in 3 seconds — no network calls to the LLM in between; the draft intent is already computed at extraction time and just needs to be rendered). Carry the draft proposal through `private_metadata` (JSON string, 3000-char limit — one intent draft fits easily) so the `view_submission` handler doesn't need a second DB read to know what's being edited. On submit, write the edited fields back to the `Proposal` row and post the same approval card (now high-confidence-equivalent, since a human edited it) rather than re-running extraction.

**Rendering two alternative-slot buttons with reasons.** Use two `section` blocks (one per slot), each showing the resolved local time and the one-line reason as body text, immediately followed by an `actions` block (or a button as the section's `accessory`) whose `value` encodes `proposalId + slotIndex` so a single shared handler can look up which slot was chosen and re-run the same approve path against that slot's start/end instead of the original one. This keeps "pick an alternative" and "approve" as the same code path with a different resolved time, rather than a second special case.

```
{ type: "section", text: {type:"mrkdwn",
    text: "*Option A — Fri 2pm*\n_Avoids your 11am–1pm block; keeps your no-meeting Friday mornings free_"},
  accessory: { type:"button", text:{type:"plain_text", text:"Choose"},
    action_id:"proposal_choose_alt", value: `${proposalId}:0` } }
```

**Authorization check on click.** Block Kit buttons are clickable by any channel member unless the handler enforces who may act — for the two-person demo this is low-risk, but the Approve handler should still check the clicking user is the intended organizer/addressee before writing to Calendar, since it's a one-line guard and the failure mode (wrong person approves) is exactly the kind of thing that goes wrong live.

## Feature Dependencies

```
Confidence gate (is_actionable + confidence on extraction schema)
    └──gates──> Approval card creation (high) / Edit modal (medium) / Silent + Decision row (low)

Approval card creation
    └──requires──> Persisted message ts (for chat.update)
    └──requires──> Deterministic calendar event id (for idempotent approve)
    └──requires──> Reject/dismiss action_id (table stakes, add alongside Approve — same effort)

Edit modal (medium confidence)
    └──requires──> trigger_id from the triggering block_actions/shortcut click
    └──requires──> private_metadata carrying the draft Proposal

Conflict-aware counter-proposal
    └──requires──> Confidence gate (only run on already-actionable, high-confidence intents — don't waste the extra MODEL_SMART call on ambiguous ones)
    └──requires──> freebusy.query + pending-Proposal union (conflict detection)
    └──requires──> Two-slot button rendering pattern (UI)
    └──enhances──> Preference memory (S1) — reasons get sharper once Preference rows exist, but conflict counter-proposal must work with zero Preference rows too (S1 may not ship)

"Already scheduled" state
    └──requires──> Organizer tiebreak (conditional UPDATE) — must exist before two demo users can both approve

Commitment ledger (S2)
    └──requires──> `commitment` type added to extraction schema (rides the same batch pass as `meeting`)
    └──requires──> Same approval-card path (for nudges) — do not build a second action-execution path

Per-user preference memory (S1)
    └──conflicts-with-nothing but is fully optional──> Conflict counter-proposal must degrade gracefully with an empty Preference table
```

### Dependency Notes

- **Confidence gate gates everything downstream** — it must land before either AI differentiator is demoable, which is exactly why PROJECT.md sequences it first (~20 min) ahead of conflict reasoning (~45 min).
- **Reject/dismiss is cheap to add alongside Approve** — same `actions` block, same `chat.update` handler shape, one more `action_id`. There's no reason to sequence it separately; add it in the same task that builds the Approve button.
- **Conflict counter-proposal should not run on medium/low-confidence intents** — it's an expensive extra `MODEL_SMART` call; gating it behind "already high-confidence and already has a card" avoids wasting the one extra call budget on intents that might get edited or dropped anyway.
- **S1 (preference memory) enhances but never blocks S2 or the core conflict feature** — this is by design (separate repo/process per PROJECT.md) so its absence at cut time changes nothing else.
- **S2's commitment ledger must reuse the approval-card action path** for nudges — building a second "send this on my behalf after one click" path would quietly reintroduce the autoreply anti-feature under a different name.

## MVP Definition

### Launch With (v1 — the demo path, all in PROJECT.md's Active requirements)

- [ ] Confidence gate on extraction (`is_actionable`, `confidence`) — cheapest, and the whole product's credibility rests on precision here
- [ ] Approval card (Approve **and** Reject/dismiss buttons) posted on high confidence
- [ ] Edit modal opened on medium confidence before the card is actionable
- [ ] Silent + `Decision`-logged path on low confidence, visible in dashboard
- [ ] Approve → real Google Calendar event + Meet link + invite + in-place `chat.update` to confirmed state with event link
- [ ] Idempotent approve (deterministic event id, 409-safe) and "already scheduled" no-op state
- [ ] Conflict-aware counter-proposal: two alternative slots, each with a one-line reason, rendered as buttons
- [ ] Dashboard: action-item queue + Decision log (retro dark theme)

### Add After Validation (v1.x — only if core demo is done and rehearsed)

- [ ] `/secretary scan` over last ~50 messages (exercises the `extractIntents(messages[])` array signature on real input)
- [ ] S2 commitment ledger (start here if only one stretch fits — cheaper and lower-risk than S1)
- [ ] S1 preference memory, only if the before/after graph-changes-the-proposal moment can be rehearsed and shown live

### Future Consideration (v2+ — explicitly out of Saturday's scope)

- [ ] Autoreply — roadmap-documented only, never built
- [ ] Public OAuth distribution / Slack Marketplace listing
- [ ] Recurring events, multi-timezone handling, account-linking UI
- [ ] Batch sweep / scheduler for detection — documented as production design, not built
- [ ] Relationship/cadence brief and time-allocation reality check (S2 priorities 2–3) — only after the commitment ledger proves the generative-UI pattern

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Confidence gate | HIGH | LOW (~20 min) | P1 |
| Approval card + Reject button | HIGH | LOW (~15–25 min) | P1 |
| chat.update confirmed state + event link | HIGH | LOW (~20 min) | P1 |
| Idempotent approve / already-scheduled state | MEDIUM (invisible unless tested, but the first thing a skeptic tries) | LOW (~10–15 min) | P1 |
| Edit modal (medium confidence) | MEDIUM | MEDIUM (~20–25 min) | P1 |
| Conflict counter-proposal with reasons | HIGH (headline moment) | MEDIUM (~45 min) | P1 (cut line: 14:15) |
| Decision log / ignored-message dashboard view | MEDIUM (proof of restraint) | LOW (already required) | P1 |
| `/secretary scan` | LOW–MEDIUM | LOW–MEDIUM | P2 |
| Commitment ledger (S2) | MEDIUM–HIGH (novel vs. all competitors) | MEDIUM–HIGH (~45–60 min) | P2 |
| Preference memory (S1) | HIGH if shown live, ZERO if not | HIGH (~60–90 min) | P3 |
| Relationship brief / time-allocation (S2 priorities 2–3) | LOW (nice extension) | HIGH | P3 |

**Priority key:** P1 = must have for the demo; P2 = build only if core is done and rehearsed; P3 = stretch-inside-a-stretch, cut without hesitation.

## Competitor Feature Analysis

| Feature | Slack AI/Slackbot | Reclaim / Motion | Fireflies / Otter / Spinach | n8n / Zapier (Relay.app: shut down 2026) | Our Approach |
|---------|--------------------|-------------------|------------------------------|--------------------------------------------|--------------|
| Unprompted detection from ordinary chat | No — user-invoked or huddle-audio-triggered | No — Motion explicitly does not scan Slack; Reclaim is chat-input, not passive | No — audio/meeting-transcript input only | No — automation *steps* fire on external events, not conversational understanding | **Yes** — allowlisted-channel message stream, confidence-gated |
| Approval gate before any write | Partial (huddle notes are informational, not a write-gate) | N/A — no write-from-chat to gate | N/A — routes notes/action items, not calendar writes | **Yes**, but generic (any payload, no domain model) | Yes, domain-specific (calendar write only, structured proposal state) |
| Calendar-aware conflict resolution with stated reason | No | Reclaim reschedules its own auto-blocked tasks; neither explains a *chat-triggered* conflict with a stated reason | No | No | **Yes** — two alternatives + one-line reason, headline differentiator |
| Preference/habit memory shown to the user | No | Internal only, not user-inspectable as a graph | No | No | S1 stretch: closed-vocabulary preference graph, viewable in Neo4j Browser |
| Plan gating | Business+/Enterprise+ for AI features | Paid tiers | Paid tiers | Free self-host (n8n) / paid (Zapier) | Single dev workspace for demo; multi-tenant schema documented for future OAuth distribution |

## Sources

- eesel AI, "Slack AI in 2026: Features, pricing, and limitations" — Slack AI plan gating (Pro/Business+/Enterprise+) — MEDIUM confidence (secondary aggregator, cross-checked against Slack's own help docs)
- Slack Help Center, "Manage access to AI features in Slack" / "Guide to AI features in Slack" — HIGH confidence (official docs)
- Slack blog, "Smarter Workflows, No Code Required: Introducing New AI Steps in Workflow Builder" — HIGH confidence (official)
- eesel AI, "A complete guide to Slack AI huddle notes and action items" — huddle-triggered, on-demand action item extraction — MEDIUM confidence
- Reclaim.ai blog, "Clockwise vs. Reclaim.ai: Compare AI Calendar Alternatives (Clockwise Sunsetting March 2026)" — Clockwise shutdown date — MEDIUM confidence (vendor blog, but the shutdown date is a factual, checkable claim and consistent across multiple independent 2026 comparison articles)
- get-alfred.ai, "Is Motion Worth It? Honest Review" and Vellum.ai, "10 Best AI Assistants for Email, Calendar, and Slack in 2026" — Motion does not scan Slack messages — MEDIUM confidence (cross-checked across two independent sources)
- Spinach.ai blog posts (Fireflies/Otter alternatives, pricing) — Spinach's owner-tagged routing to Slack/Jira/Linear — MEDIUM confidence (vendor blog, but consistent with Spinach's public product marketing)
- tooldirectory.ai, "Relay.app — Shut Down in 2026" and Automation Atlas, "Relay.app: Team Workflow Automation with Approvals (2026)" — Relay.app wind-down timeline (16 Jul / 15 Aug / 14 Sep 2026) — MEDIUM confidence (cross-checked across two independent sources, consistent specific dates)
- n8n docs + triggerworkflow.com, "n8n Human-in-the-Loop: Approval Workflows for AI Agents (2026)" — n8n's Slack HITL node built into AI Agent tool calls since v2.6 (Jan 2026) — MEDIUM confidence
- Slack Developer Docs, "Creating an interactive message," "Modals," "views.open method," "Reference: Defining view objects" — Block Kit button/modal/`private_metadata`/`trigger_id` mechanics — HIGH confidence (official docs)
- resumelens.org, "Slack Block Kit Cookbook" and glukhov.org, "Slack Integration Patterns for Alerts and Workflows" — chat.update-over-response_url, ack-then-update, leave-buttons-visible pitfall — MEDIUM confidence (independent technical blogs, consistent with official docs' 3-second-ack and trigger_id-expiry requirements)

---
*Feature research for: Approval-gated AI Slack scheduling agent*
*Researched: 2026-09-11*
