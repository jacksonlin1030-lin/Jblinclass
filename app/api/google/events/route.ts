import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "@/lib/config";
import { listCalendarEvents } from "@/lib/google";

export async function GET(req: NextRequest) {
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "缺少 start / end 參數 (YYYY-MM-DD)" }, { status: 400 });
  }
  try {
    const config = readConfig();
    const events = await listCalendarEvents(config, start, end);
    return NextResponse.json({ events });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "讀取 Google 日曆失敗" }, { status: 500 });
  }
}
