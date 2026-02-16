"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const SURVEY_GET_LATEST = `${API}/api/attendance/survey/me/latest`;
const SURVEY_SUBMIT = `${API}/api/attendance/survey/submit`;

type LikertValue = 1 | 2 | 3 | 4 | 5;

type Question = { code: string; text: string };
type Section = { key: "A" | "B" | "C" | "D" | "E" | "F"; title: string; questions: Question[] };

const SECTIONS: Section[] = [
  { key: "A", title: "Section A — Health and Well-Being Factors", questions: [
    { code: "A1", text: "My class attendance is sometimes affected by health issues such as fever, headaches, or stomach pain." },
    { code: "A2", text: "Feeling tired or not getting enough sleep affects my ability to attend morning classes." },
    { code: "A3", text: "Ongoing or long-term health conditions sometimes interfere with my regular class attendance." },
    { code: "A4", text: "Waking up early in the morning is often challenging and affects my attendance." },
  ]},
  { key: "B", title: "Section B — Personal and Self-Regulation Factors", questions: [
    { code: "B1", text: "A lack of motivation or interest in the course content negatively affects my attendance." },
    { code: "B2", text: "Ineffective time management, such as failing to prepare in advance, results in missed lectures." },
    { code: "B3", text: "Family obligations sometimes interfere with my ability to attend lectures." },
    { code: "B4", text: "Financial or household challenges occasionally hinder my participation in lectures." },
  ]},
  { key: "C", title: "Section C — Peer and Social Influence Factors", questions: [
    { code: "C1", text: "The attendance behavior of my close friends influences my own attendance decisions." },
    { code: "C2", text: "I am more likely to be absent when my friends choose not to attend lectures." },
    { code: "C3", text: "Group discussions and collaborative activities encourage me to attend classes more regularly." },
    { code: "C4", text: "Sitting closer to the lecturer enhances my concentration and attendance consistency." },
    { code: "C5", text: "Seating near entrances or high-traffic areas causes distractions that reduce my willingness to remain for the full session." },
  ]},
  { key: "D", title: "Section D — Environmental and Classroom Factors", questions: [
    { code: "D1", text: "Classroom temperature and ventilation conditions affect my comfort and willingness to attend." },
    { code: "D2", text: "Excessive noise within or near the lecture hall reduces my motivation to participate." },
    { code: "D3", text: "Lighting quality and the ability to clearly see and hear the lecturer influence my attendance." },
    { code: "D4", text: "A clean and well-maintained classroom environment encourages regular attendance." },
    { code: "D5", text: "Overcrowded classrooms make it difficult to concentrate and discourage attendance." },
  ]},
  { key: "E", title: "Section E — Academic and Teaching-Related Factors", questions: [
    { code: "E1", text: "The lecturer’s clarity, enthusiasm, and constructive feedback motivate me to attend lectures." },
    { code: "E2", text: "Interactive lectures that include questioning or activities increase my likelihood of attending." },
    { code: "E3", text: "The scheduling of lectures within the timetable affects my attendance consistency." },
    { code: "E4", text: "Regular assessments and continuous evaluation motivate me to attend lectures." },
  ]},
  { key: "F", title: "Section F — Temporal and Institutional Factors", questions: [
    { code: "F1", text: "My attendance is often lower for lectures scheduled in the late evening." },
    { code: "F2", text: "My attendance decreases immediately before or after extended holiday periods." },
    { code: "F3", text: "Family/Friends travel plans arranged during academic weeks reduce my attendance near holidays." },
    { code: "F4", text: "In the weeks preceding examinations, I tend to skip regular lectures to focus on exam preparation." },
    { code: "F5", text: "During examination periods, my class attendance is lower than usual." },
    { code: "F6", text: "When major assignments are due, I am less likely to attend lectures." },
  ]},
];

const LIKERT = [
  { value: 1 as LikertValue, label: "Strongly Disagree", short: "SD" },
  { value: 2 as LikertValue, label: "Disagree", short: "D" },
  { value: 3 as LikertValue, label: "Neutral", short: "N" },
  { value: 4 as LikertValue, label: "Agree", short: "A" },
  { value: 5 as LikertValue, label: "Strongly Agree", short: "SA" },
];

function getToken(): string | null {
  return (localStorage.getItem("access_token") || localStorage.getItem("token")) ?? null;
}

function formatDateTimeISO(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function Page() {
  const topRef = useRef<HTMLDivElement | null>(null);

  const allCodes = useMemo(() => SECTIONS.flatMap((s) => s.questions.map((q) => q.code)), []);
  const totalQuestions = allCodes.length;

  const [answers, setAnswers] = useState<Record<string, LikertValue | undefined>>({});
  const [remark, setRemark] = useState("");

  const [loadingLatest, setLoadingLatest] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [factorScores, setFactorScores] = useState<Record<string, number | null>>({});
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const answeredCount = useMemo(() => allCodes.filter((c) => answers[c] !== undefined).length, [answers, allCodes]);
  const missingCodes = useMemo(() => allCodes.filter((c) => answers[c] === undefined), [answers, allCodes]);
  const progressPct = useMemo(() => Math.round((answeredCount / totalQuestions) * 100), [answeredCount, totalQuestions]);

  const isLocked = submitted;

  useEffect(() => {
    async function loadLatest() {
      setLoadingLatest(true);
      try {
        const token = getToken();
        if (!token) {
          setLoadingLatest(false);
          return;
        }

        const res = await fetch(SURVEY_GET_LATEST, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();

        if (json?.has_submission) {
          setSubmitted(true);
          setFactorScores(json.factor_scores || {});
          setRemark(json.remark || "");
          setCreatedAt(json.created_at || null);

          const pre: Record<string, LikertValue> = {};
          for (const a of json.answers || []) pre[a.question_code] = a.value;
          setAnswers(pre);

          setMsg("You already submitted your responses. Editing is locked.");
          setSuccess(true);
        }
      } catch {
        // ignore
      } finally {
        setLoadingLatest(false);
      }
    }
    loadLatest();
  }, []);

  function setAnswer(code: string, v: LikertValue) {
    if (isLocked) return;
    setAnswers((prev) => ({ ...prev, [code]: v }));
  }

  async function submitSurvey() {
    if (isLocked) {
      setSuccess(true);
      setMsg("You already submitted your responses. Editing is locked.");
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setSubmitting(true);
    setMsg(null);
    setSuccess(false);

    try {
      const token = getToken();
      if (!token) throw new Error("You are not logged in. Please login again and try.");

      if (missingCodes.length > 0) throw new Error("Please answer all questions before submitting.");

      const payload = {
        remark: remark.trim() ? remark.trim() : null,
        answers: allCodes.map((code) => ({
          question_code: code,
          value: answers[code] as LikertValue,
        })),
      };

      const res = await fetch(SURVEY_SUBMIT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.detail || "Failed to submit survey");

      setSuccess(true);
      setMsg("Survey saved successfully ✅");
      setSubmitted(true);
      setFactorScores(json.factor_scores || {});
      setCreatedAt(json.created_at || null);

      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e: any) {
      setSuccess(false);
      setMsg(e?.message || "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen text-slate-100 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      <div ref={topRef} />

      {/* mid-tone background accents (not too bright) */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-28 -left-28 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute top-20 -right-32 h-96 w-96 rounded-full bg-indigo-500/12 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="h-16 bg-slate-900/75 border-b border-white/10 flex items-center justify-between px-6 md:px-10 sticky top-0 z-20 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            href="/student/dashboard/attendance"
            className="text-slate-300 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
          >
            <ArrowLeft size={20} />
          </Link>

          <h2 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
            <ClipboardList className="text-cyan-300" size={18} />
            Attendance Factors Survey
          </h2>

          {submitted && (
            <span className="hidden md:inline-flex items-center gap-2 ml-3 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-200 text-sm">
              <Lock size={14} />
              Locked
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-sm text-slate-300">
            Progress: <span className="text-white font-semibold">{answeredCount}/{totalQuestions}</span>
          </div>

          <div className="w-32 md:w-44 h-2.5 bg-white/10 rounded-full overflow-hidden border border-white/10">
            <div
              className="h-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8">
        {/* Top Card (mid-tone) */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.06] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)] p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Survey Form</h1>
              <p className="text-slate-300 mt-2 text-sm md:text-base">
                Answers will be saved with your student account (no need to enter student number).
              </p>

              {submitted && createdAt && (
                <p className="text-slate-400 mt-2 text-sm">
                  Submitted at: <span className="text-slate-200">{formatDateTimeISO(createdAt)}</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-between md:justify-end gap-3">
              {loadingLatest ? (
                <div className="text-slate-300 flex items-center gap-2">
                  <Loader2 className="animate-spin" size={18} />
                  Loading...
                </div>
              ) : submitted ? (
                <div className="flex items-center gap-2 text-emerald-200 font-medium">
                  <CheckCircle2 size={18} />
                  Submitted
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-200 font-medium">
                  <AlertTriangle size={18} />
                  Not submitted
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          {submitted && (
            <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-emerald-100 font-semibold">
                <Sparkles size={18} />
                Your Factor Scores
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {(["A", "B", "C", "D", "E", "F"] as const).map((k) => (
                  <div key={k} className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3 text-center">
                    <div className="text-slate-400 text-xs">Factor {k}</div>
                    <div className="text-white font-extrabold text-lg mt-0.5">
                      {factorScores?.[k] !== null && factorScores?.[k] !== undefined
                        ? Number(factorScores[k]).toFixed(2)
                        : "—"}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 text-emerald-100/90 text-sm">
                Your responses are saved. You cannot submit again.
              </div>
            </div>
          )}
        </div>

        {/* Message */}
        {msg && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm md:text-base ${
              success
                ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                : "border-red-400/20 bg-red-500/10 text-red-100"
            }`}
          >
            {msg}
          </div>
        )}

        {/* Sections */}
        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <div
              key={section.key}
              className="rounded-2xl border border-white/10 bg-white/[0.06] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)] p-5 md:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg md:text-xl font-bold text-white">
                  {section.title} <span className="text-rose-300">*</span>
                </h2>

                {submitted && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-200 text-xs md:text-sm">
                    <Lock size={14} />
                    Locked
                  </span>
                )}
              </div>

              {/* Desktop column headers */}
              <div className="mt-5 hidden lg:grid grid-cols-[1fr_repeat(5,140px)] gap-3 text-sm text-slate-300">
                <div>Statement</div>
                {LIKERT.map((l) => (
                  <div key={l.value} className="text-center">
                    {l.label}
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-4">
                {section.questions.map((q) => {
                  const selected = answers[q.code];
                  return (
                    <div
                      key={q.code}
                      className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 md:p-5"
                    >
                      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_repeat(5,140px)] gap-4 items-start">
                        <div className="w-full">
                          <div className="text-xs md:text-sm text-slate-400 mb-1">{q.code}</div>
                          <div className="text-sm md:text-base text-slate-100 leading-relaxed">{q.text}</div>
                          <div className="mt-3 lg:hidden text-slate-400 text-xs">Tap one option (SD → SA)</div>
                        </div>

                        {LIKERT.map((l) => {
                          const active = selected === l.value;

                          const base = "select-none w-full lg:w-auto rounded-xl border transition-all";
                          const enabled = "cursor-pointer hover:bg-white/10 hover:border-white/20";
                          const disabled = "cursor-not-allowed opacity-70";
                          const activeStyle = "bg-cyan-500/15 border-cyan-400/35 ring-2 ring-cyan-400/15";
                          const normalStyle = "bg-white/5 border-white/10";

                          return (
                            <label
                              key={l.value}
                              className={[
                                base,
                                active ? activeStyle : normalStyle,
                                isLocked ? disabled : enabled,
                                "px-3 py-3",
                                "flex items-center justify-between gap-3",
                              ].join(" ")}
                            >
                              <input
                                type="radio"
                                name={q.code}
                                checked={active}
                                onChange={() => setAnswer(q.code, l.value)}
                                disabled={isLocked}
                                className="h-5 w-5 accent-cyan-400"
                              />

                              <div className="flex-1">
                                <div className="text-sm font-semibold text-white">
                                  <span className="lg:hidden">{l.label}</span>
                                  <span className="hidden lg:inline">{l.short}</span>
                                </div>
                                <div className="hidden lg:block text-xs text-slate-300 mt-0.5">
                                  {l.label}
                                </div>
                              </div>

                              {active && <CheckCircle2 className="text-cyan-200" size={18} />}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Remark */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)] p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg md:text-xl font-bold text-white">Remark (Optional)</h2>
              {submitted && (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-200 text-xs md:text-sm">
                  <Lock size={14} />
                  Locked
                </span>
              )}
            </div>

            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              disabled={isLocked}
              placeholder={isLocked ? "Remark is locked after submission." : "Any extra comment about attendance..."}
              className="mt-3 w-full min-h-[130px] rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400/25 text-white placeholder-slate-500 disabled:opacity-70"
            />
          </div>

          {/* Sticky bottom bar */}
          <div className="sticky bottom-4 z-10">
            <div className="bg-slate-900/60 backdrop-blur rounded-2xl border border-white/10 shadow-lg p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="text-sm md:text-base text-slate-200">
                Completed: <span className="font-semibold text-white">{answeredCount}/{totalQuestions}</span>
                {!submitted && missingCodes.length > 0 && (
                  <span className="text-slate-300">
                    {" "}
                    — Missing <span className="text-rose-300 font-semibold">{missingCodes.length}</span>
                  </span>
                )}
                {submitted && (
                  <span className="ml-2 inline-flex items-center gap-2 text-emerald-200">
                    <CheckCircle2 size={18} /> Saved & Locked
                  </span>
                )}
              </div>

              {!submitted ? (
                <button
                  onClick={submitSurvey}
                  disabled={submitting || missingCodes.length > 0}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-7 py-3.5 font-bold text-white hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100"
                >
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  {submitting ? "Submitting..." : "Submit Survey"}
                </button>
              ) : (
                <button
                  onClick={() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 border border-white/10 px-7 py-3.5 font-semibold text-white hover:bg-white/15"
                >
                  <Sparkles size={18} />
                  View Results (Top)
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
