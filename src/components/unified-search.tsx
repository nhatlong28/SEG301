'use client';

import { useState, useEffect, useCallback } from 'react';
import SearchBar from '@/components/search/SearchBar';
import ProductCard from '@/components/products/ProductCard';
import { Grid3X3, List, Loader2, X, Filter, ChevronDown } from 'lucide-react';

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

export function UnifiedSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [facets, setFacets] = useState<Facet[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [filters, setFilters] = useState<Record<string, string[]>>({});
    const [sort, setSort] = useState('relevance');
    const [showFilters, setShowFilters] = useState(false);
    const [showResults, setShowResults] = useState(false);

    // Read query from URL on mount
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const q = searchParams.get('q');
        if (q) {
            setQuery(q);
        }
    }, []);

    const performSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setShowResults(false);
            return;
        }

        setIsLoading(true);
        setShowResults(true);

        try {
            const params = new URLSearchParams({
                q: searchQuery,
                page: '1',
                limit: '20',
                sort,
            });

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
        } catch (error) {
            console.error('Search error:', error);
            setResults([]);
            setTotal(0);
        } finally {
            setIsLoading(false);
        }
    }, [filters, sort]);

    useEffect(() => {
        if (query) {
            const timer = setTimeout(() => performSearch(query), 300);
            return () => clearTimeout(timer);
        }
    }, [query, performSearch]);

    const handleSearch = (searchQuery: string) => {
        setQuery(searchQuery);
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

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0,
        }).format(price);
    };

    return (
        <section className="dashboard-section">
            <div className="section-header">
                <span className="text-4xl">🔍</span>
                <h2>Tìm Kiếm & So Sánh Giá</h2>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
                <SearchBar onSearch={handleSearch} isLoading={isLoading} />
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                    <span className="text-slate-400 text-sm">Phổ biến:</span>
                    {['iPhone 15 Pro Max', 'Samsung Galaxy S24', 'MacBook Pro', 'Tai nghe Sony'].map((term) => (
                        <button
                            key={term}
                            onClick={() => setQuery(term)}
                            className="px-4 py-1.5 bg-slate-800/50 hover:bg-slate-700 text-slate-300 rounded-full text-sm transition"
                        >
                            {term}
                        </button>
                    ))}
                </div>
            </div>

            {/* Results Section */}
            {showResults && (
                <div className="mt-8">
                    {/* Results Header */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-slate-200">
                                Kết quả: &quot;{query}&quot;
                            </h3>
                            <p className="text-slate-400 text-sm mt-1">
                                Tìm thấy {total.toLocaleString()} sản phẩm từ 5 sàn TMĐT
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Sort */}
                            <select
                                value={sort}
                                onChange={(e) => setSort(e.target.value)}
                                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="relevance">Phù hợp nhất</option>
                                <option value="price_asc">Giá thấp → cao</option>
                                <option value="price_desc">Giá cao → thấp</option>
                                <option value="rating">Đánh giá cao</option>
                                <option value="popularity">Phổ biến nhất</option>
                            </select>

                            {/* View Toggle */}
                            <div className="flex border border-slate-700 rounded-lg overflow-hidden">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                                >
                                    <Grid3X3 className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                                >
                                    <List className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Filter Toggle */}
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200"
                            >
                                <Filter className="w-5 h-5" />
                                Lọc
                                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-6">
                        {/* Filters Sidebar */}
                        {showFilters && facets.length > 0 && (
                            <aside className="w-64 flex-shrink-0">
                                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 sticky top-24">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-slate-200 flex items-center gap-2">
                                            <Filter className="w-5 h-5" />
                                            Bộ Lọc
                                        </h3>
                                        {Object.keys(filters).some(k => filters[k].length > 0) && (
                                            <button
                                                onClick={clearFilters}
                                                className="text-sm text-blue-400 hover:underline"
                                            >
                                                Xóa tất cả
                                            </button>
                                        )}
                                    </div>

                                    {facets.map((facet) => (
                                        <div key={facet.name} className="mb-6">
                                            <h4 className="font-semibold text-slate-300 mb-3">{facet.displayName}</h4>
                                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                                {facet.values.map((v) => (
                                                    <label key={v.value} className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={filters[facet.name]?.includes(v.value) || false}
                                                            onChange={() => toggleFilter(facet.name, v.value)}
                                                            className="w-4 h-4 text-blue-600 rounded"
                                                        />
                                                        <span className="text-sm text-slate-300 flex-1">{v.label}</span>
                                                        <span className="text-xs text-slate-500">({v.count})</span>
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
                                                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm"
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
                                    <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                                </div>
                            )}

                            {/* Results Grid */}
                            {!isLoading && results.length > 0 && (
                                <div className={`grid gap-6 ${viewMode === 'grid'
                                    ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                                    : 'grid-cols-1'
                                    }`}>
                                    {results.map((product) => (
                                        <ProductCard key={product.id} product={product} />
                                    ))}
                                </div>
                            )}

                            {/* Empty State */}
                            {!isLoading && results.length === 0 && (
                                <div className="text-center py-20">
                                    <p className="text-6xl mb-4">🔍</p>
                                    <h3 className="text-2xl font-bold text-slate-300 mb-2">
                                        Không tìm thấy sản phẩm
                                    </h3>
                                    <p className="text-slate-500">
                                        Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc
                                    </p>
                                </div>
                            )}
                        </main>
                    </div>
                </div>
            )}
        </section>
    );
}
