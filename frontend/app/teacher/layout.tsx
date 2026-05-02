"use client";

import React from "react";
import Sidebar from "@/components/teacher/Sidebar";
// import RoleGuard from "@/components/RoleGuard"; // TODO: Re-enable after DB setup
// import { UserRole } from "@/context/AuthContext"; // TODO: Re-enable after DB setup

export default function TeacherLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // TODO: Re-wrap with <RoleGuard allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}> after DB setup
    return (
        <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden bg-gray-900">
                <div className="flex-1 overflow-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}
