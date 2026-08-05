import { Client } from "@notionhq/client";
import type {
  PageObjectResponse,
  DatabaseObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { AppConfig } from "./types";
import { Student, Purchase, ClassRecord } from "./types";
import { STUDENTS_PROPS, PURCHASES_PROPS, CLASS_RECORDS_PROPS } from "./notion-schema";

export function getNotionClient(config: AppConfig): Client {
  if (!config.notion.token) {
    throw new Error("Notion token 尚未設定，請先到 /settings 填寫");
  }
  return new Client({ auth: config.notion.token });
}

// ---------- property extraction helpers ----------

function isPage(obj: unknown): obj is PageObjectResponse {
  return Boolean(obj) && typeof obj === "object" && (obj as any).object === "page";
}

function getTitlePropertyKey(db: DatabaseObjectResponse): string {
  for (const [key, prop] of Object.entries(db.properties)) {
    if ((prop as any).type === "title") return key;
  }
  throw new Error(`資料庫 ${db.id} 找不到 title 型態的欄位`);
}

function getTitleText(page: PageObjectResponse, titleKey: string): string {
  const prop = page.properties[titleKey];
  if (!prop || prop.type !== "title") return "";
  return prop.title.map((t) => t.plain_text).join("");
}

function getSelectName(page: PageObjectResponse, key: string): string | null {
  const prop = page.properties[key];
  if (!prop || prop.type !== "select") return null;
  return prop.select?.name ?? null;
}

function getCheckbox(page: PageObjectResponse, key: string): boolean {
  const prop = page.properties[key];
  if (!prop || prop.type !== "checkbox") return false;
  return prop.checkbox;
}

function getDateStr(page: PageObjectResponse, key: string): string | null {
  const prop = page.properties[key];
  if (!prop || prop.type !== "date") return null;
  return prop.date?.start ?? null;
}

function getNumber(page: PageObjectResponse, key: string): number | null {
  const prop = page.properties[key];
  if (!prop || prop.type !== "number") return null;
  return prop.number;
}

function getRichText(page: PageObjectResponse, key: string): string {
  const prop = page.properties[key];
  if (!prop || prop.type !== "rich_text") return "";
  return prop.rich_text.map((t) => t.plain_text).join("");
}

function getRelationIds(page: PageObjectResponse, key: string): string[] {
  const prop = page.properties[key];
  if (!prop || prop.type !== "relation") return [];
  return prop.relation.map((r) => r.id);
}

// ---------- Students ----------

export async function listStudents(config: AppConfig): Promise<Student[]> {
  const notion = getNotionClient(config);
  const db = (await notion.databases.retrieve({
    database_id: config.notion.studentsDbId,
  })) as DatabaseObjectResponse;
  const titleKey = getTitlePropertyKey(db);

  const students: Student[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: config.notion.studentsDbId,
      start_cursor: cursor,
    });
    for (const row of res.results) {
      if (!isPage(row)) continue;
      const name = getTitleText(row, titleKey);
      if (!name) continue;
      const status = getSelectName(row, STUDENTS_PROPS.status);
      students.push({
        id: row.id,
        name,
        active: status !== STUDENTS_PROPS.statusInactive,
      });
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return students;
}

// ---------- Purchases ----------

function purchaseFromPage(page: PageObjectResponse, studentNameById: Map<string, string>): Purchase {
  const studentIds = getRelationIds(page, PURCHASES_PROPS.student);
  const studentId = studentIds[0] ?? "";
  return {
    id: page.id,
    studentId,
    studentName: studentNameById.get(studentId) ?? "",
    purchaseDate: getDateStr(page, PURCHASES_PROPS.purchaseDate) ?? "",
    sessionsPurchased: getNumber(page, PURCHASES_PROPS.sessionsPurchased) ?? 0,
    pricePerSession: getNumber(page, PURCHASES_PROPS.pricePerSession) ?? 0,
    paid: getCheckbox(page, PURCHASES_PROPS.paid),
    paidDate: getDateStr(page, PURCHASES_PROPS.paidDate),
    note: getRichText(page, PURCHASES_PROPS.note),
  };
}

export async function listPurchases(
  config: AppConfig,
  students: Student[]
): Promise<Purchase[]> {
  const notion = getNotionClient(config);
  const studentNameById = new Map(students.map((s) => [s.id, s.name]));

  const purchases: Purchase[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: config.notion.purchasesDbId,
      start_cursor: cursor,
    });
    for (const row of res.results) {
      if (!isPage(row)) continue;
      purchases.push(purchaseFromPage(row, studentNameById));
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  // Sort oldest purchase date first, needed for FIFO allocation downstream.
  purchases.sort((a, b) => (a.purchaseDate < b.purchaseDate ? -1 : 1));
  return purchases;
}

export async function createPurchase(
  config: AppConfig,
  data: {
    studentId: string;
    purchaseDate: string;
    sessionsPurchased: number;
    pricePerSession: number;
    paid: boolean;
    paidDate?: string | null;
    note?: string;
  }
): Promise<void> {
  const notion = getNotionClient(config);
  await notion.pages.create({
    parent: { database_id: config.notion.purchasesDbId },
    properties: {
      [PURCHASES_PROPS.student]: { relation: [{ id: data.studentId }] },
      [PURCHASES_PROPS.purchaseDate]: { date: { start: data.purchaseDate } },
      [PURCHASES_PROPS.sessionsPurchased]: { number: data.sessionsPurchased },
      [PURCHASES_PROPS.pricePerSession]: { number: data.pricePerSession },
      [PURCHASES_PROPS.paid]: { checkbox: data.paid },
      ...(data.paidDate
        ? { [PURCHASES_PROPS.paidDate]: { date: { start: data.paidDate } } }
        : {}),
      ...(data.note ? { [PURCHASES_PROPS.note]: { rich_text: [{ text: { content: data.note } }] } } : {}),
    },
  });
}

export async function updatePurchasePayment(
  config: AppConfig,
  purchaseId: string,
  paid: boolean,
  paidDate?: string | null
): Promise<void> {
  const notion = getNotionClient(config);
  await notion.pages.update({
    page_id: purchaseId,
    properties: {
      [PURCHASES_PROPS.paid]: { checkbox: paid },
      ...(paidDate !== undefined
        ? { [PURCHASES_PROPS.paidDate]: paidDate ? { date: { start: paidDate } } : { date: null } }
        : {}),
    },
  });
}

export async function updatePurchaseManualOverride(
  config: AppConfig,
  purchaseId: string,
  sessionsUsed: number | null
): Promise<void> {
  const notion = getNotionClient(config);
  await notion.pages.update({
    page_id: purchaseId,
    properties: {
      [PURCHASES_PROPS.manualSessionsUsedOverride]: { number: sessionsUsed },
    },
  });
}

export async function getPurchaseManualOverrides(
  config: AppConfig
): Promise<Map<string, number | null>> {
  const notion = getNotionClient(config);
  const overrides = new Map<string, number | null>();
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: config.notion.purchasesDbId,
      start_cursor: cursor,
    });
    for (const row of res.results) {
      if (!isPage(row)) continue;
      overrides.set(row.id, getNumber(row, PURCHASES_PROPS.manualSessionsUsedOverride));
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return overrides;
}

// ---------- Class Records ----------

function classRecordFromPage(page: PageObjectResponse): ClassRecord {
  const studentIds = getRelationIds(page, CLASS_RECORDS_PROPS.student);
  const purchaseIds = getRelationIds(page, CLASS_RECORDS_PROPS.purchase);
  return {
    id: page.id,
    studentId: studentIds[0] ?? "",
    date: getDateStr(page, CLASS_RECORDS_PROPS.date) ?? "",
    purchaseId: purchaseIds[0] ?? null,
    googleEventId: getRichText(page, CLASS_RECORDS_PROPS.googleEventId),
    eventTitle: getRichText(page, CLASS_RECORDS_PROPS.eventTitle),
  };
}

export async function listClassRecords(config: AppConfig): Promise<ClassRecord[]> {
  const notion = getNotionClient(config);
  const records: ClassRecord[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: config.notion.classRecordsDbId,
      start_cursor: cursor,
    });
    for (const row of res.results) {
      if (!isPage(row)) continue;
      records.push(classRecordFromPage(row));
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return records;
}

/** Returns the set of Google Calendar event IDs already recorded, for dedup. */
export async function getExistingGoogleEventIds(config: AppConfig): Promise<Set<string>> {
  const notion = getNotionClient(config);
  const ids = new Set<string>();
  let cursor: string | undefined;
  do {
    const res = await notion.databases.query({
      database_id: config.notion.classRecordsDbId,
      start_cursor: cursor,
    });
    for (const row of res.results) {
      if (!isPage(row)) continue;
      const eventId = getRichText(row, CLASS_RECORDS_PROPS.googleEventId);
      if (eventId) ids.add(eventId);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return ids;
}

export async function createClassRecord(
  config: AppConfig,
  data: {
    studentId: string;
    date: string;
    purchaseId: string | null;
    googleEventId: string;
    eventTitle: string;
  }
): Promise<void> {
  const notion = getNotionClient(config);
  await notion.pages.create({
    parent: { database_id: config.notion.classRecordsDbId },
    properties: {
      [CLASS_RECORDS_PROPS.student]: { relation: [{ id: data.studentId }] },
      [CLASS_RECORDS_PROPS.date]: { date: { start: data.date } },
      ...(data.purchaseId
        ? { [CLASS_RECORDS_PROPS.purchase]: { relation: [{ id: data.purchaseId }] } }
        : {}),
      [CLASS_RECORDS_PROPS.googleEventId]: {
        rich_text: [{ text: { content: data.googleEventId } }],
      },
      [CLASS_RECORDS_PROPS.eventTitle]: {
        rich_text: [{ text: { content: data.eventTitle.slice(0, 2000) } }],
      },
    },
  });
}

/** Basic connectivity/shape check used by the Settings page "測試連線" button. */
export async function testNotionConnection(config: AppConfig): Promise<{
  studentsCount: number;
  purchasesCount: number;
  classRecordsCount: number;
}> {
  const students = await listStudents(config);
  const purchases = await listPurchases(config, students);
  const records = await listClassRecords(config);
  return {
    studentsCount: students.length,
    purchasesCount: purchases.length,
    classRecordsCount: records.length,
  };
}
