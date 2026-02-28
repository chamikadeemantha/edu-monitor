"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Brain,
    BarChart3,
    Users,
    AlertTriangle,
    RefreshCw,
    BookOpen,
    Eye,
    Activity,
    Target,
    Lightbulb,
    ShieldAlert,
    Info,
    TrendingDown,
    Percent,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

/** ─── Types ─────────────────────────────────────────────── */
type FactorImportance = {
    factor: string;
    name: string;
    importance_pct: number;
};

type Recommendation = {
    severity: string;
    factor: string;
    title: string;
    description?: string;
    importance_pct?: number;
    actions: string[];
};

type ModuleAttendanceItem = {
    module_code: string;
    module_name: string;
    average_attendance: number;
    student_count: number;
    at_risk_count: number;
};

type OverviewData = {
    status: string;
    message?: string;
    students_analyzed?: number;
    modules_analyzed?: number;
    overall_attendance?: number;
    at_risk_count?: number;
    top_barrier_factor?: string;
    factor_importance?: FactorImportance[];
    recommendations?: Recommendation[];
    module_attendance?: ModuleAttendanceItem[];
    last_trained_at?: string;
};

type AtRiskStudent = {
    student_id: string;
    attendance_pct: number;
    top_barrier: string;
    barrier_score: number;
};

type ModuleData = {
    status: string;
    message?: string;
    module_code?: string;
    module_name?: string;
    students_in_module?: number;
    average_attendance?: number;
    factor_importance?: FactorImportance[];
    recommendations?: Recommendation[];
    at_risk_students?: AtRiskStudent[];
};

type StudentFactorProfile = {
    [key: string]: { name: string; score: number | null; level: string };
};

type StudentModule = {
    module_code: string;
    module_name: string;
    actual_attendance: number;
    top_barrier: string;
};

type StudentData = {
    status: string;
    message?: string;
    student_id?: string;
    factor_profile?: StudentFactorProfile;
    modules?: StudentModule[];
    personalized_recommendations?: string[];
};

/** ─── Helpers ───────────────────────────────────────────── */
const getToken = () => {
    if (typeof window !== "undefined") {
        return localStorage.getItem("token");
    }
    return null;
};

const factorColors: Record<string, string> = {
    F: "#10b981",
    A: "#3b82f6",
    E: "#8b5cf6",
    B: "#f59e0b",
    C: "#ec4899",
    D: "#6b7280",
};

const severityConfig: Record<string, { bg: string; border: string; icon: typeof AlertTriangle; label: string }> = {
    critical: { bg: "rgba(239,68,68,0.1)", border: "#ef4444", icon: ShieldAlert, label: "CRITICAL" },
    warning: { bg: "rgba(245,158,11,0.1)", border: "#f59e0b", icon: AlertTriangle, label: "WARNING" },
    info: { bg: "rgba(59,130,246,0.1)", border: "#3b82f6", icon: Info, label: "INFO" },
};

/** ─── Main Component ────────────────────────────────────── */
export default function MLInsightsPage() {
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [moduleData, setModuleData] = useState<ModuleData | null>(null);
    const [studentData, setStudentData] = useState<StudentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [moduleLoading, setModuleLoading] = useState(false);
    const [studentLoading, setStudentLoading] = useState(false);
    const [retraining, setRetraining] = useState(false);
    const [selectedModule, setSelectedModule] = useState<string>("all");
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [availableModules, setAvailableModules] = useState<string[]>([]);

    // ─── Fetch overview ──────────────────────────────────────
    const fetchOverview = useCallback(async (force = false) => {
        setLoading(true);
        setError(null);
        try {
            const token = getToken();
            const res = await fetch(`${API}/api/ml/overview${force ? "?force=true" : ""}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: OverviewData = await res.json();
            setOverview(data);

            // Extract modules from teacher sessions for the filter
            try {
                const sessRes = await fetch(`${API}/api/attendance/teacher/sessions`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (sessRes.ok) {
                    const sessions = await sessRes.json();
                    const modules = [...new Set(sessions.map((s: any) => s.module_code))] as string[];
                    setAvailableModules(modules);
                }
            } catch {
                /* ignore */
            }
        } catch (err: any) {
            setError(err.message || "Failed to load ML insights");
        } finally {
            setLoading(false);
        }
    }, []);

    // ─── Fetch module insights ───────────────────────────────
    const fetchModuleInsights = useCallback(async (moduleCode: string) => {
        setModuleLoading(true);
        try {
            const token = getToken();
            const res = await fetch(`${API}/api/ml/module/${moduleCode}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: ModuleData = await res.json();
            setModuleData(data);
        } catch {
            setModuleData(null);
        } finally {
            setModuleLoading(false);
        }
    }, []);

    // ─── Fetch student insights ──────────────────────────────
    const fetchStudentInsights = useCallback(async (studentUserId: string) => {
        setStudentLoading(true);
        try {
            const token = getToken();
            const res = await fetch(`${API}/api/ml/student/${studentUserId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: StudentData = await res.json();
            setStudentData(data);
        } catch {
            setStudentData(null);
        } finally {
            setStudentLoading(false);
        }
    }, []);

    // ─── Retrain model ───────────────────────────────────────
    const handleRetrain = async () => {
        setRetraining(true);
        try {
            const token = getToken();
            await fetch(`${API}/api/ml/retrain`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            await fetchOverview(true);
        } catch {
            /* ignore */
        } finally {
            setRetraining(false);
        }
    };

    // ─── Module selection ────────────────────────────────────
    const handleModuleSelect = (mod: string) => {
        setSelectedModule(mod);
        setSelectedStudentId(null);
        setStudentData(null);
        if (mod === "all") {
            setModuleData(null);
        } else {
            fetchModuleInsights(mod);
        }
    };

    useEffect(() => {
        fetchOverview();
    }, [fetchOverview]);

    // Display data always from global overview (survey is collected once, not per module)
    const displayImportance = overview?.factor_importance;
    const displayRecommendations = overview?.recommendations;

    // ─── Render ──────────────────────────────────────────────
    return (
        <div style={{ minHeight: "100vh", background: "#111827", color: "#e5e7eb", fontFamily: "'Inter', sans-serif" }}>
            {/* Header */}
            <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", borderBottom: "1px solid #1e293b", padding: "20px 32px" }}>
                <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <Link href="/teacher/attendance" style={{ color: "#9ca3af", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                            <ArrowLeft size={16} /> Back to Attendance
                        </Link>
                        <div style={{ width: 1, height: 24, background: "#374151" }} />
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Brain size={24} style={{ color: "#10b981" }} />
                            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f9fafb" }}>Attendance Insights</h1>
                        </div>
                    </div>
                    <button
                        onClick={handleRetrain}
                        disabled={retraining}
                        style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "8px 16px", borderRadius: 8,
                            background: retraining ? "#374151" : "#10b981",
                            color: "#fff", border: "none", cursor: retraining ? "not-allowed" : "pointer",
                            fontSize: 14, fontWeight: 500,
                            transition: "all 0.2s",
                        }}
                    >
                        <RefreshCw size={16} style={retraining ? { animation: "spin 1s linear infinite" } : {}} />
                        {retraining ? "Analyzing..." : "Re-Analyze"}
                    </button>
                </div>
            </div>

            <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 32px" }}>

                {/* Info banner */}
                <div style={{
                    background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.08))",
                    border: "1px solid rgba(16,185,129,0.2)", borderRadius: 12,
                    padding: "16px 24px", marginBottom: 24,
                    display: "flex", alignItems: "center", gap: 12,
                }}>
                    <Brain size={20} style={{ color: "#10b981", flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: 14, color: "#d1d5db", lineHeight: 1.5 }}>
                        This page analyzes <strong style={{ color: "#10b981" }}>survey responses</strong> together with <strong style={{ color: "#3b82f6" }}>attendance records</strong> to
                        find <strong style={{ color: "#f9fafb" }}>why</strong> students miss classes — not just who is absent.
                        Only your modules are shown.
                    </p>
                </div>

                {/* Loading / Error states */}
                {loading && (
                    <div style={{ textAlign: "center", padding: 80 }}>
                        <Activity size={48} style={{ color: "#10b981", animation: "pulse 2s infinite" }} />
                        <p style={{ color: "#9ca3af", marginTop: 16, fontSize: 16 }}>Analyzing attendance + survey data...</p>
                    </div>
                )}

                {error && (
                    <div style={{ textAlign: "center", padding: 80, background: "rgba(239,68,68,0.1)", borderRadius: 12, border: "1px solid #ef4444" }}>
                        <AlertTriangle size={48} style={{ color: "#ef4444" }} />
                        <p style={{ color: "#ef4444", marginTop: 16 }}>{error}</p>
                        <button onClick={() => fetchOverview()} style={{ marginTop: 16, padding: "8px 24px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Retry</button>
                    </div>
                )}

                {/* No data state */}
                {!loading && !error && overview?.status === "no_data" && (
                    <div style={{ textAlign: "center", padding: 80, background: "rgba(59,130,246,0.1)", borderRadius: 12, border: "1px solid #3b82f6" }}>
                        <Info size={48} style={{ color: "#3b82f6" }} />
                        <h2 style={{ color: "#f9fafb", marginTop: 16 }}>Not Enough Data</h2>
                        <p style={{ color: "#9ca3af", maxWidth: 500, margin: "8px auto 0" }}>
                            {overview.message || "Students need to complete both surveys and attend sessions before insights can be generated."}
                        </p>
                    </div>
                )}

                {/* Insufficient data state */}
                {!loading && !error && overview?.status === "insufficient_data" && (
                    <div style={{ textAlign: "center", padding: 80, background: "rgba(245,158,11,0.1)", borderRadius: 12, border: "1px solid #f59e0b" }}>
                        <AlertTriangle size={48} style={{ color: "#f59e0b" }} />
                        <h2 style={{ color: "#f9fafb", marginTop: 16 }}>Insufficient Data</h2>
                        <p style={{ color: "#9ca3af", maxWidth: 500, margin: "8px auto 0" }}>
                            {overview.message || "Need at least 5 students with both survey and attendance data."}
                        </p>
                    </div>
                )}

                {/* SUCCESS — Main Dashboard */}
                {!loading && !error && overview?.status === "success" && (
                    <>
                        {/* ─── Stat Cards (teacher-friendly) ──────────────── */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                            {[
                                {
                                    label: "Overall Attendance",
                                    value: selectedModule === "all"
                                        ? `${overview.overall_attendance ?? 0}%`
                                        : `${moduleData?.average_attendance ?? overview.overall_attendance ?? 0}%`,
                                    sub: selectedModule === "all" ? "Across your modules" : selectedModule,
                                    icon: Percent,
                                    color: (overview.overall_attendance ?? 0) >= 80 ? "#10b981" : "#f59e0b",
                                },
                                {
                                    label: "Students at Risk",
                                    value: overview.at_risk_count ?? 0,
                                    sub: "Below 80% attendance",
                                    icon: TrendingDown,
                                    color: (overview.at_risk_count ?? 0) > 0 ? "#ef4444" : "#10b981",
                                },
                                {
                                    label: "Students Analyzed",
                                    value: selectedModule === "all" ? overview.students_analyzed : (moduleData?.students_in_module ?? overview.students_analyzed ?? "—"),
                                    sub: "With survey + attendance",
                                    icon: Users,
                                    color: "#8b5cf6",
                                },
                                {
                                    label: "Top Barrier",
                                    value: overview.top_barrier_factor ? overview.top_barrier_factor.split(" ")[0] : "—",
                                    sub: overview.top_barrier_factor ?? "No barrier found",
                                    icon: Target,
                                    color: "#f59e0b",
                                },
                            ].map((card, i) => (
                                <div key={i} style={{
                                    background: "#1e293b", borderRadius: 12, padding: "20px 24px",
                                    border: "1px solid #374151", transition: "border-color 0.2s",
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <div>
                                            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0, fontWeight: 500 }}>{card.label}</p>
                                            <p style={{ fontSize: 32, fontWeight: 700, color: "#f9fafb", margin: "4px 0" }}>{card.value}</p>
                                            <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>{card.sub}</p>
                                        </div>
                                        <card.icon size={24} style={{ color: card.color, opacity: 0.7 }} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ─── Module-Wise Attendance ───────────────────────── */}
                        {overview.module_attendance && overview.module_attendance.length > 0 && (
                            <div style={{ background: "#1e293b", borderRadius: 12, padding: 24, border: "1px solid #374151", marginBottom: 24 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                                    <BookOpen size={18} style={{ color: "#8b5cf6" }} />
                                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f9fafb" }}>Module-Wise Attendance</h3>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                                    {overview.module_attendance.map((mod) => {
                                        const attColor = mod.average_attendance >= 80 ? "#10b981" : mod.average_attendance >= 70 ? "#f59e0b" : "#ef4444";
                                        return (
                                            <div
                                                key={mod.module_code}
                                                style={{
                                                    background: "#111827", borderRadius: 10, padding: "16px 20px",
                                                    border: "1px solid #374151", transition: "all 0.2s",
                                                }}
                                            >
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                                    <span style={{ fontSize: 15, fontWeight: 600, color: "#f9fafb" }}>{mod.module_code}</span>
                                                    <span style={{ fontSize: 22, fontWeight: 700, color: attColor }}>{mod.average_attendance}%</span>
                                                </div>
                                                <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px", lineHeight: 1.3 }}>{mod.module_name}</p>
                                                <div style={{ background: "#374151", borderRadius: 6, height: 8, overflow: "hidden", marginBottom: 10 }}>
                                                    <div style={{
                                                        width: `${Math.min(mod.average_attendance, 100)}%`,
                                                        height: "100%",
                                                        background: attColor,
                                                        borderRadius: 6,
                                                        transition: "width 0.6s ease-out",
                                                    }} />
                                                </div>
                                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9ca3af" }}>
                                                    <span>{mod.student_count} students</span>
                                                    {mod.at_risk_count > 0 && (
                                                        <span style={{ color: "#ef4444", fontWeight: 600 }}>{mod.at_risk_count} at risk</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ─── Why Students Miss Classes + What You Can Do ──── */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                            {/* ─── Why Students Miss Classes ─────────────── */}
                            <div style={{ background: "#1e293b", borderRadius: 12, padding: 24, border: "1px solid #374151" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                    <BarChart3 size={18} style={{ color: "#10b981" }} />
                                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f9fafb" }}>
                                        Why Students Miss Classes
                                    </h3>
                                </div>
                                <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px", lineHeight: 1.4 }}>
                                    Based on ML analysis of survey answers + attendance records.
                                    Higher % = bigger impact on attendance.
                                </p>

                                {(displayImportance || []).map((fi) => (
                                    <div key={fi.factor} style={{ marginBottom: 16 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                            <span style={{ fontSize: 13, fontWeight: 500, color: "#d1d5db" }}>
                                                <span style={{ color: factorColors[fi.factor] || "#10b981", fontWeight: 700 }}>{fi.factor}</span>
                                                {"  "}{fi.name}
                                            </span>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: factorColors[fi.factor] || "#10b981" }}>
                                                {fi.importance_pct}%
                                            </span>
                                        </div>
                                        <div style={{ background: "#374151", borderRadius: 6, height: 12, overflow: "hidden" }}>
                                            <div
                                                style={{
                                                    width: `${Math.min(fi.importance_pct, 100)}%`,
                                                    height: "100%",
                                                    background: `linear-gradient(90deg, ${factorColors[fi.factor] || "#10b981"}, ${factorColors[fi.factor] || "#10b981"}cc)`,
                                                    borderRadius: 6,
                                                    transition: "width 0.8s ease-out",
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ─── What You Can Do ────────────────────────── */}
                            <div style={{ background: "#1e293b", borderRadius: 12, padding: 24, border: "1px solid #374151" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                    <Lightbulb size={18} style={{ color: "#f59e0b" }} />
                                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f9fafb" }}>What You Can Do</h3>
                                </div>
                                <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
                                    Actionable steps based on the top attendance barriers.
                                </p>

                                {(displayRecommendations || []).map((rec, i) => {
                                    const config = severityConfig[rec.severity] || severityConfig.info;
                                    const Icon = config.icon;
                                    return (
                                        <div
                                            key={i}
                                            style={{
                                                background: config.bg,
                                                border: `1px solid ${config.border}33`,
                                                borderLeft: `4px solid ${config.border}`,
                                                borderRadius: 8,
                                                padding: 16,
                                                marginBottom: 12,
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                                <Icon size={16} style={{ color: config.border }} />
                                                <span style={{ fontSize: 11, fontWeight: 700, color: config.border, letterSpacing: 0.5 }}>
                                                    {config.label}
                                                </span>
                                                {rec.importance_pct && (
                                                    <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 4 }}>({rec.importance_pct}% impact)</span>
                                                )}
                                            </div>
                                            <p style={{ fontSize: 14, fontWeight: 600, color: "#f9fafb", margin: "0 0 8px" }}>{rec.title}</p>
                                            <ul style={{ margin: 0, paddingLeft: 20 }}>
                                                {rec.actions.map((action, j) => (
                                                    <li key={j} style={{ fontSize: 13, color: "#d1d5db", marginBottom: 4 }}>{action}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    );
                                })}

                                {(!displayRecommendations || displayRecommendations.length === 0) && (
                                    <p style={{ color: "#6b7280", fontSize: 14, textAlign: "center", padding: 20 }}>
                                        No recommendations available yet.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* ─── Last Analyzed ──────────────────────────────────── */}
                        {overview?.last_trained_at && (
                            <div style={{ textAlign: "center", padding: "16px 0", color: "#6b7280", fontSize: 13 }}>
                                Last analyzed: {new Date(overview.last_trained_at).toLocaleString()}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ─── Global Styles ──────────────────────────────────── */}
            <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
        </div>
    );
}
