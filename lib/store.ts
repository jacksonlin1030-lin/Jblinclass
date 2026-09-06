import { randomUUID } from "crypto";
import { kvGet, kvSet, kvKeysWithPrefix } from "./kvStore";
import {
  AppSettings,
  DEFAULT_SETTINGS,
  GoogleTokens,
  MatchedSession,
  MonthSnapshot,
  Purchase,
  Student,
  SyncRunSummary,
  Transaction,
  TransactionType,
} from "./types";

const KEYS = {
  students: "students",
  purchases: "purchases",
  googleTokens: "google:tokens",
  settings: "settings",
  lastRun: "sync:lastRun",
  month: (monthKey: string) => `sync:month:${monthKey}`,
  transactions: "expense:transactions",
} as const;

// ---------- Students ----------

export async function getStudents(): Promise<Student[]> {
  return (await kvGet<Student[]>(KEYS.students)) ?? [];
}

export async function addStudent(name: string): Promise<Student> {
  const students = await getStudents();
  const student: Student = { id: randomUUID(), name: name.trim(), active: true };
  students.push(student);
  await kvSet(KEYS.students, students);
  return student;
}

export async function updateStudent(id: string, patch: Partial<Pick<Student, "name" | "active">>): Promise<void> {
  const students = await getStudents();
  const next = students.map((s) => (s.id === id ? { ...s, ...patch } : s));
  await kvSet(KEYS.students, next);
}

// ---------- Purchases ----------

export async function getPurchases(): Promise<Purchase[]> {
  const purchases = (await kvGet<Purchase[]>(KEYS.purchases)) ?? [];
  return [...purchases].sort((a, b) => (a.purchaseDate < b.purchaseDate ? -1 : 1));
}

export async function addPurchase(data: {
  studentId: string;
  purchaseDate: string;
  sessionsPurchased: number;
  pricePerSession: number;
  paid: boolean;
  paidDate?: string | null;
  note?: string;
}): Promise<Purchase> {
  const purchases = (await kvGet<Purchase[]>(KEYS.purchases)) ?? [];
  const purchase: Purchase = {
    id: randomUUID(),
    studentId: data.studentId,
    purchaseDate: data.purchaseDate,
    sessionsPurchased: data.sessionsPurchased,
    pricePerSession: data.pricePerSession,
    paid: data.paid,
    paidDate: data.paidDate ?? null,
    note: data.note ?? "",
    sessionsUsedManualOverride: null,
  };
  purchases.push(purchase);
  await kvSet(KEYS.purchases, purchases);
  return purchase;
}

export async function updatePurchase(
  id: string,
  patch: Partial<
    Pick<
      Purchase,
      "paid" | "paidDate" | "sessionsUsedManualOverride" | "purchaseDate" | "sessionsPurchased" | "pricePerSession"
    >
  >
): Promise<void> {
  const purchases = (await kvGet<Purchase[]>(KEYS.purchases)) ?? [];
  const next = purchases.map((p) => (p.id === id ? { ...p, ...patch } : p));
  await kvSet(KEYS.purchases, next);
}

// ---------- Month snapshots ----------

export async function getMonthSnapshot(monthKey: string): Promise<MonthSnapshot | null> {
  return await kvGet<MonthSnapshot>(KEYS.month(monthKey));
}

export async function saveMonthSnapshot(snapshot: MonthSnapshot): Promise<void> {
  await kvSet(KEYS.month(snapshot.monthKey), snapshot);
}

/** Sets (or clears, with `fee: null`) this month's per-session venue-fee
 *  override. Creates an empty snapshot if sync hasn't run for this month yet. */
export async function updateMonthVenueFee(monthKey: string, fee: number | null): Promise<MonthSnapshot> {
  const existing = await getMonthSnapshot(monthKey);
  const next: MonthSnapshot = existing
    ? { ...existing, venueFeePerSessionOverride: fee }
    : { monthKey, sessions: [], syncedAt: new Date().toISOString(), venueFeePerSessionOverride: fee };
  await saveMonthSnapshot(next);
  return next;
}

/** All stored month snapshots, oldest first — used to compute FIFO metrics
 *  across packages that may span a month boundary. */
export async function listAllMonthSnapshots(): Promise<MonthSnapshot[]> {
  const keys = await kvKeysWithPrefix("sync:month:");
  const snapshots = await Promise.all(keys.map((k) => kvGet<MonthSnapshot>(k)));
  return snapshots
    .filter((s): s is MonthSnapshot => Boolean(s))
    .sort((a, b) => (a.monthKey < b.monthKey ? -1 : 1));
}

/** Flattens every stored month's matched sessions into one list (newest first). */
export async function getAllSessions(): Promise<MatchedSession[]> {
  const snapshots = await listAllMonthSnapshots();
  const sessions = snapshots.flatMap((s) => s.sessions);
  return sessions.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// ---------- Sync run summary ----------

export async function getLastRun(): Promise<SyncRunSummary | null> {
  return await kvGet<SyncRunSummary>(KEYS.lastRun);
}

export async function saveLastRun(summary: SyncRunSummary): Promise<void> {
  await kvSet(KEYS.lastRun, summary);
}

// ---------- Google OAuth tokens ----------

export async function getGoogleTokens(): Promise<GoogleTokens | null> {
  return await kvGet<GoogleTokens>(KEYS.googleTokens);
}

export async function saveGoogleTokens(tokens: GoogleTokens): Promise<void> {
  await kvSet(KEYS.googleTokens, tokens);
}

// ---------- Personal expense/income transactions ----------

export async function getTransactions(): Promise<Transaction[]> {
  return (await kvGet<Transaction[]>(KEYS.transactions)) ?? [];
}

export async function addTransaction(data: {
  type: TransactionType;
  date: string;
  amount: number;
  categoryId: string;
  note?: string;
}): Promise<Transaction> {
  const transactions = await getTransactions();
  const transaction: Transaction = {
    id: randomUUID(),
    type: data.type,
    date: data.date,
    amount: data.amount,
    categoryId: data.categoryId,
    note: data.note ?? "",
  };
  transactions.push(transaction);
  await kvSet(KEYS.transactions, transactions);
  return transaction;
}

export async function updateTransaction(
  id: string,
  patch: Partial<Pick<Transaction, "type" | "date" | "amount" | "categoryId" | "note">>
): Promise<void> {
  const transactions = await getTransactions();
  const next = transactions.map((t) => (t.id === id ? { ...t, ...patch } : t));
  await kvSet(KEYS.transactions, next);
}

export async function deleteTransaction(id: string): Promise<void> {
  const transactions = await getTransactions();
  await kvSet(
    KEYS.transactions,
    transactions.filter((t) => t.id !== id)
  );
}

// ---------- Settings ----------

export async function getSettings(): Promise<AppSettings> {
  const stored = await kvGet<AppSettings>(KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await kvSet(KEYS.settings, next);
  return next;
}
