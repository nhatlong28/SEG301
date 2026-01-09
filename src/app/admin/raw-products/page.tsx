'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Search, ExternalLink, Star, Package, Filter, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

interface RawProduct {
    id: number;
    external_id: string;
    external_url: string;
    name: string;
    price: number;
    original_price?: number;
    discount_percent?: number;
    brand_raw?: string;
    category_raw?: string;
    image_url?: string;
    rating?: number;
    review_count: number;
    sold_count: number;
    available: boolean;
    source_id: number;
    updated_at: string;
    sources?: {
        name: string;
        type: string;
    };
    product_mappings?: Array<{
        canonical_id: number;
        canonical_products?: {
            name: string;
        };
    }>;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const SOURCE_COLORS: Record<string, string> = {
    shopee: 'bg-orange-500',
    tiki: 'bg-blue-500',
    lazada: 'bg-purple-500',
    cellphones: 'bg-red-500',
    dienmayxanh: 'bg-green-500',
};

export default function RawProductsPage() {
    const [products, setProducts] = useState<RawProduct[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [sources, setSources] = useState<{ id: number; name: string; type: string }[]>([]);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: '20',
            });
            if (search) params.append('search', search);
            if (sourceFilter) params.append('source', sourceFilter);

            const res = await fetch(`/api/admin/raw-products?${params}`);
            const data = await res.json();

            setProducts(data.products || []);
            setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
        } catch (error) {
            toast.error('Không thể tải dữ liệu sản phẩm');
        } finally {
            setLoading(false);
        }
    }, [pagination.page, search, sourceFilter]);

    const fetchSources = async () => {
        try {
            const res = await fetch('/api/admin/stats');
            const data = await res.json();
            setSources(data.sources || []);
        } catch (error) {
            console.error('Failed to fetch sources');
        }
    };

    useEffect(() => {
        fetchSources();
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

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('vi-VN');
    };

    return (
        <div className="min-h-screen bg-[#0a0f1d] text-slate-200 p-6">
            <Toaster position="top-right" />

            {/* Header */}
            <header className="max-w-7xl mx-auto mb-8">
                <Link href="/admin" className="inline-flex items-center text-slate-400 hover:text-white mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại Dashboard
                </Link>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                    Sản phẩm thô (Raw Products)
                </h1>
                <p className="text-slate-400 mt-2">
                    Dữ liệu gốc từ các sàn TMĐT - {pagination.total.toLocaleString()} sản phẩm
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
                            className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </form>
                    <div className="flex items-center gap-2">
                        <Filter className="text-slate-500" />
                        <select
                            value={sourceFilter}
                            onChange={(e) => {
                                setSourceFilter(e.target.value);
                                setPagination(p => ({ ...p, page: 1 }));
                            }}
                            className="px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Tất cả nguồn</option>
                            {sources.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Products Grid */}
            <div className="max-w-7xl mx-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                    </div>
                ) : products.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                        <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p>Không tìm thấy sản phẩm nào</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {products.map((product) => (
                            <Link
                                key={product.id}
                                href={`/admin/raw-products/${product.id}`}
                                className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden hover:border-blue-500/50 transition-all group"
                            >
                                {/* Image */}
                                <div className="relative h-48 bg-slate-800">
                                    {product.image_url ? (
                                        <Image
                                            src={product.image_url}
                                            alt={product.name}
                                            fill
                                            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                                            className="object-cover group-hover:scale-105 transition-transform"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full">
                                            <Package className="w-12 h-12 text-slate-600" />
                                        </div>
                                    )}
                                    {/* Source Badge */}
                                    <span className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-bold text-white ${SOURCE_COLORS[product.sources?.type || ''] || 'bg-slate-600'}`}>
                                        {product.sources?.name || 'Unknown'}
                                    </span>

                                    {/* Mapping Status */}
                                    {product.product_mappings && product.product_mappings.length > 0 && (
                                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-emerald-500/90 text-white text-[10px] font-bold rounded-md flex items-center gap-1 backdrop-blur-sm">
                                            <Layers className="w-3 h-3" />
                                            ĐÃ CHUẨN HÓA
                                        </div>
                                    )}

                                    {/* Discount */}
                                    {product.discount_percent && product.discount_percent > 0 && (
                                        <span className="absolute top-2 right-2 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg">
                                            -{product.discount_percent}%
                                        </span>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="p-4">
                                    <h3 className="font-medium text-sm line-clamp-2 mb-2 group-hover:text-blue-400 transition-colors">
                                        {product.name}
                                    </h3>
                                    <div className="flex items-baseline gap-2 mb-2">
                                        <span className="text-lg font-bold text-emerald-400">
                                            {formatPrice(product.price)}
                                        </span>
                                        {product.original_price && product.original_price > product.price && (
                                            <span className="text-sm text-slate-500 line-through">
                                                {formatPrice(product.original_price)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                        <div className="flex items-center gap-1">
                                            {product.rating && (
                                                <>
                                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                                    <span>{product.rating.toFixed(1)}</span>
                                                </>
                                            )}
                                            <span>({product.review_count})</span>
                                        </div>
                                        <span>{product.sold_count.toLocaleString()} đã bán</span>
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-slate-800 text-xs text-slate-500">
                                        Cập nhật: {formatDate(product.updated_at)}
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
