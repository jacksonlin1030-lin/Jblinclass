"use client";

import { Fragment, useEffect, useState } from "react";
import StudentDetail from "@/components/StudentDetail";

interface Student {
  id: string;
  name: string;
  active: boolean;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/students");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setStudents(data.students);
  }

  useEffect(() => {
    load();
  }, []);

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewName("");
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(student: Student) {
    await fetch(`/api/students/${student.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !student.active }),
    });
    await load();
  }

  return (
    <div className="space-y-6 pb-16">
      <h1 className="text-2xl font-bold">學生管理</h1>
      <p className="text-sm text-slate-600">
        這裡是唯一需要手動維護學生名單的地方。姓名要跟 Google 日曆事件標題「包含」的字串一致，同步時才比對得到。
      </p>

      {error && (
        <div className="rounded-md bg-red-50 text-red-800 px-4 py-2 text-sm border border-red-200">{error}</div>
      )}

      <form onSubmit={addStudent} className="flex gap-2 bg-white border border-slate-200 rounded-md p-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="新學生姓名"
          className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={adding}
          className="rounded-md bg-slate-900 text-white px-4 py-1.5 text-sm font-medium disabled:opacity-50 shrink-0"
        >
          新增學生
        </button>
      </form>

      {!students ? (
        <p className="text-slate-500">載入中…</p>
      ) : students.length === 0 ? (
        <p className="text-slate-500">尚未新增任何學生，請在上方輸入姓名新增。</p>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {students.map((s) => (
            <Fragment key={s.id}>
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50"
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  {!s.active && <span className="text-xs text-slate-400 border border-slate-300 rounded px-1.5 py-0.5">停用</span>}
                </div>
                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => toggleActive(s)}
                    className="text-xs underline text-blue-700"
                  >
                    標記為{s.active ? "停用" : "啟用"}
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    className="text-xs text-slate-400"
                  >
                    {expandedId === s.id ? "收合 ▲" : "課程包/上課紀錄 ▼"}
                  </button>
                </div>
              </div>
              {expandedId === s.id && (
                <div className="px-4 pb-4">
                  <StudentDetail studentId={s.id} onChanged={load} />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
