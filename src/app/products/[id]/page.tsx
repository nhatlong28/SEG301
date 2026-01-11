'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Star, ExternalLink, Heart, Bell, Share2,
    TrendingDown, TrendingUp, ChevronDown, ChevronUp, Check
} from 'lucide-react';
import PriceComparison from '@/components/products/PriceComparison';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import Image from 'next/image';
import { useCallback } from 'react';

interface ProductData {
    product: {
        id: number;
        name: string;
        slug: string;
        description: string;
        imageUrl: string;
        images: string[];
        specs: Record<string, string>;
        brand: { id: number; name: string } | null;
        category: { id: number; name: string } | null;
        minPrice: number;
        maxPrice: number;
        avgRating: number;
        totalReviews: number;
        sourceCount: number;
    };
    sources: Array<{
        sourceId: number;
        sourceName: string;
        price: number;
        originalPrice?: number;
        discountPercent?: number;
        available: boolean;
        externalUrl?: string;
        rating?: number;
        reviewCount?: number;
    }>;
    priceHistory: Record<number, Array<{ date: string; price: number }>>;
    reviews: Array<{
        id: number;
        author: string;
        rating: number;
        content: string;
        images?: string[];
        verified_purchase: boolean;
        review_date: string;
        sources: { name: string };
    }>;
    reviewStats: {
        total: number;
        average: number;
        distribution: number[];
        sentiment: { positive: number; negative: number; neutral: number };
    };
}

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const productId = params.id as string;

    const [data, setData] = useState<ProductData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAllSpecs, setShowAllSpecs] = useState(false);
    const [showComparison, setShowComparison] = useState(false);
    const [selectedImage, setSelectedImage] = useState(0);

    const fetchProduct = useCallback(async () => {
        try {
            const searchParams = new URLSearchParams(window.location.search);
            const isRaw = searchParams.get('raw') === 'true';
            const apiEndpoint = isRaw ? `/api/products/raw/${productId}` : `/api/products/${productId}`;

            const response = await fetch(apiEndpoint);
            if (!response.ok) throw new Error('Product not found');
            const result = await response.json();
            setData(result);
        } catch (error) {
            console.error('Error fetching product:', error);
        } finally {
            setLoading(false);
        }
    }, [productId]);

    useEffect(() => {
        if (productId) {
            fetchProduct();
        }
    }, [productId, fetchProduct]);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0,
        }).format(price);
    };

    const SafeImage = ({ src, alt, className, width = 500, height = 500 }: { src?: string; alt: string; className?: string; width?: number; height?: number }) => {
        const [isError, setIsError] = useState(false);
        const fallback = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWUxZTFlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iNDAiIGZpbGw9IiM0NDQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';

        return (
            <Image
                src={isError || !src ? fallback : src}
                alt={alt}
                width={width}
                height={height}
                unoptimized
                onError={() => setIsError(true)}
                className={className}
            />
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center">
                <p className="text-6xl mb-4">😕</p>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Không tìm thấy sản phẩm</h1>
                <Link href="/" className="text-blue-600 hover:underline">Quay về trang chủ</Link>
            </div>
        );
    }

    const { product, sources, priceHistory, reviews, reviewStats } = data;
    const lowestSource = sources[0];
    const savingsPercent = product.maxPrice && product.minPrice
        ? Math.round(((product.maxPrice - product.minPrice) / product.maxPrice) * 100)
        : 0;

    const images = product.images?.length > 0 ? product.images : [product.imageUrl];
    const specs = product.specs || {};
    const specEntries = Object.entries(specs);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <Link href="/" className="text-xl font-bold text-blue-600">🛍️ PriceSpider</Link>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                    <Link href="/" className="hover:text-blue-600">Trang chủ</Link>
                    <span>/</span>
                    {product.category && (
                        <>
                            <Link href={`/search?q=${product.category.name}`} className="hover:text-blue-600">
                                {product.category.name}
                            </Link>
                            <span>/</span>
                        </>
                    )}
                    <span className="text-gray-800">{product.name}</span>
                </nav>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                    {/* Images */}
                    <div className="space-y-4">
                        <div className="aspect-square bg-white rounded-2xl shadow-sm p-6 flex items-center justify-center overflow-hidden">
                            <SafeImage
                                src={images[selectedImage]}
                                alt={product.name}
                                className="max-w-full max-h-full object-contain"
                            />
                        </div>
                        {images.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto">
                                {images.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedImage(idx)}
                                        className={`w-20 h-20 rounded-lg border-2 overflow-hidden flex-shrink-0
                      ${selectedImage === idx ? 'border-blue-600' : 'border-gray-200'}`}
                                    >
                                        <SafeImage
                                            src={img}
                                            alt=""
                                            width={80}
                                            height={80}
                                            className="w-full h-full object-contain"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Product Info */}
                    <div className="space-y-6">
                        {/* Brand & Name */}
                        <div>
                            {product.brand && (
                                <p className="text-sm text-blue-600 font-semibold uppercase tracking-wide">
                                    {product.brand.name}
                                </p>
                            )}
                            <h1 className="text-3xl font-bold text-gray-800 mt-1">{product.name}</h1>
                        </div>

                        {/* Rating */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                    <Star
                                        key={i}
                                        className={`w-5 h-5 ${i < Math.round(product.avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'
                                            }`}
                                    />
                                ))}
                                <span className="ml-2 font-semibold">{product.avgRating?.toFixed(1)}</span>
                            </div>
                            <span className="text-gray-500">({product.totalReviews} đánh giá)</span>
                            <span className="text-gray-400">|</span>
                            <span className="text-green-600 font-semibold">{product.sourceCount} nguồn</span>
                        </div>

                        {/* Price */}
                        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-6">
                            <div className="flex items-baseline gap-4">
                                <span className="text-4xl font-bold text-green-600">{formatPrice(product.minPrice)}</span>
                                {savingsPercent > 0 && (
                                    <span className="text-sm text-gray-500">
                                        đến <span className="line-through">{formatPrice(product.maxPrice)}</span>
                                    </span>
                                )}
                            </div>
                            {savingsPercent > 5 && (
                                <div className="flex items-center gap-2 mt-2">
                                    <TrendingDown className="w-5 h-5 text-green-600" />
                                    <span className="text-green-600 font-semibold">
                                        Tiết kiệm đến {savingsPercent}% ({formatPrice(product.maxPrice - product.minPrice)})
                                    </span>
                                </div>
                            )}
                            <p className="text-gray-500 text-sm mt-2">
                                Giá tốt nhất tại <span className="font-semibold text-gray-700">{lowestSource?.sourceName}</span>
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowComparison(true)}
                                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold 
                         rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                So Sánh Giá Chi Tiết
                            </button>
                            <button className="p-4 border-2 border-gray-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition">
                                <Heart className="w-6 h-6 text-gray-600 hover:text-red-500" />
                            </button>
                            <button className="p-4 border-2 border-gray-200 rounded-xl hover:border-yellow-500 hover:bg-yellow-50 transition">
                                <Bell className="w-6 h-6 text-gray-600 hover:text-yellow-500" />
                            </button>
                            <button className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition">
                                <Share2 className="w-6 h-6 text-gray-600 hover:text-blue-500" />
                            </button>
                        </div>

                        {/* Quick Sources */}
                        <div className="bg-white rounded-2xl border p-4">
                            <h3 className="font-bold text-gray-800 mb-3">🛒 Giá từ các nguồn</h3>
                            <div className="space-y-2">
                                {sources.slice(0, 4).map((source, idx) => (
                                    <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                                        <div className="flex items-center gap-2">
                                            {idx === 0 && <span className="text-green-600">🏆</span>}
                                            <span className={source.available ? 'text-gray-700' : 'text-gray-400'}>
                                                {source.sourceName}
                                            </span>
                                            {!source.available && (
                                                <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">Hết hàng</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`font-bold ${idx === 0 ? 'text-green-600' : 'text-gray-700'}`}>
                                                {formatPrice(source.price)}
                                            </span>
                                            {source.externalUrl && source.available && (
                                                <a
                                                    href={source.externalUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:text-blue-700"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Specifications */}
                {specEntries.length > 0 && (
                    <section className="bg-white rounded-2xl shadow-sm p-6 mb-8">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <span>📋 Thông Số Kỹ Thuật</span>
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(showAllSpecs ? specEntries : specEntries.slice(0, 8)).map(([key, value]) => (
                                <div key={key} className="flex border-b py-2 text-sm">
                                    <span className="w-1/2 text-gray-500">{key}</span>
                                    <span className="w-1/2 text-gray-800 font-medium">{value}</span>
                                </div>
                            ))}
                        </div>
                        {specEntries.length > 8 && (
                            <button
                                onClick={() => setShowAllSpecs(!showAllSpecs)}
                                className="mt-4 text-blue-600 hover:underline flex items-center gap-1 text-sm font-medium"
                            >
                                {showAllSpecs ? 'Thu gọn' : `Xem thêm ${specEntries.length - 8} thông số`}
                                {showAllSpecs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                        )}
                    </section>
                )}

                {/* Price History Chart */}
                {Object.keys(priceHistory).length > 0 && (
                    <section className="bg-white rounded-2xl shadow-sm p-6 mb-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <TrendingUp className="w-6 h-6 text-blue-600" />
                                Biến Động Giá
                            </h2>
                        </div>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={
                                    Object.entries(priceHistory).flatMap(([sourceId, history]) => {
                                        const sourceName = sources.find(s => String(s.sourceId) === sourceId)?.sourceName || 'Nguồn khác';
                                        return history.map(h => ({
                                            date: new Date(h.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
                                            [sourceName]: h.price,
                                            price: h.price,
                                            source: sourceName
                                        }));
                                    }).reduce((acc: Record<string, string | number>[], current) => {
                                        const existing = acc.find(a => a.date === current.date);
                                        if (existing) {
                                            existing[current.source] = current.price;
                                        } else {
                                            const newItem: Record<string, string | number> = { date: current.date as string };
                                            newItem[current.source] = current.price;
                                            acc.push(newItem);
                                        }
                                        return acc;
                                    }, []).sort((a, b) => {
                                        const [d1, m1] = (a.date as string).split('/');
                                        const [d2, m2] = (b.date as string).split('/');
                                        return new Date(2024, Number(m1) - 1, Number(d1)).getTime() - new Date(2024, Number(m2) - 1, Number(d2)).getTime();
                                    })
                                }>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                                        tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        formatter={(val: any) => [formatPrice(val), 'Giá']}
                                    />
                                    <Legend iconType="circle" />
                                    {sources.slice(0, 3).map((source, idx) => (
                                        <Line
                                            key={source.sourceId}
                                            type="monotone"
                                            dataKey={source.sourceName}
                                            stroke={['#3b82f6', '#10b981', '#f59e0b'][idx]}
                                            strokeWidth={3}
                                            dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                            activeDot={{ r: 6, strokeWidth: 0 }}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </section>
                )}

                {/* Reviews */}
                <section className="bg-white rounded-2xl shadow-sm p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-6">⭐ Đánh Giá Từ Khách Hàng</h2>

                    {/* Review Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-6 bg-gray-50 rounded-xl">
                        <div className="text-center">
                            <p className="text-5xl font-bold text-gray-800">{reviewStats.average.toFixed(1)}</p>
                            <div className="flex justify-center my-2">
                                {[...Array(5)].map((_, i) => (
                                    <Star
                                        key={i}
                                        className={`w-5 h-5 ${i < Math.round(reviewStats.average) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'
                                            }`}
                                    />
                                ))}
                            </div>
                            <p className="text-gray-500">{reviewStats.total} đánh giá</p>
                        </div>

                        <div>
                            {[5, 4, 3, 2, 1].map((star) => (
                                <div key={star} className="flex items-center gap-2 mb-1">
                                    <span className="w-8 text-sm text-gray-600">{star}⭐</span>
                                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-yellow-400"
                                            style={{ width: `${(reviewStats.distribution[star - 1] / reviewStats.total) * 100}%` }}
                                        />
                                    </div>
                                    <span className="w-8 text-sm text-gray-500">{reviewStats.distribution[star - 1]}</span>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Tích cực</span>
                                <span className="text-green-600 font-semibold">{reviewStats.sentiment.positive}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Trung lập</span>
                                <span className="text-gray-600 font-semibold">{reviewStats.sentiment.neutral}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Tiêu cực</span>
                                <span className="text-red-600 font-semibold">{reviewStats.sentiment.negative}</span>
                            </div>
                        </div>
                    </div>

                    {/* Reviews List */}
                    <div className="space-y-4">
                        {reviews.slice(0, 10).map((review) => (
                            <div key={review.id} className="border-b pb-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                        <span className="text-blue-600 font-semibold">
                                            {review.author?.[0]?.toUpperCase() || 'U'}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-gray-800">{review.author || 'Ẩn danh'}</span>
                                            {review.verified_purchase && (
                                                <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Đã mua
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <div className="flex">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`w-3 h-3 ${i < (review.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                            <span>•</span>
                                            <span>{review.sources?.name}</span>
                                            <span>•</span>
                                            <span>{new Date(review.review_date).toLocaleDateString('vi-VN')}</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-gray-700 ml-13">{review.content}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </main>

            {/* Price Comparison Modal */}
            {showComparison && (
                <PriceComparison
                    product={{
                        id: product.id,
                        name: product.name,
                        imageUrl: product.imageUrl,
                        brand: product.brand?.name,
                    }}
                    sources={sources}
                    priceHistory={priceHistory}
                    onClose={() => setShowComparison(false)}
                />
            )}
        </div>
    );
}
