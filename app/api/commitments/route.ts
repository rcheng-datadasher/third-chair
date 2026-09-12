import {
  CommitmentFilterSchema,
  listCommitments,
} from "@/lib/commitment-ledger/list-commitments";

/**
 * Read endpoint the ledger's `queryCommitments` chat action calls.
 * Query string: optional `direction` and `status`.
 *
 * @param req - The incoming request.
 * @returns 200 with `CommitmentRow[]`, or 400 on an invalid filter.
 */
export async function GET(req: Request): Promise<Response> {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = CommitmentFilterSchema.safeParse(params);
  if (!parsed.success) {
    return Response.json({ error: "Invalid filter" }, { status: 400 });
  }
  return Response.json(await listCommitments(parsed.data));
}
