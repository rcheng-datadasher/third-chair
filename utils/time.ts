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

/** Lowercase weekday names, Sunday first — the canonical order used for weekday-index arithmetic. */
export const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/** One of `WEEKDAYS`. */
export type Weekday = (typeof WEEKDAYS)[number];

/**
 * The relative-date hints `extractIntents` may produce for a message: at
 * most one of a named weekday or a day offset, plus an optional clock time.
 * The model never outputs a calendar date (D-12); this is resolved in code.
 */
export interface WhenHint {
  weekday: Weekday | null;
  day_offset: number | null;
  time_of_day: string | null;
}

const hktDatePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: HKT_TIME_ZONE,
  weekday: "long",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * Reads a `Date`'s Hong Kong local calendar date, weekday name and
 * HH:MM time via a single `Intl.DateTimeFormat` pass (no manual UTC-offset
 * arithmetic, which double-counts around midnight boundaries).
 *
 * @param now - The instant to read.
 * @returns The HKT calendar date (`YYYY-MM-DD`), lowercase weekday name,
 *   and `HH:MM` time.
 */
export function hktDateParts(now: Date): {
  isoDate: string;
  weekday: Weekday;
  time: string;
} {
  const parts = hktDatePartsFormatter.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  const weekday = get("weekday").toLowerCase() as Weekday;

  return {
    isoDate: `${year}-${month}-${day}`,
    weekday,
    time: `${hour}:${minute}`,
  };
}

/**
 * Resolves a model-produced relative-date hint (weekday name and/or day
 * offset, plus an optional clock time) into a concrete HKT ISO instant.
 *
 * Deterministic, code-only resolution (D-12, D-13) — the model never sees
 * or produces a calendar date. "Next Friday" always means the first Friday
 * strictly after today, never today itself, even when today is Friday.
 *
 * ponytail: a missing time defaults to 10:00 and a missing day defaults to
 * tomorrow — both first guesses. `bucketConfidence` caps a hint missing
 * either at "medium" so the Edit & approve modal is where a human corrects
 * it; upgrade path is that modal, not a smarter default here.
 *
 * @param now - The instant the run started.
 * @param hint - The extracted weekday/day_offset/time_of_day hint.
 * @returns An ISO 8601 instant with the `+08:00` HKT offset.
 */
export function resolveStartIso(now: Date, hint: WhenHint): string {
  const { isoDate, weekday: todayWeekday } = hktDateParts(now);
  const [year, month, day] = isoDate.split("-").map(Number);

  let daysToAdd: number;
  if (hint.weekday != null) {
    const todayIndex = WEEKDAYS.indexOf(todayWeekday);
    const targetIndex = WEEKDAYS.indexOf(hint.weekday);
    const delta = (targetIndex - todayIndex + 7) % 7;
    daysToAdd = delta === 0 ? 7 : delta;
  } else {
    daysToAdd = hint.day_offset ?? 1;
  }

  const target = new Date(Date.UTC(year, month - 1, day + daysToAdd));
  const targetIsoDate = target.toISOString().slice(0, 10);
  const time = hint.time_of_day ?? "10:00";

  return `${targetIsoDate}T${time}:00+08:00`;
}
