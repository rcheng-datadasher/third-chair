import {
  CopilotRuntime,
  copilotRuntimeNextJSAppRouterEndpoint,
  OpenAIAdapter,
} from "@copilotkit/runtime";
import type { NextRequest } from "next/server";
import { openaiClient } from "@/lib/ai/provider";
import { config } from "@/lib/config";

/**
 * Service adapter wrapping the shared `openaiClient` (Kilo Gateway), using
 * `config.ai.modelFast` — the same fast-tier model `lib/agent/` extraction
 * calls use, verified to support tool calling before this route was wired
 * (08-01 Task 1 step 2).
 */
const serviceAdapter = new OpenAIAdapter({
  openai: openaiClient,
  model: config.ai.modelFast,
});

/** One runtime instance for this process, shared by every request. */
const runtime = new CopilotRuntime();

/**
 * CopilotKit runtime endpoint. Thin route handler (D-21): all business
 * logic (client construction, model selection) lives in `lib/ai/provider.ts`
 * and `lib/config.ts`; this file only wires the runtime, the adapter and the
 * Next.js App Router endpoint together.
 *
 * @param req - The incoming CopilotKit request from `components/commitment-ledger/ledger-surface.tsx`.
 * @returns The runtime's response, streamed back to the client.
 */
export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
};
