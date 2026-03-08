"use client";

import React from "react";
import RoleGuard from "@/components/RoleGuard";
import { UserRole } from "@/context/AuthContext";

export default function StudentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <RoleGuard allowedRoles={[UserRole.STUDENT, UserRole.ADMIN]}>
            <div className="min-h-screen bg-gray-900 text-white">
                {children}
            </div>
        </RoleGuard>
    );
}
