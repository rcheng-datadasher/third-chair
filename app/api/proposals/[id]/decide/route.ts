import { z } from "zod";
import { config } from "@/lib/config";
import { approveProposal } from "@/lib/slack/approve";
import { rejectProposal } from "@/lib/slack/reject";

/** The one decision a dashboard click can make on a pending proposal. */
const decideSchema = z.object({ action: z.enum(["approve", "reject"]) });

/**
 * Applies a dashboard Approve/Reject click to a proposal. Acts as the demo
 * owner (seed user A) since the dashboard has no login; the same domain
 * functions the Slack buttons call handle the row transition and the card
 * edit, so Slack reflects the decision without extra work here.
 *
 * @param req - The request; body is `{ action: "approve" | "reject" }`.
 * @param ctx - Route context carrying the proposal id segment.
 * @returns `{ outcome }` from the domain function, or 400 on a bad body.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const parsed = decideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const { id } = await ctx.params;
  const actor = config.seed.userA.slackId;
  const outcome =
    parsed.data.action === "approve"
      ? await approveProposal(id, actor)
      : await rejectProposal(id, actor);
  return Response.json({ outcome });
}
