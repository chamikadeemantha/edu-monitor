"use client";
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Trophy,
  Clock,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  MessageCircle,
  Send,
  Loader2,
  RefreshCw,
  Bot,
  User,
  GraduationCap,
  BarChart3,
  FileText,
  UserCheck
} from 'lucide-react';

// API Configuration
const API_BASE_URL = "http://localhost:8000";

// Simple markdown renderer for bold text
const renderMarkdown = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function StudentDashboard() {
  const quizzes = [
    { id: 1, title: "Week 4: Machine Learning Basics", status: "Completed", score: "85%", date: "Dec 28, 2025" },
    { id: 2, title: "Week 5: Neural Networks Intro", status: "Pending", score: "-", date: "Dec 30, 2025" },
    { id: 3, title: "Week 6: Computer Vision", status: "Locked", score: "-", date: "Jan 05, 2026" },
  ];

  // AI Assistant State
  const [summary, setSummary] = useState('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAskLoading, setIsAskLoading] = useState(false);
  const [contentCount, setContentCount] = useState<number | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
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
      console.error('Failed to fetch stats:', error);
    }
  };

  const generateSummary = async () => {
    setIsSummaryLoading(true);
    setSummary('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/performance/summary`);

      if (!response.ok) {
        const error = await response.json();
        setSummary(`Error: ${error.detail || 'Failed to generate summary'}`);
        setIsSummaryLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setSummary('Error: Unable to read response');
        setIsSummaryLoading(false);
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                setSummary(prev => prev + parsed.text);
              }
            } catch { }
          }
        }
      }
    } catch {
      setSummary('Error: Failed to connect to server. Is the backend running?');
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const askQuestion = async () => {
    if (!inputMessage.trim() || isAskLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsAskLoading(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/performance/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage }),
      });

      if (!response.ok) {
        const error = await response.json();
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { role: 'assistant', content: `Error: ${error.detail || 'Failed to get answer'}` };
          return newMessages;
        });
        setIsAskLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { role: 'assistant', content: 'Error: Unable to read response' };
          return newMessages;
        });
        setIsAskLoading(false);
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: newMessages[newMessages.length - 1].content + parsed.text
                  };
                  return newMessages;
                });
              }
            } catch { }
          }
        }
      }
    } catch {
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { role: 'assistant', content: 'Error: Failed to connect to server' };
        return newMessages;
      });
    } finally {
      setIsAskLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askQuestion();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <nav className="bg-gray-800 border-b border-gray-700 px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-2.5 rounded-xl">
            <GraduationCap size={22} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Student Portal</h1>
            <p className="text-xs text-gray-400">AI-Powered Learning</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/student/dashboard/attendance"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
          >
            <UserCheck size={16} />
            Attendance
          </Link>
          <div className="flex items-center gap-2 bg-gray-700/50 px-3 py-1.5 rounded-lg">
            <FileText size={14} className="text-emerald-400" />
            <span className="text-sm">{contentCount ?? 0} content chunks</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Welcome, <strong className="text-white">Alex</strong></span>
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center font-bold">A</div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-8">
        {/* AI Learning Assistant - PRIORITY SECTION */}
        <section className="mb-8">
          <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 rounded-2xl p-[2px]">
            <div className="bg-gray-900 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-cyan-500/20 px-6 py-5 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl">
                      <Sparkles size={24} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">AI Learning Assistant</h2>
                      <p className="text-sm text-gray-400">Get summaries and ask questions about your lectures</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-full text-sm">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    AI Ready
                  </span>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Summary Section */}
                  <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <BookOpen size={18} className="text-purple-400" />
                        Lecture Summary
                      </h3>
                      <button
                        onClick={generateSummary}
                        disabled={isSummaryLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        {isSummaryLoading ? (
                          <><Loader2 size={16} className="animate-spin" />Generating...</>
                        ) : (
                          <><RefreshCw size={16} />Get Summary</>
                        )}
                      </button>
                    </div>
                    <div className="p-4 h-[400px] overflow-y-auto">
                      {summary ? (
                        <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">{renderMarkdown(summary)}</div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                          <BookOpen size={48} className="mb-4 opacity-30" />
                          <p className="text-center">Click &quot;Get Summary&quot; to generate an AI-powered summary of your lecture content</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chat Section */}
                  <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-700 bg-gray-800/50">
                      <h3 className="font-semibold flex items-center gap-2">
                        <MessageCircle size={18} className="text-blue-400" />
                        Ask Questions
                      </h3>
                    </div>

                    {/* Messages */}
                    <div ref={chatContainerRef} className="p-4 h-[320px] overflow-y-auto space-y-4">
                      {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                          <MessageCircle size={40} className="mb-3 opacity-30" />
                          <p className="text-center text-sm">Ask any question about the lecture content</p>
                        </div>
                      ) : (
                        messages.map((msg, idx) => (
                          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                                <Bot size={16} className="text-white" />
                              </div>
                            )}
                            <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                                {msg.content ? renderMarkdown(msg.content) : <Loader2 size={16} className="animate-spin" />}
                              </div>
                            </div>
                            {msg.role === 'user' && (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                                <User size={16} className="text-white" />
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-gray-700 bg-gray-800/50">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyDown={handleKeyPress}
                          placeholder="Ask a question about the lecture..."
                          className="flex-1 px-4 py-3 rounded-xl bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          disabled={isAskLoading}
                        />
                        <button
                          onClick={askQuestion}
                          disabled={!inputMessage.trim() || isAskLoading}
                          className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAskLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats and Quizzes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 text-blue-400 rounded-lg">
                  <Trophy size={22} />
                </div>
                <div>
                  <div className="text-2xl font-bold">1,240</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Total Points</div>
                </div>
              </div>
              <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 flex items-center gap-4">
                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-lg">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <div className="text-2xl font-bold">92%</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Avg. Score</div>
                </div>
              </div>
              <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 flex items-center gap-4">
                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-lg">
                  <Clock size={22} />
                </div>
                <div>
                  <div className="text-2xl font-bold">12h</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Study Time</div>
                </div>
              </div>
            </div>

            {/* Performance Chart */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold flex items-center gap-2">
                  <BarChart3 size={18} className="text-gray-400" />
                  Weekly Performance
                </h2>
                <select className="bg-gray-700 border border-gray-600 text-sm rounded-lg px-3 py-1.5 outline-none text-gray-300">
                  <option>Last 7 Days</option>
                  <option>Last 30 Days</option>
                </select>
              </div>
              <div className="h-48 flex items-end justify-between gap-3 px-2">
                {[40, 65, 55, 80, 72, 90, 85].map((h, i) => (
                  <div key={i} className="w-full bg-gray-700 rounded-t-lg relative group cursor-pointer hover:bg-gray-600 transition-colors">
                    <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-blue-600 to-purple-500 rounded-t-lg transition-all duration-500" style={{ height: `${h}%` }}></div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between text-xs text-gray-500 px-2 font-mono">
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
              </div>
            </div>
          </div>

          {/* Quizzes Sidebar */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700 bg-gray-800/50">
              <h2 className="font-semibold">Assigned Quizzes</h2>
            </div>
            <div className="divide-y divide-gray-700">
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="p-4 hover:bg-gray-700/50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${quiz.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' :
                      quiz.status === 'Pending' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-gray-600 text-gray-400'
                      }`}>
                      {quiz.status}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">{quiz.date}</span>
                  </div>
                  <h3 className="font-medium text-gray-200 text-sm mb-2">{quiz.title}</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      Score: <span className="text-white">{quiz.score}</span>
                    </span>
                    <button className="text-blue-400 hover:text-blue-300 p-1.5 hover:bg-gray-600 rounded-lg transition-colors">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 bg-gray-800/50 border-t border-gray-700 text-center">
              <button className="text-sm text-blue-400 font-medium hover:underline">View All</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
