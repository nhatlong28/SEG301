import { Loader2, Package } from 'lucide-react';

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const sizeClasses = {
        sm: 'w-5 h-5',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
    };

    return (
        <div className="flex items-center justify-center p-8">
            <div className="relative">
                <Loader2 className={`${sizeClasses[size]} text-blue-600 animate-spin`} />
                <div className={`absolute inset-0 ${sizeClasses[size]} bg-blue-400/20 rounded-full blur-xl animate-pulse`} />
            </div>
        </div>
    );
}

export function LoadingCard() {
    return (
        <div className="glass-card rounded-2xl overflow-hidden card-hover">
            {/* Image Skeleton */}
            <div className="aspect-square skeleton relative">
                <div className="absolute inset-0 flex items-center justify-center">
                    <Package className="w-12 h-12 text-slate-300" />
                </div>
            </div>

            {/* Content Skeleton */}
            <div className="p-4 space-y-3">
                <div className="h-4 skeleton rounded-lg w-4/5" />
                <div className="h-4 skeleton rounded-lg w-3/5" />
                <div className="h-6 skeleton rounded-lg w-2/5 mt-4" />
                <div className="h-10 skeleton rounded-xl mt-4" />
            </div>
        </div>
    );
}

export function LoadingGrid({ count = 8 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="animate-fade-in"
                    style={{ animationDelay: `${i * 50}ms` }}
                >
                    <LoadingCard />
                </div>
            ))}
        </div>
    );
}

export function LoadingPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
            <div className="relative">
                <div className="w-20 h-20 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <Package className="w-8 h-8 text-blue-600" />
                </div>
            </div>
            <p className="text-slate-500 font-medium animate-pulse">Đang tải...</p>
        </div>
    );
}
