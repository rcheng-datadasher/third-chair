"use client";

import { CopilotKit, useCopilotAction } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import "@copilotkit/react-ui/styles.css";
import type { SeedCommitment } from "@/lib/commitment-ledger/seed-rows";
import { seedCommitments } from "@/lib/commitment-ledger/seed-rows";
import { CommitmentRow } from "./commitment-row";

/** The arguments the model may pass to `queryCommitments`; both optional. */
interface QueryCommitmentsArgs {
  direction?: "owed_by_me" | "owed_to_me";
  status?: "open" | "done" | "overdue" | "dropped";
}

/**
 * Filters the hand-seeded demo rows by the model's chosen arguments. An
 * absent argument matches everything. Pure, synchronous, no I/O.
 *
 * @param rows - The full seeded commitment set.
 * @param args - The model-supplied filter, both fields optional.
 * @returns The rows matching every supplied filter.
 */
function filterCommitments(
  rows: SeedCommitment[],
  args: QueryCommitmentsArgs,
): SeedCommitment[] {
  return rows.filter(
    (row) =>
      (args.direction == null || row.direction === args.direction) &&
      (args.status == null || row.status === args.status),
  );
}

/**
 * Registers the single `queryCommitments` frontend action and its render
 * prop. Must be mounted inside `<CopilotKit>` — `useCopilotAction` reads
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
    handler: async (args: QueryCommitmentsArgs) =>
      filterCommitments(seedCommitments, args),
    // CopilotKit's own `status` describes the tool call's progress
    // ("inProgress" | "executing" | "complete"), which collides by name
    // with a commitment row's own `status` — renamed to `callStatus` so
    // the two never shadow each other.
    render: ({ status: callStatus, result }) => {
      if (callStatus !== "complete" || result == null) {
        return <p>Looking up commitments…</p>;
      }
      const rows = result as SeedCommitment[];
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
 *
 * Wraps its own subtree in a `QueryClientProvider`: this worktree's
 * `app/layout.tsx` does not yet mount Phase 6's root `<Providers>` (that
 * phase has not merged to `main` here), so the `Nudge` button's
 * `useMutation` would otherwise have no query client above it. Scoped
 * locally rather than editing `app/layout.tsx`/`app/providers.tsx`, which
 * stay untouched (D-15).
 *
 * @returns The ledger's client-rendered chat surface.
 */
export function LedgerSurface() {
  const [sessionKey, setSessionKey] = useState(0);
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
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
        <CopilotKit runtimeUrl="/api/copilotkit" key={sessionKey}>
          <QueryCommitmentsAction />
          <CopilotChat
            labels={{
              title: "Commitment Ledger",
              initial: "Ask what you owe, or what you're owed.",
            }}
          />
        </CopilotKit>
      </div>
    </QueryClientProvider>
  );
}
