"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, Phone, BookOpen, UserCircle, Calendar, GraduationCap, ArrowRight, Loader2 } from "lucide-react";

export default function StudentRegisterPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Form States
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // Profile States
    const [studentId, setStudentId] = useState("");
    const [fullName, setFullName] = useState("");
    const [age, setAge] = useState("");
    const [gender, setGender] = useState("Male");
    const [phone, setPhone] = useState("");
    const [major, setMajor] = useState("Computer Science");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("http://localhost:8000/api/auth/register/student", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    email,
                    password,
                    role: "student",
                    student_id: studentId,
                    full_name: fullName,
                    age: parseInt(age),
                    gender,
                    phone_number: phone,
                    major
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Registration failed");
            }

            // Success!!
            alert("Registration successful! Your account is pending admin approval.");
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
                    <h1 className="text-3xl font-bold text-white mb-2">Student Registration</h1>
                    <p className="text-slate-400">Create your account to access the learning portal</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg mb-6 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* --- Account Info --- */}
                    <div className="md:col-span-2 text-lg font-semibold text-blue-400 border-b border-slate-700 pb-2 mb-2">
                        Account Information
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Student ID *</label>
                        <div className="relative">
                            <UserCircle className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                            <input
                                type="text"
                                required
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="STU2024001"
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
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="johndoe"
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
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="John Doe"
                        />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                        <label className="text-sm font-medium text-slate-300">Student Email *</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="student@university.edu"
                            />
                        </div>
                    </div>

                    {/* --- Personal Details --- */}
                    <div className="md:col-span-2 text-lg font-semibold text-blue-400 border-b border-slate-700 pb-2 mb-2 mt-4">
                        Personal Details
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Age *</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                            <input
                                type="number"
                                required
                                min="1"
                                max="100"
                                value={age}
                                onChange={(e) => setAge(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="20"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Gender *</label>
                        <select
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none"
                        >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Phone Number *</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                            <input
                                type="tel"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="123-456-7890"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Major/Field of Study *</label>
                        <div className="relative">
                            <GraduationCap className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                            <input
                                type="text"
                                required
                                value={major}
                                onChange={(e) => setMajor(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="Computer Science"
                            />
                        </div>
                    </div>

                    {/* --- Security --- */}
                    <div className="md:col-span-2 text-lg font-semibold text-blue-400 border-b border-slate-700 pb-2 mb-2 mt-4">
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
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    {/* --- Submit --- */}
                    <div className="md:col-span-2 mt-6">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : "Create Account"}
                        </button>
                    </div>

                    <div className="md:col-span-2 text-center mt-4 text-slate-400">
                        Already have an account?{" "}
                        <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">
                            Sign in
                        </Link>
                    </div>

                </form>
            </div>
        </div>
    );
}
