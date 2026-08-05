import { NextResponse } from "next/server";
import { getStudents, getPurchases, getAllSessions, getSettings, getLastRun } from "@/lib/store";
import { computeStudentMetrics } from "@/lib/metrics";

// Reads live KV data on every request — must not be statically cached at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [students, purchases, sessions, settings, lastRun] = await Promise.all([
      getStudents(),
      getPurchases(),
      getAllSessions(),
      getSettings(),
      getLastRun(),
    ]);

    const metrics = computeStudentMetrics(
      students.filter((s) => s.active),
      purchases,
      sessions,
      settings.lowSessionThreshold
    );

    return NextResponse.json({ students: metrics, lastRun });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "讀取儀表板資料失敗" }, { status: 500 });
  }
}
