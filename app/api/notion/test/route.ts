import { NextResponse } from "next/server";
import { readConfig } from "@/lib/config";
import { testNotionConnection } from "@/lib/notion";

export async function GET() {
  try {
    const config = readConfig();
    const result = await testNotionConnection(config);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Notion 連線測試失敗" }, { status: 500 });
  }
}
