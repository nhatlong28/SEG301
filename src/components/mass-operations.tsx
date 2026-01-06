'use client';

import { useState } from 'react';
import { Play, Loader2, RefreshCcw, Search, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

interface MassOperationsProps {
    systemStatus: {
        isCrawling: boolean;
        isDeduplicating: boolean;
        crawlProgress?: {
            currentSource: string;
            totalSources: number;
            completedSources: number;
            totalProducts: number;
            startedAt: string;
        } | null;
    };
    onRefresh: () => void;
}

export function MassOperations({ systemStatus, onRefresh }: MassOperationsProps) {
    const [loading, setLoading] = useState<'crawl' | 'dedupe' | null>(null);

    const handleAction = async (action: 'mass-crawl' | 'deduplicate') => {
        setLoading(action === 'mass-crawl' ? 'crawl' : 'dedupe');
        try {
            const res = await fetch('/api/admin/system', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });
            const data = await res.json();

            if (res.ok) {
                toast.success(data.message);
                onRefresh();
            } else {
                toast.error(data.error);
            }
        } catch (error) {
            toast.error('Lỗi server khi thực hiện tác vụ');
        } finally {
            setLoading(null);
        }
    };

    return (
        <section className="dashboard-section">
            <div className="section-header">
                <span className="text-4xl">⚡</span>
                <h2>Mass Operations</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Mass Crawl */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Search size={100} />
                    </div>
                    <h3 className="text-xl font-bold mb-3 flex items-center gap-3 relative z-10">
                        <Search className="text-blue-400" size={24} />
                        Cào Dữ Liệu Toàn Diện
                    </h3>
                    <p className="text-slate-400 mb-6 text-sm relative z-10">
                        Tự động quét qua toàn bộ 5 sàn TMĐT (Shopee, Tiki, Lazada, CellphoneS, ĐMX)
                        theo danh mục để đạt mục tiêu 1,000,000 sản phẩm.
                    </p>

                    {/* Crawl Progress */}
                    {systemStatus.isCrawling && systemStatus.crawlProgress && (
                        <div className="mb-6 p-4 bg-slate-900/50 rounded-xl border border-blue-500/30 relative z-10">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-slate-400">Đang cào:</span>
                                <span className="text-blue-400 font-semibold">
                                    {systemStatus.crawlProgress.currentSource}
                                </span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-3 mb-3">
                                <div
                                    className="bg-gradient-to-r from-blue-500 to-emerald-500 h-3 rounded-full transition-all duration-500"
                                    style={{
                                        width: `${(systemStatus.crawlProgress.completedSources / systemStatus.crawlProgress.totalSources) * 100}%`
                                    }}
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
                        disabled={systemStatus.isCrawling || loading === 'crawl'}
                        className={`flex items-center gap-3 px-6 py-3 rounded-xl font-bold transition-all w-full justify-center relative z-10 ${systemStatus.isCrawling || loading === 'crawl'
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95'
                            }`}
                    >
                        {systemStatus.isCrawling || loading === 'crawl' ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <Play fill="currentColor" size={20} />
                        )}
                        {systemStatus.isCrawling ? 'Đang cào dữ liệu...' : 'Bắt đầu cào 1M Data'}
                    </button>
                </div>

                {/* Deduplication */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Layers size={100} />
                    </div>
                    <h3 className="text-xl font-bold mb-3 flex items-center gap-3 relative z-10">
                        <Layers className="text-emerald-400" size={24} />
                        Chuẩn Hóa & Gộp
                    </h3>
                    <p className="text-slate-400 mb-6 text-sm relative z-10">
                        Sử dụng AI Matching để tìm sản phẩm giống nhau giữa các sàn và gộp chúng
                        vào một trang so sánh giá duy nhất.
                    </p>

                    <div className="mb-6 relative z-10">
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="p-3 bg-slate-900/50 rounded-lg">
                                <div className="text-2xl font-bold text-blue-400">AI</div>
                                <div className="text-xs text-slate-500">Matching</div>
                            </div>
                            <div className="p-3 bg-slate-900/50 rounded-lg">
                                <div className="text-2xl font-bold text-emerald-400">Auto</div>
                                <div className="text-xs text-slate-500">Merge</div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => handleAction('deduplicate')}
                        disabled={systemStatus.isDeduplicating || loading === 'dedupe'}
                        className={`flex items-center gap-3 px-6 py-3 rounded-xl font-bold transition-all w-full justify-center relative z-10 ${systemStatus.isDeduplicating || loading === 'dedupe'
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 active:scale-95'
                            }`}
                    >
                        {systemStatus.isDeduplicating || loading === 'dedupe' ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <RefreshCcw size={20} />
                        )}
                        Chạy thuật toán gộp
                    </button>
                </div>
            </div>
        </section>
    );
}
