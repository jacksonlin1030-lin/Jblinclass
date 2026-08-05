import { google } from "googleapis";
import { CalendarEvent, GoogleTokens } from "./types";
import { getGoogleTokens, saveGoogleTokens } from "./store";

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`環境變數 ${name} 尚未設定，請到 Vercel 專案設定加入`);
  return value;
}

function getRedirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/google/callback";
}

export function getOAuth2Client() {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

export function getGoogleAuthUrl(): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // ensures we always get a refresh_token
    scope: SCOPES,
  });
}

/** Exchanges the OAuth `code` for tokens and persists them to the store. */
export async function exchangeCodeForTokens(code: string): Promise<void> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  const existing = await getGoogleTokens();
  const merged: GoogleTokens = {
    ...existing,
    ...tokens,
    // Keep the existing refresh_token if Google didn't send a new one this time.
    refresh_token: tokens.refresh_token ?? existing?.refresh_token ?? null,
  };
  await saveGoogleTokens(merged);
}

export async function isGoogleConnected(): Promise<boolean> {
  const tokens = await getGoogleTokens();
  return Boolean(tokens?.refresh_token);
}

/** Returns an authenticated client, refreshing + persisting the access token if it rotated. */
async function getAuthenticatedClient() {
  const tokens = await getGoogleTokens();
  if (!tokens?.refresh_token) {
    throw new Error("尚未完成 Google 日曆授權，請先到 /settings 點選「連接 Google 日曆」");
  }
  const client = getOAuth2Client();
  client.setCredentials(tokens);
  client.on("tokens", (newTokens) => {
    const merged: GoogleTokens = { ...tokens, ...newTokens };
    saveGoogleTokens(merged).catch((err) =>
      console.error("Failed to persist refreshed Google tokens:", err)
    );
  });
  return client;
}

/** Lists calendar events whose start date falls within [startDate, endDate] (inclusive, YYYY-MM-DD). */
export async function listCalendarEvents(
  startDate: string,
  endDate: string,
  calendarId: string
): Promise<CalendarEvent[]> {
  const auth = await getAuthenticatedClient();
  const calendar = google.calendar({ version: "v3", auth });

  const timeMin = new Date(`${startDate}T00:00:00`).toISOString();
  const timeMax = new Date(`${endDate}T23:59:59`).toISOString();

  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;
  do {
    const res = await calendar.events.list({
      calendarId: calendarId || "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      pageToken,
      maxResults: 250,
    });
    for (const item of res.data.items ?? []) {
      if (!item.id) continue;
      const start = item.start?.dateTime ?? item.start?.date;
      if (!start) continue;
      events.push({
        id: item.id,
        title: item.summary ?? "(無標題)",
        date: start.slice(0, 10), // YYYY-MM-DD
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return events;
}
