"use client";
import React from 'react';
import {
    BookOpen,
    Trophy,
    Clock,
    ChevronRight,
    LineChart,
    CheckCircle2
} from 'lucide-react';

export default function StudentDashboard() {
    const quizzes = [
        { id: 1, title: "Week 4: Machine Learning Basics", status: "Completed", score: "85%", date: "Dec 28, 2025" },
        { id: 2, title: "Week 5: Neural Networks Intro", status: "Pending", score: "-", date: "Dec 30, 2025" },
        { id: 3, title: "Week 6: Computer Vision", status: "Locked", score: "-", date: "Jan 05, 2026" },
    ];

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900">
            <nav className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-600 p-2 rounded-lg text-white">
                        <BookOpen size={20} />
                    </div>
                    <span className="font-bold text-lg tracking-tight">StudentPortal</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">Welcome, <strong>Alex</strong></span>
                    <div className="w-8 h-8 rounded-full bg-gray-200 border border-gray-300"></div>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto p-8">

                {/* Welcome Header */}
                <header className="mb-12">
                    <h1 className="text-3xl font-bold mb-2">My Leaning Dashboard</h1>
                    <p className="text-gray-500">Track your progress and complete upcoming assessments.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Main Content: Performance Summary */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Stats Row */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                                    <Trophy size={24} />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">1,240</div>
                                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Points</div>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                                    <CheckCircle2 size={24} />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">92%</div>
                                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Avg. Score</div>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                                <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                                    <Clock size={24} />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">12h</div>
                                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Study Time</div>
                                </div>
                            </div>
                        </div>

                        {/* Performance Chart Placeholder */}
                        <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <LineChart size={20} className="text-gray-400" />
                                    Performance Summary
                                </h2>
                                <select className="bg-gray-50 border border-gray-200 text-sm rounded-lg px-3 py-1 outline-none">
                                    <option>Last 30 Days</option>
                                    <option>This Semeseter</option>
                                </select>
                            </div>

                            <div className="h-64 flex items-end justify-between gap-2 px-4">
                                {[40, 65, 55, 80, 72, 90, 85].map((h, i) => (
                                    <div key={i} className="w-full bg-indigo-50 rounded-t-lg relative group box-border hover:bg-indigo-100 transition-colors cursor-pointer">
                                        <div
                                            className="absolute bottom-0 left-0 w-full bg-indigo-500 rounded-t-lg transition-all duration-500"
                                            style={{ height: `${h}%` }}
                                        ></div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 flex justify-between text-xs text-gray-400 px-2 font-mono">
                                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar: Quizzes */}
                    <div>
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                                <h2 className="font-bold text-gray-800">Assigned Quizzes</h2>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {quizzes.map((quiz) => (
                                    <div key={quiz.id} className="p-6 hover:bg-gray-50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${quiz.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                    quiz.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-gray-100 text-gray-500'
                                                }`}>
                                                {quiz.status}
                                            </span>
                                            <span className="text-xs text-gray-400 font-mono">{quiz.date}</span>
                                        </div>
                                        <h3 className="font-semibold text-gray-800 mb-1">{quiz.title}</h3>
                                        <div className="flex items-center justify-between mt-4">
                                            <span className="text-sm font-medium text-gray-500">
                                                Score: <span className="text-gray-900">{quiz.score}</span>
                                            </span>
                                            <button className="text-emerald-600 hover:text-emerald-700 transition-colors p-1.5 hover:bg-emerald-50 rounded-lg">
                                                <ChevronRight size={20} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                                <button className="text-sm text-indigo-600 font-medium hover:underline">View All Assessments</button>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
