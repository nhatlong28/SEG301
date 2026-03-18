import { Link, useLocation } from 'react-router-dom';
import { Search, BarChart3 } from 'lucide-react';

export default function Header() {
    const location = useLocation();
    const isDashboard = location.pathname === '/dashboard';

    return (
        <header className="h-14 bg-white border-b border-slate-200 sticky top-0 z-50">
            <div className="max-w-[1400px] mx-auto px-4 h-full flex items-center justify-between">
                {/* Logo with magnifying glass */}
                <Link to="/" className="flex items-center gap-2.5">
                    <div className="w-8 h-8 relative flex items-center justify-center">
                        <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
                            <circle cx="13" cy="13" r="10" stroke="#10B981" strokeWidth="2.5" fill="none" />
                            <path d="M21 21L28 28" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                    </div>
                    <span className="text-lg font-semibold tracking-tight">
                        <span className="text-slate-800">Price</span>
                        <span className="text-emerald-500">Hunter</span>
                    </span>
                </Link>

                {/* Navigation */}
                <nav className="flex items-center gap-2">
                    <Link
                        to="/"
                        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors
                            ${!isDashboard
                                ? 'text-emerald-600 bg-emerald-50'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        <Search className="w-4 h-4" />
                        Tìm kiếm
                    </Link>
                    <Link
                        to="/dashboard"
                        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors
                            ${isDashboard
                                ? 'text-emerald-600 bg-emerald-50'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        <BarChart3 className="w-4 h-4" />
                        Dashboard
                    </Link>
                </nav>
            </div>
        </header>
    );
}
