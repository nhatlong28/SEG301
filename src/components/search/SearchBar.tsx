'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Loader2, Tag, Clock, ShoppingBag } from 'lucide-react';
import debounce from 'lodash.debounce';

interface Suggestion {
    text: string;
    type: 'product' | 'brand' | 'category' | 'history';
    count?: number;
}

interface SearchBarProps {
    onSearch: (query: string) => void;
    placeholder?: string;
    defaultValue?: string;
    isLoading?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

const SUGGESTION_ICONS = {
    product: ShoppingBag,
    brand: Tag,
    category: Tag,
    history: Clock,
};

const SUGGESTION_COLORS = {
    product: 'text-blue-500',
    brand: 'text-emerald-500',
    category: 'text-purple-500',
    history: 'text-gray-400',
};

export default function SearchBar({
    onSearch,
    placeholder = 'Tìm kiếm sản phẩm... (VD: iPhone 15, Samsung Galaxy, Laptop)',
    defaultValue = '',
    isLoading = false,
    size = 'lg',
}: SearchBarProps) {
    const [query, setQuery] = useState(defaultValue);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);

    // Debounced suggestion fetch
    const fetchSuggestions = useMemo(
        () =>
            debounce(async (searchQuery: string) => {
                if (searchQuery.length < 2) {
                    setSuggestions([]);
                    return;
                }

                try {
                    const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(searchQuery)}`);
                    const data = await res.json();
                    setSuggestions(data.suggestions || []);
                    setSelectedIndex(-1);
                } catch {
                    setSuggestions([]);
                }
            }, 200),
        []
    );

    useEffect(() => {
        if (query) {
            fetchSuggestions(query);
        }
        return () => {
            fetchSuggestions.cancel();
        };
    }, [query, fetchSuggestions]);

    useEffect(() => {
        setQuery(defaultValue);
    }, [defaultValue]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            onSearch(query.trim());
            setShowSuggestions(false);
        }
    };

    const handleClear = () => {
        setQuery('');
        setSuggestions([]);
        inputRef.current?.focus();
    };

    const handleSuggestionClick = (suggestion: Suggestion) => {
        setQuery(suggestion.text);
        onSearch(suggestion.text);
        setShowSuggestions(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, -1));
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            handleSuggestionClick(suggestions[selectedIndex]);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    const sizeClasses = {
        sm: 'py-2.5 pl-10 pr-16 text-sm rounded-xl',
        md: 'py-3 pl-11 pr-20 text-base rounded-xl',
        lg: 'py-4 pl-12 pr-24 text-lg rounded-2xl',
    };

    return (
        <div className="relative w-full max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="relative">
                <div className="relative flex items-center">
                    {/* Search Icon */}
                    <div className="absolute left-4 text-gray-400">
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                        ) : (
                            <Search className="w-5 h-5" />
                        )}
                    </div>

                    {/* Input */}
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className={`w-full border-2 border-slate-700 bg-slate-800/50 text-slate-100 ${sizeClasses[size]}
                       focus:border-blue-500 focus:ring-4 focus:ring-blue-900/30 
                       transition-all duration-200 outline-none
                       shadow-sm hover:shadow-md placeholder:text-slate-500`}
                    />

                    {/* Clear Button */}
                    {query && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className={`absolute ${size === 'lg' ? 'right-24' : 'right-16'} text-slate-400 hover:text-slate-200 transition`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading || !query.trim()}
                        className={`absolute right-2 ${size === 'lg' ? 'px-6 py-2.5' : 'px-4 py-2'} 
                       bg-gradient-to-r from-blue-600 to-blue-700 
                       text-white font-semibold rounded-xl
                       hover:from-blue-700 hover:to-blue-800 
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200 shadow-md hover:shadow-lg
                       active:scale-95`}
                    >
                        Tìm
                    </button>
                </div>
            </form>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                    {suggestions.map((suggestion, idx) => {
                        const Icon = SUGGESTION_ICONS[suggestion.type];
                        const iconColor = SUGGESTION_COLORS[suggestion.type];

                        return (
                            <button
                                key={`${suggestion.type}-${suggestion.text}-${idx}`}
                                onClick={() => handleSuggestionClick(suggestion)}
                                className={`w-full px-4 py-3 text-left transition flex items-center gap-3
                                    ${selectedIndex === idx ? 'bg-slate-700' : 'hover:bg-slate-700/50'}`}
                            >
                                <Icon className={`w-4 h-4 ${iconColor}`} />
                                <span
                                    className="flex-1 text-slate-200"
                                    dangerouslySetInnerHTML={{ __html: highlightMatch(suggestion.text, query) }}
                                />
                                {suggestion.type === 'brand' && (
                                    <span className="text-xs px-2 py-0.5 bg-emerald-900/40 text-emerald-400 rounded-full border border-emerald-800/50">
                                        Thương hiệu
                                    </span>
                                )}
                                {suggestion.type === 'category' && (
                                    <span className="text-xs px-2 py-0.5 bg-purple-900/40 text-purple-400 rounded-full border border-purple-800/50">
                                        Danh mục
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Popular Searches */}
            {!query && size === 'lg' && (
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                    <span className="text-sm text-slate-500 font-medium">Phổ biến:</span>
                    {['iPhone 15 Pro Max', 'Samsung Galaxy S24', 'Laptop gaming', 'Tai nghe Bluetooth', 'Máy lọc không khí'].map((term) => (
                        <button
                            key={term}
                            onClick={() => {
                                setQuery(term);
                                onSearch(term);
                            }}
                            className="px-3 py-1.5 text-sm bg-slate-800 text-slate-300 border border-slate-700 hover:border-blue-500/50 hover:text-blue-400 rounded-full transition"
                        >
                            {term}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function highlightMatch(text: string, query: string): string {
    if (!query) return text;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return text.replace(regex, '<strong class="text-blue-600">$1</strong>');
}
