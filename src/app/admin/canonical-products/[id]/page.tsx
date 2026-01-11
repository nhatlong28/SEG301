'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Star, Package, Clock, Tag, Layers, TrendingDown, ShoppingCart, AlertCircle, Bell } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

interface SourcePrice {
    sourceId: number;
    sourceName: string;
    sourceType: string;
    rawProductId: number;
    productName: string;
    price: number;
    originalPrice?: number;
    discountPercent?: number;
    externalUrl: string;
    rating?: number;
    reviewCount?: number;
    soldCount?: number;
    available: boolean;
    updatedAt: string;
    confidence: number;
}

interface PriceHistoryItem {
    raw_product_id: number;
    price: number;
    original_price?: number;
    recorded_at: string;
}

interface CanonicalProductDetail {
    id: number;
    name: string;
    name_normalized: string;
    slug: string;
    description?: string;
    image_url?: string;
    images?: string[];
    min_price?: number;
    max_price?: number;
    avg_rating?: number;
    total_reviews: number;
    source_count: number;
    quality_score?: number;
    representative_specs?: Record<string, string>;
    brands?: { id: number; name: string };
    categories?: { id: number; name: string };
    sources: SourcePrice[];
    priceHistory: PriceHistoryItem[];
}

const SOURCE_COLORS: Record<string, string> = {
    shopee: 'bg-orange-500',
    tiki: 'bg-blue-500',
    lazada: 'bg-purple-500',
    cellphones: 'bg-red-500',
    dienmayxanh: 'bg-green-500',
};

export default function CanonicalProductDetailPage() {
    const params = useParams();
    const [product, setProduct] = useState<CanonicalProductDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const res = await fetch(`/api/admin/canonical-products/${params.id}`);
                const data = await res.json();

                if (data.error) {
                    toast.error(data.error);
                } else {
                    setProduct(data.product);
                }
            } catch (error) {
                toast.error('Không thể tải thông tin sản phẩm');
            } finally {
                setLoading(false);
            }
        };

        if (params.id) {
            fetchProduct();
        }
    }, [params.id]);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('vi-VN');
    };

    const getPriceDiff = (sourcePrice: number) => {
        if (!product?.min_price) return null;
        const diff = sourcePrice - product.min_price;
        const percent = (diff / product.min_price) * 100;
        return { diff, percent };
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0f1d] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
            </div>
        );
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-[#0a0f1d] text-slate-200 p-6">
                <div className="max-w-4xl mx-auto text-center py-20">
                    <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h1 className="text-2xl font-bold mb-2">Không tìm thấy sản phẩm</h1>
                    <Link href="/admin/canonical-products" className="text-emerald-400 hover:underline">
                        Quay lại danh sách
                    </Link>
                </div>
            </div>
        );
    }

    const lowestPrice = product.sources.length > 0 ? product.sources[0] : null;

    return (
        <div className="min-h-screen bg-[#0a0f1d] text-slate-200 p-6">
            <Toaster position="top-right" />

            <div className="max-w-6xl mx-auto">
                {/* Breadcrumb */}
                <Link href="/admin/canonical-products" className="inline-flex items-center text-slate-400 hover:text-white mb-6">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại danh sách
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left: Images */}
                    <div>
                        <div className="relative aspect-square bg-slate-800 rounded-2xl overflow-hidden">
                            {product.image_url ? (
                                <Image
                                    src={product.image_url}
                                    alt={product.name}
                                    fill
                                    className="object-contain"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <Package className="w-24 h-24 text-slate-600" />
                                </div>
                            )}
                            {/* Merged Badge */}
                            <span className="absolute top-4 left-4 px-3 py-1.5 rounded-xl text-sm font-bold text-white bg-emerald-500 flex items-center gap-2">
                                <Layers className="w-4 h-4" />
                                {product.source_count} nguồn
                            </span>
                        </div>
                    </div>

                    {/* Right: Info */}
                    <div>
                        {/* Brand & Category */}
                        <div className="flex items-center gap-2 mb-3">
                            {product.brands?.name && (
                                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                                    {product.brands.name}
                                </span>
                            )}
                            {product.categories?.name && (
                                <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm">
                                    {product.categories.name}
                                </span>
                            )}
                        </div>

                        <h1 className="text-2xl font-bold mb-4">{product.name}</h1>

                        {/* Best Price Highlight */}
                        {lowestPrice && (
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl mb-6">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-emerald-400 font-bold">🏆 Giá tốt nhất</span>
                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold text-white ${SOURCE_COLORS[lowestPrice.sourceType] || 'bg-slate-600'}`}>
                                        {lowestPrice.sourceName}
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-3xl font-bold text-emerald-400">
                                        {formatPrice(lowestPrice.price)}
                                    </span>
                                    {lowestPrice.originalPrice && lowestPrice.originalPrice > lowestPrice.price && (
                                        <>
                                            <span className="text-lg text-slate-500 line-through">
                                                {formatPrice(lowestPrice.originalPrice)}
                                            </span>
                                            <span className="px-2 py-1 bg-red-500 text-white text-sm font-bold rounded-lg">
                                                -{lowestPrice.discountPercent}%
                                            </span>
                                        </>
                                    )}
                                </div>
                                <a
                                    href={lowestPrice.externalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 mt-3 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors"
                                >
                                    <ExternalLink className="w-5 h-5" />
                                    Mua ngay tại {lowestPrice.sourceName}
                                </a>
                            </div>
                        )}

                        {/* Stats */}
                        <div className="flex flex-wrap gap-4 mb-6">
                            {product.avg_rating && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-xl">
                                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                                    <span className="font-semibold">{product.avg_rating.toFixed(1)}</span>
                                    <span className="text-slate-500">({product.total_reviews} đánh giá)</span>
                                </div>
                            )}
                            {product.quality_score && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-xl">
                                    <span className="text-emerald-400 font-semibold">
                                        Chất lượng: {(product.quality_score * 100).toFixed(0)}%
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Price Alert Button */}
                        <button className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded-xl transition-colors">
                            <Bell className="w-5 h-5" />
                            Đặt thông báo khi giảm giá
                        </button>
                    </div>
                </div>

                {/* Price Comparison Table */}
                <div className="mt-10 p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <TrendingDown className="w-6 h-6 text-blue-400" />
                        So sánh giá từ {product.sources.length} nguồn
                    </h2>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700">
                                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Nguồn</th>
                                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Giá hiện tại</th>
                                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Giá gốc</th>
                                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Chênh lệch</th>
                                    <th className="text-center py-3 px-4 text-slate-400 font-medium">Tình trạng</th>
                                    <th className="text-center py-3 px-4 text-slate-400 font-medium">Cập nhật</th>
                                    <th className="py-3 px-4"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {product.sources.map((source, idx) => {
                                    const priceDiff = getPriceDiff(source.price);
                                    const isLowest = idx === 0;

                                    return (
                                        <tr key={source.rawProductId} className={`border-b border-slate-800 ${isLowest ? 'bg-emerald-500/5' : ''}`}>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-3">
                                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold text-white ${SOURCE_COLORS[source.sourceType] || 'bg-slate-600'}`}>
                                                        {source.sourceName}
                                                    </span>
                                                    {isLowest && (
                                                        <span className="text-emerald-400 text-xs">🏆 Rẻ nhất</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <span className={`font-bold ${isLowest ? 'text-emerald-400' : 'text-white'}`}>
                                                    {formatPrice(source.price)}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                {source.originalPrice && source.originalPrice > source.price ? (
                                                    <span className="text-slate-500 line-through">
                                                        {formatPrice(source.originalPrice)}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                {priceDiff && priceDiff.diff > 0 ? (
                                                    <span className="text-red-400">
                                                        +{formatPrice(priceDiff.diff)} ({priceDiff.percent.toFixed(0)}%)
                                                    </span>
                                                ) : (
                                                    <span className="text-emerald-400">Rẻ nhất</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <span className={`px-2 py-1 rounded-lg text-xs ${source.available ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {source.available ? 'Còn hàng' : 'Hết hàng'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-center text-xs text-slate-500">
                                                {formatDate(source.updatedAt)}
                                            </td>
                                            <td className="py-4 px-4">
                                                <a
                                                    href={source.externalUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                    Xem
                                                </a>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Price History Chart Placeholder */}
                {product.priceHistory && product.priceHistory.length > 0 && (
                    <div className="mt-8 p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <TrendingDown className="w-6 h-6 text-blue-400" />
                            Biến động giá gần đây
                        </h2>
                        <div className="space-y-2">
                            {product.priceHistory.slice(0, 15).map((h, idx) => (
                                <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                                    <span className="text-slate-400 text-sm">{formatDate(h.recorded_at)}</span>
                                    <span className="font-bold text-emerald-400">{formatPrice(h.price)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Specs */}
                {product.representative_specs && Object.keys(product.representative_specs).length > 0 && (
                    <div className="mt-8 p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                        <h2 className="text-xl font-bold mb-4">Thông số kỹ thuật</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(product.representative_specs).map(([key, value]) => (
                                <div key={key} className="flex justify-between py-2 border-b border-slate-800">
                                    <span className="text-slate-400">{key}</span>
                                    <span className="font-medium">{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
