import { google } from "googleapis";
import { config } from "../config";
import { prisma } from "../db";

/**
 * Builds an authenticated OAuth2 client for the given user, using their
 * stored Google refresh token.
 *
 * @param userId - The user whose stored refresh token authenticates the client.
 * @returns An `OAuth2Client` with credentials set from the user's refresh token.
 * @throws If the user has no `google_refresh_token` on file (D-15) — never
 *   falls back to another user's token.
 */
export async function getGoogleAuth(userId: string) {
  const { google_refresh_token: refreshToken } =
    await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { google_refresh_token: true },
    });
  if (!refreshToken) {
    throw new Error(
      `User ${userId} has no Google refresh token; cannot call Google Calendar`,
    );
  }
  const oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

/**
 * Builds a Calendar v3 client authenticated as the given user.
 *
 * @param userId - The user whose stored refresh token authenticates the client.
 * @returns A `calendar_v3.Calendar` client. Reused by Phase 10 for demo cleanup.
 * @throws If the user has no Google refresh token (see {@link getGoogleAuth}).
 */
export async function getCalendarClient(userId: string) {
  const auth = await getGoogleAuth(userId);
  return google.calendar({ version: "v3", auth });
}
