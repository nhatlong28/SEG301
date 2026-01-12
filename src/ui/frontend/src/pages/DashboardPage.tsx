import { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
    Package, Store, TrendingUp, Clock, RefreshCw, Database,
    ShoppingBag, AlertCircle, Loader2
} from 'lucide-react';
import { getStats, DashboardStats, PlatformDistribution } from '../api';

// =============================================================================
// CONSTANTS
// =============================================================================

const PLATFORM_COLORS: Record<string, string> = {
    shopee: '#EE4D2D',
    tiki: '#1A94FF',
    lazada: '#0F0F6E',
    cellphones: '#D70018',
    dienmayxanh: '#1E8A38',
    thegioididong: '#FFD400',
    sendo: '#E53935',
    fptshop: '#E8491D',
    nguyenkim: '#F7941D',
    phongvu: '#ED1C24',
    gearvn: '#1E88E5',
    hasaki: '#FF69B4',
    yes24: '#FF6B35',
    fahasa: '#1565C0',
    unknown: '#94a3b8',
};

const CHART_COLORS = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatNumber(num: number | undefined | null): string {
    if (num === undefined || num === null || isNaN(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('vi-VN');
}

function getPlatformColor(platform: string, index: number): string {
    const key = platform.toLowerCase();
    return PLATFORM_COLORS[key] || CHART_COLORS[index % CHART_COLORS.length];
}

function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'Chưa cập nhật';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return 'N/A';
    }
}

function capitalizeFirst(str: string): string {
    if (!str) return 'Unknown';
    // Special cases for ecommerce platforms
    const platformNames: Record<string, string> = {
        'shopee': 'Shopee',
        'tiki': 'Tiki',
        'lazada': 'Lazada',
        'sendo': 'Sendo',
        'dienmayxanh': 'Điện Máy Xanh',
        'thegioididong': 'Thế Giới Di Động',
        'cellphones': 'CellphoneS',
        'fptshop': 'FPT Shop',
        'nguyenkim': 'Nguyễn Kim',
        'phongvu': 'Phong Vũ',
        'gearvn': 'GearVN',
        'hasaki': 'Hasaki',
        'yes24': 'Yes24',
        'fahasa': 'Fahasa',
        'unknown': 'Khác',
    };
    return platformNames[str.toLowerCase()] || str.charAt(0).toUpperCase() + str.slice(1);
}

// =============================================================================
// LOADING SPINNER COMPONENT
// =============================================================================

function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const sizeClasses = {
        sm: 'w-6 h-6',
        md: 'w-10 h-10',
        lg: 'w-16 h-16',
    };
    return (
        <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-500`} />
    );
}

// =============================================================================
// STAT CARD COMPONENT
// =============================================================================

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    bgColor: string;
    iconColor: string;
}

function StatCard({ icon, label, value, bgColor, iconColor }: StatCardProps) {
    return (
        <div className="bg-white/80 backdrop-blur-xl border border-white/30 shadow-xl shadow-black/5 rounded-2xl p-6 
                        hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center gap-4">
                <div className={`w-14 h-14 ${bgColor} ${iconColor} rounded-xl flex items-center justify-center shadow-lg`}>
                    {icon}
                </div>
                <div>
                    <p className="text-sm text-slate-500 font-medium">{label}</p>
                    <p className="text-2xl font-bold text-slate-800">{value}</p>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// CUSTOM TOOLTIP
// =============================================================================

interface TooltipPayload {
    value: number;
    name?: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 backdrop-blur-sm px-4 py-3 rounded-xl shadow-xl border border-slate-200">
                <p className="font-semibold text-slate-800">{label}</p>
                <p className="text-blue-600 font-bold text-lg">
                    {payload[0].value.toLocaleString('vi-VN')} sản phẩm
                </p>
            </div>
        );
    }
    return null;
}

// =============================================================================
// MAIN DASHBOARD COMPONENT
// =============================================================================

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getStats();
            setStats(data);
            console.log('📊 Dashboard stats loaded:', data);
        } catch (err) {
            setError('Không thể tải dữ liệu thống kê. Vui lòng thử lại.');
            console.error('Dashboard error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    // Prepare chart data with defensive checks
    const platformDistribution = stats?.platform_distribution || [];

    const barChartData = platformDistribution
        .map((item: PlatformDistribution, index: number) => ({
            name: capitalizeFirst(item.name),
            products: item.count || 0,
            fill: getPlatformColor(item.name, index),
        }))
        .filter(item => item.products > 0)
        .sort((a, b) => b.products - a.products);

    const pieChartData = platformDistribution
        .map((item: PlatformDistribution, index: number) => ({
            name: capitalizeFirst(item.name),
            value: item.count || 0,
            color: getPlatformColor(item.name, index),
        }))
        .filter(item => item.value > 0);

    // =========================================================================
    // LOADING STATE
    // =========================================================================
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
                <div className="text-center">
                    <div className="relative">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl animate-pulse">
                            <Database className="w-10 h-10 text-white" />
                        </div>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                            <LoadingSpinner size="md" />
                        </div>
                    </div>
                    <p className="mt-8 text-slate-600 font-medium">Đang tải dữ liệu thống kê...</p>
                    <p className="text-slate-400 text-sm mt-2">Vui lòng đợi trong giây lát</p>
                </div>
            </div>
        );
    }

    // =========================================================================
    // ERROR STATE
    // =========================================================================
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-red-50 to-orange-50">
                <div className="text-center max-w-md px-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-red-400 to-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                        <AlertCircle className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-3">Đã xảy ra lỗi</h2>
                    <p className="text-slate-600 mb-6">{error}</p>
                    <button
                        onClick={fetchStats}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-500 hover:to-blue-400 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                    >
                        Thử lại
                    </button>
                </div>
            </div>
        );
    }

    // =========================================================================
    // MAIN DASHBOARD
    // =========================================================================
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 py-8">
            <div className="container mx-auto px-4 max-w-7xl">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                            Dashboard Thống Kê
                        </h1>
                        <p className="text-slate-600">
                            Tổng quan về dữ liệu đã thu thập từ các sàn TMĐT
                            {stats?.source_table && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                                    📦 {stats.source_table}
                                </span>
                            )}
                        </p>
                    </div>
                    <button
                        onClick={fetchStats}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl 
                       hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm
                       disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span className="font-medium">Làm mới</span>
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard
                        icon={<Package className="w-7 h-7" />}
                        label="Tổng sản phẩm"
                        value={formatNumber(stats?.total_products)}
                        bgColor="bg-gradient-to-br from-blue-500 to-blue-600"
                        iconColor="text-white"
                    />
                    <StatCard
                        icon={<Store className="w-7 h-7" />}
                        label="Số sàn TMĐT"
                        value={stats?.total_platforms || 0}
                        bgColor="bg-gradient-to-br from-emerald-500 to-green-600"
                        iconColor="text-white"
                    />
                    <StatCard
                        icon={<ShoppingBag className="w-7 h-7" />}
                        label="Số thương hiệu"
                        value={formatNumber(stats?.total_brands)}
                        bgColor="bg-gradient-to-br from-purple-500 to-violet-600"
                        iconColor="text-white"
                    />
                    <StatCard
                        icon={<Clock className="w-7 h-7" />}
                        label="Cập nhật lần cuối"
                        value={formatDate(stats?.last_updated)}
                        bgColor="bg-gradient-to-br from-orange-500 to-amber-500"
                        iconColor="text-white"
                    />
                </div>

                {/* Charts Section */}
                <div className="grid lg:grid-cols-2 gap-6 mb-8">
                    {/* Bar Chart - Products by Platform */}
                    <div className="bg-white/80 backdrop-blur-xl border border-white/30 shadow-xl rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Database className="w-4 h-4 text-blue-600" />
                            </div>
                            Số sản phẩm theo sàn
                        </h3>
                        {barChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={320}>
                                <BarChart data={barChartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                                    <XAxis
                                        type="number"
                                        tickFormatter={formatNumber}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={130}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#334155', fontSize: 13, fontWeight: 500 }}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar
                                        dataKey="products"
                                        radius={[0, 8, 8, 0]}
                                        maxBarSize={40}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[320px] flex items-center justify-center">
                                <div className="text-center text-slate-400">
                                    <Database className="w-16 h-16 mx-auto mb-3 opacity-30" />
                                    <p className="font-medium">Chưa có dữ liệu</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pie Chart - Distribution */}
                    <div className="bg-white/80 backdrop-blur-xl border border-white/30 shadow-xl rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                <TrendingUp className="w-4 h-4 text-purple-600" />
                            </div>
                            Tỷ lệ phân bố sản phẩm
                        </h3>
                        {pieChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={320}>
                                <PieChart>
                                    <Pie
                                        data={pieChartData}
                                        cx="50%"
                                        cy="45%"
                                        innerRadius={70}
                                        outerRadius={110}
                                        paddingAngle={3}
                                        dataKey="value"
                                        label={({ name, percent }) =>
                                            percent > 0.05 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''
                                        }
                                        labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                                    >
                                        {pieChartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.color}
                                                stroke="#fff"
                                                strokeWidth={2}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number) => [value.toLocaleString('vi-VN'), 'Sản phẩm']}
                                        contentStyle={{
                                            borderRadius: '12px',
                                            border: 'none',
                                            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                                            padding: '12px 16px'
                                        }}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        formatter={(value) => <span className="text-slate-600 font-medium">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[320px] flex items-center justify-center">
                                <div className="text-center text-slate-400">
                                    <TrendingUp className="w-16 h-16 mx-auto mb-3 opacity-30" />
                                    <p className="font-medium">Chưa có dữ liệu</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Platform Distribution Table */}
                {barChartData.length > 0 && (
                    <div className="bg-white/80 backdrop-blur-xl border border-white/30 shadow-xl rounded-2xl p-6 mb-8">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                <Store className="w-4 h-4 text-green-600" />
                            </div>
                            Chi tiết phân bố theo sàn
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left border-b-2 border-slate-100">
                                        <th className="pb-4 text-slate-500 font-semibold text-sm uppercase tracking-wide">Sàn TMĐT</th>
                                        <th className="pb-4 text-slate-500 font-semibold text-sm uppercase tracking-wide text-right">Số sản phẩm</th>
                                        <th className="pb-4 text-slate-500 font-semibold text-sm uppercase tracking-wide text-right">Tỷ lệ</th>
                                        <th className="pb-4 text-slate-500 font-semibold text-sm uppercase tracking-wide w-1/3">Biểu đồ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {barChartData.map((item, index) => {
                                        const percentage = (stats?.total_products ?? 0) > 0
                                            ? ((item.products / (stats?.total_products ?? 1)) * 100).toFixed(1)
                                            : '0';
                                        return (
                                            <tr key={index} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                                <td className="py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-4 h-4 rounded-full shadow-sm"
                                                            style={{ backgroundColor: item.fill }}
                                                        />
                                                        <span className="font-semibold text-slate-800">{item.name}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 text-right font-bold text-slate-700">
                                                    {item.products.toLocaleString('vi-VN')}
                                                </td>
                                                <td className="py-4 text-right text-slate-500 font-medium">
                                                    {percentage}%
                                                </td>
                                                <td className="py-4">
                                                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-500"
                                                            style={{
                                                                width: `${percentage}%`,
                                                                backgroundColor: item.fill
                                                            }}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center py-6">
                    <p className="text-slate-400 text-sm">
                        SEG301 - Search Engines & Information Retrieval
                    </p>
                    <p className="text-slate-300 text-xs mt-1">
                        Powered by BM25 + Vector Search (Hybrid)
                    </p>
                </div>
            </div>
        </div>
    );
}
