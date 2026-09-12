import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 otherwise appends an "agent rules" block to CLAUDE.md on every
  // `next dev` boot, mutating a file this repo already owns and commits by
  // hand (FND-01). Disabled so `next dev` never rewrites CLAUDE.md.
  agentRules: false,
  // Turbopack fallback ladder step 1 (01-RESEARCH.md Pitfall 5): exclude the
  // Prisma 7 generated client and its native driver from Turbopack bundling.
  serverExternalPackages: ["@prisma/client", "pg"],
};

export default nextConfig;
