import { Link, useLocation } from 'react-router-dom';
import { Search, BarChart3, Home, Zap } from 'lucide-react';

export default function Header() {
    const location = useLocation();
    const isHome = location.pathname === '/';

    return (
        <header className={`
      ${isHome ? 'absolute top-0 left-0 right-0 z-10' : 'bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50'}
    `}>
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
                            <Zap className="w-6 h-6 text-white" />
                        </div>
                        <span className={`
              font-bold text-xl
              ${isHome ? 'text-white' : 'text-slate-800'}
            `}>
                            PriceHunter
                        </span>
                    </Link>

                    {/* Navigation */}
                    <nav className="flex items-center gap-1">
                        <Link
                            to="/"
                            className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
                ${isHome
                                    ? 'text-white/80 hover:text-white hover:bg-white/10'
                                    : location.pathname === '/'
                                        ? 'bg-primary-50 text-primary-700'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }
              `}
                        >
                            <Home className="w-4 h-4" />
                            <span className="hidden sm:inline">Trang chủ</span>
                        </Link>

                        <Link
                            to="/search"
                            className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
                ${isHome
                                    ? 'text-white/80 hover:text-white hover:bg-white/10'
                                    : location.pathname === '/search'
                                        ? 'bg-primary-50 text-primary-700'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }
              `}
                        >
                            <Search className="w-4 h-4" />
                            <span className="hidden sm:inline">Tìm kiếm</span>
                        </Link>

                        <Link
                            to="/dashboard"
                            className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
                ${isHome
                                    ? 'text-white/80 hover:text-white hover:bg-white/10'
                                    : location.pathname === '/dashboard'
                                        ? 'bg-primary-50 text-primary-700'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }
              `}
                        >
                            <BarChart3 className="w-4 h-4" />
                            <span className="hidden sm:inline">Thống kê</span>
                        </Link>
                    </nav>
                </div>
            </div>
        </header>
    );
}
