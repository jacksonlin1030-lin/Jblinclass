import { NextRequest, NextResponse } from "next/server";
import { readConfig, redactConfig, writeConfig } from "@/lib/config";

export async function GET() {
  const config = readConfig();
  return NextResponse.json(redactConfig(config));
}

/**
 * Accepts a partial config patch, e.g.
 * { notion: { token, studentsDbId, purchasesDbId, classRecordsDbId } }
 * { google: { clientId, clientSecret, redirectUri } }
 * { settings: { lowSessionThreshold, calendarId } }
 * Empty-string secret fields are ignored so re-saving the form (which shows
 * masked placeholders) doesn't wipe out an already-saved token.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const patch: any = {};
    if (body.notion) {
      patch.notion = { ...body.notion };
      if (!patch.notion.token) delete patch.notion.token;
    }
    if (body.google) {
      patch.google = { ...body.google };
      if (!patch.google.clientSecret) delete patch.google.clientSecret;
    }
    if (body.settings) {
      patch.settings = { ...body.settings };
    }

    const next = writeConfig(patch);
    return NextResponse.json(redactConfig(next));
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "更新設定失敗" }, { status: 500 });
  }
}
