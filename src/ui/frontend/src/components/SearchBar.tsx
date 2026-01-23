import { useState, FormEvent } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
    initialQuery?: string;
    onSearch: (query: string) => void;
    autoFocus?: boolean;
}

export default function SearchBar({
    initialQuery = '',
    onSearch,
    autoFocus = false,
}: SearchBarProps) {
    const [query, setQuery] = useState(initialQuery);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            onSearch(query.trim());
        }
    };

    return (
        <div className="w-full">
            <form onSubmit={handleSubmit}>
                <div className="flex items-center bg-white border border-slate-200 rounded-xl h-12 shadow-sm">
                    <div className="pl-4 text-slate-400">
                        <Search className="w-5 h-5" />
                    </div>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus={autoFocus}
                        placeholder="Tìm kiếm sản phẩm, thương hiệu..."
                        className="flex-1 bg-transparent border-none outline-none px-3 text-sm
                                 text-slate-800 placeholder:text-slate-400"
                    />
                    <button
                        type="submit"
                        className="flex items-center gap-2 h-9 px-5 mr-1.5
                                 bg-white border-2 border-emerald-400 text-emerald-600 text-sm font-medium rounded-lg
                                 hover:bg-emerald-50 transition-colors"
                    >
                        <Search className="w-4 h-4" />
                        Tìm kiếm
                    </button>
                </div>
            </form>
        </div>
    );
}
