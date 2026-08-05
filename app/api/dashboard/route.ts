import { NextResponse } from "next/server";
import { readConfig } from "@/lib/config";
import { listStudents, listPurchases, listClassRecords, getPurchaseManualOverrides } from "@/lib/notion";
import { computeStudentMetrics } from "@/lib/metrics";

export async function GET() {
  try {
    const config = readConfig();
    const students = await listStudents(config);
    const [purchases, classRecords, manualOverrides] = await Promise.all([
      listPurchases(config, students),
      listClassRecords(config),
      getPurchaseManualOverrides(config),
    ]);

    const metrics = computeStudentMetrics(
      students,
      purchases,
      classRecords,
      manualOverrides,
      config.settings.lowSessionThreshold
    );

    return NextResponse.json({ students: metrics });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "讀取儀表板資料失敗" }, { status: 500 });
  }
}
