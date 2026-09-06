import {
  LedgerEntry,
  MonthlyLedgerSummary,
  Purchase,
  Student,
  TEACHING_INCOME_CATEGORY_ID,
  Transaction,
} from "./types";

/**
 * Synthesizes one teaching-income ledger row per PAID course-package
 * purchase (the date used is the payment date, falling back to the purchase
 * date for old records paid before `paidDate` was tracked). These are never
 * persisted — every read of the 記帳 ledger recomputes them straight from
 * `lib/store.ts`'s student/purchase data, so marking a purchase paid (or
 * correcting its price) in 學生管理 shows up here immediately with nothing
 * to keep in sync by hand.
 */
export function teachingIncomeEntries(students: Student[], purchases: Purchase[]): LedgerEntry[] {
  const studentsById = new Map(students.map((s) => [s.id, s]));
  return purchases
    .filter((p) => p.paid)
    .map((p) => {
      const student = studentsById.get(p.studentId);
      return {
        id: `teaching:${p.id}`,
        type: "income",
        date: p.paidDate ?? p.purchaseDate,
        amount: p.sessionsPurchased * p.pricePerSession,
        categoryId: TEACHING_INCOME_CATEGORY_ID,
        note: student ? `${student.name}的課程包款` : "課程包款",
        source: "teaching-sync",
        studentId: p.studentId,
        studentName: student?.name,
      };
    });
}

/** Combines manual transactions with derived teaching-income rows into one
 *  ledger, newest first. */
export function mergeLedger(manual: Transaction[], teaching: LedgerEntry[]): LedgerEntry[] {
  const manualEntries: LedgerEntry[] = manual.map((t) => ({ ...t, source: "manual" }));
  return [...manualEntries, ...teaching].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Totals + per-category breakdown for one month, out of a full (all-time)
 *  merged ledger — callers filter by monthKey here rather than upstream so
 *  the same full ledger can back several months' summaries without re-fetching. */
export function computeMonthlySummary(monthKey: string, entries: LedgerEntry[]): MonthlyLedgerSummary {
  const inMonth = entries.filter((e) => e.date.startsWith(monthKey));
  const totalIncome = inMonth.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = inMonth.filter((e) => e.type === "expense").reduce((sum, e) => sum + e.amount, 0);

  const byCategoryMap = new Map<string, { type: "income" | "expense"; amount: number }>();
  for (const e of inMonth) {
    const existing = byCategoryMap.get(e.categoryId);
    byCategoryMap.set(e.categoryId, { type: e.type, amount: (existing?.amount ?? 0) + e.amount });
  }
  const byCategory = Array.from(byCategoryMap.entries())
    .map(([categoryId, v]) => ({ categoryId, ...v }))
    .sort((a, b) => b.amount - a.amount);

  return { monthKey, totalIncome, totalExpense, net: totalIncome - totalExpense, byCategory };
}
