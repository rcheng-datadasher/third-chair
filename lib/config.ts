import "dotenv/config";
import { z } from "zod";

/**
 * Single Zod parse of the runtime environment, executed once at import time.
 * This module is the repo's only direct reader of `process.env` (besides the
 * `NODE_ENV` check in `lib/db.ts`) — every other module imports `config`.
 * Not `server-only`: Bolt and Trigger.dev import this outside the RSC runtime.
 *
 * The `dotenv/config` side-effect import mirrors `prisma.config.ts`'s
 * existing pattern (D-16 extend, never duplicate): bun auto-loads `.env`,
 * but the Bolt `bunx tsx` runtime fallback (D-01) runs under Node, which
 * does not. `dotenv` never overwrites an already-set var, so this is a
 * no-op under bun/Next.js, which already populated `process.env`.
 */
const envSchema = z.object({
  // Slack
  SLACK_BOT_TOKEN: z.string().min(1),
  SLACK_APP_TOKEN: z.string().min(1),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_TEAM_ID: z.string().min(1),
  SLACK_WATCH_CHANNEL_IDS: z.string().transform((v) =>
    v
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  ),

  // Google
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),

  // AI (Kilo Gateway)
  AI_BASE_URL: z.string().url(),
  AI_API_KEY: z.string().min(1),
  MODEL_FAST: z.string().min(1),
  MODEL_SMART: z.string().min(1),

  // Postgres
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  // Trigger.dev
  TRIGGER_SECRET_KEY: z.string().min(1),
  TRIGGER_PROJECT_ID: z.string().min(1),

  // Agent transport
  AGENT_TRANSPORT: z.enum(["trigger", "inline"]).default("inline"),

  // Seed identities
  SEED_USER_A_SLACK_ID: z.string().min(1),
  SEED_USER_A_EMAIL: z.string().email(),
  SEED_USER_A_GOOGLE_REFRESH_TOKEN: z.string().min(1),
  SEED_USER_B_SLACK_ID: z.string().min(1),
  SEED_USER_B_EMAIL: z.string().email(),

  // Stretch (optional — S1 graph stack)
  NEO4J_URI: z.string().url().optional(),
  NEO4J_USER: z.string().optional(),
  NEO4J_PASSWORD: z.string().optional(),
  GRAPH_SERVICE_URL: z.string().url().optional(),
});

const parsed = envSchema.parse(process.env);

/**
 * The one typed environment object every process in this repo imports.
 * Extend by adding keys here — never restructure existing sections
 * (sibling phases depend on this shape).
 */
export const config = {
  slack: {
    botToken: parsed.SLACK_BOT_TOKEN,
    appToken: parsed.SLACK_APP_TOKEN,
    signingSecret: parsed.SLACK_SIGNING_SECRET,
    teamId: parsed.SLACK_TEAM_ID,
    watchChannelIds: parsed.SLACK_WATCH_CHANNEL_IDS,
  },
  google: {
    clientId: parsed.GOOGLE_CLIENT_ID,
    clientSecret: parsed.GOOGLE_CLIENT_SECRET,
    redirectUri: parsed.GOOGLE_REDIRECT_URI,
  },
  ai: {
    baseUrl: parsed.AI_BASE_URL,
    apiKey: parsed.AI_API_KEY,
    modelFast: parsed.MODEL_FAST,
    modelSmart: parsed.MODEL_SMART,
  },
  db: {
    url: parsed.DATABASE_URL,
    directUrl: parsed.DIRECT_URL,
  },
  trigger: {
    secretKey: parsed.TRIGGER_SECRET_KEY,
    projectId: parsed.TRIGGER_PROJECT_ID,
  },
  agent: {
    transport: parsed.AGENT_TRANSPORT,
  },
  graph: {
    neo4jUri: parsed.NEO4J_URI,
    neo4jUser: parsed.NEO4J_USER,
    neo4jPassword: parsed.NEO4J_PASSWORD,
    serviceUrl: parsed.GRAPH_SERVICE_URL,
  },
  seed: {
    userA: {
      slackId: parsed.SEED_USER_A_SLACK_ID,
      email: parsed.SEED_USER_A_EMAIL,
      googleRefreshToken: parsed.SEED_USER_A_GOOGLE_REFRESH_TOKEN,
    },
    userB: {
      slackId: parsed.SEED_USER_B_SLACK_ID,
      email: parsed.SEED_USER_B_EMAIL,
    },
  },
};
