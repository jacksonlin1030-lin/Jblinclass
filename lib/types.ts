// Shared types for the fitness coach tracking app.

export interface GoogleTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string;
  token_type?: string | null;
  expiry_date?: number | null;
}

export interface AppConfig {
  notion: {
    token: string;
    studentsDbId: string;
    purchasesDbId: string;
    classRecordsDbId: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    tokens?: GoogleTokens;
  };
  settings: {
    /** Remaining-session threshold at/below which a student is flagged for renewal. */
    lowSessionThreshold: number;
    /** Which Google Calendar to read events from. */
    calendarId: string;
  };
}

export const DEFAULT_CONFIG: AppConfig = {
  notion: {
    token: "",
    studentsDbId: "",
    purchasesDbId: "",
    classRecordsDbId: "",
  },
  google: {
    clientId: "",
    clientSecret: "",
    redirectUri: "http://localhost:3000/api/google/callback",
  },
  settings: {
    lowSessionThreshold: 2,
    calendarId: "primary",
  },
};

/** A student row from the Students Notion database. */
export interface Student {
  id: string;
  name: string;
  active: boolean;
}

/** A course-package purchase row from the Purchases Notion database. */
export interface Purchase {
  id: string;
  studentId: string;
  studentName: string;
  purchaseDate: string; // ISO date
  sessionsPurchased: number;
  pricePerSession: number;
  paid: boolean;
  paidDate: string | null;
  note: string;
}

/** A class-record row from the ClassRecords Notion database. */
export interface ClassRecord {
  id: string;
  studentId: string;
  date: string; // ISO date
  purchaseId: string | null;
  googleEventId: string;
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
