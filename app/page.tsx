import { prisma } from "@/lib/db";

/**
 * Phase 1 placeholder Server Component. Proves the Prisma 7 generated client
 * loads under Turbopack by rendering a live count through the shared
 * `lib/db.ts` singleton. Phase 6 replaces this file entirely.
 */
export default async function Home() {
  const count = await prisma.proposal.count();
  return <div>{`proposals: ${count}`}</div>;
}
