import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Grid, List, Clock, AlertCircle, Sparkles, TrendingUp } from 'lucide-react';
import SearchBar from '../components/SearchBar';
import FilterSidebar from '../components/FilterSidebar';
import { ProductCard, GroupedProductCard } from '../components/ProductCard';
import { LoadingGrid } from '../components/Loading';
import { searchProducts } from '../api';
import { SearchResponse, SearchMethod, Platform } from '../types';

type ViewMode = 'grid' | 'grouped';

export default function ResultsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const query = searchParams.get('q') || '';
    const method = (searchParams.get('method') as SearchMethod) || 'hybrid';
    const page = parseInt(searchParams.get('page') || '1');

    const [results, setResults] = useState<SearchResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('grouped');

    // Filters
    const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
    const [minPrice, setMinPrice] = useState<number | undefined>();
    const [maxPrice, setMaxPrice] = useState<number | undefined>();

    // Search effect
    useEffect(() => {
        if (!query) return;

        const fetchResults = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await searchProducts({
                    query,
                    method,
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
    }, [query, method, page, selectedPlatforms, minPrice, maxPrice]);

    const handleSearch = (newQuery: string, newMethod: SearchMethod) => {
        setSearchParams({ q: newQuery, method: newMethod, page: '1' });
    };

    const handlePageChange = (newPage: number) => {
        setSearchParams({ q: query, method, page: newPage.toString() });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleClearFilters = () => {
        setSelectedPlatforms([]);
        setMinPrice(undefined);
        setMaxPrice(undefined);
    };

    // No query state
    if (!query) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
                <div className="text-center animate-fade-in">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl 
                          flex items-center justify-center">
                        <Search className="w-12 h-12 text-blue-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-700 mb-3">Chưa có từ khóa tìm kiếm</h2>
                    <p className="text-slate-500 mb-6">Nhập từ khóa để tìm kiếm sản phẩm</p>
                    <button
                        onClick={() => navigate('/')}
                        className="btn-primary"
                    >
                        Về trang chủ
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
            {/* Search Header */}
            <div className="bg-white/80 backdrop-blur-lg border-b border-slate-200 py-5 sticky top-16 z-40">
                <div className="container mx-auto px-4">
                    <SearchBar
                        initialQuery={query}
                        initialMethod={method}
                        onSearch={handleSearch}
                        size="normal"
                        showMethodSelector={true}
                    />
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar */}
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

                    {/* Results Area */}
                    <div className="flex-1">
                        {/* Results Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                {results && (
                                    <div className="animate-fade-in">
                                        <p className="text-lg text-slate-700">
                                            Tìm thấy <span className="font-bold text-blue-600">{results.total_results.toLocaleString()}</span> sản phẩm
                                            {' '}cho "<span className="font-semibold">{query}</span>"
                                        </p>
                                        <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-full">
                                                <Clock className="w-3.5 h-3.5" />
                                                {results.execution_time_ms.toFixed(0)}ms
                                            </span>
                                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-blue-50 to-purple-50 rounded-full text-blue-600 font-medium">
                                                <Sparkles className="w-3.5 h-3.5" />
                                                {method.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* View Mode Toggle */}
                            <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-slate-200 shadow-sm">
                                <button
                                    onClick={() => setViewMode('grouped')}
                                    className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200
                    ${viewMode === 'grouped'
                                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md'
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                        }
                  `}
                                    title="So sánh giá"
                                >
                                    <TrendingUp className="w-4 h-4" />
                                    <span className="hidden sm:inline">So sánh</span>
                                </button>
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200
                    ${viewMode === 'grid'
                                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md'
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                        }
                  `}
                                    title="Dạng lưới"
                                >
                                    <Grid className="w-4 h-4" />
                                    <span className="hidden sm:inline">Lưới</span>
                                </button>
                            </div>
                        </div>

                        {/* Loading State */}
                        {loading && <LoadingGrid count={8} />}

                        {/* Error State */}
                        {error && (
                            <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-2xl p-8 text-center animate-fade-in">
                                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-2xl flex items-center justify-center">
                                    <AlertCircle className="w-8 h-8 text-red-500" />
                                </div>
                                <p className="text-red-700 font-semibold text-lg">{error}</p>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="mt-4 px-6 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
                                >
                                    Thử lại
                                </button>
                            </div>
                        )}

                        {/* No Results */}
                        {!loading && results && results.total_results === 0 && (
                            <div className="glass-card rounded-2xl p-12 text-center animate-fade-in">
                                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-slate-100 to-slate-200 rounded-3xl 
                                flex items-center justify-center">
                                    <Search className="w-10 h-10 text-slate-400" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-700 mb-3">Không tìm thấy kết quả</h3>
                                <p className="text-slate-500 mb-6">Thử tìm kiếm với từ khóa khác hoặc bỏ bớt bộ lọc</p>
                                <button
                                    onClick={handleClearFilters}
                                    className="btn-secondary"
                                >
                                    Xóa bộ lọc
                                </button>
                            </div>
                        )}

                        {/* Results */}
                        {!loading && results && results.total_results > 0 && (
                            <>
                                {viewMode === 'grouped' && results.grouped_results.length > 0 ? (
                                    <div className="space-y-5">
                                        {results.grouped_results.map((group, index) => (
                                            <GroupedProductCard key={index} group={group} index={index} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {results.results.map((product, index) => (
                                            <ProductCard key={product.id} product={product} index={index} />
                                        ))}
                                    </div>
                                )}

                                {/* Pagination */}
                                {results.total_pages > 1 && (
                                    <div className="flex items-center justify-center gap-2 mt-10">
                                        <button
                                            onClick={() => handlePageChange(page - 1)}
                                            disabled={page <= 1}
                                            className="px-5 py-2.5 rounded-xl bg-white border-2 border-slate-200 text-slate-600 font-medium
                                 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-all duration-200"
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
                                                        className={`
                              w-11 h-11 rounded-xl font-semibold transition-all duration-200
                              ${pageNum === page
                                                                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                                                                : 'bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                                            }
                            `}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <button
                                            onClick={() => handlePageChange(page + 1)}
                                            disabled={page >= results.total_pages}
                                            className="px-5 py-2.5 rounded-xl bg-white border-2 border-slate-200 text-slate-600 font-medium
                                 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-all duration-200"
                                        >
                                            Sau →
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
