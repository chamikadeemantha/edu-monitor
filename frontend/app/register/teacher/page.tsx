"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, Phone, Briefcase, UserCircle, Award, Clock, Loader2 } from "lucide-react";

export default function TeacherRegisterPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Form States
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // Profile States
    const [teacherId, setTeacherId] = useState("");
    const [fullName, setFullName] = useState("");
    const [position, setPosition] = useState("Lecturer");
    const [department, setDepartment] = useState("");
    const [phone, setPhone] = useState("");
    const [specialization, setSpecialization] = useState("");
    const [experience, setExperience] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("http://localhost:8000/api/auth/register/teacher", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    email,
                    password,
                    role: "teacher",
                    teacher_id: teacherId,
                    full_name: fullName,
                    position,
                    department,
                    phone_number: phone,
                    specialization,
                    years_of_experience: parseInt(experience)
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Registration failed");
            }

            // Success!!
            alert("Teacher Account Created! Pending Admin Approval.");
            router.push("/login");

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 py-12">
            <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-2xl border border-slate-700">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Teacher Registration</h1>
                    <p className="text-slate-400">Join our academic staff network</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg mb-6 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* --- Account Info --- */}
                    <div className="md:col-span-2 text-lg font-semibold text-emerald-400 border-b border-slate-700 pb-2 mb-2">
                        Account Information
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Teacher ID *</label>
                        <div className="relative">
                            <UserCircle className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                            <input
                                type="text"
                                required
                                value={teacherId}
                                onChange={(e) => setTeacherId(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                placeholder="TCH2024001"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Username *</label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                placeholder="dr_smith"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2 space-y-2">
                        <label className="text-sm font-medium text-slate-300">Full Name *</label>
                        <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            placeholder="Dr. John Smith"
                        />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                        <label className="text-sm font-medium text-slate-300">Official Email *</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                placeholder="teacher@university.edu"
                            />
                        </div>
                    </div>

                    {/* --- Professional Details --- */}
                    <div className="md:col-span-2 text-lg font-semibold text-emerald-400 border-b border-slate-700 pb-2 mb-2 mt-4">
                        Professional Details
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Position *</label>
                        <select
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none appearance-none"
                        >
                            <option value="Professor">Professor</option>
                            <option value="Associate Professor">Associate Professor</option>
                            <option value="Lecturer">Lecturer</option>
                            <option value="Assistant Lecturer">Assistant Lecturer</option>
                            <option value="Instructor">Instructor</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Department *</label>
                        <div className="relative">
                            <Briefcase className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                            <input
                                type="text"
                                required
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                placeholder="Computer Science"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Area of Specialization *</label>
                        <div className="relative">
                            <Award className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                            <input
                                type="text"
                                required
                                value={specialization}
                                onChange={(e) => setSpecialization(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                placeholder="Machine Learning"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Years of Experience *</label>
                        <div className="relative">
                            <Clock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                            <input
                                type="number"
                                required
                                min="0"
                                value={experience}
                                onChange={(e) => setExperience(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                placeholder="5"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2 space-y-2">
                        <label className="text-sm font-medium text-slate-300">Phone Number *</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                            <input
                                type="tel"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                placeholder="123-456-7890"
                            />
                        </div>
                    </div>

                    {/* --- Security --- */}
                    <div className="md:col-span-2 text-lg font-semibold text-emerald-400 border-b border-slate-700 pb-2 mb-2 mt-4">
                        Security
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Password *</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Confirm Password *</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {/* --- Submit --- */}
                    <div className="md:col-span-2 mt-6">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : "Create Teacher Account"}
                        </button>
                    </div>

                    <div className="md:col-span-2 text-center mt-4 text-slate-400">
                        Already have an account?{" "}
                        <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
                            Sign in
                        </Link>
                    </div>

                </form>
            </div>
        </div>
    );
}
