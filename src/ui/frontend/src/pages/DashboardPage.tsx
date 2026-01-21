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
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
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
    const platformNames: Record<string, string> = {
        'shopee': 'Shopee',
        'tiki': 'Tiki',
        'lazada': 'Lazada',
        'sendo': 'Sendo',
        'dienmayxanh': 'Điện Máy Xanh',
        'thegioididong': 'TGDĐ',
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
// STAT CARD COMPONENT - COMPACT
// =============================================================================

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color: string;
}

function StatCard({ icon, label, value }: StatCardProps) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4 
                        hover:border-slate-300 transition-colors">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center">
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-xs text-slate-500 truncate">{label}</p>
                    <p className="text-lg font-semibold text-slate-800">{value}</p>
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
            <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-slate-200 text-sm">
                <p className="font-medium text-slate-700">{label}</p>
                <p className="text-emerald-600 font-semibold">
                    {payload[0].value.toLocaleString('vi-VN')}
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
        } catch (err) {
            setError('Không thể tải dữ liệu.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

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

    // Loading
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Đang tải...</p>
                </div>
            </div>
        );
    }

    // Error
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                    <p className="text-slate-700 font-medium mb-3">{error}</p>
                    <button
                        onClick={fetchStats}
                        className="px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600"
                    >
                        Thử lại
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-[1400px] mx-auto px-6 py-6">
                {/* Compact Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-base font-medium text-slate-800">Dashboard</h1>
                        <p className="text-sm text-slate-500">
                            Thống kê dữ liệu sản phẩm
                            {stats?.source_table && (
                                <span className="ml-2 text-xs text-slate-400">
                                    • {stats.source_table}
                                </span>
                            )}
                        </p>
                    </div>
                    <button
                        onClick={fetchStats}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 
                                 bg-white border border-slate-200 rounded-lg hover:bg-slate-50
                                 disabled:opacity-50 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Làm mới
                    </button>
                </div>

                {/* Compact Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard
                        icon={<Package className="w-4 h-4 text-blue-600" />}
                        label="Tổng sản phẩm"
                        value={formatNumber(stats?.total_products)}
                        color="bg-blue-50"
                    />
                    <StatCard
                        icon={<Store className="w-4 h-4 text-emerald-600" />}
                        label="Sàn TMĐT"
                        value={stats?.total_platforms || 0}
                        color="bg-emerald-50"
                    />
                    <StatCard
                        icon={<ShoppingBag className="w-4 h-4 text-purple-600" />}
                        label="Thương hiệu"
                        value={formatNumber(stats?.total_brands)}
                        color="bg-purple-50"
                    />
                    <StatCard
                        icon={<Clock className="w-4 h-4 text-amber-600" />}
                        label="Cập nhật"
                        value={formatDate(stats?.last_updated)}
                        color="bg-amber-50"
                    />
                </div>

                {/* Charts Row */}
                <div className="grid lg:grid-cols-2 gap-4 mb-8">
                    {/* Bar Chart */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Database className="w-4 h-4 text-slate-400" />
                            <h3 className="text-base font-medium text-slate-700">Sản phẩm theo sàn</h3>
                        </div>
                        {barChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={320}>
                                <BarChart data={barChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal vertical={false} />
                                    <XAxis
                                        type="number"
                                        tickFormatter={formatNumber}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={100}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#475569', fontSize: 14 }}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="products" radius={[0, 4, 4, 0]} maxBarSize={28} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[320px] flex items-center justify-center text-slate-400 text-sm">
                                Chưa có dữ liệu
                            </div>
                        )}
                    </div>

                    {/* Pie Chart */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-4 h-4 text-slate-400" />
                            <h3 className="text-base font-medium text-slate-700">Tỷ lệ phân bố</h3>
                        </div>
                        {pieChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={320}>
                                <PieChart>
                                    <Pie
                                        data={pieChartData}
                                        cx="50%"
                                        cy="45%"
                                        innerRadius={55}
                                        outerRadius={85}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {pieChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="#fff" strokeWidth={2} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number) => [value.toLocaleString('vi-VN'), 'Sản phẩm']}
                                        contentStyle={{
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                            padding: '8px 12px',
                                            fontSize: '12px'
                                        }}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        iconSize={10}
                                        formatter={(value) => <span className="text-sm text-slate-600">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[320px] flex items-center justify-center text-slate-400 text-sm">
                                Chưa có dữ liệu
                            </div>
                        )}
                    </div>
                </div>

                {/* Compact Table */}
                {barChartData.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Store className="w-4 h-4 text-slate-400" />
                            <h3 className="text-sm font-medium text-slate-700">Chi tiết phân bố</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="pb-3 text-left text-xs font-medium text-slate-500 uppercase">Sàn</th>
                                        <th className="pb-3 text-right text-xs font-medium text-slate-500 uppercase">Số lượng</th>
                                        <th className="pb-3 text-right text-xs font-medium text-slate-500 uppercase">Tỷ lệ</th>
                                        <th className="pb-3 text-xs font-medium text-slate-500 uppercase w-1/3">Biểu đồ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {barChartData.map((item, index) => {
                                        const percentage = (stats?.total_products ?? 0) > 0
                                            ? ((item.products / (stats?.total_products ?? 1)) * 100).toFixed(1)
                                            : '0';
                                        return (
                                            <tr key={index} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                                                <td className="py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-2.5 h-2.5 rounded-full"
                                                            style={{ backgroundColor: item.fill }}
                                                        />
                                                        <span className="font-medium text-slate-700">{item.name}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 text-right font-medium text-slate-800">
                                                    {item.products.toLocaleString('vi-VN')}
                                                </td>
                                                <td className="py-3 text-right text-slate-500">
                                                    {percentage}%
                                                </td>
                                                <td className="py-3">
                                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full"
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
                <div className="text-center py-6 mt-4">
                    <p className="text-xs text-slate-400">
                        SEG301 • BM25 + Vector Search
                    </p>
                </div>
            </div>
        </div>
    );
}
