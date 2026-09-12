# CopilotKit "Channels" for Slack — fit assessment

**Researched:** 2026-09-12 (primary sources only: docs.copilotkit.ai, CopilotKit/CopilotKit monorepo `main`, npm registry, copilotkit.ai/pricing)
**Confidence:** HIGH on what it is and what it requires (read from runtime source + package.json); MEDIUM on the exact per-framework tab list under `/slack/*` (URLs exist, not every tab enumerated).

## TL;DR

- The docs' "Slack" section is **Channels**: a hosted product ("CopilotKit Intelligence", the renamed Copilot Cloud) that runs an AG-UI agent as a Slack bot. Not a Slack-API "connector" for a web copilot.
- Even the "direct" Slack adapter (which is just `@slack/bolt ^4.2.0` in Socket Mode under the hood) only runs inside `CopilotRuntime` **with an Intelligence API key** — `CopilotRuntime({ agents, channels })` without `intelligence` throws. Self-hosting without the cloud means writing your own runner on `channels-core` primitives.
- It **replaces** a Bolt app; it does not wrap one. Adopting it here would mean a second Socket Mode consumer on the same app token (breaks the one-Bolt-process rule), a `0.9.x` pre-1.0 SDK, `zod@^3` vs the repo's zod 4, a cloud account, and an AG-UI agent layer between the LangGraph graph and Slack.
- Documented v1 limitation: "Proactive posting (bot replies only to turns it's part of)" — the wrong shape for an unprompted-detection agent that posts cards later from a Trigger.dev task.
- **Recommendation: skip for the hackathon.** Keep `lib/slack/bolt.ts`; keep CopilotKit (react-core/react-ui, SSE runtime) scoped to Phase 8's web ledger only.

## What it is

The Slack section lives at `docs.copilotkit.ai/slack`, titled "Channels for Slack — Bring an AG-UI agent into Slack with native messages and approvals through Channels" ([llms.txt](https://docs.copilotkit.ai/llms.txt)). The landing page: "Run one AG-UI agent in Slack, Microsoft Teams, and more through managed CopilotKit Intelligence connections" ([/slack](https://docs.copilotkit.ai/slack)).

Of the four hypotheses in the question it is **(a)/(b) combined**: a Copilot-Cloud-hosted delivery layer that surfaces an AG-UI agent as a Slack bot. It is not (c) — no "let the web copilot call Slack APIs" tool exists in the docs. The Channels SDK reference: "The Channels SDK connects an agent to chat providers through a long-running `@copilotkit/channels` process, where CopilotKit Intelligence owns the provider connection while your process owns the agent, tools, approvals, state, and deployment" ([/reference/channels](https://docs.copilotkit.ai/reference/channels)).

Two deployment models are documented ([/reference/channels](https://docs.copilotkit.ai/reference/channels), [channels-core README](https://raw.githubusercontent.com/CopilotKit/CopilotKit/main/packages/channels-core/README.md)):

| Model | Who holds the Slack connection | Who runs the agent turn |
|---|---|---|
| **Managed** (Slack, Teams) | CopilotKit Intelligence (their Slack app / your app's credentials pasted into their dashboard) — delivers each turn over a "persistent gateway" WebSocket to your process | Your process, via `IntelligenceAgentRunner` (WS to Intelligence) |
| **Direct** (Slack, Teams, Discord, Telegram, WhatsApp) | Your process ("your process holds the Slack credentials, runs the Slack ingress, and talks to Slack directly" — [channels-slack README](https://raw.githubusercontent.com/CopilotKit/CopilotKit/main/packages/channels-slack/README.md)) | Still `CopilotRuntime` with `intelligence` — see Architecture |

"Managed Slack is available now. Managed Teams is a controlled integration target." ([/slack](https://docs.copilotkit.ai/slack))

## Architecture

**Message flow (managed):** "user message → Intelligence receives event → persistent gateway delivers turn → SDK runs agent → response returned as native platform UI (Block Kit or Adaptive Cards)" ([/slack](https://docs.copilotkit.ai/slack)). Your side is "A long-running Node host or container; serverless request handlers cannot own the persistent gateway connection" ([/slack/connect](https://docs.copilotkit.ai/slack/connect)). Required env: `CPK_INTELLIGENCE_API_KEY`, `CHANNEL_CODE`, `PORT` ([/slack/connect](https://docs.copilotkit.ai/slack/connect)).

**Slack app config (managed):** the docs do not give a manifest; credentials come from "the Slack connection attached in Intelligence" — "xoxb-… Bot User OAuth token and Signing Secret" configured in the Intelligence UI ([/slack/connect](https://docs.copilotkit.ai/slack/connect)). Button clicks "return as `block_actions` events through the signed managed webhook" ([/slack/interactive](https://docs.copilotkit.ai/slack/interactive)) — i.e. Intelligence is the Events/Interactivity HTTP receiver for that Slack app. The `/slack/configure` page 404'd at research time (UNVERIFIED whether it lives at another slug).

**Slack app config (direct adapter, `@copilotkit/channels-slack`):** wraps Bolt. Source: `new App({ token: opts.botToken, appToken: opts.appToken, signingSecret: opts.signingSecret, socketMode: opts.socketMode ?? true })`; HTTP mode does `await this.app.start(this.opts.port ?? 0)`; registers `this.app.action(/.*/, ...)`, `this.app.event('reaction_added', ...)`, `this.app.view(/.*/, ...)` ([adapter.ts](https://raw.githubusercontent.com/CopilotKit/CopilotKit/main/packages/channels-slack/src/adapter.ts)). README: `botToken` (xoxb-) and `appToken` (xapp-) required, `socketMode` default `true`, HTTP mode needs `signingSecret` + `port`. Scopes: `chat:write`, `channels:history`, `groups:history`, `im:history`, `users:read` (+ `files:write`, `reactions:*`, `assistant:write`, `users:read.email` per feature). Events: `message.im`, `app_mention`, `message.channels`/`message.groups` (conditional), `reaction_added`, `reaction_removed` ([channels-slack README](https://raw.githubusercontent.com/CopilotKit/CopilotKit/main/packages/channels-slack/README.md)).

**Does direct mode avoid the cloud? No, not with the shipped runner.** `packages/runtime/src/v2/runtime/core/runtime.ts`:

```ts
export interface CopilotSseRuntimeOptions ... {
  /** Intelligence Channels require the Intelligence runtime; not available in SSE mode. */
  channels?: undefined;
}
// CopilotSseRuntime ctor:
throw new Error("`channels` requires the Intelligence runtime (pass `intelligence`); " +
  "Intelligence Channels are not available in SSE mode.");
```

and `CopilotIntelligenceRuntime` unconditionally constructs `new IntelligenceAgentRunner({ url: options.intelligence.ɵgetRunnerWsUrl(), authToken: ... })` ([runtime.ts](https://github.com/CopilotKit/CopilotKit/blob/main/packages/runtime/src/v2/runtime/core/runtime.ts); test "sse runtime rejects channels" in [channels-option.test.ts](https://github.com/CopilotKit/CopilotKit/blob/main/packages/runtime/src/v2/runtime/__tests__/channels-option.test.ts)). The channels-slack README's own quick-start passes `intelligence: new CopilotKitIntelligence({ apiKey: process.env.CPK_INTELLIGENCE_API_KEY! })` even with a direct `slack({ botToken, appToken })` adapter. The only cloud-free path: "Building and operating your own channel runner on the SDK primitives is also a supported path; teams choosing it own their state, persistence, concurrency, locking, retries, and race-condition handling" ([channels-core README](https://raw.githubusercontent.com/CopilotKit/CopilotKit/main/packages/channels-core/README.md)). No docs page or example for that runner was found (UNVERIFIED that one exists beyond the primitives).

**Interactive components / HITL / threads / streaming:** yes, all present. Approvals: "The agent emits an `on_interrupt` event → `channel.onInterrupt` posts the registered component → Intelligence acknowledges the original turn → a later button click updates the card and calls `thread.resume(value)` → the SDK re-enters the agent" ([/slack/interactive](https://docs.copilotkit.ai/slack/interactive)). JSX `<Message><Section><Actions><Button onClick={({thread, action}) => thread.resume(action.value)}>` renders to Block Kit. Constraint: "Managed deliveries cannot use blocking calls like `thread.awaitChoice()`" and "Card updates are best-effort". Streaming: native Slack streaming with `streaming: "legacy"` fallback to `chat.update`; threads via `respondTo.appMentions.reply: "thread"` ([channels-slack README](https://raw.githubusercontent.com/CopilotKit/CopilotKit/main/packages/channels-slack/README.md)). Handlers: `onMessage`, `onMention`, `onWelcome`, `onInterrupt`, `onCommand`, `onReaction`, `onModalSubmit`/`onModalClose` ([createChannel ref](https://docs.copilotkit.ai/reference/channels/functions/createChannel)).

**Documented v1 limitations (direct adapter):** "OAuth / multi-workspace install (single bot token only)"; "Durable (Redis/DB) `ActionStore` — in-memory only; actions expire on restart"; "Proactive posting (bot replies only to turns it's part of)" ([channels-slack README](https://raw.githubusercontent.com/CopilotKit/CopilotKit/main/packages/channels-slack/README.md)).

## Agent backend

`createChannel({ agent })` takes an AG-UI `AbstractAgent` or a factory: "Prefer a factory. Every turn clones its configured agent" ([createChannel ref](https://docs.copilotkit.ai/reference/channels/functions/createChannel)). So yes, it is the same AG-UI agent object a web `<CopilotKit>` runtime would serve, and the same `CopilotRuntime` can host both surfaces (`identifyUser` = web, `channels` = Slack; source above). Per-framework Slack guides exist at least for `slack/langgraph-typescript/*` and `slack/strands-typescript/*` ([/slack/langgraph-typescript/tools](https://docs.copilotkit.ai/slack/langgraph-typescript/tools), [/slack/strands-typescript/tools](https://docs.copilotkit.ai/slack/strands-typescript/tools)); the general framework list is LangGraph (Py/TS/FastAPI), Google ADK, Mastra, CrewAI Flows, PydanticAI, Claude Agent SDK, Agno, AG2, LlamaIndex, AWS Strands, MS Agent Framework, Deep Agents ([llms.txt](https://docs.copilotkit.ai/llms.txt)). Model providers are whatever the agent constructs internally — CopilotKit does not own the model call, so it is neutral with respect to `lib/ai/provider.ts`. Channel-level tools use `defineChannelTool({ name, description, parameters: z.object(...), handler })` ([/slack/langgraph-typescript/tools](https://docs.copilotkit.ai/slack/langgraph-typescript/tools)).

## Requirements & packages

| Item | Value | Source |
|---|---|---|
| `@copilotkit/channels` | `0.9.2` (latest, published 2026-09-03); docs say install `--save-exact` alongside `@copilotkit/runtime@1.70.2` | npm registry; [/reference/channels](https://docs.copilotkit.ai/reference/channels) |
| `@copilotkit/channels-slack` deps | `@slack/bolt ^4.2.0`, `@slack/web-api ^7.16.0`, `@ag-ui/client 0.0.59`, `zod ^3.25.76`, `zod-to-json-schema ^3.25.1`, `rxjs ^7.8.1` | npm `@copilotkit/channels-slack@0.9.2` |
| `@copilotkit/runtime` | latest `1.71.1` | npm registry |
| Runtime | Node 22+, long-running process (not serverless) | [/slack/connect](https://docs.copilotkit.ai/slack/connect) |
| TS config | `"jsx": "react-jsx"`, `"jsxImportSource": "@copilotkit/channels"` | [channels README](https://raw.githubusercontent.com/CopilotKit/CopilotKit/main/packages/channels/README.md) |
| Cloud | CopilotKit Intelligence account + `CPK_INTELLIGENCE_API_KEY` | [/slack/connect](https://docs.copilotkit.ai/slack/connect); runtime.ts |
| Pricing | Developer plan "Free forever": 1 Slack/Teams org, 5 channels, 500 total credits, 3-day thread retention; Pro $39/mo | [copilotkit.ai/pricing](https://www.copilotkit.ai/pricing) |

Monorepo source: [`packages/channels`](https://github.com/CopilotKit/CopilotKit/tree/main/packages/channels) (umbrella), [`packages/channels-slack`](https://github.com/CopilotKit/CopilotKit/tree/main/packages/channels-slack) (adapter: `adapter.ts`, `slack-listener.ts`, `interaction.ts`, `render/`, `message-stream.ts`, `block-kit-validation.ts`, `markdown-to-mrkdwn.ts`), `packages/channels-core`, `packages/channels-ui`, `packages/channels-intelligence` (managed activation, referenced from runtime.ts), runtime wiring in [`packages/runtime/src/v2/runtime/core/channel-manager.ts`](https://github.com/CopilotKit/CopilotKit/blob/main/packages/runtime/src/v2/runtime/core/channel-manager.ts) and `endpoints/node.ts`.

## Maturity

- Managed Slack: "available now" ([/slack](https://docs.copilotkit.ai/slack)); on the free plan ([channels-core README](https://raw.githubusercontent.com/CopilotKit/CopilotKit/main/packages/channels-core/README.md), [pricing](https://www.copilotkit.ai/pricing)).
- SDK is `0.9.x` (pre-1.0), first `0.8.1` publish 2026-08-10, i.e. about one month old (npm `time`). Adapter README calls itself "v1" while listing the limitations above. Docs pin exact versions with `--save-exact`, a sign the API is still moving.
- Not GA in the sense of a stable major; treat as public beta.

## Fit with this repo

Current design (read from the repo): `lib/slack/bolt.ts` is a `@slack/bolt@5.1.0` Socket Mode app run under Node; `app_mention` → `dispatchAgentRun` (Trigger.dev or inline) → LangGraph graph → `postProposalCard` (`chat.postMessage` with `buildApprovalBlocks`) → `approve_proposal` block action → Calendar write + `chat.update`. Repo rules: exactly one Bolt process on the app token; all model calls via `lib/ai/provider.ts`; CopilotKit only in Phase 8 (throwaway worktree, web ledger).

| Concern | Finding |
|---|---|
| Replace / wrap / conflict? | **Replace.** Channels *is* a Bolt app (direct) or Intelligence's own event receiver (managed). It cannot sit beside `lib/slack/bolt.ts` as a wrapper. |
| Socket Mode single-process rule | Direct adapter constructs its own `App({ socketMode: true, appToken })`. Two Socket Mode connections on one app token load-balance events between them ([CLAUDE.md](../../CLAUDE.md)); events would be split between Bolt and Channels. Managed mode instead needs the Slack app's Request URL pointed at Intelligence — also mutually exclusive with our Socket Mode app. |
| Flow shape | Our trigger is an unprompted channel message; the card is posted *later* by a background task, and the button handler must read a proposal id from DB and write to Calendar. Channels is built around "turn in → agent run → reply in thread" with `thread.resume()`; README lists "Proactive posting" as unsupported. Approve-from-DB is expressible via `onInterrupt`/`Button onClick`, but only by moving the whole flow inside its runner. |
| Hosted-service requirement | Hard: `channels` without `intelligence` throws. New account, API key, outbound WS to Intelligence's runner during the demo — one more wifi dependency on top of Trigger.dev. |
| `lib/ai/provider.ts` rule | Neutral: model calls stay inside our agent. But the agent must become an AG-UI `AbstractAgent` (e.g. `@ag-ui/langgraph`'s `LangGraphAgent` or a hand-rolled one) — another layer between the graph and Slack. |
| Dependency cost | `@copilotkit/channels` + `@copilotkit/runtime` (+ `@ag-ui/*`), pulls in `@slack/bolt@4` beside our `@slack/bolt@5`, `zod@^3` beside our zod 4, requires JSX in a non-React process with `jsxImportSource`. Runtime must be a separate long-running Node process (cannot be the Next.js route handler). |
| Runtime under Bun | Channels docs say Node 22+; its Bolt-in-Socket-Mode core is the same thing STACK.md already flags as flaky under Bun, so it would run under Node like today's Bolt. No gain. |
| What it would give | Streaming replies, JSX→Block Kit rendering, DM/assistant pane, reaction handlers, dashboard/inspector. None are in the requirements (SLK/APR/CFL). |

**Minimal integration path if someone insists (post-hackathon experiment):** new worktree; `bun add --exact @copilotkit/channels@0.9.2 @copilotkit/runtime@1.70.2`; wrap the LangGraph graph as an AG-UI agent; `createChannel({ name, identifyUser: "platform", agent, adapters: [slack({ botToken, appToken })] })` with `onMessage` gated on `SLACK_WATCH_CHANNEL_IDS`; `ApprovalCard` JSX whose `Button.onClick` calls the existing approve logic; `new CopilotRuntime({ intelligence: new CopilotKitIntelligence({ apiKey }), agents: {...}, channels: [channel] })` + `createCopilotNodeListener`; **stop `lib/slack/bolt.ts` entirely** while it runs. Estimated 2–3 h including the Intelligence signup — more than the whole remaining stretch budget.

## Recommendation

**Skip for this hackathon.** Reasons, in order:

1. It is a replacement for the Bolt app, not an add-on, and the Bolt round trip already works (commit `102bfa8`).
2. It requires a hosted CopilotKit Intelligence account and a live WebSocket to it during the demo; the roadmap already treats one control-plane dependency (Trigger.dev) as a risk with a recorded fallback.
3. Pre-1.0 SDK (`0.9.2`, ~4 weeks old) with a "no proactive posting" limitation that is the opposite of this product's unprompted-detection premise.
4. Dependency and rule friction: second Socket Mode consumer on the app token, Bolt 4 + Bolt 5, zod 3 + zod 4, JSX in a Node worker.

Keep CopilotKit exactly where ROADMAP.md puts it: Phase 8's web-only generative-UI ledger with `@copilotkit/react-core`/`react-ui` and a plain SSE `CopilotRuntime` route (no `intelligence`, no `channels`). If a Slack-native CopilotKit story is wanted for the README, describe Channels as "evaluated, deferred: requires hosted Intelligence and replaces the Bolt app" and link this note.

## Sources

- https://docs.copilotkit.ai/llms.txt — site map; "Channels for Slack", framework list, runtime adapters, headless
- https://docs.copilotkit.ai/slack — landing page, architecture layers, message flow, availability
- https://docs.copilotkit.ai/slack/connect — env vars, packages/versions, long-running Node host, Intelligence credentials
- https://docs.copilotkit.ai/slack/interactive — approvals via `on_interrupt` / `thread.resume`, Block Kit, `block_actions` via managed webhook
- https://docs.copilotkit.ai/slack/langgraph-typescript/tools and https://docs.copilotkit.ai/slack/strands-typescript/tools — agent factory + `defineChannelTool`
- https://docs.copilotkit.ai/reference/channels — SDK overview, managed vs direct, exports, install command
- https://docs.copilotkit.ai/reference/channels/functions/createChannel — options table, handler list
- https://docs.copilotkit.ai/reference/channels/classes/Channel — direct adapters start while managed is `setup_required`
- https://raw.githubusercontent.com/CopilotKit/CopilotKit/main/packages/channels/README.md and `package.json` — umbrella package, quick-start with `intelligence` key, exports
- https://raw.githubusercontent.com/CopilotKit/CopilotKit/main/packages/channels-slack/README.md and `package.json` — adapter options, scopes, events, limitations, Bolt dependency
- https://raw.githubusercontent.com/CopilotKit/CopilotKit/main/packages/channels-slack/src/adapter.ts — Bolt `App` construction, handler registration
- https://raw.githubusercontent.com/CopilotKit/CopilotKit/main/packages/channels-core/README.md — managed runner on free plan; custom runner path; `ActionStore`
- https://github.com/CopilotKit/CopilotKit/blob/main/packages/runtime/src/v2/runtime/core/runtime.ts — `channels` requires Intelligence; `IntelligenceAgentRunner`
- https://github.com/CopilotKit/CopilotKit/blob/main/packages/runtime/src/v2/runtime/__tests__/channels-option.test.ts — "sse runtime rejects channels"
- https://registry.npmjs.org/@copilotkit/channels, /@copilotkit/channels-slack, /@copilotkit/runtime — versions, publish dates, dependency ranges (queried 2026-09-12)
- https://www.copilotkit.ai/pricing — plan limits for Slack/Teams orgs, channels, credits
- Local: `lib/slack/bolt.ts`, `lib/slack/post-proposal-card.ts`, `lib/ai/provider.ts`, `CLAUDE.md`, `.planning/research/STACK.md`, `.planning/ROADMAP.md`
- UNVERIFIED: `docs.copilotkit.ai/slack/configure` and `/slack/deploy` returned 404 at research time; a documented self-hosted (no-Intelligence) channel runner example was not found.
