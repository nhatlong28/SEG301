'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Search, Star, Package, Filter, ChevronLeft, ChevronRight, Layers, TrendingDown } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

interface CanonicalProduct {
    id: number;
    name: string;
    slug: string;
    image_url?: string;
    min_price?: number;
    max_price?: number;
    avg_rating?: number;
    total_reviews: number;
    source_count: number;
    quality_score?: number;
    brands?: { id: number; name: string };
    categories?: { id: number; name: string };
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function CanonicalProductsPage() {
    const [products, setProducts] = useState<CanonicalProduct[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [brands, setBrands] = useState<{ id: number; name: string }[]>([]);
    const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
    const [brandFilter, setBrandFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: '20',
            });
            if (search) params.append('search', search);
            if (brandFilter) params.append('brand', brandFilter);
            if (categoryFilter) params.append('category', categoryFilter);

            const res = await fetch(`/api/admin/canonical-products?${params}`);
            const data = await res.json();

            setProducts(data.products || []);
            setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
        } catch (error) {
            toast.error('Không thể tải dữ liệu sản phẩm');
        } finally {
            setLoading(false);
        }
    }, [pagination.page, search, brandFilter, categoryFilter]);

    const fetchFilters = async () => {
        try {
            const res = await fetch('/api/admin/stats');
            const data = await res.json();
            setBrands(data.brands || []);
            setCategories(data.categories || []);
        } catch (error) {
            console.error('Failed to fetch filters');
        }
    };

    useEffect(() => {
        fetchFilters();
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPagination(p => ({ ...p, page: 1 }));
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    };

    return (
        <div className="min-h-screen bg-[#0a0f1d] text-slate-200 p-6">
            <Toaster position="top-right" />

            {/* Header */}
            <header className="max-w-7xl mx-auto mb-8">
                <Link href="/admin" className="inline-flex items-center text-slate-400 hover:text-white mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại Dashboard
                </Link>
                <div className="flex items-center gap-3">
                    <Layers className="w-8 h-8 text-emerald-400" />
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                        Sản phẩm đã gộp (Canonical Products)
                    </h1>
                </div>
                <p className="text-slate-400 mt-2">
                    Sản phẩm đã được chuẩn hóa và gộp từ nhiều nguồn - {pagination.total.toLocaleString()} sản phẩm
                </p>
            </header>

            {/* Filters */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <form onSubmit={handleSearch} className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm sản phẩm..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </form>
                    <div className="flex items-center gap-2">
                        <Filter className="text-slate-500" />
                        <select
                            value={brandFilter}
                            onChange={(e) => {
                                setBrandFilter(e.target.value);
                                setPagination(p => ({ ...p, page: 1 }));
                            }}
                            className="px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl focus:outline-none"
                        >
                            <option value="">Tất cả thương hiệu</option>
                            {brands.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                        <select
                            value={categoryFilter}
                            onChange={(e) => {
                                setCategoryFilter(e.target.value);
                                setPagination(p => ({ ...p, page: 1 }));
                            }}
                            className="px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl focus:outline-none"
                        >
                            <option value="">Tất cả danh mục</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Products Grid */}
            <div className="max-w-7xl mx-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
                    </div>
                ) : products.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                        <Layers className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p>Chưa có sản phẩm nào được gộp</p>
                        <p className="text-sm mt-2">Hãy chạy quá trình chuẩn hóa & gộp từ trang Admin</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {products.map((product) => (
                            <Link
                                key={product.id}
                                href={`/admin/canonical-products/${product.id}`}
                                className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden hover:border-emerald-500/50 transition-all group"
                            >
                                {/* Image */}
                                <div className="relative h-48 bg-slate-800">
                                    {product.image_url ? (
                                        <Image
                                            src={product.image_url}
                                            alt={product.name}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full">
                                            <Package className="w-12 h-12 text-slate-600" />
                                        </div>
                                    )}
                                    {/* Source Count Badge */}
                                    <span className="absolute top-2 right-2 px-2 py-1 bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                                        <Layers className="w-3 h-3" />
                                        {product.source_count} nguồn
                                    </span>
                                </div>

                                {/* Info */}
                                <div className="p-4">
                                    {/* Brand & Category */}
                                    <div className="flex items-center gap-2 mb-2 text-xs">
                                        {product.brands?.name && (
                                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                                                {product.brands.name}
                                            </span>
                                        )}
                                        {product.categories?.name && (
                                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
                                                {product.categories.name}
                                            </span>
                                        )}
                                    </div>

                                    <h3 className="font-medium text-sm line-clamp-2 mb-2 group-hover:text-emerald-400 transition-colors">
                                        {product.name}
                                    </h3>

                                    {/* Price Range */}
                                    <div className="flex items-center gap-2 mb-2">
                                        {product.min_price && product.max_price ? (
                                            product.min_price === product.max_price ? (
                                                <span className="text-lg font-bold text-emerald-400">
                                                    {formatPrice(product.min_price)}
                                                </span>
                                            ) : (
                                                <>
                                                    <span className="text-lg font-bold text-emerald-400">
                                                        {formatPrice(product.min_price)}
                                                    </span>
                                                    <span className="text-slate-500">-</span>
                                                    <span className="text-sm text-slate-400">
                                                        {formatPrice(product.max_price)}
                                                    </span>
                                                </>
                                            )
                                        ) : (
                                            <span className="text-slate-500">Chưa có giá</span>
                                        )}
                                    </div>

                                    {/* Stats */}
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                        <div className="flex items-center gap-1">
                                            {product.avg_rating && (
                                                <>
                                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                                    <span>{product.avg_rating.toFixed(1)}</span>
                                                </>
                                            )}
                                            <span>({product.total_reviews})</span>
                                        </div>
                                        {product.quality_score && (
                                            <span className="text-emerald-400">
                                                Score: {(product.quality_score * 100).toFixed(0)}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8">
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                            disabled={pagination.page === 1}
                            className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="px-4 py-2 bg-slate-800 rounded-lg">
                            Trang {pagination.page} / {pagination.totalPages}
                        </span>
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                            disabled={pagination.page === pagination.totalPages}
                            className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
