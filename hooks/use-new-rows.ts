import { useEffect, useRef } from "react";

/**
 * Tracks which row ids appeared since the previous render, so a polled table
 * can flag a freshly arrived row for exactly one poll cycle. Rows present at
 * first paint are never flagged.
 *
 * @param rows - The current rows; each needs a stable `id`.
 * @returns The set of ids that were absent from the previous render.
 */
export function useNewRows<T extends { id: string }>(rows: T[]): Set<string> {
  const seen = useRef<Set<string>>(new Set(rows.map((r) => r.id)));
  const fresh = new Set<string>();
  for (const row of rows) {
    if (!seen.current.has(row.id)) fresh.add(row.id);
  }
  useEffect(() => {
    seen.current = new Set(rows.map((r) => r.id));
  }, [rows]);
  return fresh;
}
