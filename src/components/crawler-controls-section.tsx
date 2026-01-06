'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface CrawlStats {
    source: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped' | 'idle';
    products: number;
    totalProducts?: number;
    errors: number;
    currentAction?: string;
    duration?: number;
}

const COOKIE_SOURCES = ['shopee', 'lazada'];
const AUTO_SOURCES = ['tiki', 'cellphones', 'dienmayxanh'];

export function CrawlerControlsSection() {
    const [stats, setStats] = useState<CrawlStats[]>([]);
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [cookies, setCookies] = useState<Record<string, string>>({});
    const [activeTab, setActiveTab] = useState('shopee');

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/admin/crawl');
            const data = await res.json();
            if (data.stats) setStats(data.stats);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleAction = async (source: string, action: 'start' | 'stop') => {
        setLoading(prev => ({ ...prev, [source]: true }));
        try {
            const res = await fetch('/api/admin/crawl/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, source }),
            });

            if (!res.ok) throw new Error((await res.json()).error || 'Failed');
            toast.success(`${action === 'start' ? 'Started' : 'Stopped'} ${source}`);
            fetchStats();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Error');
        } finally {
            setLoading(prev => ({ ...prev, [source]: false }));
        }
    };

    const handleCookieStart = async (source: string) => {
        setLoading(prev => ({ ...prev, [source]: true }));
        try {
            const res = await fetch('/api/admin/crawl/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    source,
                    cookie: cookies[source]
                }),
            });

            if (!res.ok) throw new Error((await res.json()).error || 'Failed');
            toast.success(`Started ${source} with cookies`);
            fetchStats();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Error');
        } finally {
            setLoading(prev => ({ ...prev, [source]: false }));
        }
    };

    const allSources = [...COOKIE_SOURCES, ...AUTO_SOURCES];

    const renderCrawlerCard = (source: string) => {
        const stat = stats.find(s => s.source === source);
        const isRunning = stat?.status === 'running';
        const isLoading = loading[source];
        const isCookie = COOKIE_SOURCES.includes(source);

        return (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <h4 className="text-lg font-bold capitalize text-slate-200">{source}</h4>
                        {isCookie && (
                            <Badge variant="outline" className="text-xs">
                                Requires Cookie
                            </Badge>
                        )}
                    </div>
                    <Badge
                        variant={isRunning ? 'default' : 'secondary'}
                        className={isRunning ? 'animate-pulse' : ''}
                    >
                        {stat?.status || 'idle'}
                    </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b border-slate-700 pb-4 mb-4">
                    <div>
                        <div className="text-2xl font-bold text-blue-400">{stat?.products || 0}</div>
                        <p className="text-xs text-slate-500 font-medium">Session</p>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-slate-200">
                            {stat?.totalProducts?.toLocaleString() || 0}
                        </div>
                        <p className="text-xs text-slate-500 font-medium">Total Saved</p>
                    </div>
                </div>

                {stat?.errors ? (
                    <div className="text-xs text-red-400 font-medium text-right mb-2">
                        {stat.errors} errors
                    </div>
                ) : null}

                <div className="min-h-[1.25rem] text-xs text-slate-400 truncate mb-4">
                    {stat?.currentAction || 'Ready to crawl'}
                </div>

                {isCookie && !isRunning && (
                    <div className="space-y-2 mb-4">
                        <label className="text-xs font-medium text-slate-300">
                            Paste {source} Cookie (Optional but recommended):
                        </label>
                        <textarea
                            className="w-full h-16 text-xs p-2 border border-slate-700 rounded bg-slate-900/50 text-slate-200 focus:bg-slate-900 focus:border-blue-500 transition-colors resize-none"
                            placeholder={`Paste cookie string here for ${source} to bypass login...`}
                            value={cookies[source] || ''}
                            onChange={e => setCookies(prev => ({ ...prev, [source]: e.target.value }))}
                        />
                    </div>
                )}

                <div className="flex gap-2">
                    {!isRunning ? (
                        <Button
                            size="sm"
                            className="w-full font-semibold"
                            onClick={() => isCookie ? handleCookieStart(source) : handleAction(source, 'start')}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Play className="mr-2 h-4 w-4" />
                            )}
                            Start Crawl
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            variant="destructive"
                            className="w-full"
                            onClick={() => handleAction(source, 'stop')}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Square className="mr-2 h-4 w-4" />
                            )}
                            Stop
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <section className="dashboard-section">
            <div className="section-header">
                <span className="text-4xl">🕷️</span>
                <h2>Crawler Controls</h2>
            </div>

            {/* Tab Navigation */}
            <div className="tab-nav mb-6">
                {allSources.map(source => (
                    <button
                        key={source}
                        onClick={() => setActiveTab(source)}
                        className={`tab-button ${activeTab === source ? 'active' : ''}`}
                    >
                        <span className="capitalize">{source}</span>
                        {COOKIE_SOURCES.includes(source) && (
                            <AlertTriangle className="inline ml-1 h-3 w-3 text-yellow-500" />
                        )}
                    </button>
                ))}
            </div>

            {/* Active Crawler Card */}
            <div className="max-w-2xl mx-auto">
                {renderCrawlerCard(activeTab)}
            </div>
        </section>
    );
}
