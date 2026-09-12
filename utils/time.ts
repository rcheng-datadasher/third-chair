/** The one timezone this repo formats times in (Hong Kong has no DST). */
export const HKT_TIME_ZONE = "Asia/Hong_Kong";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: HKT_TIME_ZONE,
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * Formats a Date or ISO string as a human-readable Hong Kong local time.
 *
 * Stdlib `Intl.DateTimeFormat` only — no date library. Formatting only, no
 * arithmetic, so Hong Kong's lack of daylight saving needs no special
 * handling. Shared by the Slack card (Phase 2) and the dashboard (Phase 6);
 * neither may create a second private formatter.
 *
 * @param value - A `Date` or an ISO 8601 string.
 * @returns The formatted Hong Kong local time.
 */
export function formatHkt(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return formatter.format(date);
}
