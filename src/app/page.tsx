'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Toaster } from 'react-hot-toast';
import { Loader2, Database } from 'lucide-react';
import { UnifiedSearch } from '@/components/unified-search';
import { SystemStats } from '@/components/system-stats';
import { CrawlerControlsSection } from '@/components/crawler-controls-section';
import { MassOperations } from '@/components/mass-operations';
import { CrawlHistorySection } from '@/components/crawl-history-section';
import { HomepageFeaturesSection } from '@/components/homepage-features';
import { DataExplorer } from '@/components/admin/data-explorer';

interface Stats {
  totalProducts: number;
  totalRaw: number;
  totalBrands: number;
  totalCategories: number;
  deduplicationRate: string;
}

interface SystemStatus {
  isCrawling: boolean;
  isDeduplicating: boolean;
  crawlProgress?: {
    currentSource: string;
    totalSources: number;
    completedSources: number;
    totalProducts: number;
    startedAt: string;
  } | null;
}

export default function UnifiedDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    isCrawling: false,
    isDeduplicating: false
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsRes, statusRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/system')
      ]);

      const statsData = await statsRes.json();
      const statusData = await statusRes.json();

      setStats(statsData.stats);
      setSystemStatus(statusData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-[#0a0f1d] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-200 font-sans">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0f1d]/95 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                🛍️ PriceSpider - Unified Dashboard
              </h1>
              <p className="text-slate-400 mt-1 text-sm">
                Quản lý 1,000,000+ sản phẩm và tối ưu hóa dữ liệu từ 5 sàn TMĐT
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
              >
                <Database className="w-4 h-4" />
                Quản Trị Hệ Thống
              </Link>
              <div className={`px-4 py-2 rounded-full border border-slate-700 bg-slate-800/50 flex items-center gap-2 text-sm`}>
                <div className={`w-2 h-2 rounded-full ${systemStatus.isCrawling ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'
                  }`} />
                {systemStatus.isCrawling ? 'Đang cào dữ liệu...' : 'Hệ thống rảnh'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Search Section */}
        <UnifiedSearch />

        {/* System Stats */}
        <SystemStats stats={stats} />

        {/* Homepage Features: Categories, Deals, Popular Products */}
        <HomepageFeaturesSection />

        {/* Crawler Controls */}
        <CrawlerControlsSection />

        {/* Mass Operations */}
        <MassOperations
          systemStatus={systemStatus}
          onRefresh={fetchData}
        />

        {/* Data Explorer (Raw & Canonical Products) */}
        <DataExplorer />

        {/* Crawl History */}
        <CrawlHistorySection />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/50 border-t border-slate-800 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-3">🛍️ PriceSpider</h3>
              <p className="text-slate-400 text-sm">
                So sánh giá sản phẩm từ các sàn TMĐT lớn nhất Việt Nam
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Nguồn Dữ Liệu</h4>
              <ul className="space-y-1 text-slate-400 text-sm">
                <li>Shopee</li>
                <li>Tiki</li>
                <li>Lazada</li>
                <li>CellphoneS</li>
                <li>Điện Máy Xanh</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Tính Năng</h4>
              <ul className="space-y-1 text-slate-400 text-sm">
                <li>So sánh giá real-time</li>
                <li>AI Matching & Deduplication</li>
                <li>Mass Crawling (1M+ products)</li>
                <li>Advanced Search Engine</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-6 text-center text-slate-500 text-sm">
            © 2026 PriceSpider. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
