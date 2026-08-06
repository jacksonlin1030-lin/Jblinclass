"use client";

import { useEffect, useMemo, useState } from "react";
import StudentDetail from "@/components/StudentDetail";

interface StudentMetrics {
  studentId: string;
  studentName: string;
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

interface SyncRunSummary {
  monthKey: string;
  runAt: string;
  triggeredBy: "manual" | "cron";
  sessionCount: number;
  confirmedSessionCount: number;
  unmatchedEvents: { eventId: string; title: string; date: string }[];
  multiMatchWarnings: { eventTitle: string; date: string; studentNames: string[] }[];
  error?: string;
}

interface MonthlyProjection {
  monthKey: string;
  sessionCount: number;
  confirmedSessionCount: number;
  estimatedRevenue: number;
  venueFee: number;
  venueFeeIsOverride: boolean;
  netIncome: number;
}

function fmt(n: number) {
  return n.toLocaleString();
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("zh-TW", { hour12: false });
}

export default function DashboardPage() {
  const [students, setStudents] = useState<StudentMetrics[] | null>(null);
  const [lastRun, setLastRun] = useState<SyncRunSummary | null>(null);
  const [projection, setProjection] = useState<MonthlyProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingVenueFee, setEditingVenueFee] = useState(false);
  const [venueFeeInput, setVenueFeeInput] = useState("0");
  const [savingVenueFee, setSavingVenueFee] = useState(false);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStudents(data.students);
      setLastRun(data.lastRun);
      setProjection(data.projection);
      if (data.projection) setVenueFeeInput(String(data.projection.venueFee));
    } catch (err: any) {
      setError(err.message ?? "讀取儀表板資料失敗，請確認 /settings 中的設定");
    } finally {
      setLoading(false);
    }
  }

  async function saveVenueFee() {
    setSavingVenueFee(true);
    try {
      const res = await fetch("/api/venue-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fee: Number(venueFeeInput) }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditingVenueFee(false);
      await loadDashboard();
    } catch (err: any) {
      setError(err.message ?? "更新場地租借費用失敗");
    } finally {
      setSavingVenueFee(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function runSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
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
    <div className="space-y-5 pb-16">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">儀表板</h1>
        <button
          onClick={runSync}
          disabled={syncing}
          className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 shrink-0"
        >
          {syncing ? "同步中…" : "立即同步"}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 text-red-800 px-4 py-2 text-sm border border-red-200">{error}</div>
      )}

      {projection && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm text-slate-500">{projection.monthKey} 本月預估（含已排定未來課程）</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-slate-500">預估課程數量</div>
              <div className="text-lg font-semibold text-slate-900">
                {projection.sessionCount}
                <span className="text-xs font-normal text-slate-400"> 堂（已上 {projection.confirmedSessionCount}）</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">預估課程收入</div>
              <div className="text-lg font-semibold text-slate-900">{fmt(projection.estimatedRevenue)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 flex items-center gap-1">
                場地租借費用
                {!editingVenueFee && (
                  <button
                    onClick={() => {
                      setVenueFeeInput(String(projection.venueFee));
                      setEditingVenueFee(true);
                    }}
                    className="text-blue-700 underline"
                  >
                    編輯
                  </button>
                )}
              </div>
              {editingVenueFee ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="number"
                    value={venueFeeInput}
                    onChange={(e) => setVenueFeeInput(e.target.value)}
                    className="w-20 rounded border border-slate-300 px-1.5 py-0.5 text-sm"
                  />
                  <button
                    onClick={saveVenueFee}
                    disabled={savingVenueFee}
                    className="text-xs rounded bg-slate-900 text-white px-2 py-1 disabled:opacity-50"
                  >
                    存
                  </button>
                  <button onClick={() => setEditingVenueFee(false)} className="text-xs text-slate-400">
                    取消
                  </button>
                </div>
              ) : (
                <div className="text-lg font-semibold text-slate-900">
                  {fmt(projection.venueFee)}
                  {!projection.venueFeeIsOverride && <span className="text-xs font-normal text-slate-400"> (預設)</span>}
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-slate-500">淨收入（扣場地費）</div>
              <div className={`text-lg font-semibold ${projection.netIncome < 0 ? "text-red-700" : "text-green-700"}`}>
                {fmt(projection.netIncome)}
              </div>
            </div>
          </div>
        </div>
      )}

      {lastRun && (
        <div className="rounded-md bg-slate-100 text-slate-600 px-4 py-2 text-xs">
          {lastRun.monthKey} 月同步於 {fmtTime(lastRun.runAt)}（
          {lastRun.triggeredBy === "cron" ? "自動排程" : "手動"}），本月共 {lastRun.sessionCount} 堂課（已上{" "}
          {lastRun.confirmedSessionCount} 堂）
          {lastRun.error && <span className="text-red-600 ml-2">上次執行失敗：{lastRun.error}</span>}
        </div>
      )}

      {lastRun && lastRun.unmatchedEvents.length > 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-300 p-4">
          <h3 className="font-semibold text-amber-900 mb-2 text-sm">
            ⚠️ 有 {lastRun.unmatchedEvents.length} 個日曆事件比對不到任何學生（可能是新學生或標題打錯字）
          </h3>
          <ul className="text-sm text-amber-900 space-y-1">
            {lastRun.unmatchedEvents.map((e) => (
              <li key={e.eventId}>
                {e.date} — 「{e.title}」
              </li>
            ))}
          </ul>
        </div>
      )}

      {lastRun && lastRun.multiMatchWarnings.length > 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-300 p-4">
          <h3 className="font-semibold text-amber-900 mb-2 text-sm">⚠️ 有事件標題同時比對到多位學生，請確認是否正確</h3>
          <ul className="text-sm text-amber-900 space-y-1">
            {lastRun.multiMatchWarnings.map((m, i) => (
              <li key={i}>
                {m.date} — 「{m.eventTitle}」 → {m.studentNames.join("、")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">載入中…</p>
      ) : !students || students.length === 0 ? (
        <p className="text-slate-500">
          尚無啟用中的學生。請先到 <a href="/students" className="underline text-blue-700">學生管理</a> 頁面新增學生。
        </p>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">
            累計未收款金額：<span className="font-semibold text-slate-900">{fmt(totalUnpaid)}</span>
          </div>

          <div className="space-y-2">
            {students.map((s) => (
              <div
                key={s.studentId}
                className={`bg-white rounded-lg border overflow-hidden ${
                  s.lowSessionsWarning ? "border-red-300" : "border-slate-200"
                }`}
              >
                <button
                  onClick={() => setExpandedId(expandedId === s.studentId ? null : s.studentId)}
                  className={`w-full text-left px-4 py-3 ${s.lowSessionsWarning ? "bg-red-50" : ""}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{s.studentName}</span>
                    {s.lowSessionsWarning && (
                      <span className="text-xs text-red-700 font-medium">堂數即將用完</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-slate-600">
                    <div>
                      單堂課費 <span className="text-slate-900 font-medium">{fmt(s.pricePerSession)}</span>
                    </div>
                    <div>
                      剩餘堂數{" "}
                      <span className={`font-medium ${s.lowSessionsWarning ? "text-red-700" : "text-slate-900"}`}>
                        {s.sessionsRemaining} / {s.sessionsPurchased}
                      </span>
                      {s.sessionsUsedManualOverride !== null && (
                        <span className="text-slate-400"> (已手動調整)</span>
                      )}
                    </div>
                    <div>
                      應收金額 <span className="text-slate-900 font-medium">{fmt(s.amountDue)}</span>
                    </div>
                    <div>
                      未收款總額 <span className="text-slate-900 font-medium">{fmt(s.totalUnpaidAmount)}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-4 text-slate-400">
                      最近上課：{s.lastClassDate ?? "—"}
                    </div>
                  </div>
                </button>
                {expandedId === s.studentId && (
                  <div className="px-4 pb-4">
                    <StudentDetail studentId={s.studentId} onChanged={loadDashboard} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
