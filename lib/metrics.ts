import { MatchedSession, MonthlyProjection, Purchase, Student, StudentMetrics } from "./types";

function groupByStudentSortedByDate(sessions: MatchedSession[]): Map<string, MatchedSession[]> {
  const map = new Map<string, MatchedSession[]>();
  for (const s of sessions) {
    const list = map.get(s.studentId) ?? [];
    list.push(s);
    map.set(s.studentId, list);
  }
  Array.from(map.values()).forEach((list) => list.sort((a, b) => (a.date < b.date ? -1 : 1)));
  return map;
}

function groupByStudentSortedByPurchaseDate(purchases: Purchase[]): Map<string, Purchase[]> {
  const map = new Map<string, Purchase[]>();
  for (const p of purchases) {
    const list = map.get(p.studentId) ?? [];
    list.push(p);
    map.set(p.studentId, list);
  }
  Array.from(map.values()).forEach((list) => list.sort((a, b) => (a.purchaseDate < b.purchaseDate ? -1 : 1)));
  return map;
}

/**
 * FIFO-assigns a chronologically-sorted list of sessions to a chronologically-
 * sorted list of purchases for one student: each session fills the oldest
 * package that still has room; once every package is full, extra sessions
 * pile onto the last one (over-quota). Returns the purchase each session
 * (by eventId) was assigned to, plus the final per-purchase counts.
 */
function fifoAssign(
  purchases: Purchase[],
  sessions: MatchedSession[]
): { byEventId: Map<string, Purchase>; countsByPurchaseId: Map<string, number> } {
  const countsByPurchaseId = new Map<string, number>();
  for (const p of purchases) countsByPurchaseId.set(p.id, 0);
  const byEventId = new Map<string, Purchase>();

  for (const session of sessions) {
    const target =
      purchases.find((p) => (countsByPurchaseId.get(p.id) ?? 0) < p.sessionsPurchased) ??
      purchases[purchases.length - 1];
    if (!target) continue;
    countsByPurchaseId.set(target.id, (countsByPurchaseId.get(target.id) ?? 0) + 1);
    byEventId.set(session.eventId, target);
  }

  return { byEventId, countsByPurchaseId };
}

/**
 * Computes the per-student dashboard row. `confirmedSessions` must already be
 * filtered to classes that have actually happened (date <= today) — a class
 * merely booked on the calendar for later doesn't count as "used" yet. FIFO-
 * assigns them to purchases in chronological order: each class fills the
 * oldest package that still has room. "Active package" is the first one not
 * yet full; if every package is full, the most recent one is treated as
 * active and `sessionsRemaining` goes negative — that negative number *is*
 * the over-quota signal, surfaced directly in the dashboard.
 */
export function computeStudentMetrics(
  students: Student[],
  purchases: Purchase[],
  confirmedSessions: MatchedSession[],
  lowSessionThreshold: number
): StudentMetrics[] {
  const purchasesByStudent = groupByStudentSortedByPurchaseDate(purchases);
  const sessionsByStudent = groupByStudentSortedByDate(confirmedSessions);

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

    const { countsByPurchaseId } = fifoAssign(studentPurchases, studentSessions);

    let active = studentPurchases[studentPurchases.length - 1];
    for (const p of studentPurchases) {
      if ((countsByPurchaseId.get(p.id) ?? 0) < p.sessionsPurchased) {
        active = p;
        break;
      }
    }

    const autoUsed = countsByPurchaseId.get(active.id) ?? 0;
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

/**
 * Whole-month estimate across all active students, including classes already
 * booked on the calendar for later this month. `allSessions` must be the
 * FULL, unfiltered session history (every stored month, including future-
 * dated sessions within the current month) so FIFO package assignment is
 * correct even when a package purchased last month carries into this one.
 * Manual per-purchase overrides are intentionally NOT applied here — they
 * exist to correct a student's confirmed usage display, not to skew the
 * revenue projection. Venue cost is a per-session rate multiplied by the
 * month's session count (e.g. "$380/class × 22 classes"), not a flat monthly
 * figure — the coach doesn't have to total it up by hand.
 */
export function computeMonthlyProjection(
  students: Student[],
  purchases: Purchase[],
  allSessions: MatchedSession[],
  monthKey: string,
  today: string,
  venueFeePerSession: number,
  venueFeeIsOverride: boolean
): MonthlyProjection {
  const purchasesByStudent = groupByStudentSortedByPurchaseDate(purchases);
  const sessionsByStudent = groupByStudentSortedByDate(allSessions);

  let sessionCount = 0;
  let confirmedSessionCount = 0;
  let estimatedRevenue = 0;

  for (const student of students) {
    const studentPurchases = purchasesByStudent.get(student.id) ?? [];
    const studentSessions = sessionsByStudent.get(student.id) ?? [];
    if (studentPurchases.length === 0 || studentSessions.length === 0) continue;

    const { byEventId } = fifoAssign(studentPurchases, studentSessions);

    for (const session of studentSessions) {
      if (!session.date.startsWith(monthKey)) continue;
      const purchase = byEventId.get(session.eventId);
      if (!purchase) continue;
      sessionCount += 1;
      if (session.date <= today) confirmedSessionCount += 1;
      estimatedRevenue += purchase.pricePerSession;
    }
  }

  const totalVenueFee = venueFeePerSession * sessionCount;

  return {
    monthKey,
    sessionCount,
    confirmedSessionCount,
    estimatedRevenue,
    venueFeePerSession,
    venueFeeIsOverride,
    totalVenueFee,
    netIncome: estimatedRevenue - totalVenueFee,
  };
}
