import { clsx } from 'clsx';
import { Platform } from '../types';

interface PlatformBadgeProps {
    platform: string;
    size?: 'sm' | 'md';
    showIcon?: boolean;
}

const platformConfig: Record<string, { name: string; color: string; icon: string }> = {
    shopee: {
        name: 'Shopee',
        color: 'bg-orange-100 text-orange-700 border-orange-200',
        icon: '🛒'
    },
    tiki: {
        name: 'Tiki',
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: '📦'
    },
    lazada: {
        name: 'Lazada',
        color: 'bg-purple-100 text-purple-700 border-purple-200',
        icon: '🏪'
    },
    cellphones: {
        name: 'CellphoneS',
        color: 'bg-red-100 text-red-700 border-red-200',
        icon: '📱'
    },
    dienmayxanh: {
        name: 'Điện Máy Xanh',
        color: 'bg-green-100 text-green-700 border-green-200',
        icon: '🔌'
    },
    thegioididong: {
        name: 'TGDĐ',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        icon: '📲'
    },
};

export default function PlatformBadge({ platform, size = 'md', showIcon = true }: PlatformBadgeProps) {
    const config = platformConfig[platform.toLowerCase()] || {
        name: platform,
        color: 'bg-gray-100 text-gray-700 border-gray-200',
        icon: '🏷️'
    };

    return (
        <span
            className={clsx(
                'inline-flex items-center gap-1 font-semibold rounded-full border',
                config.color,
                size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
            )}
        >
            {showIcon && <span>{config.icon}</span>}
            {config.name}
        </span>
    );
}

export function getPlatformColor(platform: string): string {
    return platformConfig[platform.toLowerCase()]?.color || 'bg-gray-100 text-gray-700';
}
