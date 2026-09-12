/**
 * A normalized Slack message, built from any Bolt event payload (mention,
 * watched-channel message, etc.) before it enters the agent pipeline.
 */
export interface SlackMessage {
  /** Slack workspace/team id the message belongs to. */
  teamId: string;
  /** Channel id the message was posted in. */
  channelId: string;
  /** The message's own Slack timestamp (also its unique id within a channel). */
  ts: string;
  /** Parent thread timestamp, if this message is a reply. */
  threadTs?: string;
  /** Slack user id of the message author. */
  userId: string;
  /** Raw message text. */
  text: string;
}
