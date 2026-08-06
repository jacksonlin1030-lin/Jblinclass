// Shared types for the fitness coach tracking app.

export interface GoogleTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string;
  token_type?: string | null;
  expiry_date?: number | null;
}

/** A student the coach trains. */
export interface Student {
  id: string;
  name: string;
  active: boolean;
}

/** A course-package purchase (one row per package bought, FIFO-consumed). */
export interface Purchase {
  id: string;
  studentId: string;
  purchaseDate: string; // ISO date
  sessionsPurchased: number;
  pricePerSession: number;
  paid: boolean;
  paidDate: string | null;
  note: string;
  /** Manual override for sessions used, in case calendar matching missed an
   *  exception (e.g. a class that happened but its calendar event was deleted). */
  sessionsUsedManualOverride: number | null;
}

/** One Google Calendar event matched to a student. */
export interface MatchedSession {
  studentId: string;
  date: string; // ISO date
  eventId: string;
  eventTitle: string;
}

/** A Google Calendar event, trimmed to what we need. */
export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO date (start date)
  /** Google's event color ID ("1"-"11"), if one was explicitly set on the
   *  event. Undefined means the event uses the calendar's default color. */
  colorId?: string;
}

/** Google Calendar's 11 standard event colors, for the "which color means
 *  a class" picker in Settings. */
export const GOOGLE_EVENT_COLORS: { id: string; name: string; hex: string }[] = [
  { id: "1", name: "薰衣草色 Lavender", hex: "#7986cb" },
  { id: "2", name: "鼠尾草色 Sage", hex: "#33b679" },
  { id: "3", name: "葡萄色 Grape", hex: "#8e24aa" },
  { id: "4", name: "紅鶴色 Flamingo", hex: "#e67c73" },
  { id: "5", name: "香蕉色 Banana", hex: "#f6c026" },
  { id: "6", name: "橘色 Tangerine", hex: "#f5511d" },
  { id: "7", name: "孔雀色 Peacock", hex: "#039be5" },
  { id: "8", name: "石墨色 Graphite", hex: "#616161" },
  { id: "9", name: "藍莓色 Blueberry", hex: "#3f51b5" },
  { id: "10", name: "羅勒色 Basil", hex: "#0b8043" },
  { id: "11", name: "番茄色 Tomato", hex: "#d60000" },
];

/** An event whose title didn't match any active student name. */
export interface UnmatchedEvent {
  eventId: string;
  title: string;
  date: string;
}

/** Every night (and on manual sync) the whole current month is recomputed from
 *  scratch and this snapshot is overwritten — self-healing if calendar events
 *  changed since the last run. Past months are never touched again once the
 *  month rolls over, which is what keeps their data around as history.
 *  `sessions` covers the WHOLE month (1st through the last day), so for the
 *  current month it includes classes already taught (date <= today) as well
 *  as classes already booked on the calendar for later this month — the
 *  latter are only ever used for the monthly projection, never for a
 *  student's confirmed "已用堂數" (see lib/metrics.ts). */
export interface MonthSnapshot {
  monthKey: string; // YYYY-MM
  sessions: MatchedSession[];
  syncedAt: string; // ISO datetime
  /** This month's per-session venue rental fee, overriding
   *  settings.defaultVenueFeePerSession. null means "use the default". */
  venueFeePerSessionOverride: number | null;
}

export interface SyncRunSummary {
  monthKey: string;
  runAt: string; // ISO datetime
  triggeredBy: "manual" | "cron";
  /** Total sessions matched for the whole month (confirmed + future-booked). */
  sessionCount: number;
  /** Of sessionCount, how many have a date <= today (i.e. already happened). */
  confirmedSessionCount: number;
  /** How many calendar events existed in the month's date range, before the
   *  color filter (if any) was applied — lets a "0 sessions" result be
   *  diagnosed: were there simply no events, or did the color filter drop
   *  everything (e.g. calendar events not recolored yet)? */
  totalEventsInRange: number;
  /** Of totalEventsInRange, how many passed the color filter and were
   *  candidates for name-matching. Equals totalEventsInRange when no color
   *  filter is configured. */
  colorFilteredEventCount: number;
  unmatchedEvents: UnmatchedEvent[];
  multiMatchWarnings: { eventTitle: string; date: string; studentNames: string[] }[];
  error?: string;
}

/** Whole-month estimate across all active students, including classes already
 *  booked on the calendar for later this month. Revenue is attributed via the
 *  same FIFO package logic as per-student metrics, just run over the full
 *  month's sessions instead of stopping at today. Venue cost is a per-session
 *  rate (e.g. "$380 per class") multiplied by the month's session count —
 *  not a single flat monthly figure the coach has to total up themselves. */
export interface MonthlyProjection {
  monthKey: string;
  sessionCount: number;
  confirmedSessionCount: number;
  estimatedRevenue: number;
  venueFeePerSession: number;
  venueFeeIsOverride: boolean;
  totalVenueFee: number; // venueFeePerSession * sessionCount
  netIncome: number; // estimatedRevenue - totalVenueFee
}

export interface AppSettings {
  /** Remaining-session threshold at/below which a student is flagged for renewal. */
  lowSessionThreshold: number;
  /** Which Google Calendar to read events from. */
  calendarId: string;
  /** Default per-session venue rental fee (e.g. $380/class), carried forward
   *  each month unless overridden for a specific month. */
  defaultVenueFeePerSession: number;
  /** Google event colorId ("1"-"11") that marks an event as an actual class.
   *  Events with any other color (or no color set) are ignored entirely —
   *  not matched, not counted, not even flagged as unmatched — so personal
   *  appointments on the same calendar don't get counted as classes just
   *  because their title happens to contain a student's name. Empty string
   *  means no color filter is configured yet: every event is considered,
   *  same as before this feature existed. */
  classEventColorId: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  lowSessionThreshold: 2,
  calendarId: "primary",
  defaultVenueFeePerSession: 0,
  classEventColorId: "",
};

export const DEFAULT_SESSIONS_PER_PACKAGE = 10;

/** Per-student computed metrics for the dashboard table. */
export interface StudentMetrics {
  studentId: string;
  studentName: string;
  activePurchaseId: string | null;
  pricePerSession: number;
  sessionsUsed: number;
  sessionsUsedManualOverride: number | null;
  sessionsPurchased: number;
  sessionsRemaining: number;
  amountDue: number;
  totalUnpaidAmount: number;
  lastClassDate: string | null;
  lowSessionsWarning: boolean;
}
