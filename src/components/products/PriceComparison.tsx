'use client';

import { useState } from 'react';
import { X, ExternalLink, Star, TrendingDown, TrendingUp, Minus, Check, AlertTriangle } from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import Image from 'next/image';

interface Source {
    sourceId: number;
    sourceName: string;
    price: number;
    originalPrice?: number;
    discountPercent?: number;
    available: boolean;
    externalUrl?: string;
    imageUrl?: string;
    rating?: number;
    reviewCount?: number;
}

interface PriceComparisonProps {
    product: {
        id: number;
        name: string;
        imageUrl?: string;
        brand?: string;
    };
    sources: Source[];
    priceHistory?: Record<number, Array<{ date: string; price: number }>>;
    onClose: () => void;
}

export default function PriceComparison({
    product,
    sources,
    priceHistory,
    onClose,
}: PriceComparisonProps) {
    const [selectedDays, setSelectedDays] = useState<7 | 30 | 90>(30);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0,
        }).format(price);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    const availableSources = sources.filter(s => s.available);
    const lowestPrice = Math.min(...availableSources.map(s => s.price));
    const highestPrice = Math.max(...availableSources.map(s => s.price));
    const savingsAmount = highestPrice - lowestPrice;
    const savingsPercent = Math.round((savingsAmount / highestPrice) * 100);

    // Prepare chart data
    const chartData = priceHistory
        ? Object.entries(priceHistory).flatMap(([rawId, history]) => {
            const source = sources.find(s => String(s.sourceId) === rawId);
            return history.map(h => ({
                date: formatDate(h.date),
                [source?.sourceName || 'Unknown']: h.price,
            }));
        })
        : [];

    // Merge chart data by date
    const mergedChartData = chartData.reduce((acc: Record<string, string | number>[], item) => {
        const existing = acc.find(d => d.date === item.date);
        if (existing) {
            Object.assign(existing, item);
        } else {
            acc.push(item);
        }
        return acc;
    }, []);

    const sourceColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                    <div className="flex items-start justify-between">
                        <div className="flex gap-4">
                            {product.imageUrl && (
                                <Image
                                    src={product.imageUrl}
                                    alt={product.name}
                                    width={80}
                                    height={80}
                                    unoptimized
                                    className="w-20 h-20 object-contain bg-white/10 rounded-xl p-2"
                                />
                            )}
                            <div>
                                <p className="text-blue-200 text-sm">{product.brand}</p>
                                <h2 className="text-xl font-bold">{product.name}</h2>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-2xl font-bold text-yellow-300">{formatPrice(lowestPrice)}</span>
                                    {savingsPercent > 0 && (
                                        <span className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded-lg text-sm font-bold">
                                            Tiết kiệm {savingsPercent}% ({formatPrice(savingsAmount)})
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-full transition"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {/* Price Comparison Table */}
                    <div className="mb-8">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            🛒 So Sánh Giá Từ {sources.length} Nguồn
                        </h3>

                        <div className="space-y-3">
                            {sources
                                .sort((a, b) => a.price - b.price)
                                .map((source, idx) => (
                                    <div
                                        key={source.sourceId}
                                        className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all
                      ${idx === 0
                                                ? 'border-green-500 bg-green-50'
                                                : source.available
                                                    ? 'border-gray-200 hover:border-blue-300'
                                                    : 'border-gray-100 bg-gray-50 opacity-60'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Rank */}
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                        ${idx === 0 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                                {idx + 1}
                                            </div>

                                            {/* Source Info */}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-gray-800">{source.sourceName}</span>
                                                    {idx === 0 && (
                                                        <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                                                            Giá tốt nhất
                                                        </span>
                                                    )}
                                                    {!source.available && (
                                                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                            <AlertTriangle className="w-3 h-3" />
                                                            Hết hàng
                                                        </span>
                                                    )}
                                                </div>
                                                {source.rating && (
                                                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                                                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                                        <span>{source.rating.toFixed(1)}</span>
                                                        <span>({source.reviewCount} đánh giá)</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Price & Actions */}
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="text-xl font-bold text-gray-800">{formatPrice(source.price)}</div>
                                                {source.originalPrice && source.originalPrice > source.price && (
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="line-through text-gray-400">
                                                            {formatPrice(source.originalPrice)}
                                                        </span>
                                                        <span className="text-red-500 font-semibold">-{source.discountPercent}%</span>
                                                    </div>
                                                )}
                                                {idx > 0 && source.price > lowestPrice && (
                                                    <div className="text-sm text-red-500 flex items-center gap-1 justify-end">
                                                        <TrendingUp className="w-3 h-3" />
                                                        +{formatPrice(source.price - lowestPrice)}
                                                    </div>
                                                )}
                                                {idx === 0 && (
                                                    <div className="text-sm text-green-600 flex items-center gap-1 justify-end">
                                                        <TrendingDown className="w-3 h-3" />
                                                        Giá thấp nhất
                                                    </div>
                                                )}
                                                {source.available ? (
                                                    <div className="text-[10px] text-blue-500 flex items-center gap-1 justify-end uppercase font-bold tracking-tighter mt-1">
                                                        <Check className="w-3 h-3" /> Sẵn hàng
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] text-gray-400 flex items-center gap-1 justify-end uppercase font-bold tracking-tighter mt-1">
                                                        <Minus className="w-3 h-3" /> Hết hàng
                                                    </div>
                                                )}
                                            </div>

                                            {source.externalUrl && source.available && (
                                                <a
                                                    href={source.externalUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 
                                   text-white rounded-lg font-semibold transition-colors"
                                                >
                                                    <span>Mua ngay</span>
                                                    <ExternalLink className="w-4 h-4" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>

                    {/* Price History Chart */}
                    {mergedChartData.length > 0 && (
                        <div className="bg-gray-50 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    📊 Lịch Sử Giá
                                </h3>
                                <div className="flex gap-2">
                                    {([7, 30, 90] as const).map((days) => (
                                        <button
                                            key={days}
                                            onClick={() => setSelectedDays(days)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                        ${selectedDays === days
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-white text-gray-600 hover:bg-gray-100'
                                                }`}
                                        >
                                            {days} ngày
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={mergedChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                    <YAxis
                                        tick={{ fontSize: 12 }}
                                        tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                                    />
                                    <Tooltip
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        formatter={(value: any) => [formatPrice(value), '']}
                                        labelFormatter={(label) => `Ngày ${label}`}
                                    />
                                    <Legend />
                                    {sources.slice(0, 5).map((source, idx) => (
                                        <Line
                                            key={source.sourceId}
                                            type="monotone"
                                            dataKey={source.sourceName}
                                            stroke={sourceColors[idx]}
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{ r: 6 }}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
