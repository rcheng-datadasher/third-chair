import { HKT_TIME_ZONE } from "@/utils/time";

/**
 * Formats a poll timestamp as an HKT wall clock for the status strip. Client
 * only: the value is the browser's own poll time, which never exists on the
 * server, so this cannot cause a hydration mismatch.
 *
 * @param ms - Epoch milliseconds of the last successful poll.
 * @returns `HH:MM:SS` in Hong Kong time.
 */
function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", {
    timeZone: HKT_TIME_ZONE,
    hour12: false,
  });
}

/**
 * Status strip above a polled table: row count, the last poll time and a live
 * indicator, or an unavailable notice while the poll is failing. Announced to
 * assistive tech as a polite live region.
 *
 * @param props - Status props.
 * @param props.count - Number of rows currently shown.
 * @param props.noun - Singular noun for the rows, e.g. "proposal".
 * @param props.isError - Whether the latest poll failed.
 * @param props.updatedAt - Epoch ms of the last successful poll, or null before the first one.
 * @returns The status strip.
 */
export function FeedStatus({
  count,
  noun,
  isError,
  updatedAt,
}: {
  count: number;
  noun: string;
  isError: boolean;
  updatedAt: number | null;
}) {
  return (
    <div
      aria-live="polite"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 font-mono text-xs uppercase tracking-widest text-muted-foreground"
    >
      <span>
        <span className="tabular-nums text-foreground">{count}</span>{" "}
        {count === 1 ? noun : `${noun}s`}
      </span>
      <span className="flex items-center gap-4">
        {updatedAt !== null && (
          <span className="tabular-nums">Updated {clock(updatedAt)}</span>
        )}
        {isError ? (
          <span className="flex items-center gap-2 text-destructive">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-destructive"
            />
            Feed unavailable
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-success"
            />
            Live · 4s
          </span>
        )}
      </span>
    </div>
  );
}
