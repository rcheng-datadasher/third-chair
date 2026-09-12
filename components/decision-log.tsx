"use client";

import { useQuery } from "@tanstack/react-query";
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
 * Reason and message text render as plain JSX text so React escapes them.
 *
 * @param props - Component props.
 * @param props.initialData - Server-rendered rows for the first paint.
 * @returns The log table.
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
    <Card className="p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>VERDICT</TableHead>
            <TableHead>WHEN (HKT)</TableHead>
            <TableHead className="text-right">CONFIDENCE</TableHead>
            <TableHead>AGENT REASON</TableHead>
            <TableHead>MESSAGE</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isError && (
            <TableRow>
              <TableCell colSpan={5} className="text-destructive">
                FEED UNAVAILABLE
              </TableCell>
            </TableRow>
          )}
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                NO DECISIONS YET
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow key={row.id} data-verdict={row.verdict}>
                <TableCell>
                  <StatusChip status={row.verdict} />
                </TableCell>
                <TableCell className="font-mono tabular-nums">
                  {row.whenHkt}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.confidence === null ? "—" : row.confidence.toFixed(2)}
                </TableCell>
                <TableCell className="max-w-md whitespace-normal">
                  {row.reason}
                </TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">
                  {row.messageText}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
