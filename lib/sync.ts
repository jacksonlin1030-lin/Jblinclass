import { AppConfig, Purchase, UnmatchedEvent } from "./types";
import { listCalendarEvents } from "./google";
import {
  listStudents,
  listPurchases,
  listClassRecords,
  createClassRecord,
} from "./notion";
import { matchEventsToStudents } from "./matching";

export interface SyncResult {
  createdCount: number;
  skippedExistingCount: number;
  unmatchedEvents: UnmatchedEvent[];
  multiMatchWarnings: { eventTitle: string; date: string; studentNames: string[] }[];
  overQuotaWarnings: { studentName: string; eventTitle: string; date: string }[];
}

/**
 * Picks which purchase (course package) a new class should count against, using
 * FIFO by purchase date: the first package that isn't full yet. If every
 * package for the student is already full, the class is assigned to the most
 * recent package and flagged as over-quota so the coach can review it.
 */
function allocatePurchase(
  studentPurchases: Purchase[],
  allocatedCounts: Map<string, number>
): { purchaseId: string | null; overQuota: boolean } {
  if (studentPurchases.length === 0) return { purchaseId: null, overQuota: true };

  for (const purchase of studentPurchases) {
    const used = allocatedCounts.get(purchase.id) ?? 0;
    if (used < purchase.sessionsPurchased) {
      return { purchaseId: purchase.id, overQuota: false };
    }
  }
  // All packages full — assign to the latest one and flag it.
  const latest = studentPurchases[studentPurchases.length - 1];
  return { purchaseId: latest.id, overQuota: true };
}

export async function performSync(
  config: AppConfig,
  startDate: string,
  endDate: string
): Promise<SyncResult> {
  const [students, events] = await Promise.all([
    listStudents(config),
    listCalendarEvents(config, startDate, endDate),
  ]);
  const purchases = await listPurchases(config, students);
  const existingRecords = await listClassRecords(config);

  const { matches, unmatched, multiMatch } = matchEventsToStudents(events, students);

  // Existing (studentId, googleEventId) pairs already written to Notion, for dedup.
  const existingPairs = new Set(existingRecords.map((r) => `${r.studentId}::${r.googleEventId}`));

  // Seed allocation counts from existing class records (already-assigned purchases).
  const allocatedCounts = new Map<string, number>();
  for (const record of existingRecords) {
    if (!record.purchaseId) continue;
    allocatedCounts.set(record.purchaseId, (allocatedCounts.get(record.purchaseId) ?? 0) + 1);
  }

  const purchasesByStudent = new Map<string, Purchase[]>();
  for (const purchase of purchases) {
    const list = purchasesByStudent.get(purchase.studentId) ?? [];
    list.push(purchase);
    purchasesByStudent.set(purchase.studentId, list);
  }
  // purchases already sorted oldest-first by listPurchases()

  let createdCount = 0;
  let skippedExistingCount = 0;
  const overQuotaWarnings: SyncResult["overQuotaWarnings"] = [];

  // Sort matches by date so FIFO allocation happens in chronological order within this run.
  const sortedMatches = [...matches].sort((a, b) => (a.event.date < b.event.date ? -1 : 1));

  for (const { event, student } of sortedMatches) {
    const pairKey = `${student.id}::${event.id}`;
    if (existingPairs.has(pairKey)) {
      skippedExistingCount++;
      continue;
    }

    const studentPurchases = purchasesByStudent.get(student.id) ?? [];
    const { purchaseId, overQuota } = allocatePurchase(studentPurchases, allocatedCounts);
    if (purchaseId) {
      allocatedCounts.set(purchaseId, (allocatedCounts.get(purchaseId) ?? 0) + 1);
    }
    if (overQuota) {
      overQuotaWarnings.push({ studentName: student.name, eventTitle: event.title, date: event.date });
    }

    await createClassRecord(config, {
      studentId: student.id,
      date: event.date,
      purchaseId,
      googleEventId: event.id,
      eventTitle: event.title,
    });
    existingPairs.add(pairKey);
    createdCount++;
  }

  return {
    createdCount,
    skippedExistingCount,
    unmatchedEvents: unmatched,
    multiMatchWarnings: multiMatch.map((m) => ({
      eventTitle: m.event.title,
      date: m.event.date,
      studentNames: m.students.map((s) => s.name),
    })),
    overQuotaWarnings,
  };
}
