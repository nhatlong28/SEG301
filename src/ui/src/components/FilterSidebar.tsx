import { useState } from 'react';
import { Filter, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Platform, SearchMethod } from '../types';
import PlatformBadge from './PlatformBadge';

interface FilterSidebarProps {
    selectedMethod: SearchMethod;
    onMethodChange: (method: SearchMethod) => void;
    selectedPlatforms: Platform[];
    onPlatformChange: (platforms: Platform[]) => void;
    minPrice?: number;
    maxPrice?: number;
    onPriceChange: (min?: number, max?: number) => void;
    onClear: () => void;
}

const allPlatforms: Platform[] = ['chotot', 'tiki', 'lazada', 'cellphones', 'dienmayxanh', 'thegioididong'];

export default function FilterSidebar({
    selectedMethod,
    onMethodChange,
    selectedPlatforms,
    onPlatformChange,
    minPrice,
    maxPrice,
    onPriceChange,
}: FilterSidebarProps) {
    const [expandMethod, setExpandMethod] = useState(true);
    const [expandPlatform, setExpandPlatform] = useState(true);
    const [expandPrice, setExpandPrice] = useState(true);

    // Local state for input fields (in millions)
    const [minInputValue, setMinInputValue] = useState(minPrice ? String(minPrice / 1000000) : '');
    const [maxInputValue, setMaxInputValue] = useState(maxPrice ? String(maxPrice / 1000000) : '');

    const togglePlatform = (platform: Platform) => {
        if (selectedPlatforms.includes(platform)) {
            onPlatformChange(selectedPlatforms.filter(p => p !== platform));
        } else {
            onPlatformChange([...selectedPlatforms, platform]);
        }
    };

    const handleApplyPrice = () => {
        const minVal = minInputValue ? parseFloat(minInputValue) * 1000000 : undefined;
        const maxVal = maxInputValue ? parseFloat(maxInputValue) * 1000000 : undefined;
        onPriceChange(minVal, maxVal);
    };

    const handleClearPrice = () => {
        setMinInputValue('');
        setMaxInputValue('');
        onPriceChange(undefined, undefined);
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            {/* Search Method Filter */}
            <div className="mb-4">
                <button
                    onClick={() => setExpandMethod(!expandMethod)}
                    className="flex items-center justify-between w-full text-left text-sm font-medium text-slate-700 mb-3"
                >
                    <span className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-500" />
                        Công cụ tìm kiếm
                    </span>
                    {expandMethod ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {expandMethod && (
                    <div className="animate-fade-in space-y-1">
                        {[
                            { id: 'hybrid', label: 'Hybrid', desc: 'Kết hợp Keyword + AI' },
                            { id: 'bm25', label: 'BM25', desc: 'Tìm theo từ khóa chính xác' },
                            { id: 'vector', label: 'Vector Search', desc: 'Tìm theo ngữ nghĩa (AI)' },
                        ].map((method) => (
                            <label
                                key={method.id}
                                className={`flex flex-col py-2 px-3 rounded-lg cursor-pointer transition-colors
                                    ${selectedMethod === method.id
                                        ? 'bg-emerald-50 border border-emerald-100'
                                        : 'hover:bg-slate-50 border border-transparent'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="searchMethod"
                                        checked={selectedMethod === method.id}
                                        onChange={() => onMethodChange(method.id as SearchMethod)}
                                        className="w-4 h-4 text-emerald-500 border-slate-300 focus:ring-emerald-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">{method.label}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 ml-6">{method.desc}</span>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            <div className="border-t border-slate-100 my-3" />
            {/* Platform Filter */}
            <div className="mb-4">
                <button
                    onClick={() => setExpandPlatform(!expandPlatform)}
                    className="flex items-center justify-between w-full text-left text-sm font-medium text-slate-700 mb-3"
                >
                    <span className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400" />
                        Sàn TMĐT
                    </span>
                    {expandPlatform ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {expandPlatform && (
                    <div className="animate-fade-in space-y-1">
                        {allPlatforms.map((platform) => (
                            <label
                                key={platform}
                                className={`flex items-center gap-3 py-2 px-2 rounded-lg cursor-pointer transition-colors
                                    ${selectedPlatforms.includes(platform)
                                        ? 'bg-emerald-50'
                                        : 'hover:bg-slate-50 border border-transparent'
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedPlatforms.includes(platform)}
                                    onChange={() => togglePlatform(platform)}
                                    className="w-4 h-4 text-emerald-500 rounded border-slate-300 
                                             focus:ring-emerald-500 focus:ring-offset-0"
                                />
                                <PlatformBadge platform={platform} size="sm" />
                            </label>
                        ))}
                    </div>
                )}
            </div>

            <div className="border-t border-slate-100 my-3" />

            {/* Price Filter */}
            <div>
                <button
                    onClick={() => setExpandPrice(!expandPrice)}
                    className="flex items-center justify-between w-full text-left text-sm font-medium text-slate-700 mb-3"
                >
                    <span className="flex items-center gap-2">
                        <span className="text-emerald-500 font-bold text-base">₫</span>
                        Khoảng giá
                    </span>
                    {expandPrice ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {expandPrice && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <input
                                    type="number"
                                    placeholder="Từ"
                                    value={minInputValue}
                                    onChange={(e) => setMinInputValue(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
                                             focus:outline-none focus:border-emerald-400"
                                />
                            </div>
                            <span className="text-slate-400">-</span>
                            <div className="flex-1">
                                <input
                                    type="number"
                                    placeholder="Đến"
                                    value={maxInputValue}
                                    onChange={(e) => setMaxInputValue(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
                                             focus:outline-none focus:border-emerald-400"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 text-center">Đơn vị: triệu đồng</p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleClearPrice}
                                className="flex-1 px-3 py-2 text-sm text-slate-500 border border-slate-200 
                                         rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Xóa
                            </button>
                            <button
                                onClick={handleApplyPrice}
                                className="flex-1 px-3 py-2 text-sm text-emerald-600 border border-emerald-400 
                                         rounded-lg hover:bg-emerald-50 transition-colors font-medium"
                            >
                                Áp dụng
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
