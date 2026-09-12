import { App, type MessageShortcut } from "@slack/bolt";
import { config } from "../config";
import { handleAppMention } from "./handlers/app-mention";
import { handleApproveProposal } from "./handlers/approve-proposal";
import { handleExtractShortcut } from "./handlers/extract-shortcut";
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

(async () => {
  await app.start();
  console.log("bolt: socket mode connected");
})();
