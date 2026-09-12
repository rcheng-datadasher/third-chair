/**
 * Formats a `Date` as an RFC 3339 timestamp with an explicit `+08:00`
 * offset (Hong Kong local time).
 *
 * Hong Kong observes no daylight saving, so a fixed +8h offset is always
 * correct. Stdlib only, no date library (D-08). Lives in `lib/calendar`,
 * not `utils/time.ts` — that module is display-only formatting shared with
 * Slack/dashboard, not an RFC 3339 wire-format helper (D-16 ownership).
 *
 * @param d - The `Date` to format.
 * @returns An RFC 3339 string ending in `+08:00`, e.g.
 *   `2026-09-17T15:00:00+08:00`.
 * @throws If `d` is an invalid `Date`.
 */
export function toHktRfc3339(d: Date): string {
  if (Number.isNaN(d.getTime())) {
    throw new Error("toHktRfc3339: invalid Date");
  }
  const hkt = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return hkt.toISOString().replace(/\.\d{3}Z$/, "+08:00");
}
