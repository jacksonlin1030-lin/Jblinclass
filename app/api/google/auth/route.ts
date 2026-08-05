import { NextResponse } from "next/server";
import { readConfig } from "@/lib/config";
import { getGoogleAuthUrl } from "@/lib/google";

export async function GET() {
  try {
    const config = readConfig();
    const url = getGoogleAuthUrl(config);
    return NextResponse.redirect(url);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "無法產生 Google 授權連結" }, { status: 400 });
  }
}
