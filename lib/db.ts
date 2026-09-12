// Source: prisma.io/docs/guides/upgrade-prisma-orm/v7 (fetched 2026-09-11)
// combined with PROJECT.md's globalThis-singleton rule
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prisma/generated/client";
import { config } from "./config";

/** Global singleton holder so Next.js hot reload doesn't spawn a new pool. */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({
  connectionString: config.db.url, // DATABASE_URL — pooled, used by the running app
  max: 5, // pool max; `?connection_limit=5` in the URL is NOT honoured by `pg`
});

/**
 * Shared Prisma client for this process, behind a `globalThis` holder so hot
 * reload never spawns a second connection pool. Never construct a second
 * `PrismaClient` anywhere else in the repo — import this export instead.
 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
