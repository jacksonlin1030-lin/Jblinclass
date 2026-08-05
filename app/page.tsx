"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import StudentDetail from "@/components/StudentDetail";

interface StudentMetrics {
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

interface SyncResult {
  createdCount: number;
  skippedExistingCount: number;
  unmatchedEvents: { eventId: string; title: string; date: string }[];
  multiMatchWarnings: { eventTitle: string; date: string; studentNames: string[] }[];
  overQuotaWarnings: { studentName: string; eventTitle: string; date: string }[];
}

function firstDayOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function fmt(n: number) {
  return n.toLocaleString();
}

export default function DashboardPage() {
  const [students, setStudents] = useState<StudentMetrics[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(today());
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStudents(data.students);
    } catch (err: any) {
      setError(err.message ?? "讀取儀表板資料失敗，請確認 /settings 中的 Notion 設定");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function runSync() {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSyncResult(data);
      await loadDashboard();
    } catch (err: any) {
      setError(err.message ?? "同步失敗，請確認 /settings 中的 Google 日曆連接");
    } finally {
      setSyncing(false);
    }
  }

  const totalUnpaid = useMemo(
    () => (students ?? []).reduce((sum, s) => sum + s.totalUnpaidAmount, 0),
    [students]
  );

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">儀表板</h1>
        <div className="flex items-end gap-2 bg-white border border-slate-200 rounded-md px-3 py-2">
          <label className="text-xs text-slate-500">
            起始日
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-slate-500">
            結束日
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <button
            onClick={runSync}
            disabled={syncing}
            className="rounded-md bg-slate-900 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {syncing ? "同步中…" : "同步日曆"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 text-red-800 px-4 py-2 text-sm border border-red-200">
          {error}
        </div>
      )}

      {syncResult && (
        <div className="rounded-md bg-blue-50 text-blue-900 px-4 py-2 text-sm border border-blue-200">
          本次同步：新增 {syncResult.createdCount} 筆上課紀錄，略過 {syncResult.skippedExistingCount} 筆已存在的紀錄。
        </div>
      )}

      {syncResult && syncResult.unmatchedEvents.length > 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-300 p-4">
          <h3 className="font-semibold text-amber-900 mb-2">
            ⚠️ 有 {syncResult.unmatchedEvents.length} 個日曆事件比對不到任何學生（可能是新學生或標題打錯字）
          </h3>
          <ul className="text-sm text-amber-900 space-y-1">
            {syncResult.unmatchedEvents.map((e) => (
              <li key={e.eventId}>
                {e.date} — 「{e.title}」
              </li>
            ))}
          </ul>
        </div>
      )}

      {syncResult && syncResult.multiMatchWarnings.length > 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-300 p-4">
          <h3 className="font-semibold text-amber-900 mb-2">⚠️ 有事件標題同時比對到多位學生，請確認是否正確</h3>
          <ul className="text-sm text-amber-900 space-y-1">
            {syncResult.multiMatchWarnings.map((m, i) => (
              <li key={i}>
                {m.date} — 「{m.eventTitle}」 → {m.studentNames.join("、")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {syncResult && syncResult.overQuotaWarnings.length > 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-300 p-4">
          <h3 className="font-semibold text-amber-900 mb-2">⚠️ 以下課程已超出目前所有課程包堂數，請確認是否需要新增購買紀錄</h3>
          <ul className="text-sm text-amber-900 space-y-1">
            {syncResult.overQuotaWarnings.map((w, i) => (
              <li key={i}>
                {w.date} — {w.studentName}「{w.eventTitle}」
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">載入中…</p>
      ) : !students || students.length === 0 ? (
        <p className="text-slate-500">
          尚無學生資料。請先到 <a href="/settings" className="underline text-blue-700">設定</a> 頁面確認 Notion
          連線，並在 Notion 學生資料庫中新增學生。
        </p>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 text-sm text-slate-600 border-b border-slate-200 bg-slate-50">
            累計未收款金額：<span className="font-semibold text-slate-900">{fmt(totalUnpaid)}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 px-4">學生</th>
                <th className="py-2 px-4">單堂課費</th>
                <th className="py-2 px-4">已用堂數</th>
                <th className="py-2 px-4">剩餘堂數</th>
                <th className="py-2 px-4">應收金額</th>
                <th className="py-2 px-4">未收款總額</th>
                <th className="py-2 px-4">最近上課</th>
                <th className="py-2 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <Fragment key={s.studentId}>
                  <tr
                    className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${
                      s.lowSessionsWarning ? "bg-red-50" : ""
                    }`}
                    onClick={() => setExpandedId(expandedId === s.studentId ? null : s.studentId)}
                  >
                    <td className="py-2 px-4 font-medium">
                      {s.studentName}
                      {s.lowSessionsWarning && (
                        <span className="ml-2 text-xs text-red-700 font-normal">堂數即將用完</span>
                      )}
                    </td>
                    <td className="py-2 px-4">{fmt(s.pricePerSession)}</td>
                    <td className="py-2 px-4">
                      {s.sessionsUsed}
                      {s.sessionsUsedManualOverride !== null && (
                        <span className="ml-1 text-xs text-slate-400">(已手動調整)</span>
                      )}
                    </td>
                    <td className={`py-2 px-4 font-semibold ${s.lowSessionsWarning ? "text-red-700" : ""}`}>
                      {s.sessionsRemaining} / {s.sessionsPurchased}
                    </td>
                    <td className="py-2 px-4">{fmt(s.amountDue)}</td>
                    <td className="py-2 px-4">{fmt(s.totalUnpaidAmount)}</td>
                    <td className="py-2 px-4 text-slate-500">{s.lastClassDate ?? "—"}</td>
                    <td className="py-2 px-4 text-slate-400 text-xs">
                      {expandedId === s.studentId ? "收合 ▲" : "展開 ▼"}
                    </td>
                  </tr>
                  {expandedId === s.studentId && (
                    <tr>
                      <td colSpan={8} className="px-4 pb-4">
                        <StudentDetail studentId={s.studentId} onChanged={loadDashboard} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
