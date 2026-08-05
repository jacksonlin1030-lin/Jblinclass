import { NextRequest, NextResponse } from "next/server";
import { getAllSessions } from "@/lib/store";

export async function GET(req: NextRequest) {
  try {
    const studentId = req.nextUrl.searchParams.get("studentId");
    let sessions = await getAllSessions();
    if (studentId) {
      sessions = sessions.filter((s) => s.studentId === studentId);
    }
    return NextResponse.json({ sessions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "讀取上課紀錄失敗" }, { status: 500 });
  }
}
