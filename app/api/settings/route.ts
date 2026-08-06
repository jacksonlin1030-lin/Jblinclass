import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/store";
import { isGoogleConnected } from "@/lib/google";

export async function GET() {
  try {
    const [settings, connected] = await Promise.all([getSettings(), isGoogleConnected()]);
    return NextResponse.json({
      settings,
      google: {
        connected,
        clientIdConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        redirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/google/callback",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "讀取設定失敗" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const patch: { lowSessionThreshold?: number; calendarId?: string; defaultVenueRentalFee?: number } = {};
    if (typeof body.lowSessionThreshold === "number") patch.lowSessionThreshold = body.lowSessionThreshold;
    if (typeof body.calendarId === "string") patch.calendarId = body.calendarId;
    if (typeof body.defaultVenueRentalFee === "number") patch.defaultVenueRentalFee = body.defaultVenueRentalFee;
    const settings = await saveSettings(patch);
    return NextResponse.json({ settings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "更新設定失敗" }, { status: 500 });
  }
}
