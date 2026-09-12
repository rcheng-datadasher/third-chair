import { createHash } from "node:crypto";

/**
 * Derives a deterministic, Calendar-safe custom event id from a Proposal id.
 *
 * Google Calendar custom event ids must sit inside the base32hex charset
 * `[a-v0-9]`, 5-1024 characters. A sha256 hex digest (`0-9a-f`) is a strict
 * subset of that charset at a fixed 64 characters, so the raw Proposal
 * `cuid()` (which uses characters outside that set) is never used directly
 * (D-11). Deterministic on the Proposal id makes a repeat call for the same
 * proposal always target the same event id, which is what makes the 409
 * idempotency fallback in `create-event.ts` possible.
 *
 * @param proposalId - The Proposal's id.
 * @returns A 64-character lowercase hex string.
 */
export function deriveEventId(proposalId: string): string {
  return createHash("sha256").update(proposalId).digest("hex");
}
