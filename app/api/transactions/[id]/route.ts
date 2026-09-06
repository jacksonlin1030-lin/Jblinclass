import { NextRequest, NextResponse } from "next/server";
import { deleteTransaction, updateTransaction } from "@/lib/store";

/** Teaching-income rows are synthesized live from paid purchases (id prefix
 *  `teaching:`) and never stored as a Transaction — they can only be fixed
 *  by correcting the underlying purchase in 學生管理. */
function assertManual(id: string) {
  if (id.startsWith("teaching:")) {
    throw new Error("這筆是從學生收款資料自動帶入的教學收入，請到「學生管理」修改原始購買紀錄");
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertManual(params.id);
    const body = await req.json();
    const patch: Partial<{ type: "income" | "expense"; date: string; amount: number; categoryId: string; note: string }> = {};
    if (body.type === "income" || body.type === "expense") patch.type = body.type;
    if (typeof body.date === "string") patch.date = body.date;
    if (typeof body.amount === "number") patch.amount = body.amount;
    if (typeof body.categoryId === "string") patch.categoryId = body.categoryId;
    if (typeof body.note === "string") patch.note = body.note;

    await updateTransaction(params.id, patch);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "更新交易失敗" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertManual(params.id);
    await deleteTransaction(params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "刪除交易失敗" }, { status: 400 });
  }
}
