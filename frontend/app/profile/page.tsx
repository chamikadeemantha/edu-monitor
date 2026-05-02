"use client";

import { useAuth, UserRole } from "@/context/AuthContext";
import {
    User, Mail, Shield, School, Hash, Calendar, Phone, Briefcase, Award,
    Camera, Loader2, CheckCircle2, Pencil, X, Save, Lock, Eye, EyeOff
} from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { useRef, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

function getToken() {
    return (localStorage.getItem("access_token") || localStorage.getItem("token")) ?? null;
}

export default function ProfilePage() {
    const { user, refreshUser } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Profile picture upload ---
    const [uploading, setUploading] = useState(false);
    const [imgKey, setImgKey] = useState(0);

    // --- Phone number edit ---
    const [editingPhone, setEditingPhone] = useState(false);
    const [phoneValue, setPhoneValue] = useState("");
    const [savingPhone, setSavingPhone] = useState(false);

    // --- Password change ---
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [savingPassword, setSavingPassword] = useState(false);
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);

    // --- Shared feedback ---
    const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
    const [feedbackOk, setFeedbackOk] = useState(false);

    function flash(msg: string, ok: boolean) {
        setFeedbackMsg(msg);
        setFeedbackOk(ok);
        if (ok) setTimeout(() => setFeedbackMsg(null), 5000);
    }

    // --- Avatar click ---
    const handleAvatarClick = useCallback(() => {
        if (!uploading) fileInputRef.current?.click();
    }, [uploading]);

    // --- Avatar upload ---
    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        setUploading(true);
        setFeedbackMsg(null);
        try {
            const token = getToken();
            if (!token) throw new Error("Not logged in.");
            const fd = new FormData();
            fd.append("profile_picture", file);
            const res = await fetch(`${API}/api/auth/users/me/profile-picture`, {
                method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: fd,
            });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Upload failed"); }
            setImgKey((p) => p + 1);
            flash("Profile picture updated! Facial recognition will use this photo.", true);
        } catch (err: any) { flash(err.message || "Failed to upload", false); }
        finally { setUploading(false); }
    }, []);

    // --- Phone number save ---
    const handlePhoneSave = useCallback(async () => {
        if (!phoneValue.trim()) return;
        setSavingPhone(true);
        setFeedbackMsg(null);
        try {
            const token = getToken();
            if (!token) throw new Error("Not logged in.");
            const fd = new FormData();
            fd.append("phone_number", phoneValue.trim());
            const res = await fetch(`${API}/api/auth/users/me/phone`, {
                method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: fd,
            });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Update failed"); }
            setEditingPhone(false);
            flash("Phone number updated successfully!", true);
            // Refresh user context so the UI updates immediately
            if (refreshUser) refreshUser();
        } catch (err: any) { flash(err.message || "Failed to update phone", false); }
        finally { setSavingPhone(false); }
    }, [phoneValue, refreshUser]);

    // --- Password change ---
    const handlePasswordChange = useCallback(async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            flash("Please fill in all password fields.", false); return;
        }
        if (newPassword !== confirmPassword) {
            flash("New passwords do not match.", false); return;
        }
        if (newPassword.length < 4) {
            flash("New password must be at least 4 characters.", false); return;
        }
        setSavingPassword(true);
        setFeedbackMsg(null);
        try {
            const token = getToken();
            if (!token) throw new Error("Not logged in.");
            const fd = new FormData();
            fd.append("current_password", currentPassword);
            fd.append("new_password", newPassword);
            const res = await fetch(`${API}/api/auth/users/me/password`, {
                method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: fd,
            });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "Password change failed"); }
            setShowPasswordForm(false);
            setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
            flash("Password changed successfully!", true);
        } catch (err: any) { flash(err.message || "Failed to change password", false); }
        finally { setSavingPassword(false); }
    }, [currentPassword, newPassword, confirmPassword]);

    if (!user) {
        return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading profile...</div>;
    }

    const currentPhone =
        user.role === UserRole.STUDENT ? user.student_profile?.phone_number :
            user.role === UserRole.TEACHER ? user.teacher_profile?.phone_number : undefined;

    const ProfileField = ({ icon, label, value }: { icon: any; label: string; value: string | number | undefined }) => (
        <div className="flex items-start gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
            <div className="p-2 bg-gray-900 rounded-lg text-blue-400">{icon}</div>
            <div>
                <p className="text-sm text-gray-400">{label}</p>
                <p className="font-medium text-white">{value || "N/A"}</p>
            </div>
        </div>
    );

    return (
        <RoleGuard allowedRoles={[UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN]}>
            <div className="min-h-screen bg-gray-900 text-white p-8">
                <div className="max-w-4xl mx-auto">

                    {/* Feedback banner */}
                    {feedbackMsg && (
                        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${feedbackOk
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                : "border-red-500/30 bg-red-500/10 text-red-200"
                            }`}>
                            {feedbackOk && <CheckCircle2 size={16} />}
                            {feedbackMsg}
                        </div>
                    )}

                    {/* ─── Header Card ─── */}
                    <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-2xl p-8 mb-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 bg-blue-500 blur-3xl w-64 h-64 rounded-full -mr-20 -mt-20" />

                        {/* Avatar */}
                        <div
                            className="relative z-10 w-32 h-32 rounded-full ring-4 ring-blue-500/30 bg-gray-800 overflow-hidden shadow-2xl cursor-pointer group"
                            onClick={handleAvatarClick}
                            title="Click to update profile picture"
                        >
                            <img
                                key={imgKey}
                                src={`${API}/api/auth/users/${user.id}/profile-picture?v=${imgKey}`}
                                alt={user.username}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/150?text=User"; }}
                            />
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                {uploading
                                    ? <Loader2 size={28} className="text-white animate-spin" />
                                    : <><Camera size={24} className="text-white" /><span className="text-white text-xs mt-1 font-medium">Update</span></>
                                }
                            </div>
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

                        {/* Basic info */}
                        <div className="relative z-10 text-center md:text-left flex-1">
                            <h1 className="text-3xl font-bold mb-2">
                                {user.student_profile?.full_name || user.teacher_profile?.full_name || user.username}
                            </h1>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${user.role === UserRole.STUDENT ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                                        user.role === UserRole.TEACHER ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                                            "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                    }`}>
                                    {user.role}
                                </span>
                                <span className="flex items-center gap-1.5 text-gray-400 text-sm">
                                    <Mail size={14} /> {user.email}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ─── Profile Details ─── */}
                    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8 shadow-xl mb-8">
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                            <User className="text-blue-400" size={24} />
                            Profile Details
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <ProfileField icon={<Shield size={20} />} label="Username" value={user.username} />

                            {user.role === UserRole.STUDENT && user.student_profile && (
                                <>
                                    <ProfileField icon={<Hash size={20} />} label="Student ID" value={user.student_profile.student_id} />
                                    <ProfileField icon={<Calendar size={20} />} label="Age" value={user.student_profile.age} />
                                    <ProfileField icon={<User size={20} />} label="Gender" value={user.student_profile.gender} />

                                    {/* Editable Phone */}
                                    {editingPhone ? (
                                        <div className="flex items-start gap-4 p-4 bg-gray-800/50 rounded-xl border border-blue-500/40">
                                            <div className="p-2 bg-gray-900 rounded-lg text-blue-400"><Phone size={20} /></div>
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-400 mb-1">Phone</p>
                                                <input
                                                    autoFocus
                                                    value={phoneValue}
                                                    onChange={(e) => setPhoneValue(e.target.value)}
                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-400"
                                                />
                                                <div className="flex gap-2 mt-2">
                                                    <button
                                                        onClick={handlePhoneSave}
                                                        disabled={savingPhone || !phoneValue.trim()}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-50"
                                                    >
                                                        {savingPhone ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingPhone(false)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium"
                                                    >
                                                        <X size={14} /> Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50 group">
                                            <div className="p-2 bg-gray-900 rounded-lg text-blue-400"><Phone size={20} /></div>
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-400">Phone</p>
                                                <p className="font-medium text-white">{user.student_profile.phone_number || "N/A"}</p>
                                            </div>
                                            <button
                                                onClick={() => { setPhoneValue(user.student_profile?.phone_number || ""); setEditingPhone(true); }}
                                                className="p-2 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Edit phone number"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                        </div>
                                    )}

                                    <ProfileField icon={<School size={20} />} label="Major" value={user.student_profile.major} />
                                </>
                            )}

                            {user.role === UserRole.TEACHER && user.teacher_profile && (
                                <>
                                    <ProfileField icon={<Hash size={20} />} label="Teacher ID" value={user.teacher_profile.teacher_id} />
                                    <ProfileField icon={<Briefcase size={20} />} label="Position" value={user.teacher_profile.position} />
                                    <ProfileField icon={<School size={20} />} label="Department" value={user.teacher_profile.department} />
                                    <ProfileField icon={<Award size={20} />} label="Specialization" value={user.teacher_profile.specialization} />
                                    <ProfileField icon={<Calendar size={20} />} label="Experience" value={`${user.teacher_profile.years_of_experience} Years`} />

                                    {/* Editable Phone for teacher */}
                                    {editingPhone ? (
                                        <div className="flex items-start gap-4 p-4 bg-gray-800/50 rounded-xl border border-blue-500/40">
                                            <div className="p-2 bg-gray-900 rounded-lg text-blue-400"><Phone size={20} /></div>
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-400 mb-1">Phone</p>
                                                <input
                                                    autoFocus
                                                    value={phoneValue}
                                                    onChange={(e) => setPhoneValue(e.target.value)}
                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-400"
                                                />
                                                <div className="flex gap-2 mt-2">
                                                    <button
                                                        onClick={handlePhoneSave}
                                                        disabled={savingPhone || !phoneValue.trim()}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-50"
                                                    >
                                                        {savingPhone ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingPhone(false)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium"
                                                    >
                                                        <X size={14} /> Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50 group">
                                            <div className="p-2 bg-gray-900 rounded-lg text-blue-400"><Phone size={20} /></div>
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-400">Phone</p>
                                                <p className="font-medium text-white">{user.teacher_profile.phone_number || "N/A"}</p>
                                            </div>
                                            <button
                                                onClick={() => { setPhoneValue(user.teacher_profile?.phone_number || ""); setEditingPhone(true); }}
                                                className="p-2 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Edit phone number"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* ─── Change Password ─── */}
                    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8 shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <Lock className="text-blue-400" size={24} />
                                Change Password
                            </h2>
                            {!showPasswordForm && (
                                <button
                                    onClick={() => setShowPasswordForm(true)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 text-sm font-medium transition-colors"
                                >
                                    <Pencil size={14} /> Change
                                </button>
                            )}
                        </div>

                        {showPasswordForm ? (
                            <div className="space-y-4 max-w-md">
                                {/* Current Password */}
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Current Password</label>
                                    <div className="relative">
                                        <input
                                            type={showCurrentPw ? "text" : "password"}
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            placeholder="Enter current password"
                                            className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 pr-12 text-white text-sm outline-none focus:border-blue-400"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrentPw(!showCurrentPw)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                                        >
                                            {showCurrentPw ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {/* New Password */}
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">New Password</label>
                                    <div className="relative">
                                        <input
                                            type={showNewPw ? "text" : "password"}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Enter new password"
                                            className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 pr-12 text-white text-sm outline-none focus:border-blue-400"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPw(!showNewPw)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                                        >
                                            {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Confirm New Password */}
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Confirm New Password</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Re-enter new password"
                                        className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-400"
                                    />
                                    {confirmPassword && newPassword !== confirmPassword && (
                                        <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                                    )}
                                </div>

                                {/* Buttons */}
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={handlePasswordChange}
                                        disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                                    >
                                        {savingPassword ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        {savingPassword ? "Saving..." : "Update Password"}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowPasswordForm(false);
                                            setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
                                        }}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
                                    >
                                        <X size={16} /> Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm">
                                Use a strong password to keep your account secure. Click &quot;Change&quot; to update your password.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </RoleGuard>
    );
}
