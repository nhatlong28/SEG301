import { useState, FormEvent, useCallback } from 'react';
import { Search, Sparkles, Zap, Brain, ArrowRight } from 'lucide-react';
import { SearchMethod } from '../types';

interface SearchBarProps {
    initialQuery?: string;
    initialMethod?: SearchMethod;
    onSearch: (query: string, method: SearchMethod) => void;
    size?: 'large' | 'normal';
    showMethodSelector?: boolean;
    autoFocus?: boolean;
}

const methodOptions: { value: SearchMethod; label: string; icon: React.ReactNode; description: string; color: string }[] = [
    {
        value: 'hybrid',
        label: 'Hybrid AI',
        icon: <Sparkles className="w-4 h-4" />,
        description: 'Kết hợp từ khóa + ngữ nghĩa',
        color: 'from-purple-500 to-pink-500'
    },
    {
        value: 'bm25',
        label: 'BM25',
        icon: <Zap className="w-4 h-4" />,
        description: 'Tìm theo từ khóa chính xác',
        color: 'from-amber-500 to-orange-500'
    },
    {
        value: 'vector',
        label: 'Vector AI',
        icon: <Brain className="w-4 h-4" />,
        description: 'Tìm theo ngữ nghĩa AI',
        color: 'from-cyan-500 to-blue-500'
    },
];

export default function SearchBar({
    initialQuery = '',
    initialMethod = 'hybrid',
    onSearch,
    size = 'normal',
    showMethodSelector = true,
    autoFocus = false,
}: SearchBarProps) {
    const [query, setQuery] = useState(initialQuery);
    const [method, setMethod] = useState<SearchMethod>(initialMethod);
    const [isFocused, setIsFocused] = useState(false);

    const handleSubmit = useCallback((e: FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            onSearch(query.trim(), method);
        }
    }, [query, method, onSearch]);

    const isLarge = size === 'large';

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
            {/* Search Input Container */}
            <div className="relative group">
                {/* Glow Effect */}
                <div className={`
          absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 
          rounded-3xl blur-xl opacity-0 group-hover:opacity-30 transition-all duration-500
          ${isFocused ? 'opacity-40' : ''}
        `} />

                {/* Input Wrapper */}
                <div className={`
          relative flex items-center bg-white rounded-2xl
          border-2 transition-all duration-300
          ${isFocused ? 'border-blue-400 shadow-2xl shadow-blue-500/20' : 'border-slate-200 shadow-lg'}
        `}>
                    {/* Search Icon */}
                    <div className={`
            absolute left-5 transition-colors duration-200
            ${isFocused ? 'text-blue-500' : 'text-slate-400'}
          `}>
                        <Search className={isLarge ? 'w-6 h-6' : 'w-5 h-5'} />
                    </div>

                    {/* Input Field */}
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        autoFocus={autoFocus}
                        placeholder="Tìm kiếm sản phẩm... (VD: iPhone 15, Laptop gaming, Tai nghe...)"
                        className={`
              w-full bg-transparent border-none rounded-2xl
              focus:outline-none focus:ring-0
              transition-all duration-200 placeholder:text-slate-400
              ${isLarge ? 'pl-14 pr-40 py-5 text-lg' : 'pl-12 pr-32 py-4 text-base'}
            `}
                    />

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className={`
              absolute right-2 flex items-center gap-2 font-semibold text-white
              bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl
              shadow-lg shadow-blue-500/25 
              hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-500 hover:to-blue-400
              transform hover:-translate-y-0.5 active:translate-y-0
              transition-all duration-200
              ${isLarge ? 'px-6 py-3 text-base' : 'px-4 py-2.5 text-sm'}
            `}
                    >
                        <Search className="w-4 h-4" />
                        <span className="hidden sm:inline">Tìm kiếm</span>
                        <ArrowRight className="w-4 h-4 hidden sm:block" />
                    </button>
                </div>
            </div>

            {/* Method Selector */}
            {showMethodSelector && (
                <div className="flex items-center justify-center gap-3 mt-5">
                    {methodOptions.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setMethod(opt.value)}
                            className={`
                group/btn flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                transition-all duration-300 transform hover:-translate-y-0.5
                ${method === opt.value
                                    ? `bg-gradient-to-r ${opt.color} text-white shadow-lg`
                                    : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md'
                                }
              `}
                            title={opt.description}
                        >
                            <span className={`transition-transform duration-200 ${method === opt.value ? 'scale-110' : 'group-hover/btn:scale-110'}`}>
                                {opt.icon}
                            </span>
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </form>
    );
}
