/**
 * Throwaway exercise script — calls live Google APIs as user A.
 *
 * Not exported/imported elsewhere. Run directly with `bun lib/calendar/smoke.ts`
 * (bun auto-loads the root `.env`). Checks A's token scope first, then
 * exercises the real `checkConflicts` (D-01, CAL-01).
 */

import { prisma } from "../db";
import { checkConflicts } from "./freebusy";
import { getGoogleAuth } from "./google-client";
import { toHktRfc3339 } from "./hkt-rfc3339";

const FREEBUSY_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.events.freebusy",
];
const INSERT_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

async function main() {
  const a = await prisma.user.findFirstOrThrow({
    where: { google_refresh_token: { not: null } },
  });

  // Self-check: toHktRfc3339 must produce the exact expected offset string.
  const hktCheck = toHktRfc3339(new Date("2026-09-17T07:00:00.000Z"));
  if (hktCheck !== "2026-09-17T15:00:00+08:00") {
    console.log(`[smoke] hkt-rfc3339 FAILED got=${hktCheck}`);
    process.exitCode = 1;
    return;
  }

  // Scope check, before any Calendar call.
  const auth = await getGoogleAuth(a.id);
  const { token } = await auth.getAccessToken();
  if (!token) {
    throw new Error("[smoke] failed to obtain an access token");
  }
  const info = await auth.getTokenInfo(token);
  const scopes = info.scopes ?? [];
  console.log(`[scope-check] scopes=${scopes.join(" ")}`);

  const hasFreebusy = scopes.some((s) => FREEBUSY_SCOPES.includes(s));
  const hasInsert = scopes.some((s) => INSERT_SCOPES.includes(s));

  if (hasFreebusy && hasInsert) {
    console.log(`[scope-check] PASS scopes=${scopes.join(" ")}`);
  } else {
    const missing = [!hasFreebusy && "freebusy", !hasInsert && "insert"]
      .filter(Boolean)
      .join(",");
    console.log(
      `[scope-check] FAIL missing=${missing} scopes=${scopes.join(" ")}`,
    );
    process.exitCode = 1;
    return;
  }

  // First live call, through the real checkConflicts.
  const slots = await checkConflicts(
    a.id,
    "2026-09-17T00:00:00+08:00",
    "2026-09-18T00:00:00+08:00",
  );
  console.log(`[smoke] freebusy ok slots=${slots.length}`);
}

main()
  .catch((err) => {
    console.log(
      "[smoke] FAILED",
      err?.response?.status ?? err?.status,
      err?.message,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
