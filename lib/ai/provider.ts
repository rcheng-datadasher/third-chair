import type { ZodType } from "zod";

/** Options for a single model completion request. */
export interface CompleteOptions<T> {
  tier: "fast" | "smart";
  system: string;
  prompt: string;
  schema: ZodType<T>;
}

/**
 * The single seam every model call in this repo goes through
 * (CLAUDE.md "Single sources of truth"). No other file may import an AI SDK
 * client directly.
 *
 * Phase 1 stub: not implemented. This is a deliberate, recorded narrowing
 * of the research table's "returns a schema-shaped mock" — fabricating a
 * value for an arbitrary Zod schema needs a mock-generation dependency the
 * stack forbids, and no Phase 1 or Wave A caller invokes this function.
 * Phase 5 (AGT-01) replaces the body with the real Kilo Gateway call; this
 * signature does not change.
 *
 * @param opts - Model tier, system/prompt strings, and the Zod schema the
 *   result must satisfy.
 * @throws Always, in Phase 1 — Phase 5 (AGT-01) implements this.
 */
export async function complete<T>(_opts: CompleteOptions<T>): Promise<T> {
  throw new Error("complete: not implemented until Phase 5 (AGT-01)");
}
