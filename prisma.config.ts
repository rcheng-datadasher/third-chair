import "dotenv/config";
// Source: prisma.io/docs/orm/reference/prisma-config-reference,
// prisma.io/docs/guides/upgrade-prisma-orm/v7 (fetched 2026-09-11)
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  // The CLI (db push, generate) uses this URL. Point it at the UNPOOLED
  // connection (DIRECT_URL) — db push issues DDL a pooler can reject/mangle.
  // The pooled DATABASE_URL is used separately by lib/db.ts's PrismaPg adapter.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
