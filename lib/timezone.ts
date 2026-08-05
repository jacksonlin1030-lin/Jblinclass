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

/** Returns the current Asia/Taipei month (as "YYYY-MM") and the date range
 *  from the 1st of that month through today, both in Asia/Taipei local time. */
export function currentTaipeiMonthRange(): { monthKey: string; startDate: string; endDate: string } {
  const now = taipeiNow();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed
  const monthKey = `${year}-${pad(month + 1)}`;
  const startDate = `${year}-${pad(month + 1)}-01`;
  const endDate = toDateStr(now);
  return { monthKey, startDate, endDate };
}
