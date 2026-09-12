import { WebClient } from "@slack/web-api";
import { config } from "../config";

/**
 * Shared Slack Web API client for this process, built once from the bot
 * token. Mirrors `lib/db.ts`'s singleton pattern — never construct a second
 * `WebClient` inside a listener or handler.
 */
export const slackClient = new WebClient(config.slack.botToken);
