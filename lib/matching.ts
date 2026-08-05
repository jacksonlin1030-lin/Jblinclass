import { CalendarEvent, Student, UnmatchedEvent } from "./types";

export interface MatchedEvent {
  event: CalendarEvent;
  student: Student;
}

export interface MatchResult {
  matches: MatchedEvent[];
  unmatched: UnmatchedEvent[];
  /** Events whose title contained more than one student's name — flagged for manual review. */
  multiMatch: { event: CalendarEvent; students: Student[] }[];
}

/**
 * Matches calendar events to students by substring containment of the student's
 * name inside the event title. If an event title contains multiple different
 * student names, it is counted for all of them and also surfaced as a
 * `multiMatch` warning for manual confirmation. Events matching no student are
 * returned as `unmatched` so the coach can review them (new student? typo?).
 */
export function matchEventsToStudents(events: CalendarEvent[], students: Student[]): MatchResult {
  const matches: MatchedEvent[] = [];
  const unmatched: UnmatchedEvent[] = [];
  const multiMatch: { event: CalendarEvent; students: Student[] }[] = [];

  for (const event of events) {
    const title = event.title.trim();
    const hits = students.filter((s) => s.name && title.includes(s.name));

    if (hits.length === 0) {
      unmatched.push({ eventId: event.id, title: event.title, date: event.date });
      continue;
    }

    for (const student of hits) {
      matches.push({ event, student });
    }

    if (hits.length > 1) {
      multiMatch.push({ event, students: hits });
    }
  }

  return { matches, unmatched, multiMatch };
}
