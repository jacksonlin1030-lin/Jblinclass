import { MonthSnapshot, SyncRunSummary } from "./types";
import { listCalendarEvents } from "./google";
import { getStudents, getSettings, saveMonthSnapshot, saveLastRun } from "./store";
import { matchEventsToStudents } from "./matching";
import { currentTaipeiMonthRange } from "./timezone";

/**
 * Recomputes the current month from scratch every time it runs (nightly via
 * cron, or manually from the dashboard): fetch this month's calendar events,
 * match them to students, and overwrite the month's stored snapshot. This is
 * intentionally not incremental — it's simpler and self-healing (if a class
 * was cancelled/moved on the calendar after a previous run, tonight's run
 * corrects it automatically). Past months are never re-touched once the
 * calendar month rolls over, which is what keeps their data around as history.
 */
export async function performSync(triggeredBy: "manual" | "cron"): Promise<SyncRunSummary> {
  const { monthKey, startDate, endDate } = currentTaipeiMonthRange();
  const runAt = new Date().toISOString();

  try {
    const [students, settings] = await Promise.all([getStudents(), getSettings()]);
    const activeStudents = students; // match against all students, active flag only affects dashboard display
    const events = await listCalendarEvents(startDate, endDate, settings.calendarId);
    const { matches, unmatched, multiMatch } = matchEventsToStudents(events, activeStudents);

    const snapshot: MonthSnapshot = {
      monthKey,
      sessions: matches.map((m) => ({
        studentId: m.student.id,
        date: m.event.date,
        eventId: m.event.id,
        eventTitle: m.event.title,
      })),
      syncedAt: runAt,
    };
    await saveMonthSnapshot(snapshot);

    const summary: SyncRunSummary = {
      monthKey,
      runAt,
      triggeredBy,
      sessionCount: snapshot.sessions.length,
      unmatchedEvents: unmatched,
      multiMatchWarnings: multiMatch.map((m) => ({
        eventTitle: m.event.title,
        date: m.event.date,
        studentNames: m.students.map((s) => s.name),
      })),
    };
    await saveLastRun(summary);
    return summary;
  } catch (err: any) {
    const summary: SyncRunSummary = {
      monthKey,
      runAt,
      triggeredBy,
      sessionCount: 0,
      unmatchedEvents: [],
      multiMatchWarnings: [],
      error: err.message ?? "同步失敗",
    };
    await saveLastRun(summary);
    throw err;
  }
}
