"use client";

import { CopilotKit, useCopilotAction } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { useState } from "react";
import "@copilotkit/react-ui/styles.css";
import type { LedgerCommitment } from "@/lib/agent/commitment-schema";
import type { CommitmentFilter } from "@/lib/commitment-ledger/list-commitments";
import { CommitmentRow } from "./commitment-row";

/**
 * Fetches the persona's commitments from `/api/commitments`, which reads
 * the `Commitment` rows the agent extracted from Slack. An absent filter
 * field matches everything.
 *
 * @param args - The model-supplied filter, both fields optional.
 * @returns The rows matching every supplied filter.
 * @throws When the route responds with a non-2xx status.
 */
async function fetchCommitments(
  args: CommitmentFilter,
): Promise<LedgerCommitment[]> {
  const params = new URLSearchParams();
  if (args.direction) params.set("direction", args.direction);
  if (args.status) params.set("status", args.status);
  const res = await fetch(`/api/commitments?${params}`);
  if (!res.ok) throw new Error(`commitments fetch failed: ${res.status}`);
  return res.json();
}

/**
 * Registers the single `queryCommitments` frontend action and its render
 * prop. The handler reads live `Commitment` rows over `/api/commitments`. Must be mounted inside `<CopilotKit>` — `useCopilotAction` reads
 * that provider's context. The model chooses *which* commitments answer
 * the user's question (closed `direction`/`status` enum arguments, no
 * free-text parameter, per D-11); `selectCommitmentComponent` deterministically
 * picks which component kind renders each returned row — never the model.
 *
 * @returns `null` — this component only registers a hook side effect.
 */
function QueryCommitmentsAction() {
  useCopilotAction({
    name: "queryCommitments",
    description:
      "Look up commitments (promises) by who owes whom and their status.",
    parameters: [
      {
        name: "direction",
        type: "string",
        enum: ["owed_by_me", "owed_to_me"],
        required: false,
        description: "Filter to commitments I owe, or commitments owed to me.",
      },
      {
        name: "status",
        type: "string",
        enum: ["open", "done", "overdue", "dropped"],
        required: false,
        description: "Filter to commitments in this status.",
      },
    ],
    handler: fetchCommitments,
    // CopilotKit's own `status` describes the tool call's progress
    // ("inProgress" | "executing" | "complete"), which collides by name
    // with a commitment row's own `status` — renamed to `callStatus` so
    // the two never shadow each other.
    render: ({ status: callStatus, result }) => {
      if (callStatus !== "complete" || result == null) {
        return <p>Looking up commitments…</p>;
      }
      const rows = result as LedgerCommitment[];
      return (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <CommitmentRow key={row.id} row={row} />
          ))}
        </div>
      );
    },
  });
  return null;
}

/**
 * Client surface for the commitment ledger (Phase 8, STR-05). Mounts the
 * CopilotKit chat UI pointed at the local runtime route and the single
 * `queryCommitments` action. Imports neither the AI provider module nor
 * the typed config module — no secret or configuration value crosses into
 * the browser bundle (D-21).

 * The `Nudge` button's `useMutation` uses the root `QueryClient` from
 * `app/providers.tsx`.
 *
 * @returns The ledger's client-rendered chat surface.
 */
export function LedgerSurface() {
  const [sessionKey, setSessionKey] = useState(0);
  // @copilotkit/core 1.71 does `new URL(runtimeUrl)` with no base, so a
  // relative path throws "Invalid URL" — resolve against the page origin.
  // Falls back to the bare path during SSR; the browser value is what the
  // runtime actually fetches with.
  const runtimeUrl =
    typeof window === "undefined"
      ? "/api/copilotkit"
      : new URL("/api/copilotkit", window.location.origin).href;

  return (
    <div className="flex h-full flex-col gap-2">
      <button
        type="button"
        onClick={() => setSessionKey((key) => key + 1)}
        className="self-end rounded border border-border bg-secondary px-3 py-1 text-sm text-secondary-foreground"
      >
        New question
      </button>
      {/* Remounts the whole provider on a fresh key, starting a new chat
            session — the CopilotKit issue 3317 mitigation (08-RESEARCH Open Question 1). */}
      <CopilotKit runtimeUrl={runtimeUrl} key={sessionKey}>
        <QueryCommitmentsAction />
        <CopilotChat
          labels={{
            title: "Commitment Ledger",
            initial: "Ask what you owe, or what you're owed.",
          }}
        />
      </CopilotKit>
    </div>
  );
}
