'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    RefreshCw,
    Loader2,
    CheckCircle2,
    XCircle,
    ArrowRight,
    Zap,
    Package,
    TrendingUp,
    Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DeduplicationProgress {
    jobId: number;
    phase: 'init' | 'embedding' | 'clustering' | 'matching' | 'saving' | 'done' | 'error';
    totalProducts: number;
    processedProducts: number;
    currentSource: string;
    sourcesProcessed: number;
    totalSources: number;
    matchesFound: number;
    canonicalCreated: number;
    mappingsCreated: number;
    timeElapsed: number;
    estimatedTimeRemaining: number;
    currentBatch: number;
    totalBatches: number;
    recentMatches: Array<{
        product1: { name: string; source: string };
        product2: { name: string; source: string };
        score: number;
    }>;
    sourceBreakdown: Record<string, { processed: number; matched: number }>;
}

interface MatrixData {
    matrix: Record<string, Record<string, number>>;
    sources: string[];
    recentPairs: Array<{
        id: number;
        product1: { name: string; source: string; price?: number };
        product2: { name: string; source: string; price?: number };
        score: number;
        canonicalId: number;
    }>;
    stats: { totalPairs: number; totalCanonical: number };
}

type DeduplicationMode = 'incremental' | 'fresh';

export default function MergeProgress() {
    const [mode, setMode] = useState<DeduplicationMode>('incremental');
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState<DeduplicationProgress | null>(null);
    const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const eventSourceRef = useRef<EventSource | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Fetch initial status and matrix
    useEffect(() => {
        fetchStatus();
        fetchMatrix();
    }, []);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/admin/deduplicate');
            const data = await res.json();
            setIsRunning(data.isRunning);
            if (data.currentProgress) {
                setProgress(data.currentProgress);
                if (data.isRunning) {
                    startSSE();
                }
            }
        } catch {
            // Error fetching status
        }
    };

    const fetchMatrix = async () => {
        try {
            const res = await fetch('/api/admin/deduplicate/matrix');
            const data = await res.json();
            setMatrixData(data);
        } catch {
            // Error fetching matrix
        }
    };

    const startSSE = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        const es = new EventSource('/api/admin/deduplicate?stream=true');
        eventSourceRef.current = es;

        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data) as DeduplicationProgress;
                setProgress(data);

                // Add log entry
                const phaseNames: Record<string, string> = {
                    init: '🚀 Khởi tạo...',
                    embedding: '🧠 Tạo embeddings...',
                    clustering: '📦 Phân nhóm sản phẩm...',
                    matching: '🔍 So khớp giữa các sàn...',
                    saving: '💾 Lưu kết quả...',
                    done: '✅ Hoàn thành!',
                    error: '❌ Lỗi!',
                };

                setLogs(prev => {
                    const newLog = `[${new Date().toLocaleTimeString()}] ${phaseNames[data.phase] || data.phase} - Batch ${data.currentBatch}/${data.totalBatches}`;
                    if (prev[prev.length - 1] !== newLog) {
                        return [...prev.slice(-50), newLog];
                    }
                    return prev;
                });

                if (data.phase === 'done' || data.phase === 'error') {
                    setIsRunning(false);
                    es.close();
                    fetchMatrix();
                    if (data.phase === 'done') {
                        toast.success(`Gộp thành công! ${data.canonicalCreated} sản phẩm canonical`);
                    }
                }
            } catch {
                // Parse error
            }
        };

        es.onerror = () => {
            es.close();
            setIsRunning(false);
        };
    }, []);

    const handleStart = async () => {
        if (isRunning) return;

        try {
            setLogs([]);
            setProgress(null);

            const res = await fetch('/api/admin/deduplicate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode }),
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(data.message);
                setIsRunning(true);
                startSSE();
            } else {
                toast.error(data.error);
            }
        } catch {
            toast.error('Lỗi khi bắt đầu gộp sản phẩm');
        }
    };

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        }
        if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        return `${seconds}s`;
    };

    const progressPercent = progress
        ? Math.round((progress.processedProducts / Math.max(progress.totalProducts, 1)) * 100)
        : 0;

    return (
        <div className="space-y-6">
            {/* Control Panel */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-3">
                            <Zap className="text-emerald-500" />
                            Chuẩn Hóa & Gộp Sản Phẩm
                        </h2>
                        <p className="text-slate-400 mt-1">
                            So sánh và gộp sản phẩm giống nhau giữa 5 sàn TMĐT
                        </p>
                    </div>

                    {/* Mode Selector */}
                    <div className="flex items-center gap-3">
                        <div className="flex bg-slate-800 rounded-xl p-1">
                            <button
                                onClick={() => setMode('incremental')}
                                disabled={isRunning}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'incremental'
                                        ? 'bg-emerald-600 text-white'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                Tăng dần
                            </button>
                            <button
                                onClick={() => setMode('fresh')}
                                disabled={isRunning}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'fresh'
                                        ? 'bg-orange-600 text-white'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                Làm mới
                            </button>
                        </div>

                        <button
                            onClick={handleStart}
                            disabled={isRunning}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${isRunning
                                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                }`}
                        >
                            {isRunning ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <RefreshCw size={20} />
                            )}
                            {isRunning ? 'Đang chạy...' : 'Bắt đầu gộp'}
                        </button>
                    </div>
                </div>

                {/* Mode Description */}
                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                    {mode === 'incremental' ? (
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="text-emerald-500 mt-0.5" size={20} />
                            <div>
                                <div className="font-semibold text-emerald-400">Chế độ Tăng dần (Incremental)</div>
                                <div className="text-sm text-slate-400">
                                    Chỉ xử lý sản phẩm mới chưa được gộp. Giữ nguyên dữ liệu đã gộp trước đó.
                                    Nhanh hơn và tiết kiệm tài nguyên.
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-start gap-3">
                            <XCircle className="text-orange-500 mt-0.5" size={20} />
                            <div>
                                <div className="font-semibold text-orange-400">Chế độ Làm mới (Fresh)</div>
                                <div className="text-sm text-slate-400">
                                    Xóa toàn bộ dữ liệu canonical và mappings, gộp lại từ đầu.
                                    Dùng khi cần làm sạch hoàn toàn.
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Progress Section */}
            {(isRunning || progress) && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Package className="text-blue-400" />
                        Tiến trình gộp
                    </h3>

                    {/* Main Progress Bar */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-400">Tổng tiến độ</span>
                            <span className="text-emerald-400 font-bold">{progressPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-emerald-500 to-blue-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>

                    {/* Stats Grid */}
                    {progress && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-slate-800/50 rounded-xl p-4">
                                <div className="text-slate-400 text-sm">Đã xử lý</div>
                                <div className="text-2xl font-bold text-blue-400">
                                    {progress.processedProducts.toLocaleString()}
                                </div>
                                <div className="text-xs text-slate-500">
                                    / {progress.totalProducts.toLocaleString()}
                                </div>
                            </div>
                            <div className="bg-slate-800/50 rounded-xl p-4">
                                <div className="text-slate-400 text-sm">Canonical</div>
                                <div className="text-2xl font-bold text-emerald-400">
                                    {progress.canonicalCreated.toLocaleString()}
                                </div>
                                <div className="text-xs text-slate-500">sản phẩm gộp</div>
                            </div>
                            <div className="bg-slate-800/50 rounded-xl p-4">
                                <div className="text-slate-400 text-sm">Matches</div>
                                <div className="text-2xl font-bold text-purple-400">
                                    {progress.matchesFound.toLocaleString()}
                                </div>
                                <div className="text-xs text-slate-500">cặp khớp</div>
                            </div>
                            <div className="bg-slate-800/50 rounded-xl p-4">
                                <div className="text-slate-400 text-sm flex items-center gap-1">
                                    <Clock size={12} /> Còn lại
                                </div>
                                <div className="text-2xl font-bold text-amber-400">
                                    {formatTime(progress.estimatedTimeRemaining)}
                                </div>
                                <div className="text-xs text-slate-500">
                                    đã chạy {formatTime(progress.timeElapsed)}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Recent Matches */}
                    {progress?.recentMatches && progress.recentMatches.length > 0 && (
                        <div className="mb-6">
                            <div className="text-sm font-semibold text-slate-300 mb-3">
                                Matches gần nhất
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {progress.recentMatches.slice(0, 5).map((match, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl text-sm"
                                    >
                                        <div className="flex-1 truncate">
                                            <span className="text-blue-400">[{match.product1.source}]</span>{' '}
                                            <span className="text-slate-200">{match.product1.name}</span>
                                        </div>
                                        <ArrowRight className="text-emerald-500 flex-shrink-0" size={16} />
                                        <div className="flex-1 truncate">
                                            <span className="text-purple-400">[{match.product2.source}]</span>{' '}
                                            <span className="text-slate-200">{match.product2.name}</span>
                                        </div>
                                        <div className="text-emerald-400 font-mono text-xs flex-shrink-0">
                                            {Math.round(match.score * 100)}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Logs */}
                    <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs max-h-32 overflow-y-auto">
                        {logs.map((log, i) => (
                            <div key={i} className="text-slate-400">{log}</div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            )}

            {/* Cross-Source Matrix */}
            {matrixData && matrixData.sources.length > 0 && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <TrendingUp className="text-purple-400" />
                        Ma trận so sánh giữa các sàn
                    </h3>

                    {/* Matrix Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr>
                                    <th className="text-left p-3 text-slate-400"></th>
                                    {matrixData.sources.map(source => (
                                        <th key={source} className="p-3 text-center text-slate-300 font-medium">
                                            {source}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {matrixData.sources.map(source1 => (
                                    <tr key={source1}>
                                        <td className="p-3 text-slate-300 font-medium">{source1}</td>
                                        {matrixData.sources.map(source2 => {
                                            const count = matrixData.matrix[source1]?.[source2] || 0;
                                            const maxCount = Math.max(
                                                ...Object.values(matrixData.matrix).flatMap(row =>
                                                    Object.values(row)
                                                )
                                            );
                                            const intensity = maxCount > 0 ? count / maxCount : 0;

                                            return (
                                                <td key={source2} className="p-3 text-center">
                                                    {source1 === source2 ? (
                                                        <span className="text-slate-600">-</span>
                                                    ) : (
                                                        <span
                                                            className="inline-block px-3 py-1 rounded-lg font-mono text-xs"
                                                            style={{
                                                                backgroundColor: `rgba(34, 197, 94, ${0.1 + intensity * 0.4})`,
                                                                color: intensity > 0.5 ? '#fff' : '#94a3b8',
                                                            }}
                                                        >
                                                            {count.toLocaleString()}
                                                        </span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary Stats */}
                    <div className="mt-4 flex items-center justify-between text-sm">
                        <div className="text-slate-400">
                            Tổng cặp khớp: <span className="text-emerald-400 font-bold">{matrixData.stats.totalPairs.toLocaleString()}</span>
                        </div>
                        <div className="text-slate-400">
                            Tổng canonical: <span className="text-blue-400 font-bold">{matrixData.stats.totalCanonical.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Recent Matching Pairs */}
            {matrixData?.recentPairs && matrixData.recentPairs.length > 0 && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
                    <h3 className="text-lg font-bold mb-4">Các cặp sản phẩm đã ghép gần đây</h3>

                    <div className="space-y-3">
                        {matrixData.recentPairs.slice(0, 10).map((pair) => (
                            <div
                                key={pair.id}
                                className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl hover:bg-slate-800/70 transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs text-blue-400 mb-1">{pair.product1.source}</div>
                                    <div className="text-sm text-slate-200 truncate">{pair.product1.name}</div>
                                    {pair.product1.price && (
                                        <div className="text-xs text-slate-500">
                                            {pair.product1.price.toLocaleString()}đ
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col items-center">
                                    <ArrowRight className="text-emerald-500" size={20} />
                                    <span className="text-xs text-emerald-400 font-mono">
                                        {Math.round(pair.score * 100)}%
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs text-purple-400 mb-1">{pair.product2.source}</div>
                                    <div className="text-sm text-slate-200 truncate">{pair.product2.name}</div>
                                    {pair.product2.price && (
                                        <div className="text-xs text-slate-500">
                                            {pair.product2.price.toLocaleString()}đ
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
