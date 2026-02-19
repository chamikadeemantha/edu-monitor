"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Search,
    ClipboardList,
    User,
    Calendar,
    BarChart3,
    ChevronDown,
    ChevronUp,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    Sparkles,
    FileText,
    Users,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type LikertValue = 1 | 2 | 3 | 4 | 5;
type Answer = { question_code: string; value: LikertValue };
type FactorScores = Record<string, number | null>;

type SurveyResult = {
    found: boolean;
    has_submission: boolean;
    submission_id?: number;
    student_reg_no?: string;
    student_name?: string;
    created_at?: string;
    remark?: string;
    answers?: Answer[];
    factor_scores?: FactorScores;
};

type SubmissionSummary = {
    submission_id: number;
    student_user_id: number;
    student_reg_no: string;
    created_at: string;
    student_name: string | null;
};

type Section = {
    key: string;
    title: string;
    questions: { code: string; text: string }[];
};

const SECTIONS: Section[] = [
    {
        key: "A",
        title: "Health and Well-Being Factors",
        questions: [
            { code: "A1", text: "My class attendance is sometimes affected by health issues such as fever, headaches, or stomach pain." },
            { code: "A2", text: "Feeling tired or not getting enough sleep affects my ability to attend morning classes." },
            { code: "A3", text: "Ongoing or long-term health conditions sometimes interfere with my regular class attendance." },
            { code: "A4", text: "Waking up early in the morning is often challenging and affects my attendance." },
        ],
    },
    {
        key: "B",
        title: "Personal and Self-Regulation Factors",
        questions: [
            { code: "B1", text: "A lack of motivation or interest in the course content negatively affects my attendance." },
            { code: "B2", text: "Ineffective time management, such as failing to prepare in advance, results in missed lectures." },
            { code: "B3", text: "Family obligations sometimes interfere with my ability to attend lectures." },
            { code: "B4", text: "Financial or household challenges occasionally hinder my participation in lectures." },
        ],
    },
    {
        key: "C",
        title: "Peer and Social Influence Factors",
        questions: [
            { code: "C1", text: "The attendance behavior of my close friends influences my own attendance decisions." },
            { code: "C2", text: "I am more likely to be absent when my friends choose not to attend lectures." },
            { code: "C3", text: "Group discussions and collaborative activities encourage me to attend classes more regularly." },
            { code: "C4", text: "Sitting closer to the lecturer enhances my concentration and attendance consistency." },
            { code: "C5", text: "Seating near entrances or high-traffic areas causes distractions that reduce my willingness to remain for the full session." },
        ],
    },
    {
        key: "D",
        title: "Environmental and Classroom Factors",
        questions: [
            { code: "D1", text: "Classroom temperature and ventilation conditions affect my comfort and willingness to attend." },
            { code: "D2", text: "Excessive noise within or near the lecture hall reduces my motivation to participate." },
            { code: "D3", text: "Lighting quality and the ability to clearly see and hear the lecturer influence my attendance." },
            { code: "D4", text: "A clean and well-maintained classroom environment encourages regular attendance." },
            { code: "D5", text: "Overcrowded classrooms make it difficult to concentrate and discourage attendance." },
        ],
    },
    {
        key: "E",
        title: "Academic and Teaching-Related Factors",
        questions: [
            { code: "E1", text: "The lecturer's clarity, enthusiasm, and constructive feedback motivate me to attend lectures." },
            { code: "E2", text: "Interactive lectures that include questioning or activities increase my likelihood of attending." },
            { code: "E3", text: "The scheduling of lectures within the timetable affects my attendance consistency." },
            { code: "E4", text: "Regular assessments and continuous evaluation motivate me to attend lectures." },
        ],
    },
    {
        key: "F",
        title: "Temporal and Institutional Factors",
        questions: [
            { code: "F1", text: "My attendance is often lower for lectures scheduled in the late evening." },
            { code: "F2", text: "My attendance decreases immediately before or after extended holiday periods." },
            { code: "F3", text: "Family/Friends travel plans arranged during academic weeks reduce my attendance near holidays." },
            { code: "F4", text: "In the weeks preceding examinations, I tend to skip regular lectures to focus on exam preparation." },
            { code: "F5", text: "During examination periods, my class attendance is lower than usual." },
            { code: "F6", text: "When major assignments are due, I am less likely to attend lectures." },
        ],
    },
];

const LIKERT_LABELS: Record<number, string> = {
    1: "Strongly Disagree",
    2: "Disagree",
    3: "Neutral",
    4: "Agree",
    5: "Strongly Agree",
};

const FACTOR_COLORS: Record<string, { bar: string; bg: string; border: string; text: string }> = {
    A: { bar: "bg-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400" },
    B: { bar: "bg-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400" },
    C: { bar: "bg-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400" },
    D: { bar: "bg-cyan-500", bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-400" },
    E: { bar: "bg-violet-500", bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-400" },
    F: { bar: "bg-pink-500", bg: "bg-pink-500/10", border: "border-pink-500/30", text: "text-pink-400" },
};

function getToken(): string | null {
    return (localStorage.getItem("access_token") || localStorage.getItem("token")) ?? null;
}

function formatDate(iso?: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
}

export default function TeacherSurveyResultsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const [result, setResult] = useState<SurveyResult | null>(null);
    const [searchedId, setSearchedId] = useState("");
    const [error, setError] = useState<string | null>(null);

    // all submissions list
    const [allSubmissions, setAllSubmissions] = useState<SubmissionSummary[]>([]);
    const [loadingAll, setLoadingAll] = useState(true);

    // section expand state
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["A", "B", "C", "D", "E", "F"]));

    const answerMap = useMemo(() => {
        const map: Record<string, number> = {};
        result?.answers?.forEach((a) => { map[a.question_code] = a.value; });
        return map;
    }, [result]);

    // Load all submissions on mount
    useEffect(() => {
        async function loadAll() {
            setLoadingAll(true);
            try {
                const token = getToken();
                if (!token) { setLoadingAll(false); return; }

                const res = await fetch(`${API}/api/attendance/survey/all`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    setAllSubmissions(data.submissions || []);
                }
            } catch {
                // silent fail
            } finally {
                setLoadingAll(false);
            }
        }
        loadAll();
    }, []);

    async function handleSearch(regNo?: string) {
        const query = (regNo || searchQuery).trim();
        if (!query) return;

        setSearching(true);
        setError(null);
        setResult(null);
        setSearchedId(query);

        try {
            const token = getToken();
            if (!token) throw new Error("Not authenticated. Please log in again.");

            const res = await fetch(
                `${API}/api/attendance/survey/search?student_id=${encodeURIComponent(query)}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const json = await res.json();
            if (!res.ok) throw new Error(json?.detail || `HTTP ${res.status}`);

            setResult(json);
            if (!json.found) {
                setError(`No survey submission found for student "${query}".`);
            }
        } catch (e: any) {
            setError(e?.message || "Search failed");
        } finally {
            setSearching(false);
        }
    }

    function toggleSection(key: string) {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    function getLikertColor(v: number) {
        if (v === 1) return "bg-red-500/80 border-red-400/50";
        if (v === 2) return "bg-orange-500/80 border-orange-400/50";
        if (v === 3) return "bg-yellow-500/80 border-yellow-400/50";
        if (v === 4) return "bg-emerald-500/80 border-emerald-400/50";
        if (v === 5) return "bg-cyan-500/80 border-cyan-400/50";
        return "bg-gray-600 border-gray-500";
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Background accents */}
            <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
                <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-amber-500/8 blur-3xl" />
                <div className="absolute top-1/3 -left-40 h-96 w-96 rounded-full bg-violet-500/8 blur-3xl" />
                <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-cyan-500/6 blur-3xl" />
            </div>

            {/* Header */}
            <header className="h-16 bg-gray-800/60 border-b border-white/10 flex items-center justify-between px-6 md:px-10 sticky top-0 z-20 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <Link
                        href="/teacher/attendance"
                        className="text-gray-300 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <h2 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
                        <ClipboardList className="text-amber-400" size={20} />
                        Survey Results
                    </h2>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center gap-2 text-sm text-gray-400">
                        <Users size={16} />
                        <span>{allSubmissions.length} submission{allSubmissions.length !== 1 ? "s" : ""}</span>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm text-emerald-400 hidden sm:inline">System Online</span>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-8">
                {/* Search Section */}
                <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm shadow-2xl p-6 md:p-8">
                    <div className="flex flex-col md:flex-row md:items-end gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Search by Student Registration Number
                            </label>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                                    placeholder="e.g. IT21000000"
                                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-white/10 bg-gray-800/80 text-white placeholder-gray-500 outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 text-lg font-mono tracking-wide transition-all"
                                />
                            </div>
                        </div>
                        <button
                            onClick={() => handleSearch()}
                            disabled={searching || !searchQuery.trim()}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-3.5 font-bold text-white hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100 transition-all shadow-lg shadow-amber-500/20 md:min-w-[160px]"
                        >
                            {searching ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                            {searching ? "Searching..." : "Search"}
                        </button>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 rounded-xl border border-red-400/20 bg-red-500/10 px-5 py-4 text-red-200 flex items-start gap-3">
                        <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Results Section */}
                {result && result.found && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Student Info Card */}
                        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] shadow-2xl p-6 md:p-8">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-amber-500/30">
                                        {result.student_name ? result.student_name.charAt(0).toUpperCase() : "?"}
                                    </div>
                                    <div>
                                        <h3 className="text-xl md:text-2xl font-bold text-white">
                                            {result.student_name || "Unknown Student"}
                                        </h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="inline-flex items-center gap-1.5 text-sm text-gray-300 font-mono bg-white/5 px-3 py-1 rounded-lg border border-white/10">
                                                <User size={14} />
                                                {result.student_reg_no}
                                            </span>
                                            {result.created_at && (
                                                <span className="inline-flex items-center gap-1.5 text-sm text-gray-400">
                                                    <Calendar size={14} />
                                                    {formatDate(result.created_at)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-emerald-300 font-medium bg-emerald-500/10 border border-emerald-400/20 px-4 py-2 rounded-xl">
                                    <CheckCircle2 size={18} />
                                    Survey Submitted
                                </div>
                            </div>

                            {result.remark && (
                                <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.03] p-4">
                                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                                        <FileText size={14} />
                                        Student Remark
                                    </div>
                                    <p className="text-gray-200 text-sm leading-relaxed">{result.remark}</p>
                                </div>
                            )}
                        </div>

                        {/* Factor Scores */}
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] shadow-2xl p-6 md:p-8">
                            <div className="flex items-center gap-2 mb-6">
                                <Sparkles className="text-amber-400" size={20} />
                                <h3 className="text-lg font-bold text-white">Factor Scores Overview</h3>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {(["A", "B", "C", "D", "E", "F"] as const).map((key) => {
                                    const score = result.factor_scores?.[key];
                                    const pct = score != null ? (score / 5) * 100 : 0;
                                    const colors = FACTOR_COLORS[key];
                                    const section = SECTIONS.find((s) => s.key === key);

                                    return (
                                        <div
                                            key={key}
                                            className={`rounded-xl border ${colors.border} ${colors.bg} p-4 transition-all hover:scale-[1.02]`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div>
                                                    <span className={`text-xs font-bold ${colors.text} uppercase tracking-wider`}>
                                                        Factor {key}
                                                    </span>
                                                    <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                                                        {section?.title}
                                                    </div>
                                                </div>
                                                <div className={`text-2xl font-extrabold ${colors.text}`}>
                                                    {score != null ? score.toFixed(2) : "—"}
                                                </div>
                                            </div>

                                            <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${colors.bar} transition-all duration-700`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <div className="text-right mt-1 text-xs text-gray-500">
                                                {score != null ? `${pct.toFixed(0)}%` : "N/A"}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Detailed Answers by Section */}
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] shadow-2xl p-6 md:p-8">
                            <div className="flex items-center gap-2 mb-6">
                                <BarChart3 className="text-amber-400" size={20} />
                                <h3 className="text-lg font-bold text-white">Detailed Responses</h3>
                                <span className="text-sm text-gray-500 ml-auto">
                                    {result.answers?.length || 0} answers
                                </span>
                            </div>

                            <div className="space-y-3">
                                {SECTIONS.map((section) => {
                                    const isExpanded = expandedSections.has(section.key);
                                    const colors = FACTOR_COLORS[section.key];
                                    const sectionScore = result.factor_scores?.[section.key];

                                    return (
                                        <div
                                            key={section.key}
                                            className={`rounded-xl border ${colors.border} overflow-hidden transition-all`}
                                        >
                                            <button
                                                onClick={() => toggleSection(section.key)}
                                                className={`w-full flex items-center justify-between p-4 ${colors.bg} hover:bg-white/[0.03] transition-colors`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-sm font-bold ${colors.text}`}>
                                                        Section {section.key}
                                                    </span>
                                                    <span className="text-sm text-gray-300 font-medium">
                                                        {section.title}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-sm font-bold ${colors.text}`}>
                                                        {sectionScore != null ? sectionScore.toFixed(2) : "—"}
                                                    </span>
                                                    {isExpanded ? (
                                                        <ChevronUp size={18} className="text-gray-400" />
                                                    ) : (
                                                        <ChevronDown size={18} className="text-gray-400" />
                                                    )}
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="border-t border-white/5">
                                                    {section.questions.map((q, idx) => {
                                                        const val = answerMap[q.code];
                                                        return (
                                                            <div
                                                                key={q.code}
                                                                className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 ${idx < section.questions.length - 1
                                                                        ? "border-b border-white/5"
                                                                        : ""
                                                                    }`}
                                                            >
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="text-xs text-gray-500 font-mono mr-2">
                                                                        {q.code}
                                                                    </span>
                                                                    <span className="text-sm text-gray-300">
                                                                        {q.text}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                                    {val != null ? (
                                                                        <>
                                                                            <span
                                                                                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold text-white border ${getLikertColor(val)}`}
                                                                            >
                                                                                {val}
                                                                            </span>
                                                                            <span className="text-xs text-gray-400 w-28">
                                                                                {LIKERT_LABELS[val]}
                                                                            </span>
                                                                        </>
                                                                    ) : (
                                                                        <span className="text-xs text-gray-600">
                                                                            Not answered
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* All Submissions List — Show when no individual result is displayed */}
                {!result && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] shadow-2xl p-6 md:p-8">
                        <div className="flex items-center gap-2 mb-6">
                            <Users className="text-amber-400" size={20} />
                            <h3 className="text-lg font-bold text-white">All Survey Submissions</h3>
                        </div>

                        {loadingAll ? (
                            <div className="flex items-center justify-center py-16 text-gray-500">
                                <Loader2 className="animate-spin mr-3" size={24} />
                                Loading submissions...
                            </div>
                        ) : allSubmissions.length === 0 ? (
                            <div className="text-center py-16">
                                <ClipboardList size={48} className="mx-auto text-gray-600 mb-4" />
                                <p className="text-gray-400 text-lg font-medium">No survey submissions yet</p>
                                <p className="text-gray-500 text-sm mt-1">
                                    Students will appear here after they submit their survey
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10 text-gray-400">
                                            <th className="text-left py-3 px-4 font-medium">#</th>
                                            <th className="text-left py-3 px-4 font-medium">Student Reg No</th>
                                            <th className="text-left py-3 px-4 font-medium">Name</th>
                                            <th className="text-left py-3 px-4 font-medium">Submitted At</th>
                                            <th className="text-right py-3 px-4 font-medium">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allSubmissions.map((sub, idx) => (
                                            <tr
                                                key={sub.submission_id}
                                                className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                                            >
                                                <td className="py-3 px-4 text-gray-500">{idx + 1}</td>
                                                <td className="py-3 px-4">
                                                    <span className="font-mono text-amber-300 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                                                        {sub.student_reg_no}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-gray-300">
                                                    {sub.student_name || "—"}
                                                </td>
                                                <td className="py-3 px-4 text-gray-400 text-xs">
                                                    {formatDate(sub.created_at)}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <button
                                                        onClick={() => {
                                                            setSearchQuery(sub.student_reg_no);
                                                            handleSearch(sub.student_reg_no);
                                                        }}
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600/20 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-600/30 transition-colors"
                                                    >
                                                        <Search size={12} />
                                                        View Results
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Back to list link when viewing individual result */}
                {result && result.found && (
                    <div className="mt-6 text-center">
                        <button
                            onClick={() => {
                                setResult(null);
                                setError(null);
                                setSearchedId("");
                                setSearchQuery("");
                            }}
                            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft size={16} />
                            Back to all submissions
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
