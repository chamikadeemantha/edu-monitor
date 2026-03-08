"use client";

import React, { useState } from "react";
// Removed unnecessary imports for sidebar/navigation
import {
  BarChart3,
  BrainCircuit,
  Settings2,
  TrendingUp,
  Activity,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  Bell
} from 'lucide-react';


import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

import EngagementDetailsModal from './EngagementDetailsModal';
import UserProfileMenu from "@/components/UserProfileMenu";



export default function StudentBehaviorPage() {
  // Removed activeTab and manual router logic

  const [stats, setStats] = useState({ total: 0, engaged: 0, active: 0 });
  const [groupStats, setGroupStats] = useState({
    "Front Row": { engaged: 0, total: 0 },
    "Middle Row": { engaged: 0, total: 0 },
    "Back Row": { engaged: 0, total: 0 }
  });
  const [showDetails, setShowDetails] = useState(false);
  const [visualizeGroups, setVisualizeGroups] = useState(false);

  // New Advanced State
  const [visualStyle, setVisualStyle] = useState("dots"); // "dots", "boxes", "detailed"
  const [modalDataKeys, setModalDataKeys] = useState<{ engaged: string, total: string, label: string } | undefined>(undefined);
  const [zoneSettings, setZoneSettings] = useState({ back: 33, front: 66 });
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<{
    id: string;
    zone: string;
    message: string;
    type: 'drop' | 'low';
    timestamp: number;
    isFresh: boolean;
  }[]>([]);
  const [isAlertsCollapsed, setIsAlertsCollapsed] = useState(false);



  const [draggingZone, setDraggingZone] = useState<null | 'back' | 'front'>(null);

  // ROI Selection State

  const [isSelectingROI, setIsSelectingROI] = useState(false);
  const [roiStart, setRoiStart] = useState<{ x: number, y: number } | null>(null);
  const [roiCurrent, setRoiCurrent] = useState<{ x: number, y: number } | null>(null);
  const [activeROI, setActiveROI] = useState({ x1: 0, y1: 0, x2: 1, y2: 1 });


  // ... (keep existing functions)
  const updateZoneSettings = async (back: number, front: number) => {
    setZoneSettings({ back, front });
    try {
      await fetch('http://localhost:8000/settings/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ back_split: back / 100, front_split: front / 100 })
      });
    } catch (err) {
      console.error("Failed to update zones:", err);
    }
  };

  const toggleVisualization = async () => {
    try {
      const newState = !visualizeGroups;
      setVisualizeGroups(newState);
      await fetch('http://localhost:8000/settings/visualize-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newState })
      });
    } catch (err) {
      console.error("Failed to toggle visualization:", err);
      // Revert on error
      setVisualizeGroups(!visualizeGroups);
    }
  };

  const changeVisualStyle = async (style: string) => {
    setVisualStyle(style);
    try {
      await fetch('http://localhost:8000/settings/visual-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style: style })
      });
    } catch (err) {
      console.error("Failed to set visual style:", err);
    }
  };

  const handleROIMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isSelectingROI) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      setRoiStart({ x, y });
      setRoiCurrent({ x, y });
    }
  };

  const handleROIMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    if (isSelectingROI && roiStart) {
      setRoiCurrent({ x, y });
    } else if (draggingZone) {
      const newVal = Math.max(0, Math.min(100, Math.round(y * 100)));
      if (draggingZone === 'back') {
        if (newVal < zoneSettings.front) {
          updateZoneSettings(newVal, zoneSettings.front);
        }
      } else {
        if (newVal > zoneSettings.back) {
          updateZoneSettings(zoneSettings.back, newVal);
        }
      }
    }
  };

  const handleROIMouseUp = async () => {
    if (draggingZone) {
      setDraggingZone(null);
      return;
    }

    if (!isSelectingROI || !roiStart || !roiCurrent) {
      setRoiStart(null);
      setRoiCurrent(null);
      return;
    }

    const x1 = Math.min(roiStart.x, roiCurrent.x);
    const y1 = Math.min(roiStart.y, roiCurrent.y);
    const x2 = Math.max(roiStart.x, roiCurrent.x);
    const y2 = Math.max(roiStart.y, roiCurrent.y);

    setActiveROI({ x1, y1, x2, y2 });

    try {
      await fetch('http://localhost:8000/settings/class-boundary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x1, y1, x2, y2 })
      });
    } catch (err) {
      console.error("Failed to update class boundary:", err);
    }

    setRoiStart(null);
    setRoiCurrent(null);
    setIsSelectingROI(false);
  };



  const handleCardClick = (keys?: { engaged: string, total: string, label: string }) => {
    setModalDataKeys(keys); // If undefined, it uses default global stats
    setShowDetails(true);
  };

  React.useEffect(() => {
    const interval = setInterval(() => {
      // Fetch Global Stats
      fetch('http://localhost:8000/stats', { cache: 'no-store' })
        .then(res => res.json())
        .then(data => setStats(data))
        .catch(err => console.error("Stats fetch error:", err));

      // Fetch Group Stats
      fetch('http://localhost:8000/stats/groups', { cache: 'no-store' })
        .then(res => res.json())
        .then(data => setGroupStats(data))
        .catch(err => console.error("Group Stats fetch error:", err));

      // Fetch History
      fetch('http://localhost:8000/stats/history', { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
          const formatted = data.slice(-40).map((d: any) => ({
            time: new Date(d.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            eng: d.total > 0 ? Math.round((d.engaged / d.total) * 100) : 0,
            front_eng: d.front_total > 0 ? Math.round((d.front_engaged / d.front_total) * 100) : 0,
            mid_eng: d.mid_total > 0 ? Math.round((d.mid_engaged / d.mid_total) * 100) : 0,
            back_eng: d.back_total > 0 ? Math.round((d.back_engaged / d.back_total) * 100) : 0,
            front_total: d.front_total,
            mid_total: d.mid_total,
            back_total: d.back_total,
            total: d.total
          }));
          setHistoryData(formatted);
        })
        .catch(err => console.error("History fetch error:", err));


    }, 1000);

  }, []);

  // Trend detection and alerting logic
  React.useEffect(() => {
    if (historyData.length < 15) return;

    const zones = [
      { name: 'Front Row', key: 'front_eng', totalKey: 'front_total' },
      { name: 'Middle Row', key: 'mid_eng', totalKey: 'mid_total' },
      { name: 'Back Row', key: 'back_eng', totalKey: 'back_total' }
    ];

    const newAlertsCandidates: typeof alerts = [];
    const alertsToRemove: string[] = [];
    const now = Date.now();

    zones.forEach(zone => {
      const recentSamples = historyData.slice(-15);
      const currentSample = recentSamples[recentSamples.length - 1];
      const currentEng = currentSample[zone.key];
      const currentTotal = currentSample[zone.totalKey];

      // Recovery Check: If engagement back to >50%, mark alerts for removal
      if (currentEng > 50) {
        const activeZoneAlerts = alerts.filter(a => a.zone === zone.name);
        activeZoneAlerts.forEach(a => alertsToRemove.push(a.id));
      }

      // Safety: Only alert if students are actually in the zone
      if (currentTotal <= 0) return;

      // 1. Sudden Drop Check (last 10 samples)
      const tenSamplesAgo = recentSamples[recentSamples.length - 10]?.[zone.key];
      if (tenSamplesAgo !== undefined && (tenSamplesAgo - currentEng) >= 15) {
        // Trigger "engagement dropping" alert if not already alerted recently
        const existingDropAlert = alerts.find(a => a.zone === zone.name && a.type === 'drop' && (now - a.timestamp) < 60000);
        if (!existingDropAlert) {
          newAlertsCandidates.push({
            id: `${zone.name}-drop-${now}`,
            zone: zone.name,
            message: `Engagement is dropping rapidly in ${zone.name}`,
            type: 'drop',
            timestamp: now,
            isFresh: true
          });
        }
      }

      // 2. Continuous Low Engagement Check (last 15 samples < 30%)
      const isContinuouslyLow = recentSamples.every(s => s[zone.key] < 30 && s[zone.key] !== undefined);
      if (isContinuouslyLow) {
        const existingLowAlert = alerts.find(a => a.zone === zone.name && a.type === 'low' && (now - a.timestamp) < 300000); // Alert every 5m for continuous low
        if (!existingLowAlert) {
          newAlertsCandidates.push({
            id: `${zone.name}-low-${now}`,
            zone: zone.name,
            message: `Sustained low engagement in ${zone.name}`,
            type: 'low',
            timestamp: now,
            isFresh: true
          });
        }
      }
    });

    // Handle removals (recovery)
    if (alertsToRemove.length > 0) {
      setAlerts(prev => prev.filter(a => !alertsToRemove.includes(a.id)));
    }

    if (newAlertsCandidates.length > 0) {
      setAlerts(prev => [...newAlertsCandidates, ...prev].slice(0, 5));
    }
  }, [historyData]);

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };



  // Helper to get keys for zone
  const getZoneKeys = (zoneName: string) => {
    if (zoneName === "Front Row") return { engaged: "front_engaged", total: "front_total", label: "Front Row Behavior" };
    if (zoneName === "Middle Row") return { engaged: "mid_engaged", total: "mid_total", label: "Middle Row Behavior" };
    if (zoneName === "Back Row") return { engaged: "back_engaged", total: "back_total", label: "Back Row Behavior" };
    return undefined;
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden">
      <EngagementDetailsModal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        dataKeys={modalDataKeys}
      />

      <header className="h-16 bg-gray-800/50 backdrop-blur border-b border-gray-700 flex items-center justify-between px-8 sticky top-0 z-10 shrink-0">
        <h2 className="text-lg font-semibold text-gray-200">
          Student Behavior
        </h2>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-sm text-emerald-400 font-medium whitespace-nowrap hidden sm:block">System Online</span>
          </div>

          <div className="h-8 w-px bg-gray-700/50 mx-2 hidden sm:block"></div>

          {/* Header Alert Indicator */}
          {alerts.length > 0 && (
            <div className="relative flex items-center gap-4">
              <button
                onClick={() => setIsAlertsCollapsed(!isAlertsCollapsed)}
                className={`relative p-2 rounded-xl transition-all ${alerts.some(a => a.type === 'low')
                  ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                  : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                  }`}
              >
                <Bell size={20} className={isAlertsCollapsed ? 'animate-pulse' : ''} />
                <span className="absolute -top-1 -right-1 bg-red-600 text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-gray-900 shadow-lg text-white">
                  {alerts.length}
                </span>
              </button>

              {!isAlertsCollapsed && (
                <div className="absolute top-12 right-0 w-80 z-50 pointer-events-none">
                  <div className="pointer-events-auto flex flex-col gap-2 p-4 bg-gray-900/95 backdrop-blur-2xl border border-gray-700 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Notifications</span>
                      <button onClick={clearAllAlerts} className="text-[10px] font-bold text-gray-500 hover:text-red-400">Clear All</button>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                      {alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border ${alert.type === 'drop'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                            : 'bg-red-500/10 border-red-500/30 text-red-200'
                            }`}
                        >
                          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="text-[11px] font-bold leading-tight">{alert.message}</p>
                            <span className="text-[9px] opacity-40 mt-1 block font-mono">
                              {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                          <button onClick={() => removeAlert(alert.id)} className="p-1 hover:bg-white/10 rounded-lg">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <UserProfileMenu />
        </div>



      </header>





      <main className="p-8 flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Top Section: Overview & Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Main Stats Column */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Activity size={80} />
                </div>
                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">Overall Engagement</h3>
                <div className="text-5xl font-black text-white mb-2 leading-none">
                  {stats.total > 0 ? Math.round((stats.engaged / stats.total) * 100) : 0}<span className="text-2xl text-blue-500">%</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <TrendingUp size={16} />
                  <span>{stats.engaged} / {stats.total} On-Task</span>
                </div>
                <div className="mt-6 pt-6 border-t border-gray-700/50">
                  <button
                    onClick={() => handleCardClick(undefined)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                  >
                    View Class Details
                  </button>
                </div>
              </div>

              <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 backdrop-blur-sm">
                <h4 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">Live Monitoring</h4>
                <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-xl border border-gray-700/50">
                  <span className="text-sm font-medium text-gray-300">Active Students</span>
                  <span className="text-xl font-mono font-bold text-white">{stats.active}</span>
                </div>

              </div>
            </div>

            {/* Engagement Trends Column */}
            <div className="lg:col-span-2 bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-gray-200 text-sm font-bold uppercase tracking-widest">Engagement Trends</h3>
                  <p className="text-xs text-gray-400 mt-1">Real-time percentage over last 20 samples</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-bold uppercase border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live Feed
                </div>
              </div>

              <div className="flex-1 min-h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyData}>
                    <defs>
                      <linearGradient id="colorEngLine" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} strokeOpacity={0.5} />
                    <XAxis
                      dataKey="time"
                      stroke="#9ca3af"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      hide={historyData.length < 5}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl shadow-2xl backdrop-blur-md">
                              <p className="text-xs font-bold text-gray-400 mb-2">{label}</p>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-8">
                                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Engagement</span>
                                  <span className="text-sm font-mono font-black text-white">{payload[0].value}%</span>
                                </div>
                                <div className="flex items-center justify-between gap-8 pt-1 border-t border-gray-800">
                                  <span className="text-[10px] font-bold text-gray-500 uppercase">Class Size</span>
                                  <span className="text-[10px] font-mono text-gray-400">{payload[0].payload.total} Students</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="eng"
                      stroke="#3b82f6"
                      strokeWidth={4}
                      fill="url(#colorEngLine)"
                      name="Engagement"
                      animationDuration={500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Simplified Legend */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-700/50">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Engagement Level (%)</span>
                </div>
              </div>



            </div>
          </div>

          {/* Middle Section: Zone Distribution (Horizontal) */}
          {visualizeGroups && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
              {Object.entries(groupStats).map(([zoneName, zoneData]) => {
                const hasAlert = alerts.some(a => a.zone === zoneName);
                const isLow = alerts.some(a => a.zone === zoneName && a.type === 'low');

                return (
                  <div
                    key={zoneName}
                    className={`relative bg-gray-800/80 p-5 rounded-2xl border transition-all group cursor-pointer hover:bg-gray-800 ${hasAlert
                      ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-pulse'
                      : 'border-gray-700 hover:border-blue-500/50 shadow-lg'
                      }`}
                    onClick={() => handleCardClick(getZoneKeys(zoneName))}
                  >
                    {hasAlert && (
                      <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[8px] font-black px-2 py-1 rounded-full border border-red-400 shadow-lg uppercase tracking-tighter z-10">
                        {isLow ? 'LOW ENGAGEMENT' : 'DROPPING FAST'}
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-3 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                      {zoneName}
                      <BarChart3 size={14} className={`${hasAlert ? 'text-red-400 opacity-100' : 'opacity-50 group-hover:text-blue-400'} transition-colors`} />
                    </div>
                    <div className="flex items-end justify-between">
                      <div className={`text-2xl font-black leading-none ${hasAlert ? 'text-red-400' : 'text-white'}`}>
                        {zoneData.total > 0 ? Math.round((zoneData.engaged / zoneData.total) * 100) : 0}%
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {zoneData.engaged}/{zoneData.total} Students
                      </div>
                    </div>
                    <div className="w-full h-2 bg-gray-900 rounded-full mt-4 overflow-hidden border border-gray-700/50">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${hasAlert ? 'bg-red-500' :
                          (zoneData.total > 0 && (zoneData.engaged / zoneData.total) > 0.7) ? 'bg-emerald-500' :
                            (zoneData.total > 0 && (zoneData.engaged / zoneData.total) > 0.4) ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                        style={{ width: `${zoneData.total > 0 ? (zoneData.engaged / zoneData.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}


          {/* Bottom Section: Video Feed & Controls */}
          <div className="bg-gray-800 rounded-3xl overflow-hidden border border-gray-700 shadow-2xl relative">
            <div className="p-6 bg-gray-900/50 flex justify-between items-center sm:flex-row flex-col gap-4">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  Live Analysis Feed
                </h3>
                <p className="text-xs text-gray-500 font-medium">View YOLO detection boxes and pose skeleton overlays</p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Visual Style Selector */}
                <div className="flex bg-gray-950/50 rounded-xl p-1 gap-1 border border-gray-700/50">
                  {['dots', 'boxes', 'detailed'].map((style) => (
                    <button
                      key={style}
                      onClick={() => changeVisualStyle(style)}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all ${visualStyle === style
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-gray-500 hover:text-gray-300'
                        }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>

                <div className="h-6 w-px bg-gray-700 mx-1"></div>

                {/* Boundary Selection Toggle */}
                <button
                  onClick={() => setIsSelectingROI(!isSelectingROI)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-tight transition-all border ${isSelectingROI
                    ? 'bg-amber-600/20 text-amber-400 border-amber-500/50'
                    : 'bg-gray-700/50 hover:bg-gray-700 text-gray-400 border-transparent hover:border-gray-600'
                    }`}
                >
                  <Activity size={14} className={isSelectingROI ? 'animate-pulse' : ''} />
                  {isSelectingROI ? 'Defining Boundary...' : 'Set Class ROI'}
                </button>

                {/* Visualization Toggle */}
                <button
                  onClick={toggleVisualization}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-tight transition-all border ${visualizeGroups
                    ? 'bg-blue-600/20 text-blue-400 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                    : 'bg-gray-700/50 hover:bg-gray-700 text-gray-400 border-transparent hover:border-gray-600'
                    }`}
                >
                  <BarChart3 size={14} />
                  {visualizeGroups ? 'Zones Active' : 'Show Zones'}
                </button>
              </div>
            </div>

            {/* THE STREAM IMAGE */}
            <div
              className={`relative aspect-video bg-black flex items-center justify-center ${isSelectingROI ? 'cursor-crosshair' : ''}`}
              onMouseDown={handleROIMouseDown}
              onMouseMove={handleROIMouseMove}
              onMouseUp={handleROIMouseUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="http://localhost:8000/video_feed"
                alt="Live Classroom Feed"
                className="w-full h-full object-contain pointer-events-none select-none"
              />

              {/* Drawing Overlay */}
              {isSelectingROI && roiStart && roiCurrent && (
                <div
                  className="absolute border-2 border-dashed border-amber-400 bg-amber-400/10 pointer-events-none"
                  style={{
                    left: `${Math.min(roiStart.x, roiCurrent.x) * 100}%`,
                    top: `${Math.min(roiStart.y, roiCurrent.y) * 100}%`,
                    width: `${Math.abs(roiCurrent.x - roiStart.x) * 100}%`,
                    height: `${Math.abs(roiCurrent.y - roiStart.y) * 100}%`,
                  }}
                />
              )}

              {/* Zone Dividers */}
              {visualizeGroups && (
                <>
                  {/* Back/Mid Divider */}
                  <div
                    className="absolute w-full h-1 group/back cursor-row-resize z-20"
                    style={{ top: `${zoneSettings.back}%` }}
                    onMouseDown={(e) => { e.stopPropagation(); setDraggingZone('back'); }}
                  >
                    <div className="absolute inset-0 bg-red-500/40 group-hover/back:bg-red-400 shadow-[0_0_10px_rgba(239,68,68,0.3)] transition-colors"></div>
                    <div className="absolute right-4 -top-3 bg-red-600 text-[8px] font-black px-2 py-0.5 rounded-full text-white uppercase tracking-tighter shadow-lg">
                      Back Divider ({zoneSettings.back}%)
                    </div>
                  </div>

                  {/* Mid/Front Divider */}
                  <div
                    className="absolute w-full h-1 group/front cursor-row-resize z-20"
                    style={{ top: `${zoneSettings.front}%` }}
                    onMouseDown={(e) => { e.stopPropagation(); setDraggingZone('front'); }}
                  >
                    <div className="absolute inset-0 bg-blue-500/40 group-hover/front:bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)] transition-colors"></div>
                    <div className="absolute right-4 -top-3 bg-blue-600 text-[8px] font-black px-2 py-0.5 rounded-full text-white uppercase tracking-tighter shadow-lg">
                      Front Divider ({zoneSettings.front}%)
                    </div>
                  </div>
                </>
              )}

              <div className="absolute bottom-6 left-6 flex items-center gap-3">

                <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">Live</span>
                  </div>
                  <div className="h-4 w-px bg-white/10"></div>
                  <span className="text-[10px] font-mono text-white/60">SOURCE: CAM-01 • 1080p</span>
                </div>
              </div>

              {isSelectingROI && !roiStart && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px] pointer-events-none transition-all duration-500">
                  <div className="bg-amber-600/90 text-white px-8 py-4 rounded-3xl shadow-2xl font-bold text-lg border border-white/20 animate-in zoom-in duration-300">
                    DRAG RECTANGLE OVER STUDENTS
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
