'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Square, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
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
export function CrawlerControl() {
    const [stats, setStats] = useState<CrawlStats[]>([]);
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [cookies, setCookies] = useState<Record<string, string>>({});

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

    const renderCard = (source: string, isCookie = false) => {
        const stat = stats.find(s => s.source === source);
        const isRunning = stat?.status === 'running';
        const isLoading = loading[source];

        return (
            <Card key={source} className="overflow-hidden border-t-4 border-t-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base font-bold capitalize flex items-center gap-2">
                        {source}
                        {isCookie && <Badge variant="outline" className="text-xs font-normal">Requires Cookie</Badge>}
                    </CardTitle>
                    <Badge variant={isRunning ? 'default' : 'secondary'} className={isRunning ? 'animate-pulse' : ''}>
                        {stat?.status || 'idle'}
                    </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 border-b pb-4">
                        <div>
                            <div className="text-2xl font-bold text-blue-600">{stat?.products || 0}</div>
                            <p className="text-xs text-muted-foreground font-medium">Session</p>
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stat?.totalProducts?.toLocaleString() || 0}</div>
                            <p className="text-xs text-muted-foreground font-medium">Total Saved</p>
                        </div>
                    </div>

                    {stat?.errors ? <div className="text-xs text-red-500 font-medium text-right">{stat.errors} errors</div> : null}

                    <div className="min-h-[1.25rem] text-xs text-muted-foreground truncate">
                        {stat?.currentAction || 'Ready to crawl'}
                    </div>

                    {isCookie && !isRunning && (
                        <div className="space-y-2">
                            <label className="text-xs font-medium">Paste {source} Cookie (Optional but recommended):</label>
                            <textarea
                                className="w-full h-16 text-xs p-2 border rounded resize-none bg-muted/50 focus:bg-background transition-colors"
                                placeholder={`Paste cookie string here for ${source} to bypass login...`}
                                value={cookies[source] || ''}
                                onChange={e => setCookies(prev => ({ ...prev, [source]: e.target.value }))}
                            />
                        </div>
                    )}

                    <div className="flex gap-2 pt-2">
                        {!isRunning ? (
                            <Button
                                size="sm"
                                className="w-full font-semibold shadow-sm"
                                onClick={() => isCookie ? handleCookieStart(source) : handleAction(source, 'start')}
                                disabled={isLoading}
                            >
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                Start Crawl
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                variant="destructive"
                                className="w-full shadow-sm"
                                onClick={() => handleAction(source, 'stop')}
                                disabled={isLoading}
                            >
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}
                                Stop
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Advanced Crawlers (Shopee & Lazada)
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                    {COOKIE_SOURCES.map(source => renderCard(source, true))}
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-green-500" />
                    Auto Crawlers
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {AUTO_SOURCES.map(source => renderCard(source))}
                </div>
            </div>
        </div>
    );
}
