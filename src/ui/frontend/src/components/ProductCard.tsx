import { Star, ShoppingCart, ExternalLink, TrendingDown, Check, Sparkles } from 'lucide-react';
import { ProductItem, ProductGroup } from '../types';
import PlatformBadge from './PlatformBadge';

/**
 * Format price in Vietnamese Dong
 */
function formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
    }).format(price);
}

/**
 * Single product card
 */
interface ProductCardProps {
    product: ProductItem;
    index?: number;
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
    const hasDiscount = product.discount_percent && product.discount_percent > 0;

    return (
        <div
            className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow group animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
        >
            {/* Image Section - smaller */}
            <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
                {product.image_url ? (
                    <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <ShoppingCart className="w-16 h-16 text-slate-300" />
                    </div>
                )}

                {/* Discount Badge - smaller */}
                {hasDiscount && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-red-500 text-white 
                          rounded-full text-xs font-semibold flex items-center gap-0.5 shadow-sm">
                        <TrendingDown className="w-3 h-3" />
                        -{product.discount_percent}%
                    </div>
                )}

                {/* Platform Badge - top right */}
                <div className="absolute top-2 right-2">
                    <PlatformBadge platform={product.platform} size="md" />
                </div>

            </div>

            {/* Content Section - compact */}
            <div className="p-3">
                {/* Title - smaller */}
                <h3 className="text-sm font-medium text-slate-800 line-clamp-2 mb-2 min-h-[40px]">
                    {product.name}
                </h3>

                {/* Price Section - emerald color */}
                <div className="flex items-baseline gap-2">
                    {product.price ? (
                        <>
                            <span className="text-lg font-bold text-emerald-600">
                                {formatPrice(product.price)}
                            </span>
                            {product.original_price && product.original_price > product.price && (
                                <span className="text-xs text-slate-400 line-through">
                                    {formatPrice(product.original_price)}
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="text-slate-400 text-sm italic">Liên hệ</span>
                    )}
                </div>

                {/* Sales count - small */}
                {product.sold_count > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                        Đã bán {product.sold_count.toLocaleString()}
                    </p>
                )}
            </div>
        </div>
    );
}

/**
 * Grouped product card for price comparison
 */
interface GroupedProductCardProps {
    group: ProductGroup;
    index?: number;
}

export function GroupedProductCard({ group, index = 0 }: GroupedProductCardProps) {
    const hasMultipleOffers = group.offers.length > 1;
    const sortedOffers = [...group.offers].sort((a, b) => a.price - b.price);
    const priceSavings = hasMultipleOffers
        ? sortedOffers[sortedOffers.length - 1].price - sortedOffers[0].price
        : 0;

    return (
        <div
            className="glass-card rounded-2xl overflow-hidden card-hover animate-slide-up"
            style={{ animationDelay: `${index * 100}ms` }}
        >
            <div className="flex flex-col md:flex-row">
                {/* Image Section - smaller */}
                <div className="md:w-44 lg:w-48 aspect-square md:aspect-[4/3] bg-slate-50 flex-shrink-0 relative overflow-hidden">
                    {group.image_url ? (
                        <img
                            src={group.image_url}
                            alt={group.canonical_name}
                            className="w-full h-full object-contain p-2"
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center p-4">
                            <ShoppingCart className="w-12 h-12 text-slate-300" />
                        </div>
                    )}

                    {/* Offer Count Badge */}
                    {hasMultipleOffers && (
                        <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 
                            text-white rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg">
                            <Sparkles className="w-3.5 h-3.5" />
                            {group.offers.length} sàn
                        </div>
                    )}
                </div>

                {/* Content Section - compact */}
                <div className="flex-1 p-4">
                    {/* Title - thinner font */}
                    <h3 className="font-normal text-base lg:text-lg text-slate-800 mb-2 line-clamp-2">
                        {group.canonical_name}
                    </h3>

                    {/* Rating */}
                    {group.avg_rating && group.avg_rating > 0 && (
                        <div className="flex items-center gap-3 text-sm text-slate-500 mb-4">
                            <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-lg">
                                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                                <span className="font-semibold text-amber-700">{group.avg_rating.toFixed(1)}</span>
                            </div>
                            <span>•</span>
                            <span>{group.total_reviews.toLocaleString()} đánh giá</span>
                        </div>
                    )}

                    {/* Best Price Card - white background, green text, compact */}
                    <div className="bg-white border border-slate-200 rounded-lg p-3 mb-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1 mb-0.5">
                                    <Check className="w-3.5 h-3.5" />
                                    Giá tốt nhất
                                </p>
                                <p className="text-xl font-medium text-emerald-600">
                                    {formatPrice(group.best_price)}
                                </p>
                            </div>
                            <PlatformBadge platform={group.best_platform} size="sm" />
                        </div>
                        {priceSavings > 0 && (
                            <p className="text-sm text-green-600 mt-3 flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4" />
                                Tiết kiệm đến <span className="font-bold">{formatPrice(priceSavings)}</span> so với sàn khác
                            </p>
                        )}
                    </div>

                    {/* All Offers */}
                    {hasMultipleOffers && (
                        <div>
                            <p className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                                <TrendingDown className="w-4 h-4" />
                                So sánh giá từ {group.offers.length} sàn
                            </p>
                            <div className="space-y-2">
                                {sortedOffers.map((offer, offerIndex) => (
                                    <div
                                        key={`${offer.platform}-${offerIndex}`}
                                        className={`
                      flex items-center justify-between p-3 rounded-xl transition-all duration-200
                      ${offerIndex === 0
                                                ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200'
                                                : 'bg-slate-50 hover:bg-slate-100 border border-slate-200'
                                            }
                    `}
                                    >
                                        <div className="flex items-center gap-3">
                                            <PlatformBadge platform={offer.platform} size="sm" showIcon={false} />
                                            {!offer.available && (
                                                <span className="text-xs text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded-full">
                                                    Hết hàng
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {offer.original_price && offer.original_price > offer.price && (
                                                <span className="text-sm text-slate-400 line-through hidden sm:inline">
                                                    {formatPrice(offer.original_price)}
                                                </span>
                                            )}
                                            <span className={`font-bold text-lg ${offerIndex === 0 ? 'text-green-600' : 'text-slate-700'}`}>
                                                {formatPrice(offer.price)}
                                            </span>
                                            <a
                                                href={offer.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 
                                   rounded-lg transition-all duration-200 group/link"
                                            >
                                                <ExternalLink className="w-4 h-4 text-slate-400 group-hover/link:text-blue-500" />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
