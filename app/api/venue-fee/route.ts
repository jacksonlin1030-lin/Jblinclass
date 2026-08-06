import { NextRequest, NextResponse } from "next/server";
import { updateMonthVenueFee } from "@/lib/store";
import { currentTaipeiMonthBounds } from "@/lib/timezone";

/** Sets (or clears) the current month's venue-fee override. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { monthKey } = currentTaipeiMonthBounds();
    const fee = body.fee === null || body.fee === undefined ? null : Number(body.fee);
    const snapshot = await updateMonthVenueFee(monthKey, fee);
    return NextResponse.json({ monthKey: snapshot.monthKey, venueFeeOverride: snapshot.venueFeeOverride });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "更新場地租借費用失敗" }, { status: 500 });
  }
}
