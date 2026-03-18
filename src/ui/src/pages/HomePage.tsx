import { useNavigate } from 'react-router-dom';
import { Zap, TrendingDown, Shield, Clock, ChevronDown, Search, Sparkles, ArrowRight, Star } from 'lucide-react';
import SearchBar from '../components/SearchBar';
import { SearchMethod } from '../types';

const features = [
    {
        icon: <TrendingDown className="w-7 h-7" />,
        title: 'So sánh giá tức thì',
        description: 'Tìm giá tốt nhất từ hàng triệu sản phẩm trên Shopee, Tiki, Lazada và 3 sàn khác',
        gradient: 'from-green-500 to-emerald-500',
    },
    {
        icon: <Shield className="w-7 h-7" />,
        title: 'Entity Resolution',
        description: 'AI tự động nhận diện sản phẩm giống nhau trên các sàn khác nhau để so sánh chính xác',
        gradient: 'from-blue-500 to-cyan-500',
    },
    {
        icon: <Clock className="w-7 h-7" />,
        title: 'Tìm kiếm siêu nhanh',
        description: 'Thuật toán BM25 + Vector Search cho kết quả < 1 giây với độ chính xác cao',
        gradient: 'from-purple-500 to-pink-500',
    },
];

const quickSearches = [
    { text: 'iPhone 15 Pro Max', icon: '📱' },
    { text: 'Laptop gaming', icon: '💻' },
    { text: 'Tai nghe bluetooth', icon: '🎧' },
    { text: 'Máy lọc không khí', icon: '🌬️' },
    { text: 'Smart TV 55 inch', icon: '📺' },
    { text: 'Robot hút bụi', icon: '🤖' },
];

const stats = [
    { value: '1M+', label: 'Sản phẩm', icon: '📦' },
    { value: '6', label: 'Sàn TMĐT', icon: '🏪' },
    { value: '<1s', label: 'Thời gian tìm', icon: '⚡' },
    { value: '24/7', label: 'Cập nhật', icon: '🔄' },
];

export default function HomePage() {
    const navigate = useNavigate();

    const handleSearch = (query: string, method: SearchMethod) => {
        navigate(`/search?q=${encodeURIComponent(query)}&method=${method}`);
    };

    const handleQuickSearch = (query: string) => {
        navigate(`/search?q=${encodeURIComponent(query)}&method=hybrid`);
    };

    return (
        <div className="min-h-screen">
            {/* Hero Section */}
            <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
                {/* Animated Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900" />

                {/* Floating Orbs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/30 rounded-full blur-3xl animate-float" />
                    <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/20 rounded-full blur-3xl" />
                </div>

                {/* Grid Pattern */}
                <div className="absolute inset-0 grid-pattern opacity-20" />

                {/* Content */}
                <div className="relative z-10 container mx-auto px-4 py-20">
                    <div className="text-center max-w-4xl mx-auto">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-md rounded-full 
                            text-white/90 text-sm font-medium mb-8 border border-white/20 animate-fade-in">
                            <Sparkles className="w-4 h-4 text-yellow-400" />
                            <span>Powered by Hybrid Search (BM25 + AI Vector)</span>
                            <Zap className="w-4 h-4 text-yellow-400" />
                        </div>

                        {/* Title */}
                        <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight animate-slide-up">
                            So sánh giá{' '}
                            <span className="gradient-text animate-gradient bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500">
                                thông minh
                            </span>
                        </h1>

                        <p className="text-xl md:text-2xl text-white/70 mb-10 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s' }}>
                            Tìm kiếm sản phẩm từ <span className="text-white font-semibold">Shopee, Tiki, Lazada</span> và nhiều sàn khác.
                            Tiết kiệm thời gian và tiền bạc với giá tốt nhất.
                        </p>

                        {/* Search Bar */}
                        <div className="mb-10 animate-slide-up" style={{ animationDelay: '0.3s' }}>
                            <SearchBar
                                onSearch={handleSearch}
                                size="large"
                                showMethodSelector={true}
                                autoFocus={true}
                            />
                        </div>

                        {/* Quick Searches */}
                        <div className="flex flex-wrap items-center justify-center gap-2 animate-fade-in" style={{ animationDelay: '0.4s' }}>
                            <span className="text-white/50 text-sm mr-2">Tìm nhanh:</span>
                            {quickSearches.map((item, index) => (
                                <button
                                    key={item.text}
                                    onClick={() => handleQuickSearch(item.text)}
                                    className="group px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm
                             text-white/80 hover:text-white text-sm rounded-full 
                             transition-all duration-300 border border-white/10 hover:border-white/30
                             transform hover:-translate-y-1 hover:shadow-lg"
                                    style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                                >
                                    <span className="mr-1.5">{item.icon}</span>
                                    {item.text}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Scroll Indicator */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 animate-bounce">
                    <ChevronDown className="w-8 h-8" />
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-16 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 relative overflow-hidden">
                <div className="absolute inset-0 bg-black/20" />
                <div className="container mx-auto px-4 relative z-10">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
                        {stats.map((stat, index) => (
                            <div
                                key={stat.label}
                                className="animate-fade-in"
                                style={{ animationDelay: `${index * 0.1}s` }}
                            >
                                <div className="text-3xl mb-2">{stat.icon}</div>
                                <div className="text-4xl md:text-5xl font-black mb-2">{stat.value}</div>
                                <div className="text-white/70 font-medium">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-24 bg-white relative">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-black text-slate-800 mb-4">
                            Tại sao chọn <span className="gradient-text">PriceHunter</span>?
                        </h2>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                            Công nghệ tìm kiếm tiên tiến kết hợp BM25 và Vector Search
                            giúp bạn tìm được sản phẩm tốt nhất với giá tốt nhất.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {features.map((feature, index) => (
                            <div
                                key={index}
                                className="group p-8 rounded-3xl bg-gradient-to-br from-slate-50 to-white 
                           border-2 border-slate-100 hover:border-slate-200
                           hover:shadow-2xl hover:shadow-slate-200/50
                           transition-all duration-500 transform hover:-translate-y-2"
                            >
                                <div className={`
                  w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl 
                  flex items-center justify-center mb-6 text-white
                  group-hover:scale-110 transition-transform duration-300 shadow-lg
                `}>
                                    {feature.icon}
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-3">
                                    {feature.title}
                                </h3>
                                <p className="text-slate-600 leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-gradient-to-br from-slate-900 to-slate-800">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                        Sẵn sàng tiết kiệm tiền?
                    </h2>
                    <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
                        Bắt đầu tìm kiếm ngay để khám phá giá tốt nhất cho sản phẩm bạn cần
                    </p>
                    <button
                        onClick={() => document.querySelector('input')?.focus()}
                        className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 
                       text-white font-bold rounded-2xl shadow-xl shadow-purple-500/30
                       hover:shadow-2xl hover:shadow-purple-500/40 transform hover:-translate-y-1
                       transition-all duration-300 text-lg"
                    >
                        <Search className="w-5 h-5" />
                        Bắt đầu tìm kiếm
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-10 bg-slate-900 text-white/60 text-center">
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                            <Zap className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold text-white">PriceHunter</span>
                    </div>
                    <p className="mb-2">SEG301 - Search Engines & Information Retrieval</p>
                    <p className="text-sm">E-Commerce Price Spider © 2026 • Powered by BM25 + Vector Search</p>
                </div>
            </footer>
        </div>
    );
}
