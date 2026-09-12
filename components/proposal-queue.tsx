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

/**
 * Read-only proposal queue that polls every 4 s, including in background tabs.
 *
 * @param props - Component props.
 * @param props.initialData - Server-rendered rows for the first paint.
 * @returns The queue table.
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
    <Card className="p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>STATUS</TableHead>
            <TableHead>TITLE</TableHead>
            <TableHead>START (HKT)</TableHead>
            <TableHead className="text-right">CONFIDENCE</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isError && (
            <TableRow>
              <TableCell colSpan={4} className="text-destructive">
                FEED UNAVAILABLE
              </TableCell>
            </TableRow>
          )}
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                NO PROPOSALS YET
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow key={row.id} data-status={row.status}>
                <TableCell>
                  <StatusChip status={row.status} />
                </TableCell>
                <TableCell>{row.title}</TableCell>
                <TableCell className="font-mono tabular-nums">
                  {row.startHkt}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.confidence === null ? "—" : row.confidence.toFixed(2)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
