// Canonical Notion property names used across the three databases.
// These must match exactly what the user creates in Notion (see README / Settings page).

export const STUDENTS_PROPS = {
  // title property name may vary by workspace; we detect it by type instead of name.
  status: "狀態",
  statusActive: "啟用",
  statusInactive: "停用",
} as const;

export const PURCHASES_PROPS = {
  student: "學生",
  purchaseDate: "購買日期",
  sessionsPurchased: "購買堂數",
  pricePerSession: "單堂課費",
  paid: "已收款",
  paidDate: "收款日期",
  note: "備註",
  manualSessionsUsedOverride: "已用堂數手動調整",
} as const;

export const CLASS_RECORDS_PROPS = {
  student: "學生",
  date: "日期",
  purchase: "對應課程包",
  googleEventId: "Google日曆事件ID",
  eventTitle: "事件標題",
} as const;

export const DEFAULT_SESSIONS_PER_PACKAGE = 10;
