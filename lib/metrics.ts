import { MatchedSession, Purchase, Student, StudentMetrics } from "./types";

/**
 * Computes the per-student dashboard row. Sessions (merged across all stored
 * months) are FIFO-assigned to purchases in chronological order: each class
 * fills the oldest package that still has room. "Active package" is the
 * first one not yet full; if every package is full, the most recent one is
 * treated as active and `sessionsRemaining` goes negative — that negative
 * number *is* the over-quota signal, surfaced directly in the dashboard.
 */
export function computeStudentMetrics(
  students: Student[],
  purchases: Purchase[],
  allSessions: MatchedSession[],
  lowSessionThreshold: number
): StudentMetrics[] {
  const purchasesByStudent = new Map<string, Purchase[]>();
  for (const p of purchases) {
    const list = purchasesByStudent.get(p.studentId) ?? [];
    list.push(p);
    purchasesByStudent.set(p.studentId, list);
  }
  Array.from(purchasesByStudent.values()).forEach((list) =>
    list.sort((a, b) => (a.purchaseDate < b.purchaseDate ? -1 : 1))
  );

  const sessionsByStudent = new Map<string, MatchedSession[]>();
  for (const s of allSessions) {
    const list = sessionsByStudent.get(s.studentId) ?? [];
    list.push(s);
    sessionsByStudent.set(s.studentId, list);
  }
  Array.from(sessionsByStudent.values()).forEach((list) =>
    list.sort((a, b) => (a.date < b.date ? -1 : 1))
  );

  return students.map((student) => {
    const studentPurchases = purchasesByStudent.get(student.id) ?? [];
    const studentSessions = sessionsByStudent.get(student.id) ?? [];

    const totalUnpaidAmount = studentPurchases
      .filter((p) => !p.paid)
      .reduce((sum, p) => sum + p.sessionsPurchased * p.pricePerSession, 0);

    const lastClassDate =
      studentSessions.length > 0 ? studentSessions[studentSessions.length - 1].date : null;

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
        lastClassDate,
        lowSessionsWarning: false,
      };
    }

    // FIFO-assign each session (chronological) to the first purchase with room;
    // once every purchase is full, extra sessions pile onto the last one.
    const assignedCounts = new Map<string, number>();
    for (const p of studentPurchases) assignedCounts.set(p.id, 0);
    for (let i = 0; i < studentSessions.length; i++) {
      const target =
        studentPurchases.find((p) => (assignedCounts.get(p.id) ?? 0) < p.sessionsPurchased) ??
        studentPurchases[studentPurchases.length - 1];
      assignedCounts.set(target.id, (assignedCounts.get(target.id) ?? 0) + 1);
    }

    let active = studentPurchases[studentPurchases.length - 1];
    for (const p of studentPurchases) {
      if ((assignedCounts.get(p.id) ?? 0) < p.sessionsPurchased) {
        active = p;
        break;
      }
    }

    const autoUsed = assignedCounts.get(active.id) ?? 0;
    const manualOverride = active.sessionsUsedManualOverride;
    const effectiveUsed = manualOverride ?? autoUsed;
    const remaining = active.sessionsPurchased - effectiveUsed; // can go negative: over-quota signal
    const amountDue = active.paid ? 0 : Math.max(remaining, 0) * active.pricePerSession;

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
      lastClassDate,
      lowSessionsWarning: remaining <= lowSessionThreshold,
    };
  });
}
