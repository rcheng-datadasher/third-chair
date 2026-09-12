"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EmptyRow,
  GRID_CELL,
  GRID_HEAD,
  GridFrame,
  NewMarker,
} from "@/components/data-grid";
import { FeedStatus } from "@/components/feed-status";
import { StatusChip } from "@/components/status-chip";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNewRows } from "@/hooks/use-new-rows";
import type { ProposalRow } from "@/lib/dashboard/queries";

/**
 * Fetches the proposal poll endpoint.
 *
 * @returns The current proposal rows.
 * @throws When the endpoint responds with a non-2xx status.
 */
async function fetchProposals(): Promise<ProposalRow[]> {
  const res = await fetch("/api/proposals");
  if (!res.ok) throw new Error(`proposals ${res.status}`);
  return res.json();
}

/** A dashboard decision on one proposal. Same shape the decide route validates. */
interface Decision {
  id: string;
  action: "approve" | "reject";
}

/**
 * Posts an Approve/Reject decision to the decide route.
 *
 * @param decision - The proposal id and the action to apply.
 * @returns The outcome string the domain function returned.
 * @throws When the endpoint responds with a non-2xx status.
 */
async function postDecision(decision: Decision): Promise<string> {
  const res = await fetch(`/api/proposals/${decision.id}/decide`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: decision.action }),
  });
  if (!res.ok) throw new Error(`decide ${res.status}`);
  const { outcome } = (await res.json()) as { outcome: string };
  return outcome;
}

/**
 * Proposal queue that polls every 4 s, including in background tabs.
 * Column grammar shared with the Decision log: chip, primary text, time,
 * confidence. Rows that arrive between polls carry a one-cycle NEW marker.
 *
 * @param props - Component props.
 * @param props.initialData - Server-rendered rows for the first paint.
 * @returns The status strip and the scrollable grid.
 */
export function ProposalQueue({ initialData }: { initialData: ProposalRow[] }) {
  const { data, isError, isFetched, dataUpdatedAt } = useQuery({
    queryKey: ["proposals"],
    queryFn: fetchProposals,
    initialData,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });
  const fresh = useNewRows(data);
  const queryClient = useQueryClient();
  const decide = useMutation({
    mutationFn: postDecision,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["proposals"] }),
  });
  const busyId = decide.isPending ? decide.variables.id : null;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <FeedStatus
        count={data.length}
        noun="proposal"
        isError={isError}
        updatedAt={isFetched ? dataUpdatedAt : null}
      />
      <GridFrame>
        <table className="w-full min-w-[880px] table-fixed border-separate border-spacing-0 text-base">
          <caption className="sr-only">
            Proposals extracted from Slack, newest first
          </caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={`${GRID_HEAD} w-44`}>Status</TableHead>
              <TableHead className={GRID_HEAD}>Title</TableHead>
              <TableHead className={`${GRID_HEAD} w-64`}>Start (HKT)</TableHead>
              <TableHead className={`${GRID_HEAD} w-36 text-right`}>
                Confidence
              </TableHead>
              <TableHead className={`${GRID_HEAD} w-64`}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <EmptyRow colSpan={5}>No proposals yet</EmptyRow>
            ) : (
              data.map((row) => (
                <TableRow
                  key={row.id}
                  data-status={row.status}
                  data-new={fresh.has(row.id) || undefined}
                >
                  <TableCell className={`${GRID_CELL} whitespace-nowrap`}>
                    <StatusChip status={row.status} />
                    {fresh.has(row.id) && <NewMarker />}
                  </TableCell>
                  <TableCell className={`${GRID_CELL} font-medium`}>
                    {row.title}
                  </TableCell>
                  <TableCell
                    className={`${GRID_CELL} whitespace-nowrap font-mono tabular-nums`}
                  >
                    {row.startHkt}
                  </TableCell>
                  <TableCell
                    className={`${GRID_CELL} text-right font-mono tabular-nums`}
                  >
                    {row.confidence === null ? "—" : row.confidence.toFixed(2)}
                  </TableCell>
                  <TableCell className={`${GRID_CELL} whitespace-nowrap`}>
                    <div className="flex items-center gap-2">
                      {row.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            disabled={busyId === row.id}
                            onClick={() =>
                              decide.mutate({ id: row.id, action: "approve" })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === row.id}
                            onClick={() =>
                              decide.mutate({ id: row.id, action: "reject" })
                            }
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {row.slackUrl && (
                        <a
                          href={row.slackUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonVariants({
                            variant: "link",
                            size: "sm",
                          })}
                        >
                          Open in Slack ↗
                        </a>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </table>
      </GridFrame>
    </section>
  );
}
