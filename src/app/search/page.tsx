'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SearchBar from '@/components/search/SearchBar';
import ProductCard from '@/components/products/ProductCard';
import { Filter, ChevronDown, Grid3X3, List, Loader2, X } from 'lucide-react';

interface SearchResult {
    id: number;
    name: string;
    slug: string;
    brand: string | null;
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
    }>;
}

interface Facet {
    name: string;
    displayName: string;
    type: string;
    values: Array<{ value: string; label: string; count: number }>;
}

export default function SearchPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-8 h-8" /></div>}>
            <SearchContent />
        </Suspense>
    );
}

function SearchContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [query, setQuery] = useState(searchParams.get('q') || '');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [facets, setFacets] = useState<Facet[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [filters, setFilters] = useState<Record<string, string[]>>({});
    const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null);
    const [showFilters, setShowFilters] = useState(true);
    const [sort, setSort] = useState('relevance');

    // Perform search
    const performSearch = useCallback(async (searchQuery: string, currentPage = 1) => {
        if (!searchQuery.trim()) return;

        setIsLoading(true);

        try {
            const params = new URLSearchParams({
                q: searchQuery,
                page: String(currentPage),
                limit: '20',
                sort,
            });

            // Add filters
            Object.entries(filters).forEach(([key, values]) => {
                if (values.length > 0) {
                    params.set(key, values.join(','));
                }
            });

            const response = await fetch(`/api/search?${params}`);
            const data = await response.json();

            setResults(data.results || []);
            setTotal(data.total || 0);
            setFacets(data.facets || []);
            setPriceRange(data.priceRange || null);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsLoading(false);
        }
    }, [filters, sort]);

    // Initial search from URL
    useEffect(() => {
        const q = searchParams.get('q');
        if (q) {
            setQuery(q);
            performSearch(q);
        }
    }, [searchParams, performSearch]);

    // Search when filters or sort change
    useEffect(() => {
        if (query) {
            performSearch(query, 1);
            setPage(1);
        }
    }, [query, performSearch]);

    const handleSearch = (searchQuery: string) => {
        setQuery(searchQuery);
        router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
        performSearch(searchQuery);
        setPage(1);
    };

    const toggleFilter = (facetName: string, value: string) => {
        setFilters(prev => {
            const current = prev[facetName] || [];
            const newValues = current.includes(value)
                ? current.filter(v => v !== value)
                : [...current, value];

            return { ...prev, [facetName]: newValues };
        });
    };

    const clearFilters = () => {
        setFilters({});
    };

    const loadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        performSearch(query, nextPage);
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0,
        }).format(price);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-6">
                        <Link href="/" className="text-2xl font-bold text-blue-600 whitespace-nowrap">
                            🛍️ PriceSpider
                        </Link>
                        <div className="flex-1">
                            <SearchBar
                                onSearch={handleSearch}
                                defaultValue={query}
                                isLoading={isLoading}
                            />
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* Results Header */}
                {query && (
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">
                                Kết quả tìm kiếm: &quot;{query}&quot;
                            </h1>
                            <p className="text-gray-500 mt-1">
                                Tìm thấy {total.toLocaleString()} sản phẩm từ 5 sàn TMĐT
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Sort */}
                            <select
                                value={sort}
                                onChange={(e) => setSort(e.target.value)}
                                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="relevance">Phù hợp nhất</option>
                                <option value="price_asc">Giá thấp → cao</option>
                                <option value="price_desc">Giá cao → thấp</option>
                                <option value="rating">Đánh giá cao</option>
                                <option value="popularity">Phổ biến nhất</option>
                            </select>

                            {/* View Toggle */}
                            <div className="flex border rounded-lg overflow-hidden">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
                                >
                                    <Grid3X3 className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
                                >
                                    <List className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Filter Toggle (Mobile) */}
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="lg:hidden flex items-center gap-2 px-4 py-2 border rounded-lg"
                            >
                                <Filter className="w-5 h-5" />
                                Lọc
                                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex gap-6">
                    {/* Filters Sidebar */}
                    {showFilters && (
                        <aside className="w-64 flex-shrink-0 hidden lg:block">
                            <div className="bg-white rounded-xl shadow-sm p-4 sticky top-24">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                        <Filter className="w-5 h-5" />
                                        Bộ Lọc
                                    </h3>
                                    {Object.keys(filters).some(k => filters[k].length > 0) && (
                                        <button
                                            onClick={clearFilters}
                                            className="text-sm text-blue-600 hover:underline"
                                        >
                                            Xóa tất cả
                                        </button>
                                    )}
                                </div>

                                {/* Price Range */}
                                {priceRange && (
                                    <div className="mb-6">
                                        <h4 className="font-semibold text-gray-700 mb-3">💰 Khoảng Giá</h4>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Từ"
                                                className="w-1/2 px-3 py-2 border rounded-lg text-sm"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Đến"
                                                className="w-1/2 px-3 py-2 border rounded-lg text-sm"
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            {formatPrice(priceRange.min)} - {formatPrice(priceRange.max)}
                                        </p>
                                    </div>
                                )}

                                {/* Dynamic Facets */}
                                {facets.map((facet) => (
                                    <div key={facet.name} className="mb-6">
                                        <h4 className="font-semibold text-gray-700 mb-3">{facet.displayName}</h4>
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {facet.values.map((v) => (
                                                <label key={v.value} className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={filters[facet.name]?.includes(v.value) || false}
                                                        onChange={() => toggleFilter(facet.name, v.value)}
                                                        className="w-4 h-4 text-blue-600 rounded"
                                                    />
                                                    <span className="text-sm text-gray-700 flex-1">{v.label}</span>
                                                    <span className="text-xs text-gray-400">({v.count})</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </aside>
                    )}

                    {/* Results */}
                    <main className="flex-1">
                        {/* Active Filters */}
                        {Object.keys(filters).some(k => filters[k].length > 0) && (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {Object.entries(filters).map(([key, values]) =>
                                    values.map((v) => (
                                        <span
                                            key={`${key}-${v}`}
                                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                                        >
                                            {v}
                                            <button onClick={() => toggleFilter(key, v)}>
                                                <X className="w-4 h-4" />
                                            </button>
                                        </span>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Loading */}
                        {isLoading && (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                            </div>
                        )}

                        {/* Results Grid */}
                        {!isLoading && results.length > 0 && (
                            <>
                                <div className={`grid gap-6 ${viewMode === 'grid'
                                    ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                                    : 'grid-cols-1'
                                    }`}>
                                    {results.map((product) => (
                                        <ProductCard key={product.id} product={product} />
                                    ))}
                                </div>

                                {/* Load More */}
                                {results.length < total && (
                                    <div className="text-center mt-8">
                                        <button
                                            onClick={loadMore}
                                            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition"
                                        >
                                            Xem thêm ({total - results.length} sản phẩm)
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Empty State */}
                        {!isLoading && query && results.length === 0 && (
                            <div className="text-center py-20">
                                <p className="text-6xl mb-4">🔍</p>
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                                    Không tìm thấy sản phẩm
                                </h2>
                                <p className="text-gray-500">
                                    Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc
                                </p>
                            </div>
                        )}

                        {/* Initial State */}
                        {!query && (
                            <div className="text-center py-20">
                                <p className="text-6xl mb-4">🛒</p>
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                                    Tìm kiếm sản phẩm
                                </h2>
                                <p className="text-gray-500">
                                    Nhập tên sản phẩm để so sánh giá từ 5 sàn TMĐT
                                </p>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}
