'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TrendingUp, Tag, Flame } from 'lucide-react';

interface Product {
    id: number;
    name: string;
    min_price: number;
    source_count: number;
    image_url?: string;
    brands?: { name: string };
}

interface Deal {
    id: number;
    name: string;
    price: number;
    original_price: number;
    discount_percent: number;
    image_url?: string;
}

interface Category {
    id: number;
    name: string;
    icon?: string;
    count?: number;
}

export function HomepageFeaturesSection() {
    const [popularProducts, setPopularProducts] = useState<Product[]>([]);
    const [deals, setDeals] = useState<Deal[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/homepage');
                const data = await res.json();
                setPopularProducts(data.popularProducts || []);
                setDeals(data.deals || []);
                setCategories(data.categories || []);
            } catch (error) {
                console.error('Failed to fetch homepage data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0,
        }).format(price);
    };

    if (loading) {
        return null;
    }

    const SafeImage = ({ src, alt, className }: { src?: string; alt: string; className?: string }) => {
        const [isError, setIsError] = useState(false);
        const fallback = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWUxZTFlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iNDAiIGZpbGw9IiM0NDQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';

        return (
            <Image
                src={isError || !src ? fallback : src}
                alt={alt}
                width={200}
                height={200}
                unoptimized
                onError={() => setIsError(true)}
                className={className}
            />
        );
    };

    return (
        <>
            {/* Categories Section */}
            {categories.length > 0 && (
                <section className="dashboard-section">
                    <div className="section-header">
                        <span className="text-4xl">📁</span>
                        <h2>Danh Mục Sản Phẩm</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {categories.map((cat) => (
                            <Link
                                key={cat.id}
                                href={`/?q=${encodeURIComponent(cat.name)}`}
                                className="flex flex-col items-center gap-3 p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-all group"
                            >
                                <span className="text-4xl">{cat.icon || '📦'}</span>
                                <div className="text-center">
                                    <p className="font-semibold text-slate-200 group-hover:text-blue-400 transition text-sm">
                                        {cat.name}
                                    </p>
                                    <p className="text-xs text-slate-500">{cat.count || 0} SP</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Deals Section */}
            {deals.length > 0 && (
                <section className="dashboard-section">
                    <div className="section-header">
                        <Flame className="text-red-500" size={32} />
                        <h2>🏷️ Giảm Giá Sốc Hôm Nay</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {deals.slice(0, 10).map((deal) => (
                            <Link
                                key={deal.id}
                                href={`/products/${deal.id}?raw=true`}
                                className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden hover:border-red-500/50 transition-all group block shadow-lg shadow-black/20"
                            >
                                <div className="relative aspect-square bg-slate-900/80 p-4">
                                    <SafeImage
                                        src={deal.image_url}
                                        alt={deal.name}
                                        className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                                    />
                                    <span className="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                                        <Tag size={12} />
                                        -{deal.discount_percent}%
                                    </span>
                                </div>
                                <div className="p-4">
                                    <h3 className="font-bold text-white line-clamp-2 mb-2 text-sm group-hover:text-red-400 transition min-h-[40px]">
                                        {deal.name}
                                    </h3>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xl font-black text-red-500">
                                            {formatPrice(deal.price)}
                                        </span>
                                        <span className="text-xs text-slate-400 line-through">
                                            {formatPrice(deal.original_price)}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Popular Products Section */}
            {popularProducts.length > 0 && (
                <section className="dashboard-section">
                    <div className="section-header">
                        <TrendingUp className="text-emerald-500" size={32} />
                        <h2>🔥 Sản Phẩm Phổ Biến</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {popularProducts.slice(0, 10).map((product) => (
                            <Link
                                key={product.id}
                                href={`/products/${product.id}`}
                                className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden hover:border-emerald-500/50 transition-all group"
                            >
                                <div className="aspect-square bg-slate-900/80 p-4">
                                    <SafeImage
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                                    />
                                </div>
                                <div className="p-4">
                                    {product.brands?.name && (
                                        <p className="text-xs text-blue-400 font-bold mb-1">
                                            {product.brands.name}
                                        </p>
                                    )}
                                    <h3 className="font-bold text-white line-clamp-2 mb-2 text-sm group-hover:text-emerald-400 transition">
                                        {product.name}
                                    </h3>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-xl font-black text-emerald-400">
                                            {formatPrice(product.min_price)}
                                        </span>
                                        <span className="text-xs text-slate-300 font-medium">
                                            / {product.source_count} nguồn
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </>
    );
}
