import { NextRequest, NextResponse } from "next/server";
import { addTransaction, getPurchases, getStudents, getTransactions } from "@/lib/store";
import { computeMonthlySummary, mergeLedger, teachingIncomeEntries } from "@/lib/expenseMetrics";
import { currentTaipeiMonthBounds } from "@/lib/timezone";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/types";

// Reads live KV + student/purchase data on every request — must not be
// statically cached at build time.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const monthKey = req.nextUrl.searchParams.get("month") ?? currentTaipeiMonthBounds().monthKey;

    const [manual, students, purchases] = await Promise.all([getTransactions(), getStudents(), getPurchases()]);
    const ledger = mergeLedger(manual, teachingIncomeEntries(students, purchases));
    const entries = ledger.filter((e) => e.date.startsWith(monthKey));
    const summary = computeMonthlySummary(monthKey, ledger);

    return NextResponse.json({
      monthKey,
      entries,
      summary,
      categories: { expense: EXPENSE_CATEGORIES, income: INCOME_CATEGORIES },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "讀取記帳資料失敗" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.type !== "income" && body.type !== "expense") {
      return NextResponse.json({ error: "type 必須是 income 或 expense" }, { status: 400 });
    }
    if (!body.date || typeof body.amount !== "number" || !body.categoryId) {
      return NextResponse.json({ error: "缺少必要欄位：date, amount, categoryId" }, { status: 400 });
    }
    const transaction = await addTransaction({
      type: body.type,
      date: body.date,
      amount: body.amount,
      categoryId: body.categoryId,
      note: body.note ?? "",
    });
    return NextResponse.json({ transaction });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "新增交易失敗" }, { status: 500 });
  }
}
