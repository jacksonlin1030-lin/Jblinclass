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
}

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
  /** This month's venue rental fee, overriding settings.defaultVenueRentalFee.
   *  null means "use the default". */
  venueFeeOverride: number | null;
}

export interface SyncRunSummary {
  monthKey: string;
  runAt: string; // ISO datetime
  triggeredBy: "manual" | "cron";
  /** Total sessions matched for the whole month (confirmed + future-booked). */
  sessionCount: number;
  /** Of sessionCount, how many have a date <= today (i.e. already happened). */
  confirmedSessionCount: number;
  unmatchedEvents: UnmatchedEvent[];
  multiMatchWarnings: { eventTitle: string; date: string; studentNames: string[] }[];
  error?: string;
}

/** Whole-month estimate across all active students, including classes already
 *  booked on the calendar for later this month. Revenue is attributed via the
 *  same FIFO package logic as per-student metrics, just run over the full
 *  month's sessions instead of stopping at today. */
export interface MonthlyProjection {
  monthKey: string;
  sessionCount: number;
  confirmedSessionCount: number;
  estimatedRevenue: number;
  venueFee: number;
  venueFeeIsOverride: boolean;
  netIncome: number;
}

export interface AppSettings {
  /** Remaining-session threshold at/below which a student is flagged for renewal. */
  lowSessionThreshold: number;
  /** Which Google Calendar to read events from. */
  calendarId: string;
  /** Default monthly venue rental fee, carried forward each month unless overridden. */
  defaultVenueRentalFee: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  lowSessionThreshold: 2,
  calendarId: "primary",
  defaultVenueRentalFee: 0,
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
