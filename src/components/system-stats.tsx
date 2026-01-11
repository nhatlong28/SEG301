'use client';

import Link from 'next/link';
import { Database, Layers, Zap, TrendingUp, ChevronRight } from 'lucide-react';

interface Stats {
    totalProducts: number;
    totalRaw: number;
    totalBrands: number;
    totalCategories: number;
    deduplicationRate: string;
}

interface SystemStatsProps {
    stats: Stats | null;
}

export function SystemStats({ stats }: SystemStatsProps) {
    return (
        <section className="dashboard-section">
            <div className="section-header">
                <span className="text-4xl">📊</span>
                <h2>System Overview</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Tổng sản phẩm thô"
                    value={stats?.totalRaw.toLocaleString() || '0'}
                    icon={<Database className="text-blue-400" size={24} />}
                    description="Nhấn để xem chi tiết"
                    href="#data-explorer"
                />
                <StatCard
                    title="Sản phẩm gộp (Thực)"
                    value={stats?.totalProducts.toLocaleString() || '0'}
                    icon={<Layers className="text-emerald-400" size={24} />}
                    description="Nhấn để xem chi tiết"
                    trend={stats?.deduplicationRate ? `${stats.deduplicationRate}%` : undefined}
                    href="#data-explorer"
                />
                <StatCard
                    title="Danh mục & Thương hiệu"
                    value={`${stats?.totalCategories || 0} / ${stats?.totalBrands || 0}`}
                    icon={<Zap className="text-amber-400" size={24} />}
                    description="Phân loại hệ thống"
                />
                <StatCard
                    title="Reduction Rate"
                    value={stats?.deduplicationRate ? `${stats.deduplicationRate}%` : '0%'}
                    icon={<TrendingUp className="text-purple-400" size={24} />}
                    description="Hiệu quả gộp dữ liệu"
                />
            </div>
        </section>
    );
}

function StatCard({
    title,
    value,
    icon,
    description,
    trend,
    href
}: {
    title: string;
    value: string;
    icon: React.ReactNode;
    description: string;
    trend?: string;
    href?: string;
}) {
    const content = (
        <div className={`bg-slate-800/50 border border-slate-700 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden transition-all h-full ${href ? 'hover:border-blue-500/50 hover:bg-slate-800/80 cursor-pointer group' : ''}`}>
            <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-slate-900/50">
                    {icon}
                </div>
                {trend && (
                    <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-400/10 px-2 py-1 rounded-lg">
                        <TrendingUp size={12} /> {trend}
                    </div>
                )}
                {href && (
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                )}
            </div>
            <div className="text-3xl font-bold mb-1 text-slate-100">{value}</div>
            <div className="text-slate-200 text-sm font-semibold mb-1 group-hover:text-blue-400 transition-colors">{title}</div>
            <div className="text-slate-500 text-xs font-normal">{description}</div>
        </div>
    );

    if (href) {
        return <Link href={href} className="block h-full">{content}</Link>;
    }

    return content;
}
