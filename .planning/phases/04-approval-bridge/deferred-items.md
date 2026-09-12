## Deferred Items

- Task 1's import-boundary grep gate (`grep -rn --include='*.ts' -E '@slack/bolt|slack/bolt' lib types utils | grep -vE '^(lib/slack/bolt\.ts|lib/slack/handlers/)'`) matches `lib/slack/actions/approve-proposal.ts:5:} from "@slack/bolt";`, a pre-existing Phase 1 file (commit `102bfa8`, `01-03`) outside this plan's `files_modified` list and outside `lib/slack/**`, which this plan is instructed not to touch (04-02's sync note; D-19/D-20 file ownership).
  status: open
  **What:** The gate's exclusion regex only carves out `lib/slack/bolt.ts` and `lib/slack/handlers/`, not `lib/slack/actions/` — a directory Phase 1 already used for the Approve/Reject action handler, predating this phase's plan.
  **Why not fixed here:** Fixing it means either editing the gate's exclusion list (not this plan's file) or moving/renaming Phase 1's file (owned by a different phase, and outside `files_modified`). Neither is in scope for 04-02.
  **Risk assessment (T-04-09):** Low — the import is `import type { ... } from "@slack/bolt"` (type-only, erased at compile time; no `App`/Socket Mode construction) and the file is not reachable from `runAgent`'s import chain (`lib/agent/tasks/run-agent.ts` → `lib/agent/graph.ts` → `lib/slack/post-proposal-card.ts` / `lib/slack/post-edit-approve-card.ts`, never `lib/slack/actions/`). Confirmed by manual trace this session.
  **Suggested fix (future phase / DMO-05 review):** widen the gate's exclusion to `lib/slack/actions/` alongside `lib/slack/handlers/`, or move Phase 1's action handlers under `lib/slack/handlers/` for naming consistency.

- 04-02 Task 3 (both-transports live hand-check, APR-05/D-17, ROADMAP Phase 4 success criterion 3): DEFERRED by explicit human decision at 14:13 (speed cut), not executed.
  status: open
  **What:** The plan's Task 3 asked for a live Slack round trip proving both `trigger` and `inline` transports from a real watched-channel message, with the trigger side visible in the Trigger.dev dashboard and the inline side working with the CLI stopped and Bolt restarted.
  **Why not fixed here:** Time-boxed decision, not a blocker found during execution — the human chose to bank Task 1's already-live trigger-side proof and defer the combined check.
  **Current evidence:** Task 1's one-off `tasks.trigger` run already proves the trigger side end to end (run `run_06g98atq7l71uoaacevc47a701` COMPLETED in 4.9s, real Proposal + Decision rows, real card posted to `C0C17MQJ2HF`, human-verified at 14:03). The inline side is the unchanged Phase 1 code path.
  **Suggested resolution:** Close out during 04-01's Bolt run (`AGENT_TRANSPORT=inline`) or during Phase 7's integration pass — post one watched-channel message with the CLI stopped and transport set to inline, confirm a card posts with no Trigger.dev run and no Bolt error, per Task 3's original step 5.
