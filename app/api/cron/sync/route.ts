import { NextRequest, NextResponse } from "next/server";
import { performSync } from "@/lib/sync";

// Scheduled by vercel.json: "0 14 * * *" = 22:00 Asia/Taipei daily (UTC+8, no DST).
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await performSync("cron");
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "同步失敗" }, { status: 500 });
  }
}
