// Trigger.dev v4 root config, read only by the CLI at build/dev time.
// Never imported by Bolt, Next.js or the task runtime, so this file reads
// process.env directly — the same documented carve-out prisma.config.ts
// already established for build/CLI-only files (D-22).
//
// Default runtime for tasks is Node (the only supported choice for this
// build); no override is set here.
//
// [Rule 1/3 deviation, Task 1] The pinned SDK's TriggerConfig type marks
// `maxDuration` as required (no `?`), not optional as the plan/research
// assumed from the docs — omitting it is a TS2345 compile error against
// this exact 4.5.16 install. 300s covers this graph's model calls with
// headroom; raise it if a future phase's task runs longer.

import { prismaExtension } from "@trigger.dev/build/extensions/prisma";
import { defineConfig } from "@trigger.dev/sdk";
import { config as loadDotenv } from "dotenv";

// The CLI evaluates this file before its own env-file auto-load takes
// effect, so the project reference below can read as empty on the very
// first parse unless the canonical local env file is loaded explicitly
// here first (proven in this repo's connection_test/trigger.config.ts).
loadDotenv({ path: ".env.local" });

export default defineConfig({
  // TRIGGER_PROJECT_ID already exists in lib/config.ts's env schema — reused
  // here rather than introducing a second key name for the same value.
  project: process.env.TRIGGER_PROJECT_ID ?? "",
  dirs: ["./lib/agent/tasks"],
  maxDuration: 300,
  build: {
    extensions: [prismaExtension({ mode: "modern" })],
  },
});
