"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  Trophy,
  Clock,
  ChevronRight,
  LineChart,
  CheckCircle2,
  Sparkles,
  MessageCircle,
  Send,
  Loader2,
  RefreshCw,
  Bot,
  User,
  UserCheck,
} from "lucide-react";

// API Configuration
const API_BASE_URL = "http://localhost:8000";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function StudentDashboard() {
  const quizzes = [
    { id: 1, title: "Week 4: Machine Learning Basics", status: "Completed", score: "85%", date: "Dec 28, 2025" },
    { id: 2, title: "Week 5: Neural Networks Intro", status: "Pending", score: "-", date: "Dec 30, 2025" },
    { id: 3, title: "Week 6: Computer Vision", status: "Locked", score: "-", date: "Jan 05, 2026" },
  ];

  // AI Assistant State
  const [summary, setSummary] = useState("");
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isAskLoading, setIsAskLoading] = useState(false);
  const [contentCount, setContentCount] = useState<number | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    // Auto-scroll chat to bottom
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/performance/stats`);
      if (response.ok) {
        const data = await response.json();
        setContentCount(data.data?.document_count ?? 0);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const generateSummary = async () => {
    setIsSummaryLoading(true);
    setSummary("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/performance/summary`);

      if (!response.ok) {
        const error = await response.json();
        setSummary(`Error: ${error.detail || "Failed to generate summary"}`);
        setIsSummaryLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setSummary("Error: Unable to read response");
        setIsSummaryLoading(false);
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.text) setSummary((prev) => prev + parsed.text);
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch {
      setSummary("Error: Failed to connect to server. Is the backend running?");
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const askQuestion = async () => {
    if (!inputMessage.trim() || isAskLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsAskLoading(true);

    // Add placeholder for assistant response
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/performance/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userMessage }),
      });

      if (!response.ok) {
        const error = await response.json();
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            role: "assistant",
            content: `Error: ${error.detail || "Failed to get answer"}`,
          };
          return newMessages;
        });
        setIsAskLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            role: "assistant",
            content: "Error: Unable to read response",
          };
          return newMessages;
        });
        setIsAskLoading(false);
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: "assistant",
                    content: newMessages[newMessages.length - 1].content + parsed.text,
                  };
                  return newMessages;
                });
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          role: "assistant",
          content: "Error: Failed to connect to server",
        };
        return newMessages;
      });
    } finally {
      setIsAskLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askQuestion();
    }
  };

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
          <Link
            href="/student/dashboard/attendance"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            <UserCheck size={18} />
            Attendance
          </Link>

          <span className="text-sm text-gray-600">
            Welcome, <strong>Alex</strong>
          </span>
          <div className="w-8 h-8 rounded-full bg-gray-200 border border-gray-300" />
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-8">
        {/* Welcome Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Learning Dashboard</h1>
          <p className="text-gray-500">Track your progress and access AI-powered learning tools.</p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="xl:col-span-2 space-y-8">
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

            {/* AI Learning Assistant */}
            <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-[2px]">
              <div className="bg-white rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 px-6 py-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles size={20} />
                    AI Learning Assistant
                  </h2>
                  <p className="text-sm text-white/80">
                    {contentCount !== null ? `${contentCount} lecture content chunks available` : "Loading..."}
                  </p>
                </div>

                <div className="p-6">
                  {/* Summary */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-700">Lecture Summary</h3>
                      <button
                        onClick={generateSummary}
                        disabled={isSummaryLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        {isSummaryLoading ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <RefreshCw size={16} />
                            Get Summary
                          </>
                        )}
                      </button>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 min-h-[100px] max-h-[200px] overflow-y-auto border border-gray-200">
                      {summary ? (
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
                      ) : (
                        <p className="text-gray-400 text-center">
                          Click &quot;Get Summary&quot; to generate an AI summary of your lecture content
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Chat */}
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <MessageCircle size={18} />
                      Ask Questions
                    </h3>

                    <div
                      ref={chatContainerRef}
                      className="bg-gray-50 rounded-xl border border-gray-200 p-4 h-[250px] overflow-y-auto mb-3 space-y-4"
                    >
                      {messages.length === 0 ? (
                        <p className="text-gray-400 text-center">Ask any question about the lecture content</p>
                      ) : (
                        messages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            {msg.role === "assistant" && (
                              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                <Bot size={16} className="text-purple-600" />
                              </div>
                            )}

                            <div
                              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                msg.role === "user"
                                  ? "bg-indigo-600 text-white"
                                  : "bg-white border border-gray-200 text-gray-700"
                              }`}
                            >
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {msg.content || <Loader2 size={16} className="animate-spin" />}
                              </p>
                            </div>

                            {msg.role === "user" && (
                              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                <User size={16} className="text-indigo-600" />
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Ask a question about the lecture..."
                        className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        disabled={isAskLoading}
                      />
                      <button
                        onClick={askQuestion}
                        disabled={!inputMessage.trim() || isAskLoading}
                        className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isAskLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Chart */}
            <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <LineChart size={20} className="text-gray-400" />
                  Performance Summary
                </h2>
                <select className="bg-gray-50 border border-gray-200 text-sm rounded-lg px-3 py-1 outline-none">
                  <option>Last 30 Days</option>
                  <option>This Semester</option>
                </select>
              </div>

              <div className="h-64 flex items-end justify-between gap-2 px-4">
                {[40, 65, 55, 80, 72, 90, 85].map((h, i) => (
                  <div
                    key={i}
                    className="w-full bg-indigo-50 rounded-t-lg relative group box-border hover:bg-indigo-100 transition-colors cursor-pointer"
                  >
                    <div
                      className="absolute bottom-0 left-0 w-full bg-indigo-500 rounded-t-lg transition-all duration-500"
                      style={{ height: `${h}%` }}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-between text-xs text-gray-400 px-2 font-mono">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
            </div>
          </div>

          {/* Right Column: Quizzes */}
          <div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <h2 className="font-bold text-gray-800">Assigned Quizzes</h2>
              </div>

              <div className="divide-y divide-gray-100">
                {quizzes.map((quiz) => (
                  <div key={quiz.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          quiz.status === "Completed"
                            ? "bg-green-100 text-green-700"
                            : quiz.status === "Pending"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
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
