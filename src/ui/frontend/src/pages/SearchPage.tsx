import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, AlertCircle, Sparkles, Grid, TrendingUp, Search } from 'lucide-react';
import SearchBar from '../components/SearchBar';
import FilterSidebar from '../components/FilterSidebar';
import { ProductCard, GroupedProductCard } from '../components/ProductCard';
import { LoadingGrid } from '../components/Loading';
import { searchProducts } from '../api';
import { SearchResponse, Platform } from '../types';

type ViewMode = 'grid' | 'grouped';

export default function SearchPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    const query = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');

    const [results, setResults] = useState<SearchResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('grouped');

    const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
    const [minPrice, setMinPrice] = useState<number | undefined>();
    const [maxPrice, setMaxPrice] = useState<number | undefined>();

    useEffect(() => {
        if (!query) {
            setResults(null);
            return;
        }

        const fetchResults = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await searchProducts({
                    query,
                    method: 'hybrid',
                    page,
                    limit: 20,
                    platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
                    min_price: minPrice,
                    max_price: maxPrice,
                });
                setResults(data);
            } catch (err) {
                setError('Không thể tải kết quả. Vui lòng thử lại.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [query, page, selectedPlatforms, minPrice, maxPrice]);

    const handleSearch = (newQuery: string) => {
        setSearchParams({ q: newQuery, page: '1' });
    };

    const handlePageChange = (newPage: number) => {
        setSearchParams({ q: query, page: newPage.toString() });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleClearFilters = () => {
        setSelectedPlatforms([]);
        setMinPrice(undefined);
        setMaxPrice(undefined);
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Main Layout - 3 columns: Filter | Search+Results */}
            <div className="container-app">
                <div className="flex">
                    {/* Left Sidebar - Filter (Fixed height, scrollable) */}
                    <aside className="hidden lg:block w-64 flex-shrink-0 border-r border-slate-100 bg-white">
                        <div className="sticky top-14 h-[calc(100vh-56px)] overflow-y-auto scrollbar-hide p-4">
                            <FilterSidebar
                                selectedPlatforms={selectedPlatforms}
                                onPlatformChange={setSelectedPlatforms}
                                minPrice={minPrice}
                                maxPrice={maxPrice}
                                onPriceChange={(min, max) => {
                                    setMinPrice(min);
                                    setMaxPrice(max);
                                }}
                                onClear={handleClearFilters}
                            />
                        </div>
                    </aside>

                    {/* Right Side - Search Bar + Results */}
                    <div className="flex-1 min-w-0">
                        {/* Search Bar - Sticky */}
                        <div className="sticky top-14 z-40 bg-white border-b border-slate-100 py-4 px-4">
                            <SearchBar
                                initialQuery={query}
                                onSearch={handleSearch}
                                autoFocus={!query}
                            />
                        </div>

                        {/* Results Area */}
                        <main className="p-4">
                            {/* No Query State */}
                            {!query && (
                                <div className="text-center py-20 animate-fade-in">
                                    <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-2xl flex items-center justify-center">
                                        <Search className="w-8 h-8 text-emerald-500" />
                                    </div>
                                    <h2 className="text-lg font-semibold text-slate-700 mb-2">
                                        Bắt đầu tìm kiếm
                                    </h2>
                                    <p className="text-slate-500 text-sm max-w-sm mx-auto">
                                        Nhập tên sản phẩm để tìm kiếm và so sánh giá từ nhiều sàn TMĐT
                                    </p>
                                </div>
                            )}

                            {/* Results Header */}
                            {query && results && (
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                    <div className="animate-fade-in">
                                        <p className="text-slate-700">
                                            <span className="font-semibold text-emerald-600">
                                                {results.total_results.toLocaleString()}
                                            </span>{' '}
                                            kết quả cho "{query}"
                                        </p>
                                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded">
                                                <Clock className="w-3 h-3" />
                                                {results.execution_time_ms.toFixed(0)}ms
                                            </span>
                                            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded font-medium">
                                                <Sparkles className="w-3 h-3" />
                                                HYBRID
                                            </span>
                                        </div>
                                    </div>

                                    {/* View Toggle */}
                                    <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-slate-200">
                                        <button
                                            onClick={() => setViewMode('grouped')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                                                ${viewMode === 'grouped'
                                                    ? 'bg-white border-2 border-emerald-400 text-emerald-600'
                                                    : 'text-slate-500 hover:bg-slate-50'
                                                }`}
                                        >
                                            <TrendingUp className="w-4 h-4" />
                                            So sánh
                                        </button>
                                        <button
                                            onClick={() => setViewMode('grid')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                                                ${viewMode === 'grid'
                                                    ? 'bg-white border-2 border-emerald-400 text-emerald-600'
                                                    : 'text-slate-500 hover:bg-slate-50'
                                                }`}
                                        >
                                            <Grid className="w-4 h-4" />
                                            Lưới
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Loading */}
                            {loading && <LoadingGrid count={6} />}

                            {/* Error */}
                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center animate-fade-in">
                                    <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                                    <p className="text-red-700 font-medium">{error}</p>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="mt-3 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium"
                                    >
                                        Thử lại
                                    </button>
                                </div>
                            )}

                            {/* No Results */}
                            {!loading && results && results.total_results === 0 && (
                                <div className="text-center py-16 animate-fade-in">
                                    <div className="w-14 h-14 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                                        <Search className="w-7 h-7 text-slate-300" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-700 mb-1">
                                        Không tìm thấy kết quả
                                    </h3>
                                    <p className="text-slate-500 text-sm">Thử từ khóa khác</p>
                                </div>
                            )}

                            {/* Results */}
                            {!loading && results && results.total_results > 0 && (
                                <>
                                    {viewMode === 'grouped' && results.grouped_results.length > 0 ? (
                                        <div className="space-y-3">
                                            {results.grouped_results.map((group, index) => (
                                                <GroupedProductCard key={index} group={group} index={index} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                            {results.results.map((product, index) => (
                                                <ProductCard key={product.id} product={product} index={index} />
                                            ))}
                                        </div>
                                    )}

                                    {/* Pagination */}
                                    {results.total_pages > 1 && (
                                        <div className="flex items-center justify-center gap-2 mt-8">
                                            <button
                                                onClick={() => handlePageChange(page - 1)}
                                                disabled={page <= 1}
                                                className="btn-secondary text-sm disabled:opacity-50"
                                            >
                                                ← Trước
                                            </button>
                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: Math.min(5, results.total_pages) }, (_, i) => {
                                                    const pageNum = Math.max(1, Math.min(page - 2 + i, results.total_pages - 4 + i));
                                                    if (pageNum < 1 || pageNum > results.total_pages) return null;
                                                    return (
                                                        <button
                                                            key={pageNum}
                                                            onClick={() => handlePageChange(pageNum)}
                                                            className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors
                                                                ${pageNum === page
                                                                    ? 'bg-emerald-500 text-white'
                                                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            {pageNum}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <button
                                                onClick={() => handlePageChange(page + 1)}
                                                disabled={page >= results.total_pages}
                                                className="btn-secondary text-sm disabled:opacity-50"
                                            >
                                                Sau →
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </main>
                    </div>
                </div>
            </div>
        </div>
    );
}
