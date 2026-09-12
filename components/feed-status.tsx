/**
 * One-line status strip above a polled table: row count plus a live indicator,
 * or an unavailable notice when the poll is failing. Read-only.
 *
 * @param props - Status props.
 * @param props.count - Number of rows currently shown.
 * @param props.noun - Singular noun for the rows, e.g. "proposal".
 * @param props.isError - Whether the latest poll failed.
 * @returns The status strip.
 */
export function FeedStatus({
  count,
  noun,
  isError,
}: {
  count: number;
  noun: string;
  isError: boolean;
}) {
  return (
    <div className="flex items-center justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground">
      <span>
        <span className="tabular-nums text-foreground">{count}</span>{" "}
        {count === 1 ? noun : `${noun}s`}
      </span>
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
          <span aria-hidden="true" className="size-2 rounded-full bg-success" />
          Live · refreshes every 4s
        </span>
      )}
    </div>
  );
}
