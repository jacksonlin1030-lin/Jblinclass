import { NextResponse } from "next/server";
import { readConfig } from "@/lib/config";
import { listStudents } from "@/lib/notion";

export async function GET() {
  try {
    const config = readConfig();
    const students = await listStudents(config);
    return NextResponse.json({ students });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "讀取學生資料失敗" }, { status: 500 });
  }
}
