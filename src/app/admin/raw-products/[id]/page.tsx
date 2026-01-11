'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Star, Package, TrendingDown, Clock, Tag, ShoppingCart } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

interface RawProductDetail {
    id: number;
    external_id: string;
    external_url: string;
    name: string;
    name_normalized: string;
    description?: string;
    price: number;
    original_price?: number;
    discount_percent?: number;
    brand_raw?: string;
    category_raw?: string;
    image_url?: string;
    images?: string[];
    rating?: number;
    review_count: number;
    sold_count: number;
    available: boolean;
    stock_quantity?: number;
    specs?: Record<string, string>;
    crawled_at: string;
    updated_at: string;
    sources?: {
        id: number;
        name: string;
        type: string;
        base_url: string;
    };
    price_history?: {
        price: number;
        original_price?: number;
        recorded_at: string;
    }[];
}

const SOURCE_COLORS: Record<string, string> = {
    shopee: 'bg-orange-500',
    tiki: 'bg-blue-500',
    lazada: 'bg-purple-500',
    cellphones: 'bg-red-500',
    dienmayxanh: 'bg-green-500',
};

export default function RawProductDetailPage() {
    const params = useParams();
    const [product, setProduct] = useState<RawProductDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const res = await fetch(`/api/admin/raw-products/${params.id}`);
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

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0f1d] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        );
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-[#0a0f1d] text-slate-200 p-6">
                <div className="max-w-4xl mx-auto text-center py-20">
                    <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h1 className="text-2xl font-bold mb-2">Không tìm thấy sản phẩm</h1>
                    <Link href="/admin/raw-products" className="text-blue-400 hover:underline">
                        Quay lại danh sách
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0f1d] text-slate-200 p-6">
            <Toaster position="top-right" />

            <div className="max-w-6xl mx-auto">
                {/* Breadcrumb */}
                <Link href="/admin/raw-products" className="inline-flex items-center text-slate-400 hover:text-white mb-6">
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
                            {/* Source Badge */}
                            <span className={`absolute top-4 left-4 px-3 py-1.5 rounded-xl text-sm font-bold text-white ${SOURCE_COLORS[product.sources?.type || ''] || 'bg-slate-600'}`}>
                                {product.sources?.name || 'Unknown'}
                            </span>
                        </div>

                        {/* Additional Images */}
                        {product.images && product.images.length > 1 && (
                            <div className="flex gap-2 mt-4 overflow-x-auto">
                                {product.images.slice(0, 5).map((img, idx) => (
                                    <div key={idx} className="relative w-20 h-20 flex-shrink-0 bg-slate-800 rounded-lg overflow-hidden">
                                        <Image src={img} alt={`${product.name} ${idx + 1}`} fill className="object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Info */}
                    <div>
                        <h1 className="text-2xl font-bold mb-4">{product.name}</h1>

                        {/* Price */}
                        <div className="flex items-baseline gap-3 mb-6">
                            <span className="text-3xl font-bold text-emerald-400">
                                {formatPrice(product.price)}
                            </span>
                            {product.original_price && product.original_price > product.price && (
                                <>
                                    <span className="text-xl text-slate-500 line-through">
                                        {formatPrice(product.original_price)}
                                    </span>
                                    <span className="px-2 py-1 bg-red-500 text-white text-sm font-bold rounded-lg">
                                        -{product.discount_percent}%
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Stats */}
                        <div className="flex flex-wrap gap-4 mb-6">
                            {product.rating && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-xl">
                                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                                    <span className="font-semibold">{product.rating.toFixed(1)}</span>
                                    <span className="text-slate-500">({product.review_count} đánh giá)</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-xl">
                                <ShoppingCart className="w-5 h-5 text-blue-400" />
                                <span>{product.sold_count.toLocaleString()} đã bán</span>
                            </div>
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${product.available ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                <span>{product.available ? 'Còn hàng' : 'Hết hàng'}</span>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-3 mb-6">
                            {product.brand_raw && (
                                <div className="flex items-center gap-3">
                                    <Tag className="w-5 h-5 text-slate-500" />
                                    <span className="text-slate-400">Thương hiệu:</span>
                                    <span className="font-medium">{product.brand_raw}</span>
                                </div>
                            )}
                            {product.category_raw && (
                                <div className="flex items-center gap-3">
                                    <Tag className="w-5 h-5 text-slate-500" />
                                    <span className="text-slate-400">Danh mục:</span>
                                    <span className="font-medium">{product.category_raw}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-3">
                                <Clock className="w-5 h-5 text-slate-500" />
                                <span className="text-slate-400">Cập nhật:</span>
                                <span className="font-medium">{formatDate(product.updated_at)}</span>
                            </div>
                        </div>

                        {/* External Link */}
                        {product.external_url && (
                            <a
                                href={product.external_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors"
                            >
                                <ExternalLink className="w-5 h-5" />
                                Xem trên {product.sources?.name}
                            </a>
                        )}
                    </div>
                </div>

                {/* Specs */}
                {product.specs && Object.keys(product.specs).length > 0 && (
                    <div className="mt-8 p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                        <h2 className="text-xl font-bold mb-4">Thông số kỹ thuật</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(product.specs).map(([key, value]) => (
                                <div key={key} className="flex justify-between py-2 border-b border-slate-800">
                                    <span className="text-slate-400">{key}</span>
                                    <span className="font-medium">{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Price History */}
                {product.price_history && product.price_history.length > 0 && (
                    <div className="mt-8 p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <TrendingDown className="w-6 h-6 text-blue-400" />
                            Lịch sử giá
                        </h2>
                        <div className="space-y-2">
                            {product.price_history.slice(0, 10).map((h, idx) => (
                                <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-800">
                                    <span className="text-slate-400">{formatDate(h.recorded_at)}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="font-bold text-emerald-400">{formatPrice(h.price)}</span>
                                        {h.original_price && h.original_price > h.price && (
                                            <span className="text-slate-500 line-through">{formatPrice(h.original_price)}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Description */}
                {product.description && (
                    <div className="mt-8 p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                        <h2 className="text-xl font-bold mb-4">Mô tả sản phẩm</h2>
                        <p className="text-slate-300 whitespace-pre-line">{product.description}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
