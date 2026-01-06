'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
    Search,
    Layers,
    Database,
    Filter,
    ExternalLink,
    Star,
    Package,
    ChevronLeft,
    ChevronRight,
    Loader2,
    CheckCircle2,
    AlertCircle,
    RefreshCcw
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Product {
    id: number;
    name: string;
    image_url?: string;
    price: number;
    original_price?: number;
    source_name?: string;
    source_type?: string;
    is_mapped?: boolean;
    crawled_at?: string;
    canonical_name?: string;
    external_url?: string;
    source_count?: number;
}

const SOURCE_COLORS: Record<string, string> = {
    shopee: 'bg-orange-500',
    tiki: 'bg-blue-500',
    lazada: 'bg-purple-500',
    cellphones: 'bg-red-500',
    dienmayxanh: 'bg-green-500',
};

export function DataExplorer() {
    const [view, setView] = useState<'canonical' | 'raw'>('canonical');
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [source, setSource] = useState('all');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const apiPath = view === 'canonical' ? '/api/admin/canonical-products' : '/api/admin/raw-products';
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '12',
                search: search
            });

            if (view === 'raw' && source !== 'all') {
                params.set('source', source);
            }

            const res = await fetch(`${apiPath}?${params}`);
            const data = await res.json();

            if (view === 'canonical') {
                setProducts((data.products || []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    image_url: p.image_url,
                    price: p.min_price,
                    source_count: p.source_count,
                    crawled_at: p.updated_at
                })));
            } else {
                setProducts((data.products || []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    image_url: p.image_url,
                    price: p.price,
                    original_price: p.original_price,
                    source_name: p.sources?.name,
                    source_type: p.sources?.type,
                    is_mapped: p.product_mappings?.length > 0,
                    canonical_name: p.product_mappings?.[0]?.canonical_products?.name,
                    external_url: p.external_url,
                    crawled_at: p.updated_at
                })));
            }

            setTotalPages(data.pagination?.totalPages || 1);
            setTotal(data.pagination?.total || 0);
        } catch (error) {
            console.error('Failed to fetch data explorer products:', error);
            setProducts([]);
            toast.error('Không thể tải dữ liệu. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    }, [view, page, search, source]);

    const SafeImage = ({ src, alt, className }: { src?: string; alt: string; className?: string }) => {
        const [isError, setIsError] = useState(false);
        const fallback = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWUxZTFlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iNDAiIGZpbGw9IiM0NDQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';

        if (!src && !isError) {
            return (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-20">
                    <Package size={48} />
                    <span className="text-[10px] font-bold">MISSING IMAGE</span>
                </div>
            );
        }

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

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts();
        }, 300);
        return () => clearTimeout(timer);
    }, [fetchProducts]);

    const formatPrice = (price?: number) => {
        if (!price) return 'Liên hệ';
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
    };

    const handleReset = async () => {
        if (!confirm('Bạn có chắc chắn muốn làm mới toàn bộ dữ liệu đã gộp? Hành động này sẽ xóa các bản ghi cũ và tính toán lại từ đầu.')) return;

        setLoading(true);
        try {
            const res = await fetch('/api/admin/system', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deduplicate' })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Đã bắt đầu quá trình gộp lại dữ liệu');
            } else {
                toast.error(data.error);
            }
        } catch (error) {
            toast.error('Lỗi khi gửi yêu cầu làm mới');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="dashboard-section scroll-mt-24 pt-8 border-t border-slate-800" id="data-explorer">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/20 rounded-2xl">
                        <Database className="w-8 h-8 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Khu Vực Quản Lý Dữ Liệu</h2>
                        <p className="text-slate-500 text-sm mt-1">
                            {total.toLocaleString()} {view === 'canonical' ? 'sản phẩm gộp' : 'dữ liệu thô từ sàn'} • {view === 'canonical' ? 'Đã chuẩn hóa' : 'Chờ xử lý'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-xs font-bold transition-all"
                        title="Xóa và chạy lại thuật toán gộp"
                    >
                        <RefreshCcw size={14} />
                        LÀM MỚI & GỘP LẠI
                    </button>

                    <div className="flex items-center bg-slate-900/80 p-1.5 rounded-2xl border border-slate-700/50 backdrop-blur-md">
                        <button
                            onClick={() => { setView('canonical'); setPage(1); }}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${view === 'canonical'
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <Layers className="w-4 h-4" />
                            SẢN PHẨM THỰC
                        </button>
                        <button
                            onClick={() => { setView('raw'); setPage(1); }}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${view === 'raw'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <Database className="w-4 h-4" />
                            DỮ LIỆU THÔ
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 mb-8">
                <div className="relative flex-1 group w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder={`Tìm trong ${total.toLocaleString()} ${view === 'canonical' ? 'sản phẩm đã gộp...' : 'sản phẩm thô...'}`}
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-medium"
                    />
                </div>

                {view === 'raw' && (
                    <select
                        value={source}
                        onChange={(e) => { setSource(e.target.value); setPage(1); }}
                        className="bg-slate-900/50 border border-slate-700 rounded-2xl py-3.5 px-4 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all font-medium appearance-none min-w-[150px]"
                    >
                        <option value="all">Tất cả sàn</option>
                        <option value="1">Shopee</option>
                        <option value="2">Tiki</option>
                        <option value="3">Lazada</option>
                        <option value="4">CellphoneS</option>
                        <option value="5">Điện Máy Xanh</option>
                    </select>
                )}

                <button className="p-3.5 bg-slate-800/50 border border-slate-700 rounded-2xl text-slate-400 hover:text-white transition-colors">
                    <Filter size={20} />
                </button>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                    <p className="text-slate-500 animate-pulse font-medium">Đang tải dữ liệu...</p>
                </div>
            ) : products.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {products.map((product) => (
                        <div key={product.id} className="group bg-slate-800/30 border border-slate-700 hover:border-slate-500/50 rounded-2xl overflow-hidden transition-all flex flex-col h-full">
                            {view === 'canonical' ? (
                                <Link href={`/admin/canonical-products/${product.id}`} className="relative aspect-square bg-slate-900/50 p-6 flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity">
                                    <SafeImage
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                                    />
                                    <div className="absolute bottom-4 left-4 px-3 py-1 bg-indigo-500/90 backdrop-blur-md text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5">
                                        <Layers size={12} />
                                        {product.source_count} NGUỒN
                                    </div>
                                </Link>
                            ) : (
                                <div className="relative aspect-square bg-slate-900/50 p-6 flex items-center justify-center overflow-hidden">
                                    <SafeImage
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                                    />

                                    <span className={`absolute top-4 left-4 px-2 py-1 rounded-lg text-[10px] font-black text-white ${SOURCE_COLORS[product.source_type || ''] || 'bg-slate-600'}`}>
                                        {product.source_name?.toUpperCase()}
                                    </span>

                                    {product.is_mapped && (
                                        <div className="absolute top-4 right-4 bg-emerald-500/90 text-white rounded-full p-1.5 shadow-lg shadow-emerald-500/20" title="Đã được gộp">
                                            <CheckCircle2 size={16} />
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="p-5 flex flex-col flex-1">
                                {view === 'canonical' ? (
                                    <Link href={`/admin/canonical-products/${product.id}`} className="font-bold text-white hover:text-blue-400 transition-colors line-clamp-2 min-h-[3rem] text-sm mb-3">
                                        {product.name}
                                    </Link>
                                ) : (
                                    <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2 min-h-[3rem] text-sm mb-3">
                                        {product.name}
                                    </h3>
                                )}

                                <div className="mt-auto">
                                    <div className="flex items-baseline gap-2 mb-3">
                                        <span className="text-xl font-black text-white">
                                            {formatPrice(product.price)}
                                        </span>
                                        {view === 'raw' && product.original_price && product.original_price > product.price && (
                                            <span className="text-xs text-slate-500 line-through">
                                                {formatPrice(product.original_price)}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                                        <span className="text-[10px] text-slate-500 font-medium tracking-wider">
                                            ID: #{product.id}
                                        </span>
                                        {view === 'raw' ? (
                                            <a
                                                href={product.external_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 hover:bg-slate-700 rounded-lg text-blue-400 transition-colors"
                                            >
                                                <ExternalLink size={18} />
                                            </a>
                                        ) : (
                                            <Link
                                                href={`/admin/canonical-products/${product.id}`}
                                                className="p-2 hover:bg-slate-700 rounded-lg text-emerald-400 transition-colors"
                                            >
                                                <ChevronRight size={18} />
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
                    <AlertCircle className="w-16 h-16 opacity-20" />
                    <p className="text-xl font-medium">Không tìm thấy sản phẩm nào</p>
                    <button
                        onClick={() => { setSearch(''); setPage(1); }}
                        className="text-indigo-400 hover:underline"
                    >
                        Xóa tìm kiếm
                    </button>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-12 pb-8">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-400 disabled:opacity-30 hover:text-white transition-all hover:border-slate-600 shadow-sm"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <div className="flex items-center gap-2 px-6 py-2 bg-slate-900/50 border border-slate-700 rounded-xl shadow-inner">
                        <span className="text-indigo-400 font-black text-lg">{page}</span>
                        <span className="text-slate-600 font-medium">/</span>
                        <span className="text-slate-400 font-bold">{totalPages}</span>
                    </div>

                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-400 disabled:opacity-30 hover:text-white transition-all hover:border-slate-600 shadow-sm"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}
        </section>
    );
}
