"use client";

import { useAuth, UserRole } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminDashboard() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && (!user || user.role !== UserRole.ADMIN)) {
            router.push("/login");
        }
    }, [user, isLoading, router]);

    if (isLoading || !user || user.role !== UserRole.ADMIN) {
        return <div className="text-white p-8">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <h1 className="text-3xl font-bold mb-4">Admin Dashboard</h1>
            <p>Welcome, {user.username}!</p>
            <div className="mt-8">
                <h2 className="text-xl font-semibold mb-2">System Overview</h2>
                {/* Admin stats and controls would go here */}
                <p className="text-slate-400">Manage users, classes, and system settings.</p>
            </div>
        </div>
    );
}
