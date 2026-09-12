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
import type { DecisionRow } from "@/lib/dashboard/queries";

const HEAD =
  "h-11 px-4 font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground";
const CELL = "px-4 py-3.5 align-top";

/**
 * Fetches the decision poll endpoint.
 *
 * @returns The current decision rows.
 * @throws When the endpoint responds with a non-2xx status.
 */
async function fetchDecisions(): Promise<DecisionRow[]> {
  const res = await fetch("/api/decisions");
  if (!res.ok) throw new Error(`decisions ${res.status}`);
  return res.json();
}

/**
 * Read-only Decision log that polls every 4 s, including in background tabs.
 * The agent's reason carries the row; the source message sits beside it in
 * muted text. Both render as plain JSX text so React escapes them.
 *
 * @param props - Component props.
 * @param props.initialData - Server-rendered rows for the first paint.
 * @returns The log table with its status strip.
 */
export function DecisionLog({ initialData }: { initialData: DecisionRow[] }) {
  const { data, isError } = useQuery({
    queryKey: ["decisions"],
    queryFn: fetchDecisions,
    initialData,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });

  return (
    <section className="flex flex-col gap-3">
      <FeedStatus count={data.length} noun="decision" isError={isError} />
      <Card className="rounded-sm border p-0 text-base shadow-retro ring-0">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={`${HEAD} w-40`}>Verdict</TableHead>
              <TableHead className={`${HEAD} w-64`}>When (HKT)</TableHead>
              <TableHead className={`${HEAD} w-36 text-right`}>
                Confidence
              </TableHead>
              <TableHead className={HEAD}>Agent reason</TableHead>
              <TableHead className={`${HEAD} w-[28%]`}>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className={`${CELL} py-12 text-center font-mono text-sm uppercase tracking-widest text-muted-foreground`}
                >
                  No decisions yet
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id} data-verdict={row.verdict}>
                  <TableCell className={CELL}>
                    <StatusChip status={row.verdict} />
                  </TableCell>
                  <TableCell className={`${CELL} font-mono tabular-nums`}>
                    {row.whenHkt}
                  </TableCell>
                  <TableCell
                    className={`${CELL} text-right font-mono tabular-nums`}
                  >
                    {row.confidence === null ? "—" : row.confidence.toFixed(2)}
                  </TableCell>
                  <TableCell className={`${CELL} whitespace-normal`}>
                    {row.reason || "—"}
                  </TableCell>
                  <TableCell
                    className={`${CELL} whitespace-normal text-muted-foreground`}
                  >
                    {row.messageText || "—"}
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
