import { NextResponse } from "next/server";
import {
  getStudents,
  getPurchases,
  getAllSessions,
  getSettings,
  getLastRun,
  getMonthSnapshot,
} from "@/lib/store";
import { computeStudentMetrics, computeMonthlyProjection } from "@/lib/metrics";
import { currentTaipeiMonthBounds } from "@/lib/timezone";

// Reads live KV data on every request — must not be statically cached at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { monthKey, today } = currentTaipeiMonthBounds();

    const [students, purchases, allSessions, settings, lastRun, monthSnapshot] = await Promise.all([
      getStudents(),
      getPurchases(),
      getAllSessions(),
      getSettings(),
      getLastRun(),
      getMonthSnapshot(monthKey),
    ]);

    const activeStudents = students.filter((s) => s.active);
    const confirmedSessions = allSessions.filter((s) => s.date <= today);

    const metrics = computeStudentMetrics(activeStudents, purchases, confirmedSessions, settings.lowSessionThreshold);

    const venueFeeIsOverride = monthSnapshot?.venueFeePerSessionOverride != null;
    const venueFeePerSession = monthSnapshot?.venueFeePerSessionOverride ?? settings.defaultVenueFeePerSession;
    const projection = computeMonthlyProjection(
      activeStudents,
      purchases,
      allSessions,
      monthKey,
      today,
      venueFeePerSession,
      venueFeeIsOverride
    );

    return NextResponse.json({ students: metrics, lastRun, projection });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "讀取儀表板資料失敗" }, { status: 500 });
  }
}
