import { MonthSnapshot, SyncRunSummary } from "./types";
import { listCalendarEvents } from "./google";
import { getStudents, getSettings, getMonthSnapshot, saveMonthSnapshot, saveLastRun } from "./store";
import { matchEventsToStudents } from "./matching";
import { currentTaipeiMonthBounds } from "./timezone";

/**
 * Recomputes the current month from scratch every time it runs (nightly via
 * cron, or manually from the dashboard): fetch the WHOLE month's calendar
 * events — 1st through the last day, including days later this month that
 * haven't happened yet — match them to students, and overwrite the month's
 * stored snapshot. This is intentionally not incremental — it's simpler and
 * self-healing (if a class was cancelled/moved on the calendar after a
 * previous run, tonight's run corrects it automatically). Past months are
 * never re-touched once the calendar month rolls over, which is what keeps
 * their data around as history.
 *
 * Fetching the full month (not just up to today) lets the dashboard show a
 * whole-month projection including classes already booked for later this
 * month. That projection is entirely separate from a student's confirmed
 * "已用堂數", which lib/metrics.ts derives by filtering to date <= today —
 * a class that's merely booked on the calendar doesn't count as attended
 * until the day actually happens.
 *
 * If settings.classEventColorId is set, events are first filtered down to
 * only that color before name-matching runs — so a personal appointment
 * that happens to mention a student's name in its title (or is on the same
 * shared calendar) never gets counted as a class. Events in any other
 * color are dropped silently here, before matching, so they also never
 * show up as "unmatched" — they were never candidates to begin with.
 */
export async function performSync(triggeredBy: "manual" | "cron"): Promise<SyncRunSummary> {
  const { monthKey, startDate, endDate, today } = currentTaipeiMonthBounds();
  const runAt = new Date().toISOString();

  try {
    const [students, settings, existingSnapshot] = await Promise.all([
      getStudents(),
      getSettings(),
      getMonthSnapshot(monthKey),
    ]);
    const allEvents = await listCalendarEvents(startDate, endDate, settings.calendarId);
    const events = settings.classEventColorId
      ? allEvents.filter((e) => e.colorId === settings.classEventColorId)
      : allEvents;
    const { matches, unmatched, multiMatch } = matchEventsToStudents(events, students);

    const snapshot: MonthSnapshot = {
      monthKey,
      sessions: matches.map((m) => ({
        studentId: m.student.id,
        date: m.event.date,
        eventId: m.event.id,
        eventTitle: m.event.title,
      })),
      syncedAt: runAt,
      // Preserve any venue-fee override already set for this month — a sync
      // run shouldn't reset it back to the default.
      venueFeeOverride: existingSnapshot?.venueFeeOverride ?? null,
    };
    await saveMonthSnapshot(snapshot);

    const confirmedSessionCount = snapshot.sessions.filter((s) => s.date <= today).length;

    const summary: SyncRunSummary = {
      monthKey,
      runAt,
      triggeredBy,
      sessionCount: snapshot.sessions.length,
      confirmedSessionCount,
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
      confirmedSessionCount: 0,
      unmatchedEvents: [],
      multiMatchWarnings: [],
      error: err.message ?? "同步失敗",
    };
    await saveLastRun(summary);
    throw err;
  }
}
