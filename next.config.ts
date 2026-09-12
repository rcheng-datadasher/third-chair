import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 otherwise appends an "agent rules" block to CLAUDE.md on every
  // `next dev` boot, mutating a file this repo already owns and commits by
  // hand (FND-01). Disabled so `next dev` never rewrites CLAUDE.md.
  agentRules: false,
};

export default nextConfig;
