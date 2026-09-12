"use client";

import { CopilotKit, useCopilotAction } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { useState } from "react";
import "@copilotkit/react-ui/styles.css";

/** One commitment-shaped row as returned by the `queryCommitments` handler. */
interface StubCommitmentRow {
  what: string;
  who: string;
  direction: "owed_by_me" | "owed_to_me";
  status: "open" | "done" | "overdue" | "dropped";
}

/**
 * Fixed two-row stub result for Task 1's round-trip tracer only. Task 3
 * replaces this with the real seeded rows filtered by the model's chosen
 * arguments (`lib/commitment-ledger/seed-rows.ts`).
 */
const STUB_ROWS: StubCommitmentRow[] = [
  {
    what: "send the deck",
    who: "Alex",
    direction: "owed_by_me",
    status: "open",
  },
  {
    what: "review the PR",
    who: "Sam",
    direction: "owed_to_me",
    status: "overdue",
  },
];

/**
 * Registers the single `queryCommitments` frontend action and its render
 * prop. Must be mounted inside `<CopilotKit>` — `useCopilotAction` reads
 * that provider's context. The model chooses *which* commitments answer
 * the user's question (closed `direction`/`status` enum arguments, no
 * free-text parameter, per D-11); which component renders each row is a
 * separate, deterministic concern Task 3 wires in.
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
    handler: async () => STUB_ROWS,
    // CopilotKit's own `status` describes the tool call's progress
    // ("inProgress" | "executing" | "complete"), which collides by name
    // with a commitment row's own `status` — renamed to `callStatus` so
    // the two never shadow each other.
    render: ({ status: callStatus, result }) => {
      if (callStatus !== "complete" || result == null) {
        return <p>Looking up commitments…</p>;
      }
      const rows = result as StubCommitmentRow[];
      return (
        <ul className="list-none space-y-1 p-0">
          {rows.map((row) => (
            <li key={`${row.who}-${row.what}`} className="text-sm">
              {row.what} — {row.who}
            </li>
          ))}
        </ul>
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
 * @returns The ledger's client-rendered chat surface.
 */
export function LedgerSurface() {
  const [sessionKey, setSessionKey] = useState(0);

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
          session — the #3317 mitigation (08-RESEARCH Open Question 1). */}
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
  );
}
