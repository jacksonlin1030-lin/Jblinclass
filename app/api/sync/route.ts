import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "@/lib/config";
import { performSync } from "@/lib/sync";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.startDate || !body.endDate) {
      return NextResponse.json({ error: "缺少 startDate / endDate" }, { status: 400 });
    }
    const config = readConfig();
    const result = await performSync(config, body.startDate, body.endDate);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "同步失敗" }, { status: 500 });
  }
}
