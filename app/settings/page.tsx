"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GOOGLE_EVENT_COLORS } from "@/lib/types";

interface SettingsResponse {
  settings: {
    lowSessionThreshold: number;
    calendarId: string;
    defaultVenueRentalFee: number;
    classEventColorId: string;
  };
  google: { connected: boolean; clientIdConfigured: boolean; redirectUri: string };
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">載入中…</p>}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [calendarId, setCalendarId] = useState("primary");
  const [lowSessionThreshold, setLowSessionThreshold] = useState(2);
  const [defaultVenueRentalFee, setDefaultVenueRentalFee] = useState(0);
  const [classEventColorId, setClassEventColorId] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings");
    const json: SettingsResponse = await res.json();
    setData(json);
    setCalendarId(json.settings.calendarId);
    setLowSessionThreshold(json.settings.lowSessionThreshold);
    setDefaultVenueRentalFee(json.settings.defaultVenueRentalFee);
    setClassEventColorId(json.settings.classEventColorId);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const connected = searchParams.get("google_connected");
    const error = searchParams.get("google_error");
    if (connected) setMessage("Google 日曆已成功連接！");
    if (error) setMessage(`Google 授權失敗：${error}`);
  }, [searchParams]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowSessionThreshold, calendarId, defaultVenueRentalFee }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMessage("設定已儲存");
      await load();
    } catch (err: any) {
      setMessage(`儲存失敗：${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function selectClassColor(colorId: string) {
    setClassEventColorId(colorId);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classEventColorId: colorId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMessage(colorId ? "已設定上課顏色，下次同步就會套用" : "已取消顏色篩選，會比對所有日曆事件");
    } catch (err: any) {
      setMessage(`儲存失敗：${err.message}`);
    }
  }

  if (loading || !data) return <p className="text-slate-500">載入中…</p>;

  return (
    <div className="space-y-8 pb-16">
      <h1 className="text-2xl font-bold">設定</h1>
      {message && (
        <div className="rounded-md bg-blue-50 text-blue-800 px-4 py-2 text-sm border border-blue-200">
          {message}
        </div>
      )}

      <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <h2 className="text-lg font-semibold">Google 日曆連接</h2>
        {!data.google.clientIdConfigured ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
            尚未設定 <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code> 環境變數，
            請到 Vercel 專案設定加入（步驟見 README），加入後重新部署才會生效。
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <a
              href="/api/google/auth"
              className="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium"
            >
              {data.google.connected ? "重新連接 Google 日曆" : "連接 Google 日曆"}
            </a>
            <span className={`text-sm ${data.google.connected ? "text-green-700" : "text-slate-500"}`}>
              {data.google.connected ? "✓ 已連接" : "尚未連接"}
            </span>
          </div>
        )}
        <p className="text-xs text-slate-400">
          重新導向 URI：<code>{data.google.redirectUri}</code>（需與 Google Cloud Console 設定的一致）
        </p>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <h2 className="text-lg font-semibold">上課事件顏色篩選</h2>
        <p className="text-sm text-slate-600">
          在 Google 日曆裡，把每一堂課的事件都設成同一個顏色，這裡選同一個顏色，同步時就只會比對這個顏色的事件——你排的其他行程（用別的顏色）不會被誤算成課程，就算標題剛好提到學生的名字也一樣。
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => selectClassColor("")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
              classEventColorId === ""
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-600"
            }`}
          >
            不篩選（比對所有事件）
          </button>
          {GOOGLE_EVENT_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => selectClassColor(c.id)}
              title={c.name}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border ${
                classEventColorId === c.id ? "border-slate-900 ring-2 ring-slate-900" : "border-slate-300"
              }`}
            >
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: c.hex }} />
              {c.name}
            </button>
          ))}
        </div>
        {classEventColorId && (
          <p className="text-xs text-slate-400">
            目前只會比對 Google 日曆上顏色為「
            {GOOGLE_EVENT_COLORS.find((c) => c.id === classEventColorId)?.name}」的事件。
          </p>
        )}
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <h2 className="text-lg font-semibold">同步設定</h2>
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
          <label className="text-sm">
            預設每月場地租借費用（每月自動延用，當月要改可在儀表板上直接編輯）
            <input
              type="number"
              min={0}
              value={defaultVenueRentalFee}
              onChange={(e) => setDefaultVenueRentalFee(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5"
            />
          </label>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-slate-900 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "儲存中…" : "儲存"}
        </button>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-2">
        <h2 className="text-lg font-semibold">網站密碼</h2>
        <p className="text-sm text-slate-600">
          網站密碼是透過 Vercel 環境變數 <code>APP_PASSWORD</code> 設定的，不會顯示在這裡。要更換密碼請到 Vercel
          專案設定修改這個環境變數並重新部署。
        </p>
      </section>
    </div>
  );
}
