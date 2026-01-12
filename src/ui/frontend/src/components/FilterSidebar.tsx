import { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp, Sliders } from 'lucide-react';
import { Platform } from '../types';
import PlatformBadge from './PlatformBadge';

interface FilterSidebarProps {
    selectedPlatforms: Platform[];
    onPlatformChange: (platforms: Platform[]) => void;
    minPrice?: number;
    maxPrice?: number;
    onPriceChange: (min?: number, max?: number) => void;
    onClear: () => void;
}

const allPlatforms: Platform[] = ['shopee', 'tiki', 'lazada', 'cellphones', 'dienmayxanh', 'thegioididong'];

const priceRanges = [
    { label: 'Dưới 1 triệu', min: 0, max: 1000000 },
    { label: '1 - 5 triệu', min: 1000000, max: 5000000 },
    { label: '5 - 10 triệu', min: 5000000, max: 10000000 },
    { label: '10 - 20 triệu', min: 10000000, max: 20000000 },
    { label: 'Trên 20 triệu', min: 20000000, max: undefined },
];

export default function FilterSidebar({
    selectedPlatforms,
    onPlatformChange,
    minPrice,
    maxPrice,
    onPriceChange,
    onClear,
}: FilterSidebarProps) {
    const [expandPlatform, setExpandPlatform] = useState(true);
    const [expandPrice, setExpandPrice] = useState(true);
    const [customMin, setCustomMin] = useState('');
    const [customMax, setCustomMax] = useState('');

    const hasFilters = selectedPlatforms.length > 0 || minPrice !== undefined || maxPrice !== undefined;

    const togglePlatform = (platform: Platform) => {
        if (selectedPlatforms.includes(platform)) {
            onPlatformChange(selectedPlatforms.filter(p => p !== platform));
        } else {
            onPlatformChange([...selectedPlatforms, platform]);
        }
    };

    const handleCustomPrice = () => {
        const min = customMin ? parseInt(customMin) * 1000000 : undefined;
        const max = customMax ? parseInt(customMax) * 1000000 : undefined;
        onPriceChange(min, max);
    };

    const selectPriceRange = (min?: number, max?: number) => {
        onPriceChange(min, max);
    };

    const isPriceRangeSelected = (min?: number, max?: number) => {
        return minPrice === min && maxPrice === max;
    };

    return (
        <div className="w-full lg:w-72 flex-shrink-0">
            <div className="glass-card rounded-2xl p-5 sticky top-20">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
                            <Sliders className="w-4 h-4 text-white" />
                        </div>
                        <h3 className="font-bold text-slate-800">Bộ lọc</h3>
                    </div>
                    {hasFilters && (
                        <button
                            onClick={onClear}
                            className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1 
                         px-2 py-1 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4" />
                            Xóa lọc
                        </button>
                    )}
                </div>

                {/* Platform Filter */}
                <div className="mb-5">
                    <button
                        onClick={() => setExpandPlatform(!expandPlatform)}
                        className="flex items-center justify-between w-full text-left font-semibold text-slate-700 mb-3 
                       p-2 -mx-2 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                        <span className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-blue-500" />
                            Sàn TMĐT
                        </span>
                        {expandPlatform ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {expandPlatform && (
                        <div className="space-y-1.5 animate-fade-in">
                            {allPlatforms.map((platform) => (
                                <label
                                    key={platform}
                                    className={`
                    flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200
                    ${selectedPlatforms.includes(platform)
                                            ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200'
                                            : 'hover:bg-slate-50 border-2 border-transparent'
                                        }
                  `}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedPlatforms.includes(platform)}
                                        onChange={() => togglePlatform(platform)}
                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 
                               focus:ring-blue-500 focus:ring-2 cursor-pointer"
                                    />
                                    <PlatformBadge platform={platform} size="sm" />
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="border-t border-slate-200 my-4" />

                {/* Price Filter */}
                <div>
                    <button
                        onClick={() => setExpandPrice(!expandPrice)}
                        className="flex items-center justify-between w-full text-left font-semibold text-slate-700 mb-3
                       p-2 -mx-2 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                        <span className="flex items-center gap-2">
                            <span className="text-green-500 font-bold">₫</span>
                            Khoảng giá
                        </span>
                        {expandPrice ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {expandPrice && (
                        <div className="animate-fade-in">
                            {/* Quick Ranges */}
                            <div className="space-y-1.5 mb-4">
                                {priceRanges.map((range) => (
                                    <button
                                        key={range.label}
                                        onClick={() => selectPriceRange(range.min, range.max)}
                                        className={`
                      w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                      ${isPriceRangeSelected(range.min, range.max)
                                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md'
                                                : 'hover:bg-slate-50 text-slate-600 border border-slate-200'
                                            }
                    `}
                                    >
                                        {range.label}
                                    </button>
                                ))}
                            </div>

                            {/* Custom Range */}
                            <div className="space-y-2 p-3 bg-slate-50 rounded-xl">
                                <p className="text-xs text-slate-500 font-medium">Tùy chỉnh (triệu VNĐ)</p>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        placeholder="Từ"
                                        value={customMin}
                                        onChange={(e) => setCustomMin(e.target.value)}
                                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg 
                               focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                    />
                                    <span className="text-slate-400 font-medium">—</span>
                                    <input
                                        type="number"
                                        placeholder="Đến"
                                        value={customMax}
                                        onChange={(e) => setCustomMax(e.target.value)}
                                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg 
                               focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                    />
                                </div>
                                <button
                                    onClick={handleCustomPrice}
                                    className="w-full py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white 
                             text-sm font-semibold rounded-lg shadow-md hover:shadow-lg 
                             transform hover:-translate-y-0.5 transition-all duration-200"
                                >
                                    Áp dụng
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
