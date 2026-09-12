import { NextResponse } from "next/server";
import { z } from "zod";
import { createNudgeProposal } from "@/lib/commitment-ledger/create-nudge-proposal";

/** The only body shape this route accepts — unknown keys are rejected (T-08-07). */
const NudgeRequestSchema = z
  .object({
    commitmentId: z.string().min(1),
  })
  .strict();

/**
 * Creates a nudge `Proposal` and posts its Slack approval card. Thin
 * handler (D-21): validation and every side effect live in
 * `createNudgeProposal`. Never echoes the submitted body back to the
 * caller, so an injected extra key never surfaces in the response.
 *
 * @param req - The incoming request; body `{ commitmentId: string }`.
 * @returns 200 with the created proposal id, 400 on a validation failure,
 *   or 500 on any thrown error (a short message only, never the raw error).
 */
export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const parsed = NudgeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  try {
    const { proposalId } = await createNudgeProposal(parsed.data.commitmentId);
    return NextResponse.json({ proposalId });
  } catch {
    return NextResponse.json(
      { error: "Failed to create nudge" },
      { status: 500 },
    );
  }
}
