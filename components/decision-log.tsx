"use client";

import { useQuery } from "@tanstack/react-query";
import {
  EmptyRow,
  GRID_CELL,
  GRID_HEAD,
  GridFrame,
  NewMarker,
} from "@/components/data-grid";
import { FeedStatus } from "@/components/feed-status";
import { StatusChip } from "@/components/status-chip";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNewRows } from "@/hooks/use-new-rows";
import type { DecisionRow } from "@/lib/dashboard/queries";

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
 * Same column grammar as the queue: chip, primary text (the agent's reason),
 * secondary text (the source message), time, confidence. Reason and message
 * render as plain JSX text so React escapes them.
 *
 * @param props - Component props.
 * @param props.initialData - Server-rendered rows for the first paint.
 * @returns The status strip and the scrollable grid.
 */
export function DecisionLog({ initialData }: { initialData: DecisionRow[] }) {
  const { data, isError, isFetched, dataUpdatedAt } = useQuery({
    queryKey: ["decisions"],
    queryFn: fetchDecisions,
    initialData,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });
  const fresh = useNewRows(data);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <FeedStatus
        count={data.length}
        noun="decision"
        isError={isError}
        updatedAt={isFetched ? dataUpdatedAt : null}
      />
      <GridFrame>
        <table className="w-full min-w-[1040px] table-fixed border-separate border-spacing-0 text-base">
          <caption className="sr-only">
            The agent's decisions on Slack messages, newest first
          </caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={`${GRID_HEAD} w-40`}>Verdict</TableHead>
              <TableHead className={GRID_HEAD}>Agent reason</TableHead>
              <TableHead className={`${GRID_HEAD} w-64`}>Message</TableHead>
              <TableHead className={`${GRID_HEAD} w-64`}>When (HKT)</TableHead>
              <TableHead className={`${GRID_HEAD} w-36 text-right`}>
                Confidence
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <EmptyRow colSpan={5}>No decisions yet</EmptyRow>
            ) : (
              data.map((row) => (
                <TableRow
                  key={row.id}
                  data-verdict={row.verdict}
                  data-new={fresh.has(row.id) || undefined}
                >
                  <TableCell className={`${GRID_CELL} whitespace-nowrap`}>
                    <StatusChip status={row.verdict} />
                    {fresh.has(row.id) && <NewMarker />}
                  </TableCell>
                  <TableCell className={`${GRID_CELL} max-w-prose`}>
                    {row.reason || "—"}
                  </TableCell>
                  <TableCell className={`${GRID_CELL} text-muted-foreground`}>
                    {row.messageText || "—"}
                  </TableCell>
                  <TableCell
                    className={`${GRID_CELL} whitespace-nowrap font-mono tabular-nums`}
                  >
                    {row.whenHkt}
                  </TableCell>
                  <TableCell
                    className={`${GRID_CELL} whitespace-nowrap text-right font-mono tabular-nums`}
                  >
                    {row.confidence === null ? "—" : row.confidence.toFixed(2)}
                    {row.band && (
                      <span className="ml-2 text-xs uppercase tracking-widest text-muted-foreground">
                        {row.band}
                      </span>
                    )}
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
