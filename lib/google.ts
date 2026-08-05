import { google } from "googleapis";
import { AppConfig, CalendarEvent, GoogleTokens } from "./types";
import { writeConfig } from "./config";

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

export function getOAuth2Client(config: AppConfig) {
  if (!config.google.clientId || !config.google.clientSecret) {
    throw new Error("Google OAuth Client ID / Secret 尚未設定，請先到 /settings 填寫");
  }
  const client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
  if (config.google.tokens) {
    client.setCredentials(config.google.tokens);
  }
  return client;
}

export function getGoogleAuthUrl(config: AppConfig): string {
  const client = getOAuth2Client(config);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // ensures we always get a refresh_token
    scope: SCOPES,
  });
}

/** Exchanges the OAuth `code` for tokens and persists them to the local config file. */
export async function exchangeCodeForTokens(config: AppConfig, code: string): Promise<void> {
  const client = getOAuth2Client(config);
  const { tokens } = await client.getToken(code);
  const merged: GoogleTokens = {
    ...config.google.tokens,
    ...tokens,
    // Keep the existing refresh_token if Google didn't send a new one this time.
    refresh_token: tokens.refresh_token ?? config.google.tokens?.refresh_token ?? null,
  };
  writeConfig({ google: { ...config.google, tokens: merged } });
}

/** Returns an authenticated client, refreshing + persisting the access token if it rotated. */
async function getAuthenticatedClient(config: AppConfig) {
  const client = getOAuth2Client(config);
  if (!config.google.tokens?.refresh_token) {
    throw new Error("尚未完成 Google 日曆授權，請先到 /settings 點選「連接 Google 日曆」");
  }
  client.on("tokens", (tokens) => {
    const merged: GoogleTokens = { ...config.google.tokens, ...tokens };
    writeConfig({ google: { ...config.google, tokens: merged } });
  });
  return client;
}

/** Lists calendar events whose start date falls within [startDate, endDate] (inclusive, YYYY-MM-DD). */
export async function listCalendarEvents(
  config: AppConfig,
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  const auth = await getAuthenticatedClient(config);
  const calendar = google.calendar({ version: "v3", auth });

  const timeMin = new Date(`${startDate}T00:00:00`).toISOString();
  const timeMax = new Date(`${endDate}T23:59:59`).toISOString();

  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;
  do {
    const res = await calendar.events.list({
      calendarId: config.settings.calendarId || "primary",
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
