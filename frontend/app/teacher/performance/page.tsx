"use client";
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Upload,
    Mic,
    MicOff,
    FileText,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Trash2,
    Send,
    GraduationCap
} from 'lucide-react';

// API Configuration
const API_BASE_URL = "http://localhost:8000";

interface UploadStatus {
    status: 'idle' | 'uploading' | 'success' | 'error';
    message: string;
    chunks?: number;
}

interface TranscriptStatus {
    status: 'idle' | 'processing' | 'success' | 'error';
    message: string;
}

export default function StudentPerformanceSection() {
    // File upload state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ status: 'idle', message: '' });
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Transcription state
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [transcriptStatus, setTranscriptStatus] = useState<TranscriptStatus>({ status: 'idle', message: '' });
    const recognitionRef = useRef<any>(null);

    // Stats
    const [contentStats, setContentStats] = useState<{ document_count: number } | null>(null);

    // Initialize speech recognition
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';

                recognition.onresult = (event: any) => {
                    let interim = '';
                    let final = '';
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const result = event.results[i];
                        if (result.isFinal) {
                            final += result[0].transcript + ' ';
                        } else {
                            interim += result[0].transcript;
                        }
                    }
                    if (final) {
                        setTranscript(prev => prev + final);
                    }
                    setInterimTranscript(interim);
                };

                recognition.onerror = (event: any) => {
                    console.error('Speech recognition error:', event.error);
                    setIsRecording(false);
                };

                recognition.onend = () => {
                    if (isRecording) {
                        recognition.start();
                    }
                };

                recognitionRef.current = recognition;
            }
        }
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/performance/stats`);
            if (response.ok) {
                const data = await response.json();
                setContentStats(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    // File upload handlers
    const handleFileSelect = (file: File) => {
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf') || file.name.endsWith('.txt')) {
            setSelectedFile(file);
            setUploadStatus({ status: 'idle', message: '' });
        } else {
            setUploadStatus({ status: 'error', message: 'Please select a PDF or TXT file' });
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const uploadFile = async () => {
        if (!selectedFile) return;
        setUploadStatus({ status: 'uploading', message: 'Processing document...' });

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            const response = await fetch(`${API_BASE_URL}/api/performance/upload`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setUploadStatus({ status: 'success', message: data.message, chunks: data.data?.chunks_stored });
                setSelectedFile(null);
                fetchStats();
            } else {
                setUploadStatus({ status: 'error', message: data.detail || data.message || 'Upload failed' });
            }
        } catch (error) {
            setUploadStatus({ status: 'error', message: 'Failed to connect to server. Is the backend running?' });
        }
    };

    // Transcription handlers
    const toggleRecording = () => {
        if (!recognitionRef.current) {
            alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
            return;
        }

        if (isRecording) {
            recognitionRef.current.stop();
            setIsRecording(false);
        } else {
            setTranscript('');
            setInterimTranscript('');
            recognitionRef.current.start();
            setIsRecording(true);
        }
    };

    const clearTranscript = () => {
        setTranscript('');
        setInterimTranscript('');
        setTranscriptStatus({ status: 'idle', message: '' });
    };

    const submitTranscript = async () => {
        if (!transcript.trim()) return;
        setTranscriptStatus({ status: 'processing', message: 'Processing transcript...' });

        try {
            const response = await fetch(`${API_BASE_URL}/api/performance/transcript`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: transcript, use_llm_filter: true }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setTranscriptStatus({ status: 'success', message: `Stored ${data.data?.chunks_stored || 1} content chunks` });
                setTranscript('');
                fetchStats();
            } else {
                setTranscriptStatus({ status: 'error', message: data.detail || data.message || 'Processing failed' });
            }
        } catch (error) {
            setTranscriptStatus({ status: 'error', message: 'Failed to connect to server' });
        }
    };

    const clearContent = async () => {
        if (!confirm('Are you sure you want to clear all stored content?')) return;
        try {
            await fetch(`${API_BASE_URL}/api/performance/clear`, { method: 'DELETE' });
            fetchStats();
        } catch (error) {
            console.error('Failed to clear:', error);
        }
    };

    return (
        <div className="space-y-6">
            {/* Info Banner */}
            <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-4 flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-lg">
                    <GraduationCap size={24} className="text-blue-400" />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-white">Lecture Content Manager</h3>
                    <p className="text-sm text-gray-400">Upload slides and record lectures for AI-powered student summaries and Q&A</p>
                </div>
                {contentStats && (
                    <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
                        <FileText size={14} className="text-blue-400" />
                        <span className="text-sm text-white">{contentStats.document_count} chunks</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* File Upload Section */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Upload size={18} className="text-blue-400" />
                            Upload Lecture Slides
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">PDF or TXT files accepted</p>
                    </div>
                    <div className="p-6">
                        <div
                            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-blue-500/50 hover:bg-gray-700/30'}`}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input ref={fileInputRef} type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
                            <Upload size={32} className="mx-auto text-gray-500 mb-3" />
                            <p className="text-white font-medium">{selectedFile ? selectedFile.name : 'Drop your file here'}</p>
                            <p className="text-sm text-gray-500 mt-1">{selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'or click to browse'}</p>
                        </div>

                        <div className="mt-4 space-y-3">
                            <button
                                onClick={uploadFile}
                                disabled={!selectedFile || uploadStatus.status === 'uploading'}
                                className={`w-full py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${selectedFile && uploadStatus.status !== 'uploading' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                            >
                                {uploadStatus.status === 'uploading' ? <><Loader2 size={16} className="animate-spin" />Processing...</> : <><Upload size={16} />Upload & Process</>}
                            </button>

                            {uploadStatus.message && (
                                <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${uploadStatus.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : uploadStatus.status === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                    {uploadStatus.status === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                    {uploadStatus.message}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Live Transcription Section */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-700 bg-gray-900/50">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Mic size={18} className="text-purple-400" />
                            Live Transcription
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">Record lecture speech in real-time</p>
                    </div>
                    <div className="p-6">
                        <div className="flex justify-center mb-4">
                            <button
                                onClick={toggleRecording}
                                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/30' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                {isRecording ? <MicOff size={28} className="text-white" /> : <Mic size={28} className="text-white" />}
                            </button>
                        </div>
                        <p className="text-center text-sm text-gray-400 mb-4">{isRecording ? 'Recording... Click to stop' : 'Click to start recording'}</p>

                        <div className="bg-gray-900 rounded-lg p-4 min-h-[150px] max-h-[200px] overflow-y-auto border border-gray-700">
                            {transcript || interimTranscript ? (
                                <p className="text-gray-200 leading-relaxed text-sm">
                                    {transcript}
                                    <span className="text-blue-400 opacity-70">{interimTranscript}</span>
                                </p>
                            ) : (
                                <p className="text-gray-600 text-center text-sm">Transcript will appear here...</p>
                            )}
                        </div>

                        <div className="mt-4 space-y-3">
                            <div className="flex gap-2">
                                <button
                                    onClick={submitTranscript}
                                    disabled={!transcript.trim() || transcriptStatus.status === 'processing'}
                                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${transcript.trim() && transcriptStatus.status !== 'processing' ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                                >
                                    {transcriptStatus.status === 'processing' ? <><Loader2 size={16} className="animate-spin" />Processing...</> : <><Send size={16} />Submit</>}
                                </button>
                                <button
                                    onClick={clearTranscript}
                                    disabled={!transcript.trim() && !interimTranscript}
                                    className={`py-2.5 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${transcript.trim() || interimTranscript ? 'bg-gray-600 text-white hover:bg-gray-500' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                                >
                                    <Trash2 size={16} />
                                    Clear
                                </button>
                            </div>

                            {transcriptStatus.message && (
                                <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${transcriptStatus.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : transcriptStatus.status === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                    {transcriptStatus.status === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                    {transcriptStatus.message}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* How it works */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                <h3 className="font-semibold text-white mb-4">How it works</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold shrink-0">1</div>
                        <div>
                            <h4 className="font-medium text-white text-sm">Upload Slides</h4>
                            <p className="text-xs text-gray-500">Text is extracted and stored for AI retrieval</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold shrink-0">2</div>
                        <div>
                            <h4 className="font-medium text-white text-sm">Record Lecture</h4>
                            <p className="text-xs text-gray-500">Speech is transcribed and filtered for key content</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold shrink-0">3</div>
                        <div>
                            <h4 className="font-medium text-white text-sm">Student Access</h4>
                            <p className="text-xs text-gray-500">Students get AI summaries and can ask questions</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Clear Content Section */}
            {contentStats && contentStats.document_count > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-red-500/20 rounded-lg">
                                <Trash2 size={24} className="text-red-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Lecture Finished?</h3>
                                <p className="text-sm text-gray-400">Clear all {contentStats.document_count} stored chunks to prepare for the next lecture</p>
                            </div>
                        </div>
                        <button
                            onClick={clearContent}
                            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Trash2 size={18} />
                            Clear All Content
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
