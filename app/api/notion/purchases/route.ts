import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "@/lib/config";
import { listStudents, listPurchases, createPurchase } from "@/lib/notion";
import { DEFAULT_SESSIONS_PER_PACKAGE } from "@/lib/notion-schema";

export async function GET(req: NextRequest) {
  try {
    const config = readConfig();
    const studentId = req.nextUrl.searchParams.get("studentId");
    const students = await listStudents(config);
    let purchases = await listPurchases(config, students);
    if (studentId) {
      purchases = purchases.filter((p) => p.studentId === studentId);
    }
    return NextResponse.json({ purchases });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "讀取課程包購買紀錄失敗" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const config = readConfig();
    const body = await req.json();
    if (!body.studentId || !body.purchaseDate || !body.pricePerSession) {
      return NextResponse.json(
        { error: "缺少必要欄位：studentId, purchaseDate, pricePerSession" },
        { status: 400 }
      );
    }
    await createPurchase(config, {
      studentId: body.studentId,
      purchaseDate: body.purchaseDate,
      sessionsPurchased: body.sessionsPurchased ?? DEFAULT_SESSIONS_PER_PACKAGE,
      pricePerSession: body.pricePerSession,
      paid: Boolean(body.paid),
      paidDate: body.paidDate ?? null,
      note: body.note ?? "",
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "新增課程包購買紀錄失敗" }, { status: 500 });
  }
}
