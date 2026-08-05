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
}

interface ClassRecord {
  id: string;
  date: string;
  eventTitle: string;
  purchaseId: string | null;
}

export default function StudentDetail({
  studentId,
  onChanged,
}: {
  studentId: string;
  onChanged: () => void;
}) {
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [records, setRecords] = useState<ClassRecord[] | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newPurchase, setNewPurchase] = useState({
    purchaseDate: new Date().toISOString().slice(0, 10),
    sessionsPurchased: 10,
    pricePerSession: 0,
    paid: false,
  });
  const [busy, setBusy] = useState(false);

  async function load() {
    const [pRes, rRes] = await Promise.all([
      fetch(`/api/notion/purchases?studentId=${studentId}`),
      fetch(`/api/notion/classrecords?studentId=${studentId}`),
    ]);
    setPurchases((await pRes.json()).purchases);
    setRecords((await rRes.json()).records);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function togglePaid(purchase: Purchase) {
    setBusy(true);
    await fetch(`/api/notion/purchases/${purchase.id}`, {
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
    await fetch(`/api/notion/purchases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, ...newPurchase }),
    });
    setShowNewForm(false);
    await load();
    onChanged();
    setBusy(false);
  }

  if (!purchases || !records) {
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
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-1 pr-3">購買日期</th>
                <th className="py-1 pr-3">堂數</th>
                <th className="py-1 pr-3">單堂課費</th>
                <th className="py-1 pr-3">收款狀態</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3">{p.purchaseDate}</td>
                  <td className="py-1.5 pr-3">{p.sessionsPurchased}</td>
                  <td className="py-1.5 pr-3">{p.pricePerSession.toLocaleString()}</td>
                  <td className="py-1.5 pr-3">
                    {p.paid ? (
                      <span className="text-green-700">已收款{p.paidDate ? `（${p.paidDate}）` : ""}</span>
                    ) : (
                      <span className="text-amber-700">未收款</span>
                    )}
                  </td>
                  <td className="py-1.5">
                    <button
                      onClick={() => togglePaid(p)}
                      disabled={busy}
                      className="text-xs underline text-blue-700 disabled:opacity-50"
                    >
                      標記為{p.paid ? "未收款" : "已收款"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <h4 className="font-semibold mb-2">上課紀錄（最近優先）</h4>
        {records.length === 0 ? (
          <p className="text-slate-500">尚無上課紀錄</p>
        ) : (
          <ul className="space-y-1 max-h-56 overflow-y-auto">
            {records.map((r) => (
              <li key={r.id} className="flex justify-between border-b border-slate-100 py-1">
                <span>{r.date}</span>
                <span className="text-slate-500 truncate max-w-xs">{r.eventTitle}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
