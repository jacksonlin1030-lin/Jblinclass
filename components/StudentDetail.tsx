"use client";

import { useEffect, useState } from "react";

interface Purchase {
  id: string;
  studentId: string;
  purchaseDate: string;
  sessionsPurchased: number;
  pricePerSession: number;
  paid: boolean;
  paidDate: string | null;
  note: string;
  sessionsUsedManualOverride: number | null;
}

interface Session {
  studentId: string;
  date: string;
  eventTitle: string;
}

interface EditForm {
  purchaseDate: string;
  sessionsPurchased: string;
  pricePerSession: string;
  sessionsUsedManualOverride: string; // empty string = null (auto)
}

export default function StudentDetail({
  studentId,
  onChanged,
}: {
  studentId: string;
  onChanged: () => void;
}) {
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newPurchase, setNewPurchase] = useState({
    purchaseDate: new Date().toISOString().slice(0, 10),
    sessionsPurchased: 10,
    pricePerSession: 0,
    paid: false,
  });
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  async function load() {
    const [pRes, sRes] = await Promise.all([
      fetch(`/api/purchases?studentId=${studentId}`),
      fetch(`/api/sessions?studentId=${studentId}`),
    ]);
    setPurchases((await pRes.json()).purchases);
    setSessions((await sRes.json()).sessions);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function togglePaid(purchase: Purchase) {
    setBusy(true);
    await fetch(`/api/purchases/${purchase.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paid: !purchase.paid,
        paidDate: !purchase.paid ? new Date().toISOString().slice(0, 10) : null,
      }),
    });
    await load();
    onChanged();
    setBusy(false);
  }

  async function submitNewPurchase() {
    setBusy(true);
    await fetch(`/api/purchases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, ...newPurchase }),
    });
    setShowNewForm(false);
    await load();
    onChanged();
    setBusy(false);
  }

  function startEdit(p: Purchase) {
    setEditingId(p.id);
    setEditForm({
      purchaseDate: p.purchaseDate,
      sessionsPurchased: String(p.sessionsPurchased),
      pricePerSession: String(p.pricePerSession),
      sessionsUsedManualOverride:
        p.sessionsUsedManualOverride === null ? "" : String(p.sessionsUsedManualOverride),
    });
  }

  async function saveEdit(id: string) {
    if (!editForm) return;
    setBusy(true);
    await fetch(`/api/purchases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purchaseDate: editForm.purchaseDate,
        sessionsPurchased: Number(editForm.sessionsPurchased),
        pricePerSession: Number(editForm.pricePerSession),
        sessionsUsedManualOverride:
          editForm.sessionsUsedManualOverride === "" ? null : Number(editForm.sessionsUsedManualOverride),
      }),
    });
    setEditingId(null);
    setEditForm(null);
    await load();
    onChanged();
    setBusy(false);
  }

  if (!purchases || !sessions) {
    return <p className="text-sm text-slate-500 py-3">載入中…</p>;
  }

  return (
    <div className="bg-slate-50 rounded-md p-4 space-y-5 text-sm">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold">課程包購買紀錄</h4>
          <button
            onClick={() => setShowNewForm((v) => !v)}
            className="text-xs rounded border border-slate-300 px-2 py-1 hover:bg-slate-100"
          >
            {showNewForm ? "取消" : "+ 新增購買"}
          </button>
        </div>

        {showNewForm && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 items-end bg-white p-3 rounded border border-slate-200">
            <label className="text-xs">
              購買日期
              <input
                type="date"
                value={newPurchase.purchaseDate}
                onChange={(e) => setNewPurchase({ ...newPurchase, purchaseDate: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="text-xs">
              購買堂數
              <input
                type="number"
                value={newPurchase.sessionsPurchased}
                onChange={(e) =>
                  setNewPurchase({ ...newPurchase, sessionsPurchased: Number(e.target.value) })
                }
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="text-xs">
              單堂課費
              <input
                type="number"
                value={newPurchase.pricePerSession}
                onChange={(e) =>
                  setNewPurchase({ ...newPurchase, pricePerSession: Number(e.target.value) })
                }
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="text-xs flex items-center gap-1.5 pb-2">
              <input
                type="checkbox"
                checked={newPurchase.paid}
                onChange={(e) => setNewPurchase({ ...newPurchase, paid: e.target.checked })}
              />
              已收款
            </label>
            <button
              onClick={submitNewPurchase}
              disabled={busy}
              className="col-span-2 sm:col-span-4 rounded bg-slate-900 text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              儲存新購買紀錄
            </button>
          </div>
        )}

        {purchases.length === 0 ? (
          <p className="text-slate-500">尚無購買紀錄</p>
        ) : (
          <div className="space-y-2">
            {purchases.map((p) =>
              editingId === p.id && editForm ? (
                <div key={p.id} className="bg-white rounded border border-slate-300 p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs">
                      購買日期
                      <input
                        type="date"
                        value={editForm.purchaseDate}
                        onChange={(e) => setEditForm({ ...editForm, purchaseDate: e.target.value })}
                        className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1"
                      />
                    </label>
                    <label className="text-xs">
                      堂數
                      <input
                        type="number"
                        value={editForm.sessionsPurchased}
                        onChange={(e) => setEditForm({ ...editForm, sessionsPurchased: e.target.value })}
                        className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1"
                      />
                    </label>
                    <label className="text-xs">
                      單堂課費
                      <input
                        type="number"
                        value={editForm.pricePerSession}
                        onChange={(e) => setEditForm({ ...editForm, pricePerSession: e.target.value })}
                        className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1"
                      />
                    </label>
                    <label className="text-xs">
                      已用堂數覆蓋（留空=自動）
                      <input
                        type="number"
                        placeholder="自動"
                        value={editForm.sessionsUsedManualOverride}
                        onChange={(e) =>
                          setEditForm({ ...editForm, sessionsUsedManualOverride: e.target.value })
                        }
                        className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1"
                      />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(p.id)}
                      disabled={busy}
                      className="text-xs rounded bg-slate-900 text-white px-3 py-1.5 disabled:opacity-50"
                    >
                      存
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditForm(null);
                      }}
                      className="text-xs text-slate-400 px-3 py-1.5"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div key={p.id} className="bg-white rounded border border-slate-200 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium">{p.purchaseDate}</span>
                    {p.paid ? (
                      <span className="text-green-700 text-xs">已收款{p.paidDate ? `（${p.paidDate}）` : ""}</span>
                    ) : (
                      <span className="text-amber-700 text-xs">未收款</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mb-2">
                    堂數 <span className="text-slate-900">{p.sessionsPurchased}</span> ・ 單堂課費{" "}
                    <span className="text-slate-900">{p.pricePerSession.toLocaleString()}</span> ・ 已用堂數覆蓋{" "}
                    <span className="text-slate-900">
                      {p.sessionsUsedManualOverride === null ? "自動" : p.sessionsUsedManualOverride}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => startEdit(p)}
                      disabled={busy}
                      className="text-xs underline text-slate-600 disabled:opacity-50"
                    >
                      編輯
                    </button>
                    <button
                      onClick={() => togglePaid(p)}
                      disabled={busy}
                      className="text-xs underline text-blue-700 disabled:opacity-50"
                    >
                      標記為{p.paid ? "未收款" : "已收款"}
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      <div>
        <h4 className="font-semibold mb-2">上課紀錄（最近優先，來自日曆同步）</h4>
        {sessions.length === 0 ? (
          <p className="text-slate-500">尚無上課紀錄</p>
        ) : (
          <ul className="space-y-1 max-h-56 overflow-y-auto">
            {sessions.map((s, i) => (
              <li key={i} className="flex justify-between border-b border-slate-100 py-1 gap-3">
                <span className="shrink-0">{s.date}</span>
                <span className="text-slate-500 truncate">{s.eventTitle}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
