'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Move, Compass } from 'lucide-react';

export default function TeacherBehaviorPage() {
    const [stats, setStats] = useState({ behavior: 'Initializing...', mobility: 0, orientation: 0, hand_speed: 0 });

    useEffect(() => {
        const interval = setInterval(() => {
            fetch('http://localhost:8000/api/teacher_stats')
                .then(res => res.json())
                .then(data => setStats(data))
                .catch(err => console.error(err));
        }, 500);
        return () => clearInterval(interval);
    }, []);

    const getBehaviorColor = (b: string) => {
        if (b === 'INTERACTIVE') return 'text-emerald-400';
        if (b === 'LECTURING') return 'text-blue-400';
        return 'text-orange-400';
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden">
            <header className="h-16 bg-gray-800/50 backdrop-blur border-b border-gray-700 flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
                <h2 className="text-lg font-semibold text-gray-200">
                    Teacher Performance
                </h2>
                <div className="flex items-center gap-4">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-sm text-emerald-400">System Online</span>
                </div>
            </header>
            <main className="p-8 flex-1 overflow-auto">
                <h1 className="text-2xl font-bold mb-6">Teacher Behavior Analysis</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <div className="flex items-center gap-2 mb-2">
                            <Activity size={20} className="text-blue-500" />
                            <h3 className="text-gray-400 font-medium">Current State</h3>
                        </div>
                        <div className={`text-3xl font-bold ${getBehaviorColor(stats.behavior)}`}>
                            {stats.behavior}
                        </div>
                    </div>
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <div className="flex items-center gap-2 mb-2">
                            <Move size={20} className="text-purple-500" />
                            <h3 className="text-gray-400 font-medium">Mobility Score</h3>
                        </div>
                        <div className="text-3xl font-bold">{stats.mobility}</div>
                    </div>
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <div className="flex items-center gap-2 mb-2">
                            <Compass size={20} className="text-yellow-500" />
                            <h3 className="text-gray-400 font-medium">Orientation Var.</h3>
                        </div>
                        <div className="text-3xl font-bold">{stats.orientation}</div>
                    </div>
                </div>
                <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 shadow-xl max-w-4xl mx-auto">
                    <div className="aspect-video bg-black flex items-center justify-center">
                        <img src="http://localhost:8000/teacher_feed" alt="Feed" className="w-full h-full object-contain" />
                    </div>
                </div>
            </main>
        </div>
    );
}
