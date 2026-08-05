import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "@/lib/config";
import { listClassRecords } from "@/lib/notion";

export async function GET(req: NextRequest) {
  try {
    const config = readConfig();
    const studentId = req.nextUrl.searchParams.get("studentId");
    let records = await listClassRecords(config);
    if (studentId) {
      records = records.filter((r) => r.studentId === studentId);
    }
    records.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
    return NextResponse.json({ records });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "讀取上課紀錄失敗" }, { status: 500 });
  }
}
