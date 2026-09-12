/**
 * Throwaway exercise script — calls live Google APIs as user A.
 *
 * Not exported/imported elsewhere. Run directly with `bun lib/calendar/smoke.ts`
 * (bun auto-loads the root `.env`). Checks A's token scope first, then makes
 * one live `freebusy.query` call (D-01).
 */
import { prisma } from "../db";
import { getCalendarClient, getGoogleAuth } from "./google-client";

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

  // First live call.
  const calendar = await getCalendarClient(a.id);
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: "2026-09-17T00:00:00+08:00",
      timeMax: "2026-09-18T00:00:00+08:00",
      timeZone: "Asia/Hong_Kong",
      items: [{ id: "primary" }],
    },
  });
  console.log(JSON.stringify(res.data.calendars));
  console.log("[smoke] freebusy ok");
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
