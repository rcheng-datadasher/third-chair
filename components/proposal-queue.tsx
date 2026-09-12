"use client";

import { useQuery } from "@tanstack/react-query";
import { FeedStatus } from "@/components/feed-status";
import { StatusChip } from "@/components/status-chip";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProposalRow } from "@/lib/dashboard/queries";

const HEAD =
  "h-11 px-4 font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground";
const CELL = "px-4 py-3.5";

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

/**
 * Read-only proposal queue that polls every 4 s, including in background tabs.
 * Title carries the row; status, start and confidence are fixed-width metadata.
 *
 * @param props - Component props.
 * @param props.initialData - Server-rendered rows for the first paint.
 * @returns The queue table with its status strip.
 */
export function ProposalQueue({ initialData }: { initialData: ProposalRow[] }) {
  const { data, isError } = useQuery({
    queryKey: ["proposals"],
    queryFn: fetchProposals,
    initialData,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });

  return (
    <section className="flex flex-col gap-3">
      <FeedStatus count={data.length} noun="proposal" isError={isError} />
      <Card className="rounded-sm border p-0 text-base shadow-retro ring-0">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={`${HEAD} w-44`}>Status</TableHead>
              <TableHead className={HEAD}>Title</TableHead>
              <TableHead className={`${HEAD} w-64`}>Start (HKT)</TableHead>
              <TableHead className={`${HEAD} w-36 text-right`}>
                Confidence
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={4}
                  className={`${CELL} py-12 text-center font-mono text-sm uppercase tracking-widest text-muted-foreground`}
                >
                  No proposals yet
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id} data-status={row.status}>
                  <TableCell className={CELL}>
                    <StatusChip status={row.status} />
                  </TableCell>
                  <TableCell className={`${CELL} truncate font-medium`}>
                    {row.title}
                  </TableCell>
                  <TableCell className={`${CELL} font-mono tabular-nums`}>
                    {row.startHkt}
                  </TableCell>
                  <TableCell
                    className={`${CELL} text-right font-mono tabular-nums`}
                  >
                    {row.confidence === null ? "—" : row.confidence.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}
