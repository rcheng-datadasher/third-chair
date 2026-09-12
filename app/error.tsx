"use client";

/**
 * Route error boundary. Keeps a database hiccup looking like this product
 * instead of the stock Next error page on the projector.
 *
 * @param props - Error boundary props supplied by Next.
 * @param props.reset - Re-renders the route segment.
 * @returns The error scene.
 */
export default function RouteError({ reset }: { reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-mono text-sm uppercase tracking-widest text-destructive">
        Feed unavailable
      </p>
      <p className="max-w-prose text-muted-foreground">
        The dashboard could not read from the database. Nothing was changed.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg border px-4 py-2 font-mono text-xs uppercase tracking-widest shadow-retro hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Retry
      </button>
    </main>
  );
}
