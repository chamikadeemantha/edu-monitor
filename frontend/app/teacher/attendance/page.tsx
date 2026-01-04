"use client";

import { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type SessionRes = {
  session_id: string;
  module_code: string;
  module_name: string;
  year: string;
  faculty: string;
  batch: string;
  start_time: string;
  end_time: string;
  hours: number;
  location: string;

  pin: string;
  pin_expires_at: string;
  max_students: number;
  remaining_slots: number;
  regen_left: number;
};

type SessionDetailRes = SessionRes & {
  attendance_count: number;
  attendance: {
    student_id: string;
    student_name?: string;
    selfie_base64?: string;
    marked_at: string;
  }[];
};

const MODULES = [
  { code: "IT3071", name: "Machine Learning and Optimization Methods" },
  { code: "IT3061", name: "Massive Data Processing and Cloud Computing" },
  { code: "IT3041", name: "Information Retrieval and Web Analytics" },
  { code: "IT3021", name: "Data Warehousing and Business Intelligence" },
  { code: "IT3011", name: "Theory and Practices in Statistical Modelling" },
  { code: "IT4010", name: "Research Project (Comprehensive Design and Analysis Project)" },
  { code: "IT4140", name: "Industry Placement - 6 Months" },
  { code: "IT4030", name: "Internet of Things" },
  { code: "IT4041", name: "Introduction to Information Security Analytics" },
  { code: "IT4011", name: "Database Administration and Storage Systems" },
  { code: "IT4031", name: "Visual Analytics and User Experience Design" },
];

export default function AttendancePage() {
  const [moduleCode, setModuleCode] = useState(MODULES[0].code);

  const moduleName = useMemo(
    () => MODULES.find((m) => m.code === moduleCode)?.name ?? "",
    [moduleCode]
  );

  const [year, setYear] = useState("2025");
  const [faculty, setFaculty] = useState("Computing");
  const [batch, setBatch] = useState("Batch 20");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [hours, setHours] = useState(2);
  const [location, setLocation] = useState("Lab 01");
  const [maxStudents, setMaxStudents] = useState(60);
  const [expiryMinutes, setExpiryMinutes] = useState(10);
  const [regenLimit, setRegenLimit] = useState(3);

  const [session, setSession] = useState<SessionRes | null>(null);
  const [detail, setDetail] = useState<SessionDetailRes | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pollOn, setPollOn] = useState(false);

  async function createSession() {
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch(`${API}/api/attendance/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_code: moduleCode,
          module_name: moduleName,
          year,
          faculty,
          batch,
          start_time: startTime || "now",
          end_time: endTime || "later",
          hours,
          location,
          max_students: maxStudents,
          expiry_minutes: expiryMinutes,
          regen_limit: regenLimit,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to create session");

      setSession(data);
      setPollOn(true);
      await loadDetail(data.session_id);
    } catch (e: any) {
      setMsg(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  async function regeneratePin() {
    if (!session) return;

    setMsg(null);
    try {
      const res = await fetch(
        `${API}/api/attendance/sessions/${session.session_id}/regenerate-pin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiry_minutes: expiryMinutes }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to regenerate PIN");
      setSession(data);
    } catch (e: any) {
      setMsg(e?.message || "Error");
    }
  }

  async function loadDetail(forcedSessionId?: string) {
    const sid = forcedSessionId || session?.session_id;
    if (!sid) return;

    const res = await fetch(`${API}/api/attendance/sessions/${sid}`);
    const data = await res.json();
    if (res.ok) setDetail(data);
  }

  useEffect(() => {
    if (!pollOn || !session) return;

    loadDetail();
    const t = setInterval(() => loadDetail(), 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollOn, session?.session_id]);

  const expiresIn = useMemo(() => {
    if (!session) return null;
    const exp = new Date(session.pin_expires_at).getTime();
    const diff = Math.max(0, exp - Date.now());
    return Math.ceil(diff / 1000);
  }, [session, detail]);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden">
      <header className="h-16 bg-gray-800/50 backdrop-blur border-b border-gray-700 flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
        <h2 className="text-lg font-semibold text-gray-200">
          Student Attendance
        </h2>
        <div className="flex items-center gap-4">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-sm text-emerald-400">System Online</span>
        </div>
      </header>

      <main className="p-8 flex-1 overflow-auto">
        <div className="mb-6 gap-6">
          <h1 className="text-2xl font-bold">Student Attendance</h1>
          <p className="text-gray-400">Create session → generate PIN → watch live check-ins.</p>
        </div>

        {msg && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
            {msg}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Session creator */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-lg font-semibold">Lecture Setup</h2>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm text-gray-300">
                Module Code
                <select
                  className="mt-1 w-full rounded-lg bg-gray-900 border border-gray-700 p-2 text-white outline-none"
                  value={moduleCode}
                  onChange={(e) => setModuleCode(e.target.value)}
                >
                  {MODULES.map((m) => (
                    <option key={m.code} value={m.code} className="bg-gray-900 text-white">
                      {m.code}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-gray-300">
                Module Name (auto)
                <input
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={moduleName}
                  readOnly
                />
              </label>

              <label className="text-sm text-gray-300">
                Year
                <input
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </label>

              <label className="text-sm text-gray-300">
                Faculty
                <input
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                />
              </label>

              <label className="text-sm text-gray-300">
                Batch
                <input
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                />
              </label>

              <label className="text-sm text-gray-300">
                Location
                <input
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </label>

              <label className="text-sm text-gray-300">
                Start Time
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </label>

              <label className="text-sm text-gray-300">
                End Time
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </label>

              <label className="text-sm text-gray-300">
                Hours
                <input
                  type="number"
                  step="0.5"
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                />
              </label>

              <label className="text-sm text-gray-300">
                Student Count (max check-ins)
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={maxStudents}
                  onChange={(e) => setMaxStudents(Number(e.target.value))}
                />
              </label>

              <label className="text-sm text-gray-300">
                PIN Expiry (minutes)
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={expiryMinutes}
                  onChange={(e) => setExpiryMinutes(Number(e.target.value))}
                />
              </label>

              <label className="text-sm text-gray-300">
                PIN Regenerate Limit
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg bg-black/20 border border-white/10 p-2 text-white outline-none"
                  value={regenLimit}
                  onChange={(e) => setRegenLimit(Number(e.target.value))}
                />
              </label>
            </div>

            <button
              onClick={createSession}
              disabled={loading}
              className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500 disabled:opacity-60"
            >
              {loading ? "Generating..." : "Generate PIN"}
            </button>
          </div>

          {/* Live Session */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-4 text-lg font-semibold">Live Session</h2>

            {!session ? (
              <div className="text-gray-400">No active session yet.</div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-gray-300 text-sm">PIN</div>
                      <div className="text-4xl font-bold tracking-widest">{session.pin}</div>
                      <div className="mt-1 text-sm text-gray-400">
                        Expires in: <span className="text-white">{expiresIn ?? "-"}s</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-gray-300 text-sm">Remaining Slots</div>
                      <div className="text-3xl font-bold">
                        {detail?.remaining_slots ?? session.remaining_slots}
                      </div>
                      <div className="mt-1 text-sm text-gray-400">
                        Regen left: <span className="text-white">{session.regen_left}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={regeneratePin}
                    className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500"
                  >
                    Regenerate PIN
                  </button>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="font-semibold">
                      Attendance ({detail?.attendance_count ?? 0})
                    </div>
                    <button
                      onClick={() => loadDetail()}
                      className="rounded-lg bg-white/10 px-3 py-1 text-sm hover:bg-white/15"
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="max-h-[360px] overflow-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-gray-300">
                        <tr className="border-b border-white/10">
                          <th className="py-2">Face</th>
                          <th className="py-2">Student ID</th>
                          <th className="py-2">Name</th>
                          <th className="py-2">Marked At</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-200">
                        {(detail?.attendance ?? []).map((a) => (
                          <tr key={a.student_id} className="border-b border-white/5">
                            <td className="py-2">
                              {a.selfie_base64 ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  alt="selfie"
                                  className="h-10 w-10 rounded-full object-cover"
                                  src={a.selfie_base64}
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                                  🙂
                                </div>
                              )}
                            </td>
                            <td className="py-2">{a.student_id}</td>
                            <td className="py-2">{a.student_name ?? "-"}</td>
                            <td className="py-2">{new Date(a.marked_at).toLocaleString()}</td>
                          </tr>
                        ))}

                        {(detail?.attendance ?? []).length === 0 && (
                          <tr>
                            <td className="py-4 text-gray-400" colSpan={4}>
                              No check-ins yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
