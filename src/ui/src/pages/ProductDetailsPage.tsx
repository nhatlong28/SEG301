import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    ChevronLeft,
    ShoppingCart,
    Star,
    Shield,
    Truck,
    RotateCcw,
    Info,
    Sparkles,
    CheckCircle2,
    ArrowRight
} from 'lucide-react';
import { getProductDetails } from '../api';
import { ProductItem } from '../types';
import PlatformBadge from '../components/PlatformBadge';
import { LoadingSpinner } from '../components/Loading';

export default function ProductDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [product, setProduct] = useState<ProductItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeImage, setActiveImage] = useState<string>('');

    useEffect(() => {
        if (!id) return;
        window.scrollTo(0, 0);

        const fetchDetails = async () => {
            setLoading(true);
            try {
                const data = await getProductDetails(id);
                setProduct(data);
                if (data.image_url) setActiveImage(data.image_url);
                else if (data.images && data.images.length > 0) setActiveImage(data.images[0]);
            } catch (err) {
                setError('Không tìm thấy thông tin sản phẩm.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [id]);

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><LoadingSpinner /></div>;
    if (error || !product) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
            <div className="glass-card p-10 rounded-3xl text-center max-w-md animate-fade-in">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
                    <Info className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-4">{error || 'Không tìm thấy sản phẩm'}</h2>
                <button onClick={() => navigate(-1)} className="btn-primary inline-flex items-center gap-2">
                    <ChevronLeft className="w-4 h-4" /> Quay lại tìm kiếm
                </button>
            </div>
        </div>
    );

    const formatPrice = (price?: number) => {
        if (!price) return 'Liên hệ';
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0,
        }).format(price);
    };

    const allImages = [
        ...(product.image_url ? [product.image_url] : []),
        ...(product.images || [])
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    return (
        <div className="min-h-screen bg-slate-50 pt-8 pb-32 selection:bg-emerald-100 selection:text-emerald-900">
            {/* Background Decor */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-40 overflow-hidden z-0">
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-emerald-100 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] left-[-5%] w-[30%] h-[30%] bg-blue-100 blur-[100px] rounded-full"></div>
            </div>

            <div className="container-app relative z-10">
                {/* Navigation & Header */}
                <nav className="mb-8 flex items-center justify-between">
                    <button onClick={() => navigate(-1)} className="group flex items-center gap-2 text-slate-500 hover:text-emerald-600 transition-all">
                        <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:shadow-md group-hover:-translate-x-1 transition-all">
                            <ChevronLeft className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-medium">Quay lại </span>
                    </button>
                    <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5" />
                        Ưu đãi giá tốt nhất
                    </div>
                </nav>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
                    {/* Image Showcase Section - more compact */}
                    <div className="lg:col-span-5">
                        <div className="sticky top-28 space-y-4">
                            <div className="glass-card rounded-[2rem] p-4 bg-white/50 border-white/40 shadow-2xl shadow-emerald-500/5 group relative overflow-hidden">
                                {/* Main Image View */}
                                <div className="aspect-square bg-white rounded-[1.5rem] overflow-hidden border border-slate-50 flex items-center justify-center relative">
                                    <img
                                        src={activeImage || '/placeholder-product.png'}
                                        alt={product.name}
                                        className="w-full h-full object-contain p-6 group-hover:scale-110 transition-transform duration-1000 ease-in-out"
                                    />
                                    {product.discount_percent && (
                                        <div className="absolute top-4 left-4 px-3 py-1.5 bg-red-500 text-white rounded-xl text-xs font-black shadow-lg shadow-red-500/20 animate-float z-20">
                                            -{product.discount_percent}%
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Thumbnails */}
                            {allImages.length > 1 && (
                                <div className="flex justify-center gap-2 overflow-x-auto py-2 scrollbar-hide">
                                    {allImages.map((img, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setActiveImage(img)}
                                            className={`flex-shrink-0 w-14 h-14 rounded-xl border-2 overflow-hidden bg-white transition-all duration-500
                                                ${activeImage === img ? 'border-emerald-500 shadow-md scale-105' : 'border-slate-100 opacity-50 hover:opacity-100'}`}
                                        >
                                            <img src={img} alt="" className="w-full h-full object-contain p-1.5" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Product Details & Actions */}
                    <div className="lg:col-span-7">
                        <div className="flex flex-col gap-6 animate-slide-up">
                            {/* Title & Brand */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <PlatformBadge platform={product.platform} size="lg" />
                                    <div className="h-4 w-px bg-slate-200"></div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                        ID: {product.id}
                                    </span>
                                </div>
                                <h1 className="text-xl lg:text-2xl font-bold text-slate-900 leading-snug tracking-tight max-w-xl">
                                    {product.name}
                                </h1>

                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <div className="flex text-amber-400">
                                            {[...Array(5)].map((_, i) => (
                                                <Star
                                                    key={i}
                                                    className={`w-5 h-5 ${i < Math.floor(product.rating || 0) ? 'fill-current' : 'text-slate-200'}`}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-lg font-bold text-slate-800">{product.rating || '5.0'}</span>
                                        <span className="text-slate-400 text-sm">({product.review_count || 0} nhận xét)</span>
                                    </div>
                                    <div className="h-6 w-px bg-slate-200"></div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-slate-500">Đã bán</span>
                                        <span className="font-bold text-slate-800">{(product.sold_count || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Luxury Price Widget - further reduced size */}
                            <div className="glass-card-dark rounded-3xl p-5 text-white relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 shadow-inner group-hover:opacity-10 transition-opacity">
                                    <ShoppingCart className="w-20 h-20" />
                                </div>

                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-emerald-400 font-bold tracking-wide text-[10px] uppercase">Cam kết giá tốt nhất</span>
                                    </div>

                                    <div className="flex flex-wrap items-end gap-3 mb-5">
                                        <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200 leading-none">
                                            {formatPrice(product.price)}
                                        </span>
                                        {product.original_price && product.original_price > (product.price || 0) && (
                                            <span className="text-lg text-slate-400 line-through mb-1 opacity-70">
                                                {formatPrice(product.original_price)}
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <a
                                            href={product.external_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group relative overflow-hidden flex items-center justify-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:shadow-xl hover:shadow-white/5 active:scale-95"
                                        >
                                            <span className="relative z-10">Mua ngay</span>
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </a>
                                        <button className="px-6 py-3 bg-slate-800/50 backdrop-blur-md border border-slate-700/50 text-white font-bold rounded-xl hover:bg-slate-700/50 transition-all flex items-center justify-center gap-2 active:scale-95 text-sm">
                                            <ShoppingCart className="w-4 h-4" />
                                            Thêm vào giỏ hàng
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Trust Features */}
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { icon: Shield, col: 'blue', text: 'Auth 100%', sub: 'Cam kết chính hãng' },
                                    { icon: Truck, col: 'orange', text: 'Hỏa tốc', sub: 'Giao hàng nhanh chóng' },
                                    { icon: RotateCcw, col: 'emerald', text: 'Đổi trả', sub: 'Hỗ trợ trong 7 ngày' }
                                ].map((feature, i) => (
                                    <div key={i} className="glass-card rounded-[1.5rem] p-4 flex flex-col items-center text-center gap-2 group hover:bg-white hover:-translate-y-1 transition-all">
                                        <div className={`w-12 h-12 rounded-2xl bg-${feature.col}-50 flex items-center justify-center text-${feature.col}-600 group-hover:scale-110 transition-transform`}>
                                            <feature.icon className="w-6 h-6" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{feature.text}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">{feature.sub}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Technical Specs Tab */}
                            {product.specs && Object.keys(product.specs).length > 0 && (
                                <div className="glass-card rounded-[2rem] overflow-hidden">
                                    <div className="bg-slate-900 px-6 py-3 flex items-center gap-3">
                                        <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                            <Info className="w-4 h-4" />
                                        </div>
                                        <h4 className="text-white font-bold uppercase tracking-wider text-xs">Thông số kỹ thuật</h4>
                                    </div>
                                    <div className="p-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                                            {Object.entries(product.specs).map(([key, value]) => (
                                                <div key={key} className="flex flex-col py-3 border-b border-slate-50 group hover:bg-slate-50 transition-colors px-2 rounded-lg">
                                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 opacity-60 group-hover:opacity-100">{key.replace(/_/g, ' ')}</span>
                                                    <span className="text-sm text-slate-700 font-bold leading-tight">{String(value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Description Section */}
                            {product.description && (
                                <div className="glass-card rounded-[2rem] p-6 lg:p-8">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="h-6 w-1 bg-emerald-500 rounded-full"></div>
                                        <h4 className="text-lg font-bold text-slate-800 uppercase tracking-tight">Mô tả sản phẩm</h4>
                                    </div>
                                    <div className="prose prose-emerald max-w-none">
                                        <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                                            {product.description}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
