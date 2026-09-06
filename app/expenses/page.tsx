"use client";

import { useEffect, useMemo, useState } from "react";

type TransactionType = "income" | "expense";

interface Category {
  id: string;
  name: string;
  type: TransactionType;
  group: string;
}

interface LedgerEntry {
  id: string;
  type: TransactionType;
  date: string;
  amount: number;
  categoryId: string;
  note: string;
  source: "manual" | "teaching-sync";
  studentName?: string;
}

interface MonthlySummary {
  monthKey: string;
  totalIncome: number;
  totalExpense: number;
  net: number;
  byCategory: { categoryId: string; type: TransactionType; amount: number }[];
}

interface FormState {
  type: TransactionType;
  date: string;
  amount: string;
  categoryId: string;
  note: string;
}

const TEACHING_INCOME_LABEL = "教學收入（自動帶入）";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(type: TransactionType, categories: { expense: Category[]; income: Category[] }): FormState {
  const first = (type === "income" ? categories.income : categories.expense)[0];
  return { type, date: todayStr(), amount: "", categoryId: first?.id ?? "", note: "" };
}

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function fmt(n: number | null | undefined) {
  return (typeof n === "number" && !Number.isNaN(n) ? n : 0).toLocaleString();
}

function groupCategories(categories: Category[]): { group: string; items: Category[] }[] {
  const groups: { group: string; items: Category[] }[] = [];
  for (const c of categories) {
    let g = groups.find((g) => g.group === c.group);
    if (!g) {
      g = { group: c.group, items: [] };
      groups.push(g);
    }
    g.items.push(c);
  }
  return groups;
}

export default function ExpensesPage() {
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [categories, setCategories] = useState<{ expense: Category[]; income: Category[] }>({
    expense: [],
    income: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState | null>(null);

  async function load(month?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(month ? `/api/transactions?month=${month}` : "/api/transactions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMonthKey(data.monthKey);
      setEntries(data.entries);
      setSummary(data.summary);
      setCategories(data.categories);
      setForm((prev) => prev ?? emptyForm("expense", data.categories));
    } catch (err: any) {
      setError(err.message ?? "讀取記帳資料失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function categoryName(entry: LedgerEntry): string {
    if (entry.source === "teaching-sync") return TEACHING_INCOME_LABEL;
    const list = entry.type === "income" ? categories.income : categories.expense;
    return list.find((c) => c.id === entry.categoryId)?.name ?? entry.categoryId;
  }

  function switchFormType(type: TransactionType) {
    setForm(emptyForm(type, categories));
  }

  async function submitNew() {
    if (!form || !form.amount || !form.categoryId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm(emptyForm(form.type, categories));
      await load(monthKey ?? undefined);
    } catch (err: any) {
      setError(err.message ?? "新增交易失敗");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(entry: LedgerEntry) {
    setEditingId(entry.id);
    setEditForm({
      type: entry.type,
      date: entry.date,
      amount: String(entry.amount),
      categoryId: entry.categoryId,
      note: entry.note,
    });
  }

  async function saveEdit(id: string) {
    if (!editForm) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, amount: Number(editForm.amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditingId(null);
      setEditForm(null);
      await load(monthKey ?? undefined);
    } catch (err: any) {
      setError(err.message ?? "更新交易失敗");
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load(monthKey ?? undefined);
    } catch (err: any) {
      setError(err.message ?? "刪除交易失敗");
    } finally {
      setBusy(false);
    }
  }

  const categoryGroups = useMemo(
    () => (form?.type === "income" ? [{ group: "收入", items: categories.income }] : groupCategories(categories.expense)),
    [form?.type, categories]
  );
  const editCategoryGroups = useMemo(
    () =>
      editForm?.type === "income" ? [{ group: "收入", items: categories.income }] : groupCategories(categories.expense),
    [editForm?.type, categories]
  );

  return (
    <div className="space-y-5 pb-16">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">記帳</h1>
        {monthKey && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => load(shiftMonth(monthKey, -1))}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100"
            >
              ← 上月
            </button>
            <span className="font-medium text-sm w-20 text-center">{monthKey}</span>
            <button
              onClick={() => load(shiftMonth(monthKey, 1))}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100"
            >
              下月 →
            </button>
          </div>
        )}
      </div>

      <p className="text-sm text-slate-600">
        教學收入會自動從「學生管理」裡已收款的課程包帶進來，不用在這裡重複輸入；其他生活收支才需要手動記錄。
      </p>

      {error && (
        <div className="rounded-md bg-red-50 text-red-800 px-4 py-2 text-sm border border-red-200">{error}</div>
      )}

      {summary && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <div className="text-xs text-slate-500">本月總收入</div>
              <div className="text-lg font-semibold text-green-700">{fmt(summary.totalIncome)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">本月總支出</div>
              <div className="text-lg font-semibold text-red-700">{fmt(summary.totalExpense)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">淨結餘</div>
              <div className={`text-lg font-semibold ${summary.net < 0 ? "text-red-700" : "text-slate-900"}`}>
                {fmt(summary.net)}
              </div>
            </div>
          </div>
          {summary.byCategory.length > 0 && (
            <div className="border-t border-slate-100 pt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
              {summary.byCategory.map((c) => (
                <div key={c.categoryId} className="flex justify-between text-slate-600">
                  <span>
                    {c.categoryId === "teaching-income"
                      ? TEACHING_INCOME_LABEL
                      : (c.type === "income" ? categories.income : categories.expense).find(
                          (cat) => cat.id === c.categoryId
                        )?.name ?? c.categoryId}
                  </span>
                  <span className={c.type === "income" ? "text-green-700" : "text-red-700"}>{fmt(c.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {form && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => switchFormType("expense")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
                form.type === "expense" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600"
              }`}
            >
              支出
            </button>
            <button
              onClick={() => switchFormType("income")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
                form.type === "income" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600"
              }`}
            >
              收入
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <label className="text-xs">
              日期
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="text-xs">
              金額
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="text-xs">
              分類
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              >
                {categoryGroups.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="text-xs">
              備註
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="選填"
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              />
            </label>
          </div>
          <button
            onClick={submitNew}
            disabled={busy || !form.amount || !form.categoryId}
            className="rounded-md bg-slate-900 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            新增一筆
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">載入中…</p>
      ) : !entries || entries.length === 0 ? (
        <p className="text-slate-500">這個月還沒有任何記錄。</p>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {entries.map((entry) =>
            editingId === entry.id && editForm ? (
              <div key={entry.id} className="p-3 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <label className="text-xs">
                    日期
                    <input
                      type="date"
                      value={editForm.date}
                      onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                      className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1"
                    />
                  </label>
                  <label className="text-xs">
                    金額
                    <input
                      type="number"
                      value={editForm.amount}
                      onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                      className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1"
                    />
                  </label>
                  <label className="text-xs">
                    分類
                    <select
                      value={editForm.categoryId}
                      onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                      className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1"
                    >
                      {editCategoryGroups.map((g) => (
                        <optgroup key={g.group} label={g.group}>
                          {g.items.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs">
                    備註
                    <input
                      value={editForm.note}
                      onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                      className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(entry.id)}
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
              <div key={entry.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500 shrink-0">{entry.date}</span>
                    <span className="font-medium truncate">{categoryName(entry)}</span>
                    {entry.source === "teaching-sync" && (
                      <span className="text-xs text-slate-400 border border-slate-300 rounded px-1.5 py-0.5 shrink-0">
                        自動
                      </span>
                    )}
                  </div>
                  {entry.note && <div className="text-xs text-slate-400 truncate">{entry.note}</div>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-semibold ${entry.type === "income" ? "text-green-700" : "text-red-700"}`}>
                    {entry.type === "income" ? "+" : "-"}
                    {fmt(entry.amount)}
                  </span>
                  {entry.source === "manual" && (
                    <>
                      <button onClick={() => startEdit(entry)} disabled={busy} className="text-xs underline text-slate-600">
                        編輯
                      </button>
                      <button onClick={() => removeEntry(entry.id)} disabled={busy} className="text-xs underline text-red-600">
                        刪除
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
