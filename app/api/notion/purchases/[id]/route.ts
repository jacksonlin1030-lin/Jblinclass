import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "@/lib/config";
import { updatePurchasePayment, updatePurchaseManualOverride } from "@/lib/notion";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const config = readConfig();
    const body = await req.json();

    if (typeof body.paid === "boolean") {
      await updatePurchasePayment(config, params.id, body.paid, body.paidDate ?? null);
    }
    if ("sessionsUsedManualOverride" in body) {
      const value = body.sessionsUsedManualOverride;
      await updatePurchaseManualOverride(config, params.id, value === null ? null : Number(value));
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "更新課程包失敗" }, { status: 500 });
  }
}
