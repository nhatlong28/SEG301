'use client';

import { Star, ShoppingCart, ExternalLink, TrendingDown, Layers, Sparkles } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface ProductCardProps {
    product: {
        id: number;
        name: string;
        slug: string;
        brand: string | null;
        category?: string | null;
        imageUrl: string | null;
        minPrice: number | null;
        maxPrice: number | null;
        avgRating: number | null;
        totalReviews: number;
        sourceCount: number;
        sources: Array<{
            sourceName: string;
            price: number;
            available: boolean;
            discountPercent?: number;
        }>;
        relevanceScore?: number;
        matchType?: 'exact' | 'semantic' | 'hybrid';
    };
    onClick?: () => void;
    variant?: 'default' | 'compact' | 'list';
}

const SOURCE_COLORS: Record<string, string> = {
    'Shopee': 'bg-orange-100 text-orange-700',
    'Tiki': 'bg-blue-100 text-blue-700',
    'Lazada': 'bg-purple-100 text-purple-700',
    'CellphoneS': 'bg-red-100 text-red-700',
    'Điện Máy Xanh': 'bg-green-100 text-green-700',
};

export default function ProductCard({ product, onClick, variant = 'default' }: ProductCardProps) {
    const formatPrice = (price: number | null) => {
        if (!price) return 'N/A';
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0,
        }).format(price);
    };

    const savingsPercent = product.minPrice && product.maxPrice && product.maxPrice > product.minPrice
        ? Math.round(((product.maxPrice - product.minPrice) / product.maxPrice) * 100)
        : 0;

    const lowestSource = product.sources?.length > 0 ? product.sources[0] : null;

    // Get the best discount from any source
    const bestDiscount = product.sources?.reduce((max, s) =>
        Math.max(max, s.discountPercent || 0), 0);

    if (variant === 'list') {
        return (
            <div
                onClick={onClick}
                className="group bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all 
                     cursor-pointer border border-gray-100 hover:border-blue-200 p-4 flex gap-4"
            >
                {/* Image */}
                <div className="relative w-32 h-32 flex-shrink-0 bg-slate-900 rounded-xl overflow-hidden">
                    <Image
                        src={product.imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWUxZTFlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iNDAiIGZpbGw9IiM0NDQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4='}
                        alt={product.name}
                        fill
                        unoptimized
                        className="object-contain p-2"
                    />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            {product.brand && (
                                <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
                                    {product.brand}
                                </p>
                            )}
                            <h3 className="font-semibold text-gray-800 line-clamp-2 group-hover:text-blue-600 transition-colors">
                                {product.name}
                            </h3>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <span className="text-xl font-bold text-green-600">
                                {formatPrice(product.minPrice)}
                            </span>
                            {savingsPercent > 5 && (
                                <p className="text-xs text-red-500 flex items-center justify-end gap-1">
                                    <TrendingDown className="w-3 h-3" />
                                    Tiết kiệm {savingsPercent}%
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Sources */}
                    <div className="flex flex-wrap gap-2 mt-3">
                        {product.sources.slice(0, 5).map((source, idx) => (
                            <span
                                key={idx}
                                className={`px-2 py-0.5 text-xs font-medium rounded-full ${SOURCE_COLORS[source.sourceName] || 'bg-gray-100 text-gray-600'}`}
                            >
                                {source.sourceName}: {formatPrice(source.price)}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={onClick}
            className="group bg-slate-800/80 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 
                 cursor-pointer overflow-hidden border border-slate-700 hover:border-blue-500/50"
        >
            {/* Image */}
            <div className="relative aspect-square bg-slate-900/50 overflow-hidden">
                <Image
                    src={product.imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWUxZTFlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iNDAiIGZpbGw9IiM0NDQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4='}
                    alt={product.name}
                    width={500}
                    height={500}
                    unoptimized
                    className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                />

                {/* Savings Badge */}
                {(savingsPercent > 5 || bestDiscount > 5) && (
                    <div className="absolute top-3 left-3 bg-gradient-to-r from-red-500 to-orange-500 
                          text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-lg flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" />
                        {savingsPercent > bestDiscount ? `${savingsPercent}%` : `-${bestDiscount}%`}
                    </div>
                )}

                {/* Source Count Badge */}
                <div className="absolute top-3 right-3 bg-blue-600 text-white px-2 py-1 
                        rounded-lg text-xs font-semibold flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {product.sourceCount} nguồn
                </div>

                {/* Match Type Badge */}
                {product.matchType === 'semantic' && (
                    <div className="absolute bottom-3 left-3 bg-purple-600/90 text-white px-2 py-1 
                            rounded-lg text-xs font-medium flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        AI Match
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                {/* Brand & Category */}
                <div className="flex items-center gap-2 mb-1">
                    {product.brand && (
                        <span className="text-xs text-blue-400 font-semibold uppercase tracking-wide">
                            {product.brand}
                        </span>
                    )}
                    {product.category && (
                        <span className="text-xs text-slate-400">• {product.category}</span>
                    )}
                </div>

                {/* Name */}
                <h3 className="font-semibold text-slate-100 line-clamp-2 mb-3 min-h-[2.5rem] 
                       group-hover:text-blue-400 transition-colors">
                    {product.name}
                </h3>

                {/* Price */}
                <div className="mb-3">
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-emerald-400">
                            {formatPrice(product.minPrice)}
                        </span>
                        {product.maxPrice && product.maxPrice > (product.minPrice || 0) && (
                            <span className="text-sm text-slate-500 line-through">
                                {formatPrice(product.maxPrice)}
                            </span>
                        )}
                    </div>
                    {lowestSource && (
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                            🏆 Giá tốt nhất tại <span className="font-medium text-blue-400">{lowestSource.sourceName}</span>
                        </p>
                    )}
                </div>

                {/* Rating */}
                {product.avgRating && product.avgRating > 0 && (
                    <div className="flex items-center gap-2 mb-4">
                        <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                                <Star
                                    key={i}
                                    className={`w-4 h-4 ${i < Math.round(product.avgRating || 0)
                                        ? 'text-yellow-400 fill-yellow-400'
                                        : 'text-slate-600'
                                        }`}
                                />
                            ))}
                        </div>
                        <span className="text-sm text-slate-400">
                            {product.avgRating?.toFixed(1)} ({product.totalReviews.toLocaleString()})
                        </span>
                    </div>
                )}

                {/* Source Prices Preview */}
                <div className="space-y-1.5 mb-4">
                    {product.sources?.slice(0, 3).map((source, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                            <span className={`flex items-center gap-1 ${source.available ? 'text-slate-300' : 'text-slate-500'}`}>
                                <span className={`w-2 h-2 rounded-full ${source.available ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                                {source.sourceName}
                            </span>
                            <span className={`font-semibold ${idx === 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                                {formatPrice(source.price)}
                            </span>
                        </div>
                    ))}
                    {product.sources?.length > 3 && (
                        <p className="text-xs text-slate-500 text-center">
                            +{product.sources.length - 3} nguồn khác
                        </p>
                    )}
                </div>

                {/* CTA Button */}
                <Link href={`/products/${product.id}`}>
                    <button className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 
                             hover:from-blue-700 hover:to-blue-800 
                             text-white font-semibold rounded-xl 
                             transition-all duration-200 flex items-center justify-center gap-2
                             shadow-md hover:shadow-lg active:scale-[0.98]">
                        <span>So Sánh Giá</span>
                        <ExternalLink className="w-4 h-4" />
                    </button>
                </Link>
            </div>
        </div>
    );
}
