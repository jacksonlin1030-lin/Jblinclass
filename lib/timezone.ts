// Taiwan doesn't observe DST, so a fixed UTC+8 offset is always correct —
// no need to pull in a timezone library for this.
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

function taipeiNow(): Date {
  return new Date(Date.now() + TAIPEI_OFFSET_MS);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Today's date (Asia/Taipei), as "YYYY-MM-DD". */
export function todayTaipei(): string {
  return toDateStr(taipeiNow());
}

/** The current Asia/Taipei month, as "YYYY-MM". */
export function currentTaipeiMonthKey(): string {
  const now = taipeiNow();
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
}

/**
 * Returns the current Asia/Taipei month's full date range (1st through the
 * last day of the month, regardless of today), plus today's date for
 * distinguishing already-happened classes from ones merely booked on the
 * calendar for later this month.
 */
export function currentTaipeiMonthBounds(): {
  monthKey: string;
  startDate: string;
  endDate: string;
  today: string;
} {
  const now = taipeiNow();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed
  const monthKey = `${year}-${pad(month + 1)}`;
  const startDate = `${year}-${pad(month + 1)}-01`;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const endDate = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
  return { monthKey, startDate, endDate, today: toDateStr(now) };
}
