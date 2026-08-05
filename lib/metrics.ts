import { ClassRecord, Purchase, Student, StudentMetrics } from "./types";

/**
 * Computes the per-student dashboard row. "Active package" is the first
 * (oldest) purchase that still has sessions remaining — matching the FIFO
 * allocation used during sync. If every package is full, the most recent
 * package is treated as active (mirrors lib/sync.ts's overQuota fallback).
 */
export function computeStudentMetrics(
  students: Student[],
  purchases: Purchase[],
  classRecords: ClassRecord[],
  manualOverrides: Map<string, number | null>,
  lowSessionThreshold: number
): StudentMetrics[] {
  const purchasesByStudent = new Map<string, Purchase[]>();
  for (const p of purchases) {
    const list = purchasesByStudent.get(p.studentId) ?? [];
    list.push(p);
    purchasesByStudent.set(p.studentId, list);
  }
  // Ensure oldest-first ordering per student (purchases arrive pre-sorted, but be defensive).
  Array.from(purchasesByStudent.values()).forEach((list) => {
    list.sort((a, b) => (a.purchaseDate < b.purchaseDate ? -1 : 1));
  });

  const autoUsedByPurchase = new Map<string, number>();
  for (const r of classRecords) {
    if (!r.purchaseId) continue;
    autoUsedByPurchase.set(r.purchaseId, (autoUsedByPurchase.get(r.purchaseId) ?? 0) + 1);
  }

  const lastClassDateByStudent = new Map<string, string>();
  for (const r of classRecords) {
    const current = lastClassDateByStudent.get(r.studentId);
    if (!current || r.date > current) {
      lastClassDateByStudent.set(r.studentId, r.date);
    }
  }

  return students.map((student) => {
    const studentPurchases = purchasesByStudent.get(student.id) ?? [];

    const totalUnpaidAmount = studentPurchases
      .filter((p) => !p.paid)
      .reduce((sum, p) => sum + p.sessionsPurchased * p.pricePerSession, 0);

    if (studentPurchases.length === 0) {
      return {
        studentId: student.id,
        studentName: student.name,
        activePurchaseId: null,
        pricePerSession: 0,
        sessionsUsed: 0,
        sessionsUsedManualOverride: null,
        sessionsPurchased: 0,
        sessionsRemaining: 0,
        amountDue: 0,
        totalUnpaidAmount: 0,
        lastClassDate: lastClassDateByStudent.get(student.id) ?? null,
        lowSessionsWarning: false,
      };
    }

    // Find first non-full package (FIFO), else fall back to the most recent one.
    let active = studentPurchases[studentPurchases.length - 1];
    for (const p of studentPurchases) {
      const auto = autoUsedByPurchase.get(p.id) ?? 0;
      const used = manualOverrides.get(p.id) ?? auto;
      if (used < p.sessionsPurchased) {
        active = p;
        break;
      }
    }

    const autoUsed = autoUsedByPurchase.get(active.id) ?? 0;
    const manualOverride = manualOverrides.get(active.id) ?? null;
    const effectiveUsed = manualOverride ?? autoUsed;
    const remaining = Math.max(active.sessionsPurchased - effectiveUsed, 0);
    const amountDue = active.paid ? 0 : remaining * active.pricePerSession;

    return {
      studentId: student.id,
      studentName: student.name,
      activePurchaseId: active.id,
      pricePerSession: active.pricePerSession,
      sessionsUsed: effectiveUsed,
      sessionsUsedManualOverride: manualOverride,
      sessionsPurchased: active.sessionsPurchased,
      sessionsRemaining: remaining,
      amountDue,
      totalUnpaidAmount,
      lastClassDate: lastClassDateByStudent.get(student.id) ?? null,
      lowSessionsWarning: remaining <= lowSessionThreshold,
    };
  });
}
