import { App } from "@slack/bolt";
import type { SlackMessage } from "../../types/slack";
import { dispatchAgentRun } from "../agent/dispatch";
import { config } from "../config";
import { handleApproveProposal } from "./actions/approve-proposal";
import { EDIT_APPROVE_MODAL_CALLBACK_ID } from "./blocks";
import { handleEditApproveProposal } from "./handlers/edit-approve-proposal";
import { handleEditApproveSubmission } from "./handlers/edit-approve-submission";

/**
 * The Bolt process entry point. Registration only — every handler body
 * lives in its own module so later phases append registrations rather than
 * restructure this file (named overlap for Phases 2, 4, 5, 7).
 */
const app = new App({
  token: config.slack.botToken,
  appToken: config.slack.appToken,
  signingSecret: config.slack.signingSecret,
  socketMode: true,
});

app.event("app_mention", async ({ event }) => {
  const message: SlackMessage = {
    teamId: config.slack.teamId,
    channelId: event.channel,
    ts: event.ts,
    threadTs: event.thread_ts,
    userId: event.user ?? "",
    text: event.text,
  };
  await dispatchAgentRun({ message });
});

app.action("approve_proposal", handleApproveProposal);
app.action("edit_approve_proposal", handleEditApproveProposal);
app.view(EDIT_APPROVE_MODAL_CALLBACK_ID, handleEditApproveSubmission);

(async () => {
  await app.start();
  console.log("bolt: socket mode connected");
})();
