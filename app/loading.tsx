/**
 * Route loading state shown while a scene's first server read is in flight.
 *
 * @returns The loading scene.
 */
export default function Loading() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
        Loading…
      </p>
    </main>
  );
}
