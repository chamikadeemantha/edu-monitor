"use client";

import { useAuth, UserRole } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle, XCircle, User, ShieldCheck } from "lucide-react";

interface PendingUser {
    id: number;
    username: string;
    email: string;
    role: string;
    is_approved: boolean;
    created_at: string;
}

export default function AdminDashboard() {
    const { user, isLoading, token } = useAuth();
    const router = useRouter();
    const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    useEffect(() => {
        if (!isLoading) {
            if (!user || user.role !== UserRole.ADMIN) {
                router.push("/login");
            } else {
                fetchPendingUsers();
            }
        }
    }, [user, isLoading, router]);

    const fetchPendingUsers = async () => {
        if (!token) return;
        setLoadingUsers(true);
        try {
            const res = await fetch("http://localhost:8000/api/auth/admin/pending-users", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setPendingUsers(data);
            }
        } catch (error) {
            console.error("Failed to fetch pending users", error);
        } finally {
            setLoadingUsers(false);
        }
    };

    const approveUser = async (userId: number) => {
        if (!token) return;
        try {
            const res = await fetch(`http://localhost:8000/api/auth/admin/approve/${userId}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                // Remove from local list
                setPendingUsers(prev => prev.filter(u => u.id !== userId));
                alert("User approved successfully!");
            } else {
                alert("Failed to approve user.");
            }
        } catch (error) {
            console.error("Error approving user", error);
        }
    };

    if (isLoading || !user || user.role !== UserRole.ADMIN) {
        return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <div className="bg-blue-600 p-3 rounded-xl">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                        <p className="text-slate-400">Welcome back, {user.username}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* --- Pending Approvals Section --- */}
                    <div className="lg:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <User className="w-5 h-5 text-yellow-500" />
                                Pending Approvals
                            </h2>
                            <span className="bg-slate-700 text-xs font-bold px-2 py-1 rounded-full text-slate-300">
                                {pendingUsers.length}
                            </span>
                        </div>

                        <div className="p-6">
                            {loadingUsers ? (
                                <p className="text-center text-slate-500 py-4">Loading requests...</p>
                            ) : pendingUsers.length === 0 ? (
                                <p className="text-center text-slate-500 py-8">No pending registrations.</p>
                            ) : (
                                <div className="space-y-4">
                                    {pendingUsers.map((pUser) => (
                                        <div key={pUser.id} className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition hover:border-slate-600">
                                            <div>
                                                <div className="font-semibold text-lg">{pUser.username}</div>
                                                <div className="text-sm text-slate-400">{pUser.email}</div>
                                                <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                                                    {pUser.role}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                                <button
                                                    onClick={() => approveUser(pUser.id)}
                                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Approve
                                                </button>
                                                {/* Optional: Add Reject Button Logic later */}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- Quick Stats or Links (Placeholder) --- */}
                    <div className="space-y-6">
                        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
                            <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg">
                                    <span className="text-slate-400 text-sm">Total Users</span>
                                    <span className="font-mono font-bold">--</span>
                                </div>
                                <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg">
                                    <span className="text-slate-400 text-sm">Active Classes</span>
                                    <span className="font-mono font-bold">--</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
