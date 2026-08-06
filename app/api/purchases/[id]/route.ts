import { NextRequest, NextResponse } from "next/server";
import { updatePurchase } from "@/lib/store";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const patch: {
      paid?: boolean;
      paidDate?: string | null;
      sessionsUsedManualOverride?: number | null;
      purchaseDate?: string;
      sessionsPurchased?: number;
      pricePerSession?: number;
    } = {};

    if (typeof body.paid === "boolean") {
      patch.paid = body.paid;
      patch.paidDate = body.paidDate ?? null;
    }
    if ("sessionsUsedManualOverride" in body) {
      patch.sessionsUsedManualOverride =
        body.sessionsUsedManualOverride === null ? null : Number(body.sessionsUsedManualOverride);
    }
    if (typeof body.purchaseDate === "string") patch.purchaseDate = body.purchaseDate;
    if (typeof body.sessionsPurchased === "number") patch.sessionsPurchased = body.sessionsPurchased;
    if (typeof body.pricePerSession === "number") patch.pricePerSession = body.pricePerSession;

    await updatePurchase(params.id, patch);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "更新課程包失敗" }, { status: 500 });
  }
}
