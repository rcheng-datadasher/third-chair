/**
 * Throwaway exercise script — calls live Google APIs as user A.
 *
 * Not exported/imported elsewhere. Run directly with `bun lib/calendar/smoke.ts`
 * (bun auto-loads the root `.env`). Checks A's token scope first, then
 * exercises the real `checkConflicts` (D-01, CAL-01) and `createCalendarEvent`
 * against the seeded Proposal (CAL-02..05), calling it twice to prove the 409
 * idempotency fallback (CAL-04), then re-runs `checkConflicts` to confirm the
 * created event shows up as a real `+08:00` busy block. Side effect: the
 * first run ever for the seeded Proposal id creates a real event and emails
 * its participant; every later run resolves both calls through the 409
 * fallback. After Phase 10's cleanup deletes that event, this script throws
 * `CancelledEventError` by design — that is the intended behavior, not a bug.
 */

import { prisma } from "../db";
import { createCalendarEvent } from "./create-event";
import { deriveEventId } from "./event-id";
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

  // The seeded Proposal — Phase 2's round trip creates other pending
  // Proposals in the same Postgres, so select by its unique dedupe_key.
  const proposal = await prisma.proposal.findUniqueOrThrow({
    where: { dedupe_key: "phase1-seed-proposal" },
  });
  const expectedEventId = deriveEventId(proposal.id);

  // Two sequential calls: proves the 409 -> events.get fallback is
  // idempotent (CAL-04), not just that the first insert worked.
  let idempotencyOk = true;
  for (let i = 0; i < 2; i++) {
    const created = await createCalendarEvent(proposal, a.id);
    console.log(
      `[smoke] eventId=${created.eventId} expected=${expectedEventId} htmlLink=${created.htmlLink} meetLink=${created.meetLink}`,
    );
    if (created.eventId !== expectedEventId) {
      console.log("[smoke] eventId mismatch");
      idempotencyOk = false;
    }
  }
  if (!idempotencyOk) {
    console.log("[smoke] idempotency FAILED");
    process.exitCode = 1;
    return;
  }
  console.log(`[smoke] idempotent OK eventId=${expectedEventId}`);

  // Re-check freebusy: the seeded event should now show up as a real busy
  // block, closing success criterion 1 against a real (not empty) result.
  const slotsAfter = await checkConflicts(
    a.id,
    "2026-09-17T00:00:00+08:00",
    "2026-09-18T00:00:00+08:00",
  );
  const proposalStart = proposal.start.getTime();
  const proposalEnd = proposal.end.getTime();
  const covering = slotsAfter.find(
    (slot) =>
      new Date(slot.startIso).getTime() <= proposalStart &&
      new Date(slot.endIso).getTime() >= proposalEnd,
  );
  if (covering) {
    console.log(
      `[smoke] busy-block OK ${covering.startIso}..${covering.endIso}`,
    );
  } else {
    console.log("[smoke] busy-block FAILED");
    process.exitCode = 1;
  }
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
