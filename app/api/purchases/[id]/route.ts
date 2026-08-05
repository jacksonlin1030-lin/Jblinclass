import { NextRequest, NextResponse } from "next/server";
import { updatePurchase } from "@/lib/store";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const patch: { paid?: boolean; paidDate?: string | null; sessionsUsedManualOverride?: number | null } = {};
    if (typeof body.paid === "boolean") {
      patch.paid = body.paid;
      patch.paidDate = body.paidDate ?? null;
    }
    if ("sessionsUsedManualOverride" in body) {
      patch.sessionsUsedManualOverride =
        body.sessionsUsedManualOverride === null ? null : Number(body.sessionsUsedManualOverride);
    }
    await updatePurchase(params.id, patch);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "更新課程包失敗" }, { status: 500 });
  }
}
