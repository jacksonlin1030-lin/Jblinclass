"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface RedactedConfig {
  notion: {
    token: string;
    hasToken: boolean;
    studentsDbId: string;
    purchasesDbId: string;
    classRecordsDbId: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    hasClientSecret: boolean;
    redirectUri: string;
    connected: boolean;
  };
  settings: {
    lowSessionThreshold: number;
    calendarId: string;
  };
}

const SCHEMA_ROWS: { db: string; field: string; type: string }[] = [
  { db: "學生資料庫", field: "姓名", type: "Title" },
  { db: "學生資料庫", field: "狀態", type: "Select（選項：啟用 / 停用）" },
  { db: "課程包購買紀錄資料庫", field: "學生", type: "Relation → 學生資料庫" },
  { db: "課程包購買紀錄資料庫", field: "購買日期", type: "Date" },
  { db: "課程包購買紀錄資料庫", field: "購買堂數", type: "Number（預設 10）" },
  { db: "課程包購買紀錄資料庫", field: "單堂課費", type: "Number" },
  { db: "課程包購買紀錄資料庫", field: "已收款", type: "Checkbox" },
  { db: "課程包購買紀錄資料庫", field: "收款日期", type: "Date（選填）" },
  { db: "課程包購買紀錄資料庫", field: "備註", type: "Text（選填）" },
  { db: "課程包購買紀錄資料庫", field: "已用堂數手動調整", type: "Number（選填，供例外微調）" },
  { db: "上課紀錄資料庫", field: "學生", type: "Relation → 學生資料庫" },
  { db: "上課紀錄資料庫", field: "日期", type: "Date" },
  { db: "上課紀錄資料庫", field: "對應課程包", type: "Relation → 課程包購買紀錄資料庫（同步時自動指派）" },
  { db: "上課紀錄資料庫", field: "Google日曆事件ID", type: "Text（同步防重複用，不用手動填）" },
  { db: "上課紀錄資料庫", field: "事件標題", type: "Text（同步時自動帶入）" },
];

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">載入中…</p>}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<RedactedConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  // form fields
  const [notionToken, setNotionToken] = useState("");
  const [studentsDbId, setStudentsDbId] = useState("");
  const [purchasesDbId, setPurchasesDbId] = useState("");
  const [classRecordsDbId, setClassRecordsDbId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [calendarId, setCalendarId] = useState("primary");
  const [lowSessionThreshold, setLowSessionThreshold] = useState(2);

  async function loadConfig() {
    setLoading(true);
    const res = await fetch("/api/config");
    const data: RedactedConfig = await res.json();
    setConfig(data);
    setStudentsDbId(data.notion.studentsDbId);
    setPurchasesDbId(data.notion.purchasesDbId);
    setClassRecordsDbId(data.notion.classRecordsDbId);
    setClientId(data.google.clientId);
    setRedirectUri(data.google.redirectUri);
    setCalendarId(data.settings.calendarId);
    setLowSessionThreshold(data.settings.lowSessionThreshold);
    setLoading(false);
  }

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    const connected = searchParams.get("google_connected");
    const error = searchParams.get("google_error");
    if (connected) setMessage("Google 日曆已成功連接！");
    if (error) setMessage(`Google 授權失敗：${error}`);
  }, [searchParams]);

  async function saveNotion() {
    setSaving("notion");
    setMessage(null);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notion: { token: notionToken, studentsDbId, purchasesDbId, classRecordsDbId },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNotionToken("");
      setMessage("Notion 設定已儲存");
      await loadConfig();
    } catch (err: any) {
      setMessage(`儲存失敗：${err.message}`);
    } finally {
      setSaving(null);
    }
  }

  async function saveGoogle() {
    setSaving("google");
    setMessage(null);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          google: { clientId, clientSecret, redirectUri },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setClientSecret("");
      setMessage("Google OAuth 設定已儲存");
      await loadConfig();
    } catch (err: any) {
      setMessage(`儲存失敗：${err.message}`);
    } finally {
      setSaving(null);
    }
  }

  async function saveSettings() {
    setSaving("settings");
    setMessage(null);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { lowSessionThreshold, calendarId } }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMessage("提醒設定已儲存");
      await loadConfig();
    } catch (err: any) {
      setMessage(`儲存失敗：${err.message}`);
    } finally {
      setSaving(null);
    }
  }

  async function testNotion() {
    setTestResult("測試中…");
    try {
      const res = await fetch("/api/notion/test");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTestResult(
        `連線成功：學生 ${data.studentsCount} 位、購買紀錄 ${data.purchasesCount} 筆、上課紀錄 ${data.classRecordsCount} 筆`
      );
    } catch (err: any) {
      setTestResult(`連線失敗：${err.message}`);
    }
  }

  if (loading) return <p className="text-slate-500">載入中…</p>;

  return (
    <div className="space-y-8 pb-16">
      <h1 className="text-2xl font-bold">設定</h1>
      {message && (
        <div className="rounded-md bg-blue-50 text-blue-800 px-4 py-2 text-sm border border-blue-200">
          {message}
        </div>
      )}

      {/* Notion database schema instructions */}
      <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <h2 className="text-lg font-semibold">1. 建立 Notion 資料庫</h2>
        <p className="text-sm text-slate-600">
          請在 Notion 建立以下 3 個資料庫，欄位名稱與型態要完全一致（大小寫、中文字都要對），建立後把該資料庫分享給你的
          Integration，再把資料庫 ID 貼到下方欄位。資料庫 ID 是分享連結網址中 32 碼那段（去掉問號後的參數）。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-slate-200 text-slate-500">
                <th className="py-1.5 pr-4">資料庫</th>
                <th className="py-1.5 pr-4">欄位</th>
                <th className="py-1.5">型態</th>
              </tr>
            </thead>
            <tbody>
              {SCHEMA_ROWS.map((row, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-1.5 pr-4 text-slate-500">{row.db}</td>
                  <td className="py-1.5 pr-4 font-medium">{row.field}</td>
                  <td className="py-1.5 text-slate-600">{row.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 pt-2">
          <label className="text-sm">
            Notion Integration Token
            <input
              type="password"
              placeholder={config?.notion.hasToken ? "已設定（留白代表不變更）" : "secret_xxx..."}
              value={notionToken}
              onChange={(e) => setNotionToken(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5"
            />
          </label>
          <label className="text-sm">
            學生資料庫 ID
            <input
              value={studentsDbId}
              onChange={(e) => setStudentsDbId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5"
            />
          </label>
          <label className="text-sm">
            課程包購買紀錄資料庫 ID
            <input
              value={purchasesDbId}
              onChange={(e) => setPurchasesDbId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5"
            />
          </label>
          <label className="text-sm">
            上課紀錄資料庫 ID
            <input
              value={classRecordsDbId}
              onChange={(e) => setClassRecordsDbId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5"
            />
          </label>
        </div>
        <div className="flex gap-3 items-center pt-1">
          <button
            onClick={saveNotion}
            disabled={saving === "notion"}
            className="rounded-md bg-slate-900 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {saving === "notion" ? "儲存中…" : "儲存 Notion 設定"}
          </button>
          <button
            onClick={testNotion}
            className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium"
          >
            測試連線
          </button>
          {testResult && <span className="text-sm text-slate-600">{testResult}</span>}
        </div>
      </section>

      {/* Google OAuth */}
      <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <h2 className="text-lg font-semibold">2. 連接 Google 日曆</h2>
        <p className="text-sm text-slate-600">
          到{" "}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noreferrer"
            className="underline text-blue-700"
          >
            Google Cloud Console
          </a>{" "}
          建立 OAuth 用戶端 ID（類型選「網頁應用程式」），並把下方「重新導向 URI」加進「已授權的重新導向 URI」清單，同時啟用
          Google Calendar API。建立後把 Client ID / Client Secret 貼到下方。
        </p>
        <div className="grid gap-3">
          <label className="text-sm">
            Client ID
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5"
            />
          </label>
          <label className="text-sm">
            Client Secret
            <input
              type="password"
              placeholder={config?.google.hasClientSecret ? "已設定（留白代表不變更）" : "GOCSPX-..."}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5"
            />
          </label>
          <label className="text-sm">
            重新導向 URI（複製到 Google Cloud Console）
            <input
              value={redirectUri}
              onChange={(e) => setRedirectUri(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 font-mono text-xs"
            />
          </label>
        </div>
        <div className="flex gap-3 items-center pt-1">
          <button
            onClick={saveGoogle}
            disabled={saving === "google"}
            className="rounded-md bg-slate-900 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {saving === "google" ? "儲存中…" : "儲存 Google 設定"}
          </button>
          <a
            href="/api/google/auth"
            className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium"
          >
            連接 Google 日曆
          </a>
          <span className={`text-sm ${config?.google.connected ? "text-green-700" : "text-slate-500"}`}>
            {config?.google.connected ? "✓ 已連接" : "尚未連接"}
          </span>
        </div>
      </section>

      {/* Reminder settings */}
      <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <h2 className="text-lg font-semibold">3. 其他設定</h2>
        <div className="grid gap-3 max-w-sm">
          <label className="text-sm">
            Google 日曆 ID（預設 primary 即為主日曆）
            <input
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5"
            />
          </label>
          <label className="text-sm">
            堂數即將用完提醒門檻（剩餘 ≤ 此數字時標紅提醒續購）
            <input
              type="number"
              min={0}
              value={lowSessionThreshold}
              onChange={(e) => setLowSessionThreshold(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5"
            />
          </label>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving === "settings"}
          className="rounded-md bg-slate-900 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {saving === "settings" ? "儲存中…" : "儲存"}
        </button>
      </section>
    </div>
  );
}
