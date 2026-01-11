'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface LogFile {
    source: string;
    status: string;
    products: number;
    errors: number;
    startTime: string;
    endTime: string;
    savedAt: string;
    duration?: number;
}

export function CrawlHistorySection() {
    const [logs, setLogs] = useState<LogFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/crawl/history');
            const data = await res.json();
            if (data.logs) {
                setLogs(data.logs);
            }
        } catch (error) {
            console.error('Failed to fetch history', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const displayLogs = expanded ? logs : logs.slice(0, 5);

    return (
        <section className="dashboard-section">
            <div className="section-header">
                <span className="text-4xl">📜</span>
                <h2>Crawl History</h2>
                <button
                    onClick={fetchHistory}
                    disabled={loading}
                    className="ml-auto p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                    <RefreshCw className={`h-5 w-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {logs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No crawl history found</p>
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-800/50 text-slate-400 text-sm">
                                    <th className="p-4 font-medium">Date</th>
                                    <th className="p-4 font-medium">Source</th>
                                    <th className="p-4 font-medium">Status</th>
                                    <th className="p-4 font-medium">Products</th>
                                    <th className="p-4 font-medium">Errors</th>
                                    <th className="p-4 font-medium">Duration</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {displayLogs.map((log, i) => (
                                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="p-4 text-slate-300 whitespace-nowrap text-sm">
                                            {format(new Date(log.savedAt), 'dd/MM/yyyy HH:mm')}
                                        </td>
                                        <td className="p-4">
                                            <Badge variant="outline" className="capitalize text-slate-200 border-slate-700 bg-slate-800/50">
                                                {log.source}
                                            </Badge>
                                        </td>
                                        <td className="p-4">
                                            <Badge
                                                variant={log.status === 'completed' ? 'secondary' : 'destructive'}
                                                className="capitalize"
                                            >
                                                {log.status}
                                            </Badge>
                                        </td>
                                        <td className="p-4 font-mono text-blue-400">{log.products}</td>
                                        <td className={`p-4 font-mono ${log.errors > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                            {log.errors}
                                        </td>
                                        <td className="p-4 text-slate-400 text-sm">
                                            {log.duration ? `${Math.round(log.duration / 1000)}s` : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {logs.length > 5 && (
                        <div className="mt-4 text-center">
                            <button
                                onClick={() => setExpanded(!expanded)}
                                className="inline-flex items-center gap-2 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
                            >
                                {expanded ? (
                                    <>
                                        <ChevronUp className="w-4 h-4" />
                                        Show Less
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="w-4 h-4" />
                                        View All ({logs.length} logs)
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
