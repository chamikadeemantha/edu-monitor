"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserCheck, BarChart3, ClipboardList } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// ✅ Centralized route (so you can change in one place later)
const SURVEY_ROUTE = "/student/dashboard/attendance/survey";

type MarkRes = {
  ok: boolean;
  message: string;
  module_code?: string;
  module_name?: string;
  marked_at?: string;
  remaining_slots?: number;
  max_students?: number;
};

export default function StudentAttendancePage() {
  const [studentId, setStudentId] = useState("");
  const [pin, setPin] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [data, setData] = useState<MarkRes | null>(null);

  const [history, setHistory] = useState<
    { module_code: string; module_name: string; marked_at: string }[]
  >([]);

  async function submitAttendance() {
    setLoading(true);
    setMsg(null);
    setSuccess(false);

    try {
      if (!studentId.trim()) throw new Error("Student ID is required");
      if (!/^\d{6}$/.test(pin.trim())) throw new Error("PIN must be 6 digits");

      const res = await fetch(`${API}/api/attendance/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId.trim(),
          pin: pin.trim(),
        }),
      });

      const json = (await res.json()) as MarkRes;

      if (!res.ok || !json.ok) {
        throw new Error((json as any)?.message || "Failed to mark attendance");
      }

      setSuccess(true);
      setMsg(json.message || "Attendance marked!");
      setData(json);
      setPin("");

      if (json.module_code && json.module_name && json.marked_at) {
        setHistory((prev) => [
          { module_code: json.module_code!, module_name: json.module_name!, marked_at: json.marked_at! },
          ...prev,
        ]);
      }
    } catch (e: any) {
      setSuccess(false);
      setMsg(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  const moduleStats = useMemo(() => {
    const map = new Map<string, { module_name: string; count: number }>();
    for (const h of history) {
      const key = h.module_code;
      const prev = map.get(key);
      if (!prev) map.set(key, { module_name: h.module_name, count: 1 });
      else map.set(key, { module_name: prev.module_name, count: prev.count + 1 });
    }
    return Array.from(map.entries()).map(([module_code, v]) => ({
      module_code,
      module_name: v.module_name,
      count: v.count,
    }));
  }, [history]);

  const maxStudents = data?.max_students ?? undefined;
  const remaining = typeof data?.remaining_slots === "number" ? data.remaining_slots : undefined;

  const markedCount = useMemo(() => {
    if (typeof maxStudents === "number" && typeof remaining === "number") {
      return Math.max(0, maxStudents - remaining);
    }
    return undefined;
  }, [maxStudents, remaining]);

  const progressPct = useMemo(() => {
    if (typeof maxStudents === "number" && typeof markedCount === "number" && maxStudents > 0) {
      return Math.min(100, Math.round((markedCount / maxStudents) * 100));
    }
    return undefined;
  }, [maxStudents, markedCount]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/student/dashboard"
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-800"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </Link>
          <h2 className="text-lg font-semibold text-gray-200">Student Attendance</h2>
        </div>

        {/* ============================================================
           ✅✅✅ TAKE SURVEY BUTTON (ROUTE FIXED)
           This button should go to:
           http://localhost:3000/student/dashboard/attendance/survey
           If you ever change the route, update SURVEY_ROUTE only.
           ============================================================ */}
        <div className="flex items-center gap-3">
          <Link
            href={SURVEY_ROUTE}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            title="Take Attendance Factors Survey"
          >
            <ClipboardList size={18} />
            Take Survey
          </Link>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-sm text-emerald-400">System Online</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-8">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <UserCheck className="text-emerald-600" />
              Attendance
            </h1>
            <p className="text-gray-400">
              Enter the 6-digit PIN provided by your lecturer to mark attendance.
            </p>
          </div>

          {/* ============================================================
             ✅✅✅ SECOND TAKE SURVEY BUTTON (ROUTE FIXED)
             ============================================================ */}
          <Link
            href={SURVEY_ROUTE}
            className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-700"
          >
            <ClipboardList size={18} className="text-blue-400" />
            Take Attendance Survey
          </Link>
        </header>

        {msg && (
          <div
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              success
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {msg}
          </div>
        )}

        <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm font-medium text-gray-300">
              Student ID
              <input
                className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-gray-400"
                placeholder="e.g., IT20231234"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              />
            </label>

            <label className="text-sm font-medium text-gray-300">
              PIN (6 digits)
              <input
                className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 tracking-widest text-white placeholder-gray-400"
                placeholder="e.g., 123456"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
              />
            </label>
          </div>

          <button
            onClick={submitAttendance}
            disabled={loading}
            className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Submitting..." : "Submit Attendance"}
          </button>

          {/* ============================================================
             ✅✅✅ THIRD TAKE SURVEY BUTTON (ROUTE FIXED)
             ============================================================ */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
            <div className="text-gray-400">
              For early warning analytics, please complete the Attendance Factors Survey.
            </div>
            <Link
              href={SURVEY_ROUTE}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
            >
              <ClipboardList size={18} />
              Take Survey
            </Link>
          </div>

          {data?.module_code && (
            <div className="mt-6 rounded-lg bg-gray-700/50 border border-gray-600 p-4">
              <div className="text-sm text-gray-400">
                Marked for:
                <span className="font-semibold text-white ml-1">
                  {data.module_code} — {data.module_name}
                </span>
              </div>

              {data.marked_at && (
                <div className="text-sm text-gray-400 mt-1">
                  Time:{" "}
                  <span className="font-medium text-white">
                    {new Date(data.marked_at).toLocaleString()}
                  </span>
                </div>
              )}

              {typeof data.remaining_slots === "number" && (
                <div className="text-sm text-gray-400 mt-1">
                  Remaining slots:{" "}
                  <span className="font-medium text-white">{data.remaining_slots}</span>
                </div>
              )}

              {typeof progressPct === "number" && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Marked: {markedCount}/{maxStudents}</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-600 overflow-hidden">
                    <div className="h-2 bg-emerald-500" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* VISUALIZATION */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-sm p-6">
            <div className="text-sm text-gray-400">Last Module</div>
            <div className="mt-2 text-lg font-bold">{data?.module_name ?? "—"}</div>
            <div className="text-sm text-gray-500 mt-1">{data?.module_code ?? ""}</div>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-sm p-6">
            <div className="text-sm text-gray-400">Attendance Records (local)</div>
            <div className="mt-2 text-3xl font-bold">{history.length}</div>
            <div className="text-sm text-gray-500 mt-1">Total marks done</div>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-sm p-6">
            <div className="text-sm text-gray-400">Remaining Slots</div>
            <div className="mt-2 text-3xl font-bold">
              {typeof remaining === "number" ? remaining : "—"}
            </div>
            <div className="text-sm text-gray-500 mt-1">For current session</div>
          </div>

          <div className="lg:col-span-3 bg-gray-800 rounded-xl border border-gray-700 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-200 flex items-center gap-2">
                <BarChart3 size={18} className="text-gray-400" />
                Attendance Summary (by module)
              </h2>
              <div className="text-xs text-gray-500">
                (This chart uses local history until DB is connected)
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {moduleStats.length === 0 ? (
                <div className="text-sm text-gray-500">
                  No attendance yet. Submit once to see stats.
                </div>
              ) : (
                moduleStats.map((m) => {
                  const max = Math.max(...moduleStats.map((x) => x.count), 1);
                  const w = Math.round((m.count / max) * 100);
                  return (
                    <div key={m.module_code} className="w-full">
                      <div className="flex justify-between text-sm mb-1">
                        <div className="font-medium text-gray-200">
                          {m.module_code} — <span className="text-gray-400">{m.module_name}</span>
                        </div>
                        <div className="font-semibold">{m.count}</div>
                      </div>
                      <div className="h-3 rounded-full bg-gray-700 overflow-hidden">
                        <div className="h-3 bg-emerald-500" style={{ width: `${w}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
