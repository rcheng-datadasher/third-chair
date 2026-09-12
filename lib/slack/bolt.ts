import { App, type MessageShortcut } from "@slack/bolt";
import { config } from "../config";
import { EDIT_APPROVE_MODAL_CALLBACK_ID } from "./blocks";
import { handleAppMention } from "./handlers/app-mention";
import { handleApproveProposal } from "./handlers/approve-proposal";
import { handleEditApproveProposal } from "./handlers/edit-approve-proposal";
import { handleEditApproveSubmission } from "./handlers/edit-approve-submission";
import { handleExtractShortcut } from "./handlers/extract-shortcut";
import { handleRejectProposal } from "./handlers/reject-proposal";
import { handleSecretaryCommand } from "./handlers/secretary-command";
import { handleWatchedChannelMessage } from "./handlers/watched-channel-message";

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

app.message(handleWatchedChannelMessage);
app.event("app_mention", handleAppMention);
// ponytail: registered by shortcut type, not callback_id — the app installs
// exactly one message shortcut. Add callback_id once a second one exists.
app.shortcut<MessageShortcut>(
  { type: "message_action" },
  handleExtractShortcut,
);
app.command("/secretary", handleSecretaryCommand);
app.action("approve_proposal", handleApproveProposal);
app.action("reject_proposal", handleRejectProposal);
app.action("edit_approve_proposal", handleEditApproveProposal);
app.view(EDIT_APPROVE_MODAL_CALLBACK_ID, handleEditApproveSubmission);

(async () => {
  await app.start();
  console.log("bolt: socket mode connected");
})();
