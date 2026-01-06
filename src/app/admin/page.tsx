'use client';

import React, { useState, useEffect } from 'react';
import MergeProgress from '@/components/admin/merge-progress';
import Link from 'next/link';
import {
    Database,
    Zap,
    RefreshCcw,
    Layers,
    TrendingUp,
    AlertCircle,
    Clock,
    Search,
    ChevronRight,
    Play,
    Loader2,
    CheckCircle2,
    Package
} from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';

interface Stats {
    totalProducts: number;
    totalRaw: number;
    totalBrands: number;
    totalCategories: number;
    deduplicationRate: string;
}

interface Source {
    id: number;
    name: string;
    type: string;
    is_active: boolean;
    last_crawled_at: string;
    total_items_crawled: number;
    productCount: number;
}

interface CrawlLog {
    id: number;
    started_at: string;
    completed_at: string;
    status: string;
    total_items: number;
    new_items: number;
    updated_items: number;
    error_count: number;
    sources: { name: string; type: string };
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [sources, setSources] = useState<Source[]>([]);
    const [logs, setLogs] = useState<CrawlLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [systemStatus, setSystemStatus] = useState<{
        isCrawling: boolean;
        isDeduplicating: boolean;
        crawlProgress?: {
            currentSource: string;
            totalSources: number;
            completedSources: number;
            totalProducts: number;
            startedAt: string;
        } | null;
    }>({ isCrawling: false, isDeduplicating: false });

    const fetchData = async () => {
        try {
            const [statsRes, statusRes] = await Promise.all([
                fetch('/api/admin/stats'),
                fetch('/api/admin/system')
            ]);

            const statsData = await statsRes.json();
            const statusData = await statusRes.json();

            setStats(statsData.stats);
            setSources(statsData.sources);
            setLogs(statsData.recentCrawls);
            setSystemStatus(statusData);
        } catch (error) {
            toast.error('Không thể tải dữ liệu admin');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Polling every 10s
        return () => clearInterval(interval);
    }, []);

    const handleAction = async (action: 'mass-crawl' | 'deduplicate') => {
        try {
            const res = await fetch('/api/admin/system', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            const data = await res.json();

            if (res.ok) {
                toast.success(data.message);
                fetchData();
            } else {
                toast.error(data.error);
            }
        } catch (error) {
            toast.error('Lỗi server khi thực hiện tác vụ');
        }
    };

    if (loading && !stats) {
        return (
            <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0f1d] text-slate-200 p-6 font-sans">
            <Toaster position="top-right" />

            {/* Header */}
            <header className="max-w-7xl mx-auto flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                        Hệ Thống Quản Trị Spider
                    </h1>
                    <p className="text-slate-400 mt-1">Quản lý 1,000,000+ sản phẩm và tối ưu hóa dữ liệu</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className={`px-4 py-2 rounded-full border border-slate-700 bg-slate-800/50 flex items-center gap-2 text-sm`}>
                        <div className={`w-2 h-2 rounded-full ${systemStatus.isCrawling ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                        {systemStatus.isCrawling ? 'Đang cào dữ liệu...' : 'Hệ thống rảnh'}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto space-y-8">

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        title="Tổng sản phẩm thô"
                        value={stats?.totalRaw.toLocaleString() || '0'}
                        icon={<Database className="text-blue-400" />}
                        description="Dữ liệu từ 5 sàn TMĐT"
                    />
                    <StatCard
                        title="Sản phẩm gộp (Thực)"
                        value={stats?.totalProducts.toLocaleString() || '0'}
                        icon={<Layers className="text-emerald-400" />}
                        description="Đã được chuẩn hóa"
                        trend={stats?.deduplicationRate + '%'}
                    />
                    <StatCard
                        title="Danh mục & Thương hiệu"
                        value={`${stats?.totalCategories} / ${stats?.totalBrands}`}
                        icon={<Zap className="text-amber-400" />}
                        description="Phân loại hệ thống"
                    />
                    <StatCard
                        title="Reduction Rate"
                        value={stats?.deduplicationRate + '%'}
                        icon={<TrendingUp className="text-purple-400" />}
                        description="Hiệu quả gộp dữ liệu"
                    />
                </div>

                {/* Quick Navigation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Link href="/admin/raw-products" className="group">
                        <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-3xl hover:border-blue-500/50 transition-all flex items-center justify-between relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Database size={100} />
                            </div>
                            <div className="flex items-center gap-6 relative z-10">
                                <div className="p-4 bg-blue-500/20 rounded-2xl">
                                    <Database className="w-8 h-8 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl group-hover:text-blue-400 transition-colors">Kho Dữ Liệu Thô</h3>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Xem <span className="text-blue-400 font-bold">{stats?.totalRaw.toLocaleString() || 0}</span> sản phẩm gốc chưa xử lý
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 relative z-10">
                                <div className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-bold rounded-lg border border-blue-500/20">
                                    Raw Data
                                </div>
                                <ChevronRight className="w-6 h-6 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                            </div>
                        </div>
                    </Link>
                    <Link href="/admin/canonical-products" className="group">
                        <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-3xl hover:border-emerald-500/50 transition-all flex items-center justify-between relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Layers size={100} />
                            </div>
                            <div className="flex items-center gap-6 relative z-10">
                                <div className="p-4 bg-emerald-500/20 rounded-2xl">
                                    <Layers className="w-8 h-8 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl group-hover:text-emerald-400 transition-colors">Sản Phẩm Đã Gộp</h3>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Xem <span className="text-emerald-400 font-bold">{stats?.totalProducts.toLocaleString() || 0}</span> sản phẩm đã chuẩn hóa
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 relative z-10">
                                <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20">
                                    Canonical
                                </div>
                                <ChevronRight className="w-6 h-6 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Control Center */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Mass Crawl Box */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Search size={120} />
                        </div>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                            <Search className="text-blue-500" /> Cào dữ liệu toàn diện
                        </h2>
                        <p className="text-slate-400 mb-6 max-w-md">
                            Tự động quét qua toàn bộ 5 sàn TMĐT (Shopee, Tiki, Lazada, CellphoneS, ĐMX) theo danh mục để đạt mục tiêu 1,000,000 sản phẩm.
                        </p>

                        {/* Crawl Progress Display */}
                        {systemStatus.isCrawling && systemStatus.crawlProgress && (
                            <div className="mb-6 p-4 bg-slate-800/50 rounded-2xl border border-blue-500/30">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-slate-400">Đang cào:</span>
                                    <span className="text-blue-400 font-semibold">{systemStatus.crawlProgress.currentSource}</span>
                                </div>
                                <div className="w-full bg-slate-700 rounded-full h-3 mb-3">
                                    <div
                                        className="bg-gradient-to-r from-blue-500 to-emerald-500 h-3 rounded-full transition-all duration-500"
                                        style={{ width: `${(systemStatus.crawlProgress.completedSources / systemStatus.crawlProgress.totalSources) * 100}%` }}
                                    />
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-400">
                                        {systemStatus.crawlProgress.completedSources}/{systemStatus.crawlProgress.totalSources} nguồn
                                    </span>
                                    <span className="text-emerald-400 font-semibold">
                                        {systemStatus.crawlProgress.totalProducts.toLocaleString()} sản phẩm
                                    </span>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => handleAction('mass-crawl')}
                            disabled={systemStatus.isCrawling}
                            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all ${systemStatus.isCrawling
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95'
                                }`}
                        >
                            {systemStatus.isCrawling ? (
                                <Loader2 className="animate-spin" />
                            ) : (
                                <Play fill="currentColor" />
                            )}
                            {systemStatus.isCrawling ? 'Đang cào dữ liệu...' : 'Bắt đầu cào 1M Data'}
                        </button>
                    </div>

                    {/* Deduplicate Box - Now using full page component */}
                    <div className="lg:col-span-2">
                        <MergeProgress />
                    </div>
                </div>

                {/* Sources Table */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl">
                    <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                        <h2 className="text-xl font-bold">Nguồn dữ liệu</h2>
                        <Link href="/admin/crawl">
                            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition-colors">
                                Quản lý Crawler & Cookie
                            </button>
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-800/50 text-slate-400 text-sm">
                                    <th className="p-4 font-medium uppercase tracking-wider">Nguồn</th>
                                    <th className="p-4 font-medium uppercase tracking-wider">Trạng thái</th>
                                    <th className="p-4 font-medium uppercase tracking-wider">Số lượng Item</th>
                                    <th className="p-4 font-medium uppercase tracking-wider">Lần cuối cào</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {sources.map(source => (
                                    <tr key={source.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-blue-400 uppercase">
                                                    {source.type.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-semibold">{source.name}</div>
                                                    <div className="text-xs text-slate-500">{source.type}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-md text-xs font-medium ${source.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                                                }`}>
                                                {source.is_active ? 'Hoạt động' : 'Tạm dừng'}
                                            </span>
                                        </td>
                                        <td className="p-4 font-mono text-blue-400">{source.productCount.toLocaleString()}</td>
                                        <td className="p-4 text-slate-400 text-sm">
                                            {source.last_crawled_at ? new Date(source.last_crawled_at).toLocaleString() : 'Chưa rõ'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent History */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl">
                    <div className="p-6 border-b border-slate-800">
                        <h2 className="text-xl font-bold">Lịch sử cào gần đây</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        {logs.slice(0, 5).map(log => (
                            <div key={log.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/30 border border-slate-800/50">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <div className="font-medium flex items-center gap-2">
                                            Cào {log.sources?.name || 'Hệ thống'}
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${log.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                                                }`}>
                                                {log.status}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-500">{new Date(log.started_at).toLocaleString()}</div>
                                    </div>
                                </div>
                                <div className="flex gap-8 text-sm">
                                    <div className="text-center">
                                        <div className="text-slate-500 text-xs">Tổng Item</div>
                                        <div className="font-semibold text-slate-200">{log.total_items}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-slate-500 text-xs">Mới</div>
                                        <div className="font-semibold text-emerald-400">+{log.new_items}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-slate-500 text-xs">Lỗi</div>
                                        <div className="font-semibold text-red-400">{log.error_count}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}

function StatCard({ title, value, icon, description, trend }: { title: string, value: string, icon: React.ReactNode, description: string, trend?: string }) {
    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-slate-800 bg-opacity-50">
                    {icon}
                </div>
                {trend && (
                    <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-400/10 px-2 py-1 rounded-lg">
                        <TrendingUp size={12} /> {trend}
                    </div>
                )}
            </div>
            <div className="text-2xl font-bold mb-1">{value}</div>
            <div className="text-slate-200 text-sm font-semibold mb-1">{title}</div>
            <div className="text-slate-500 text-xs font-normal">{description}</div>
        </div>
    );
}
