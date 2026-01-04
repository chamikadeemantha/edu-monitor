"use client";
import React, { useState } from 'react';
import {
    BarChart3,
    BrainCircuit,
    UserCheck,
    GraduationCap,
    LayoutDashboard,
    Users
} from 'lucide-react';

// Import the Student Performance component
import StudentPerformanceSection from '../performance/page';

export default function TeacherDashboard() {
    const [activeTab, setActiveTab] = useState('engagement');

    const tabs = [
        { id: 'engagement', label: 'Student Engagement', icon: BrainCircuit },
        { id: 'performance', label: 'Teacher Performance', icon: BarChart3 },
        { id: 'attendance', label: 'Student Attendance', icon: UserCheck },
        { id: 'student-perf', label: 'Student Performance', icon: GraduationCap },
    ];

    return (
        <div className="flex h-screen bg-gray-900 text-white">
            {/* Sidebar */}
            <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
                <div className="p-6 border-b border-gray-700">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <LayoutDashboard className="text-blue-500" />
                        ClassMaster
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">Teacher Dashboard</p>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                                    }`}
                            >
                                <Icon size={20} />
                                <span className="text-sm font-medium">{tab.label}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                            <Users size={16} />
                        </div>
                        <div>
                            <p className="text-sm font-medium">Prof. Anderson</p>
                            <p className="text-xs text-gray-500">Instructor</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <header className="h-16 bg-gray-800/50 backdrop-blur border-b border-gray-700 flex items-center justify-between px-8 sticky top-0 z-10">
                    <h2 className="text-lg font-semibold text-gray-200">
                        {tabs.find(t => t.id === activeTab)?.label}
                    </h2>
                    <div className="flex items-center gap-4">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-sm text-emerald-400">System Online</span>
                    </div>
                </header>

                <main className="p-8">
                    {/* Engagement Tab */}
                    {activeTab === 'engagement' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                                    <h3 className="text-gray-400 text-sm font-medium mb-2">Current Status</h3>
                                    <div className="text-2xl font-bold text-white">Monitoring Active</div>
                                    <div className="text-emerald-400 text-sm mt-1">Live feed processing</div>
                                </div>
                                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                                    <h3 className="text-gray-400 text-sm font-medium mb-2">Class Engagement</h3>
                                    <div className="text-2xl font-bold text-white">85%</div>
                                    <div className="text-emerald-400 text-sm mt-1">↑ 12% vs last 5 mins</div>
                                </div>
                                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                                    <h3 className="text-gray-400 text-sm font-medium mb-2">Active Students</h3>
                                    <div className="text-2xl font-bold text-white">24</div>
                                    <div className="text-gray-500 text-sm mt-1">Total in view</div>
                                </div>
                            </div>

                            <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl relative">
                                <div className="p-4 bg-gray-900/50 border-b border-gray-700 flex justify-between items-center">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <BrainCircuit size={18} className="text-blue-400" />
                                        Live Classroom Feed
                                    </h3>
                                    <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded font-mono uppercase">REC</span>
                                </div>
                                <div className="relative aspect-video bg-black flex items-center justify-center">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="http://localhost:8000/video_feed" alt="Live Classroom Feed" className="w-full h-full object-contain" />
                                    <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-mono text-white/80">
                                        CAM-01 • 1080p • 30FPS
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Student Performance Tab - Using imported component */}
                    {activeTab === 'student-perf' && (
                        <StudentPerformanceSection />
                    )}

                    {/* Other tabs placeholder */}
                    {activeTab !== 'engagement' && activeTab !== 'student-perf' && (
                        <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
                            <div className="p-8 rounded-full bg-gray-800 mb-6">
                                {(() => {
                                    const Icon = tabs.find(t => t.id === activeTab)?.icon || LayoutDashboard;
                                    return <Icon size={64} className="opacity-20" />;
                                })()}
                            </div>
                            <h3 className="text-xl font-medium text-gray-300 mb-2">Module Not Connected</h3>
                            <p className="max-w-md text-center">
                                This is a placeholder for the
                                <span className="text-blue-400 mx-1">{tabs.find(t => t.id === activeTab)?.label}</span>
                                module developed by other group members.
                            </p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
