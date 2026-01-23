

interface PlatformBadgeProps {
    platform: string;
    size?: 'sm' | 'md' | 'lg';
    showIcon?: boolean;
}

const PLATFORM_LOGOS: Record<string, string> = {
    shopee: 'https://rubee.com.vn/admin/webroot/upload/image//images/tin-tuc/Shopee-logo-1.jpg',
    tiki: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQYCQ5JVmYLvEXcaRltrNNapCu2Qeld8H5nBg&s',
    lazada: 'https://inkythuatso.com/uploads/images/2021/09/lazada-logo-inkythuatso-14-11-38-31.jpg',
    cellphones: 'https://media.licdn.com/dms/image/v2/D563DAQF7vmGn-qCPVQ/image-scale_191_1128/image-scale_191_1128/0/1714127984958/tuyendungcellphones_dienthoaivui_cover?e=2147483647&v=beta&t=xxDhn-mldGLzrCe6QJt_Nb8n7rO7EPxHoFp16ReXAO4',
    dienmayxanh: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS_JQCgom6CniwqoL8dkYBIK4nY_zbWRI9TqA&s',
    thegioididong: 'https://inuvdp.com/wp-content/uploads/2023/07/File-Vector-Logo-The-Gioi-Di-Dong-03.jpg',
};

const PLATFORM_NAMES: Record<string, string> = {
    shopee: 'Shopee',
    tiki: 'Tiki',
    lazada: 'Lazada',
    cellphones: 'CellphoneS',
    dienmayxanh: 'Điện Máy Xanh',
    thegioididong: 'TGDĐ',
};

export default function PlatformBadge({
    platform,
    size = 'md',
}: PlatformBadgeProps) {
    const key = platform?.toLowerCase() || 'unknown';
    const logo = PLATFORM_LOGOS[key];
    const name = PLATFORM_NAMES[key] || platform;

    // Top 2 platforms (Shopee, Tiki) keep original size
    // Bottom 4 platforms (Lazada, CellphoneS, DMX, TGDĐ) are 3x larger
    const isLargePlatform = ['lazada', 'cellphones', 'dienmayxanh', 'thegioididong'].includes(key);

    const getLogoSize = () => {
        if (size === 'sm') {
            // For filter sidebar
            return isLargePlatform ? 'w-20 h-12' : 'w-12 h-12';
        }
        // For other uses
        return isLargePlatform ? 'w-16 h-10' : 'w-10 h-10';
    };

    if (!logo) {
        return (
            <span className="text-xs text-slate-500 font-medium">
                {name}
            </span>
        );
    }

    return (
        <img
            src={logo}
            alt={name}
            title={name}
            className={`${getLogoSize()} object-contain rounded`}
            onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
            }}
        />
    );
}
