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
  BookOpen,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const SURVEY_GET_LATEST = `${API}/api/attendance/survey/me/latest`;
const SURVEY_SUBMIT = `${API}/api/attendance/survey/submit`;
const SURVEY_MODULES = `${API}/api/attendance/survey/me/modules`;

type LikertValue = 1 | 2 | 3 | 4 | 5;
type Question = { code: string; text: string };
type Section = { key: "A" | "B" | "C" | "D" | "E" | "F"; title: string; questions: Question[] };

// Personal factors (submitted once, globally)
const GLOBAL_SECTIONS: Section[] = [
  {
    key: "A", title: "Section A — Health and Well-Being Factors", questions: [
      { code: "A1", text: "My class attendance is sometimes affected by health issues such as fever, headaches, or stomach pain." },
      { code: "A2", text: "Feeling tired or not getting enough sleep affects my ability to attend morning classes." },
      { code: "A3", text: "Ongoing or long-term health conditions sometimes interfere with my regular class attendance." },
      { code: "A4", text: "Waking up early in the morning is often challenging and affects my attendance." },
    ]
  },
  {
    key: "B", title: "Section B — Personal and Self-Regulation Factors", questions: [
      { code: "B1", text: "A lack of motivation or interest in the course content negatively affects my attendance." },
      { code: "B2", text: "Ineffective time management, such as failing to prepare in advance, results in missed lectures." },
      { code: "B3", text: "Family obligations sometimes interfere with my ability to attend lectures." },
      { code: "B4", text: "Financial or household challenges occasionally hinder my participation in lectures." },
    ]
  },
];

// Module-specific factors (submitted per module)
const MODULE_SECTIONS: Section[] = [
  {
    key: "C", title: "Section C — Peer and Social Influence Factors", questions: [
      { code: "C1", text: "The attendance behavior of my close friends influences my own attendance decisions." },
      { code: "C2", text: "I am more likely to be absent when my friends choose not to attend lectures." },
      { code: "C3", text: "Group discussions and collaborative activities encourage me to attend classes more regularly." },
      { code: "C4", text: "Sitting closer to the lecturer enhances my concentration and attendance consistency." },
      { code: "C5", text: "Seating near entrances or high-traffic areas causes distractions that reduce my willingness to remain for the full session." },
    ]
  },
  {
    key: "D", title: "Section D — Environmental and Classroom Factors", questions: [
      { code: "D1", text: "Classroom temperature and ventilation conditions affect my comfort and willingness to attend." },
      { code: "D2", text: "Excessive noise within or near the lecture hall reduces my motivation to participate." },
      { code: "D3", text: "Lighting quality and the ability to clearly see and hear the lecturer influence my attendance." },
      { code: "D4", text: "A clean and well-maintained classroom environment encourages regular attendance." },
      { code: "D5", text: "Overcrowded classrooms make it difficult to concentrate and discourage attendance." },
    ]
  },
  {
    key: "E", title: "Section E — Academic and Teaching-Related Factors", questions: [
      { code: "E1", text: "The lecturer's clarity, enthusiasm, and constructive feedback motivate me to attend lectures." },
      { code: "E2", text: "Interactive lectures that include questioning or activities increase my likelihood of attending." },
      { code: "E3", text: "The scheduling of lectures within the timetable affects my attendance consistency." },
      { code: "E4", text: "Regular assessments and continuous evaluation motivate me to attend lectures." },
    ]
  },
  {
    key: "F", title: "Section F — Temporal and Institutional Factors", questions: [
      { code: "F1", text: "My attendance is often lower for lectures scheduled in the late evening." },
      { code: "F2", text: "My attendance decreases immediately before or after extended holiday periods." },
      { code: "F3", text: "Family/Friends travel plans arranged during academic weeks reduce my attendance near holidays." },
      { code: "F4", text: "In the weeks preceding examinations, I tend to skip regular lectures to focus on exam preparation." },
      { code: "F5", text: "During examination periods, my class attendance is lower than usual." },
      { code: "F6", text: "When major assignments are due, I am less likely to attend lectures." },
    ]
  },
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

function formatDateTimeISO(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}


// ===================== MAIN PAGE =====================
export default function Page() {
  const topRef = useRef<HTMLDivElement | null>(null);

  // Module data
  const [loadingModules, setLoadingModules] = useState(true);
  const [modules, setModules] = useState<{ module_code: string; module_name: string }[]>([]);
  const [hasGlobal, setHasGlobal] = useState(false);
  const [completedModules, setCompletedModules] = useState<Record<string, string>>({});

  // Current view: "select" | "global" | module_code
  const [currentView, setCurrentView] = useState<string>("select");
  const [selectedModule, setSelectedModule] = useState<{ module_code: string; module_name: string } | null>(null);

  // Survey state
  const [answers, setAnswers] = useState<Record<string, LikertValue | undefined>>({});
  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [factorScores, setFactorScores] = useState<Record<string, number | null>>({});
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [loadingAnswers, setLoadingAnswers] = useState(false);

  // Current sections/codes based on view
  const currentSections = currentView === "global" ? GLOBAL_SECTIONS : MODULE_SECTIONS;
  const allCodes = useMemo(() => currentSections.flatMap(s => s.questions.map(q => q.code)), [currentView]);
  const totalQuestions = allCodes.length;
  const answeredCount = useMemo(() => allCodes.filter(c => answers[c] !== undefined).length, [answers, allCodes]);
  const missingCodes = useMemo(() => allCodes.filter(c => answers[c] === undefined), [answers, allCodes]);
  const progressPct = useMemo(() => Math.round((answeredCount / totalQuestions) * 100), [answeredCount, totalQuestions]);

  // Check if current view is already submitted
  const isCurrentLocked = currentView === "global" ? hasGlobal :
    currentView !== "select" ? !!completedModules[currentView] : false;

  // Load modules + completion status
  useEffect(() => {
    async function load() {
      setLoadingModules(true);
      try {
        const token = getToken();
        if (!token) { setLoadingModules(false); return; }

        const res = await fetch(SURVEY_MODULES, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();

        setModules(json.modules || []);
        setHasGlobal(json.has_global || false);
        setCompletedModules(json.completed_modules || {});

        // If no global survey yet, go straight to global form
        if (!json.has_global) {
          setCurrentView("global");
        }
      } catch {
        // Fallback: no modules found
      } finally {
        setLoadingModules(false);
      }
    }
    load();
  }, []);

  // Load existing answers when switching view
  useEffect(() => {
    if (currentView === "select") return;

    async function loadExisting() {
      setLoadingAnswers(true);
      setAnswers({});
      setFactorScores({});
      setSubmittedAt(null);
      try {
        const token = getToken();
        if (!token) return;

        const moduleParam = currentView !== "global" ? `?module_code=${currentView}` : "";
        const res = await fetch(`${SURVEY_GET_LATEST}${moduleParam}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        if (json?.has_submission) {
          const pre: Record<string, LikertValue> = {};
          for (const a of json.answers || []) pre[a.question_code] = a.value;
          setAnswers(pre);
          setFactorScores(json.factor_scores || {});
          setSubmittedAt(json.created_at || null);
        }
      } catch {
        // No existing data
      } finally {
        setLoadingAnswers(false);
      }
    }
    loadExisting();
  }, [currentView]);

  function setAnswer(code: string, v: LikertValue) {
    if (isCurrentLocked) return;
    setAnswers(prev => ({ ...prev, [code]: v }));
  }

  async function submitSurvey() {
    setSubmitting(true);
    setMsg(null);
    setSuccess(false);

    try {
      const token = getToken();
      if (!token) throw new Error("You are not logged in. Please login again.");

      if (missingCodes.length > 0) throw new Error("Please answer all questions before submitting.");

      const payload: any = {
        remark: remark.trim() ? remark.trim() : null,
        answers: allCodes.map(code => ({
          question_code: code,
          value: answers[code] as LikertValue,
        })),
      };

      // If module-specific survey, include module_code
      if (currentView !== "global") {
        payload.module_code = currentView;
      }

      const res = await fetch(SURVEY_SUBMIT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.detail || "Failed to submit survey");

      setSuccess(true);
      setFactorScores(json.factor_scores || {});
      setSubmittedAt(json.created_at || null);

      if (currentView === "global") {
        setMsg("Personal factors (A & B) saved successfully! ✅ Now select a module to continue.");
        setHasGlobal(true);
        // Go back to module selector after a short delay
        setTimeout(() => {
          setCurrentView("select");
          setAnswers({});
          setRemark("");
          setMsg(null);
        }, 2000);
      } else {
        setMsg(`Survey for ${selectedModule?.module_code || currentView} saved! ✅`);
        setCompletedModules(prev => ({ ...prev, [currentView]: new Date().toISOString() }));
        // Go back to module selector
        setTimeout(() => {
          setCurrentView("select");
          setAnswers({});
          setRemark("");
          setMsg(null);
        }, 2000);
      }

      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e: any) {
      setSuccess(false);
      setMsg(e?.message || "Error");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── RENDER SURVEY FORM (used for both global and module views) ───
  function renderSurveyForm() {
    return (
      <>
        {/* Top info card */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.06] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)] p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                {currentView === "global"
                  ? "Personal Factors — Health & Self-Regulation"
                  : `Module: ${selectedModule?.module_code || currentView}`}
              </h1>
              <p className="text-slate-400 mt-1 text-sm">
                {currentView === "global"
                  ? "These questions are about your general health and personal habits. You only need to answer them once."
                  : `Answer these questions specifically for ${selectedModule?.module_name || currentView} lectures.`}
              </p>
              {isCurrentLocked && submittedAt && (
                <p className="text-slate-400 mt-2 text-sm">
                  Submitted at: <span className="text-slate-200">{formatDateTimeISO(submittedAt)}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isCurrentLocked ? (
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

          {/* Factor scores (shown after submission) */}
          {isCurrentLocked && Object.keys(factorScores).length > 0 && (
            <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-emerald-100 font-semibold">
                <Sparkles size={18} />
                Your Factor Scores
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {(currentView === "global" ? ["A", "B"] : ["C", "D", "E", "F"]).map(k => (
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
                Your responses are saved.
              </div>
            </div>
          )}
        </div>

        {/* Loading indicator */}
        {loadingAnswers ? (
          <div className="text-center py-16">
            <Loader2 className="animate-spin mx-auto" size={32} />
            <p className="text-slate-400 mt-3">Loading your responses...</p>
          </div>
        ) : (
          <>
            {/* Message */}
            {msg && (
              <div className={`mb-6 rounded-xl border px-4 py-3 text-sm md:text-base ${success
                ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                : "border-red-400/20 bg-red-500/10 text-red-100"}`}
              >
                {msg}
              </div>
            )}

            {/* Survey sections with questions */}
            <div className="space-y-6">
              {currentSections.map(section => (
                <div
                  key={section.key}
                  className="rounded-2xl border border-white/10 bg-white/[0.06] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)] p-5 md:p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg md:text-xl font-bold text-white">
                      {section.title} <span className="text-rose-300">*</span>
                    </h2>
                    {isCurrentLocked && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-200 text-xs md:text-sm">
                        <Lock size={14} /> Locked
                      </span>
                    )}
                  </div>

                  {/* Module context hint */}
                  {currentView !== "global" && (
                    <p className="mt-2 text-cyan-300/70 text-xs italic">
                      Answer for: {selectedModule?.module_name || currentView}
                    </p>
                  )}

                  {/* Desktop column headers */}
                  <div className="mt-5 hidden lg:grid grid-cols-[1fr_repeat(5,140px)] gap-3 text-sm text-slate-300">
                    <div>Statement</div>
                    {LIKERT.map(l => (
                      <div key={l.value} className="text-center">{l.label}</div>
                    ))}
                  </div>

                  <div className="mt-4 space-y-4">
                    {section.questions.map(q => {
                      const selected = answers[q.code];
                      return (
                        <div key={q.code} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 md:p-5">
                          <div className="flex flex-col lg:grid lg:grid-cols-[1fr_repeat(5,140px)] gap-4 items-start">
                            <div className="w-full">
                              <div className="text-xs md:text-sm text-slate-400 mb-1">{q.code}</div>
                              <div className="text-sm md:text-base text-slate-100 leading-relaxed">{q.text}</div>
                              <div className="mt-3 lg:hidden text-slate-400 text-xs">Tap one option (SD → SA)</div>
                            </div>

                            {LIKERT.map(l => {
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
                                    isCurrentLocked ? disabled : enabled,
                                    "px-3 py-3",
                                    "flex items-center justify-between gap-3",
                                  ].join(" ")}
                                >
                                  <input
                                    type="radio"
                                    name={q.code}
                                    checked={active}
                                    onChange={() => setAnswer(q.code, l.value)}
                                    disabled={isCurrentLocked}
                                    className="h-5 w-5 accent-cyan-400"
                                  />
                                  <div className="flex-1">
                                    <div className="text-sm font-semibold text-white">
                                      <span className="lg:hidden">{l.label}</span>
                                      <span className="hidden lg:inline">{l.short}</span>
                                    </div>
                                    <div className="hidden lg:block text-xs text-slate-300 mt-0.5">{l.label}</div>
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
                  {isCurrentLocked && (
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-200 text-xs md:text-sm">
                      <Lock size={14} /> Locked
                    </span>
                  )}
                </div>
                <textarea
                  value={remark}
                  onChange={e => setRemark(e.target.value)}
                  disabled={isCurrentLocked}
                  placeholder={isCurrentLocked ? "Remark is locked after submission." : "Any extra comment about attendance..."}
                  className="mt-3 w-full min-h-[130px] rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400/25 text-white placeholder-slate-500 disabled:opacity-70"
                />
              </div>

              {/* Sticky bottom bar */}
              <div className="sticky bottom-4 z-10">
                <div className="bg-slate-900/60 backdrop-blur rounded-2xl border border-white/10 shadow-lg p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="text-sm md:text-base text-slate-200">
                    Completed: <span className="font-semibold text-white">{answeredCount}/{totalQuestions}</span>
                    {!isCurrentLocked && missingCodes.length > 0 && (
                      <span className="text-slate-300">
                        {" "}— Missing <span className="text-rose-300 font-semibold">{missingCodes.length}</span>
                      </span>
                    )}
                    {isCurrentLocked && (
                      <span className="ml-2 inline-flex items-center gap-2 text-emerald-200">
                        <CheckCircle2 size={18} /> Saved & Locked
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {!isCurrentLocked ? (
                      <button
                        onClick={submitSurvey}
                        disabled={submitting || missingCodes.length > 0}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-7 py-3.5 font-bold text-white hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100"
                      >
                        {submitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                        {submitting ? "Submitting..." : currentView === "global" ? "Save Personal Factors" : `Submit for ${currentView}`}
                      </button>
                    ) : (
                      <button
                        onClick={() => { setCurrentView("select"); setAnswers({}); setRemark(""); setMsg(null); }}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 border border-white/10 px-7 py-3.5 font-semibold text-white hover:bg-white/15"
                      >
                        <ArrowLeft size={18} />
                        Back to Modules
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen text-slate-100 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
      <div ref={topRef} />

      {/* Background accents */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-28 -left-28 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute top-20 -right-32 h-96 w-96 rounded-full bg-indigo-500/12 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="h-16 bg-slate-900/75 border-b border-white/10 flex items-center justify-between px-6 md:px-10 sticky top-0 z-20 backdrop-blur">
        <div className="flex items-center gap-3">
          {currentView === "select" ? (
            <Link
              href="/student/dashboard/attendance"
              className="text-slate-300 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
            >
              <ArrowLeft size={20} />
            </Link>
          ) : (
            <button
              onClick={() => { setCurrentView("select"); setAnswers({}); setRemark(""); setMsg(null); }}
              className="text-slate-300 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
            >
              <ArrowLeft size={20} />
            </button>
          )}

          <h2 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
            <ClipboardList className="text-cyan-300" size={18} />
            {currentView === "select"
              ? "Attendance Factors Survey"
              : currentView === "global"
                ? "Personal Factors (A & B)"
                : `Module Survey — ${currentView}`}
          </h2>
        </div>

        {currentView !== "select" && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-sm text-slate-300">
              Progress: <span className="text-white font-semibold">{answeredCount}/{totalQuestions}</span>
            </div>
            <div className="w-32 md:w-44 h-2.5 bg-white/10 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8">

        {/* ─── MODULE SELECTOR VIEW ─── */}
        {currentView === "select" && (
          <>
            <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.06] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)] p-5 md:p-6">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Attendance Factors Survey</h1>
              <p className="text-slate-400 mt-2 text-sm leading-relaxed">
                Complete personal factors once, then answer module-specific questions for each module you attend.
              </p>

              {/* Step indicator */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${hasGlobal
                  ? "bg-emerald-500/10 border border-emerald-400/20 text-emerald-200"
                  : "bg-amber-500/10 border border-amber-400/20 text-amber-200"}`}
                >
                  {hasGlobal ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  Step 1: Personal Factors (A & B) — {hasGlobal ? "Done" : "Pending"}
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${Object.keys(completedModules).length === modules.length && modules.length > 0
                  ? "bg-emerald-500/10 border border-emerald-400/20 text-emerald-200"
                  : "bg-cyan-500/10 border border-cyan-400/20 text-cyan-200"}`}
                >
                  <BookOpen size={16} />
                  Step 2: Module Factors — {Object.keys(completedModules).length}/{modules.length}
                </div>
              </div>
            </div>

            {loadingModules ? (
              <div className="text-center py-20">
                <Loader2 className="animate-spin mx-auto" size={32} />
                <p className="text-slate-400 mt-3">Loading your modules...</p>
              </div>
            ) : (
              <>
                {/* Global survey card — show to re-view or to fill */}
                <div className="mb-6">
                  <button
                    onClick={() => { setCurrentView("global"); setAnswers({}); setRemark(""); setMsg(null); }}
                    className={`w-full text-left rounded-2xl border-2 p-5 transition-all group ${hasGlobal
                      ? "border-emerald-400/20 bg-emerald-500/5 hover:bg-emerald-500/10"
                      : "border-amber-400/30 bg-amber-500/5 hover:bg-amber-500/10"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${hasGlobal
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-amber-500/15 text-amber-300"}`}
                        >
                          {hasGlobal ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                        </div>
                        <div>
                          <div className={`font-semibold text-lg ${hasGlobal ? "text-emerald-100" : "text-amber-200"}`}>
                            Personal Factors (A & B)
                          </div>
                          <p className="text-slate-400 text-sm mt-1">
                            {hasGlobal
                              ? "✅ Completed — click to view your responses"
                              : "Health, well-being, and self-regulation — answer these first"}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={20} className={`${hasGlobal ? "text-emerald-400" : "text-amber-300"} group-hover:translate-x-1 transition-transform`} />
                    </div>
                  </button>
                </div>

                {/* Section divider */}
                <div className="mb-4 flex items-center gap-3 px-1">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-slate-400 text-sm font-medium">Module-Specific Surveys (C, D, E, F)</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                {hasGlobal && modules.length > 0 && (
                  <div className="mb-4 text-slate-400 text-sm px-1">
                    Select a module to complete its survey. Each module may have different factors.
                  </div>
                )}

                {!hasGlobal && modules.length > 0 && (
                  <div className="mb-4 flex items-center gap-2 text-amber-300/80 text-sm px-1">
                    <Lock size={14} />
                    Complete Personal Factors first to unlock module surveys.
                  </div>
                )}

                {/* Module cards */}
                <div className="space-y-3">
                  {modules.map(mod => {
                    const isCompleted = !!completedModules[mod.module_code];
                    return (
                      <button
                        key={mod.module_code}
                        onClick={() => {
                          if (!hasGlobal) {
                            setMsg("Please complete Personal Factors (A & B) first.");
                            setSuccess(false);
                            return;
                          }
                          setSelectedModule(mod);
                          setCurrentView(mod.module_code);
                          setAnswers({});
                          setRemark("");
                          setMsg(null);
                        }}
                        className={`w-full text-left rounded-2xl border p-5 transition-all group ${isCompleted
                          ? "border-emerald-400/20 bg-emerald-500/5 hover:bg-emerald-500/10"
                          : "border-white/10 bg-white/[0.06] hover:bg-white/[0.1]"
                          } ${!hasGlobal ? "opacity-50 cursor-not-allowed" : ""}`}
                        disabled={!hasGlobal}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isCompleted
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-cyan-500/10 text-cyan-300"}`}
                            >
                              {isCompleted ? <CheckCircle2 size={24} /> : <BookOpen size={24} />}
                            </div>
                            <div>
                              <div className="font-semibold text-white text-lg">{mod.module_code}</div>
                              <div className="text-slate-400 text-sm">{mod.module_name}</div>
                              {isCompleted && (
                                <div className="text-emerald-300 text-xs mt-1">✅ Completed — click to view</div>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={20} className={`${isCompleted ? "text-emerald-400" : "text-slate-500"} group-hover:translate-x-1 transition-transform`} />
                        </div>
                      </button>
                    );
                  })}

                  {modules.length === 0 && (
                    <div className="text-center py-16 rounded-2xl border border-white/10 bg-white/[0.03]">
                      <BookOpen size={40} className="mx-auto mb-3 opacity-50 text-slate-500" />
                      <p className="text-slate-400">No modules found.</p>
                      <p className="text-slate-500 text-sm mt-1">Attendance sessions need to be created first.</p>
                    </div>
                  )}
                </div>

                {/* Message (for "complete global first" etc) */}
                {msg && currentView === "select" && (
                  <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${success
                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                    : "border-red-400/20 bg-red-500/10 text-red-100"}`}
                  >
                    {msg}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ─── SURVEY FORM VIEW (Global or Module) ─── */}
        {currentView !== "select" && renderSurveyForm()}
      </main>
    </div>
  );
}
