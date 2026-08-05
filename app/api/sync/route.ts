import { NextResponse } from "next/server";
import { performSync } from "@/lib/sync";

/** Manual "立即同步" trigger from the dashboard — always syncs the current month. */
export async function POST() {
  try {
    const summary = await performSync("manual");
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "同步失敗" }, { status: 500 });
  }
}
