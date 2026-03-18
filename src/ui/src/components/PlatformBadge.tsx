

interface PlatformBadgeProps {
    platform: string;
    size?: 'sm' | 'md' | 'lg';
    showIcon?: boolean;
}

const PLATFORM_LOGOS: Record<string, string> = {
    shopee: 'https://static.chotot.com/storage/APP_WRAPPER/logo/c2c.png',
    tiki: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQYCQ5JVmYLvEXcaRltrNNapCu2Qeld8H5nBg&s',
    lazada: 'https://inkythuatso.com/uploads/images/2021/09/lazada-logo-inkythuatso-14-11-38-31.jpg',
    cellphones: 'https://media.licdn.com/dms/image/v2/D563DAQF7vmGn-qCPVQ/image-scale_191_1128/image-scale_191_1128/0/1714127984958/tuyendungcellphones_dienthoaivui_cover?e=2147483647&v=beta&t=xxDhn-mldGLzrCe6QJt_Nb8n7rO7EPxHoFp16ReXAO4',
    dienmayxanh: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS_JQCgom6CniwqoL8dkYBIK4nY_zbWRI9TqA&s',
    thegioididong: 'https://inuvdp.com/wp-content/uploads/2023/07/File-Vector-Logo-The-Gioi-Di-Dong-03.jpg',
    chotot: 'https://static.chotot.com/storage/APP_WRAPPER/logo/c2c.png',
};

const PLATFORM_NAMES: Record<string, string> = {
    shopee: 'Chợ Tốt',
    tiki: 'Tiki',
    lazada: 'Lazada',
    cellphones: 'CellphoneS',
    dienmayxanh: 'Điện Máy Xanh',
    thegioididong: 'TGDĐ',
    chotot: 'Chợ Tốt',
};

// Normalize DB platform names to lowercase keys
const normalizePlatformKey = (raw: string): string => {
    const lower = raw.toLowerCase().trim();
    const map: Record<string, string> = {
        'điện máy xanh': 'dienmayxanh',
        'dien may xanh': 'dienmayxanh',
        'thế giới di động': 'thegioididong',
        'the gioi di dong': 'thegioididong',
        'cellphones': 'cellphones',
        'cellphones.com.vn': 'cellphones',
    };
    return map[lower] || lower;
};

export default function PlatformBadge({
    platform,
    size = 'md',
}: PlatformBadgeProps) {
    const key = normalizePlatformKey(platform || 'unknown');
    const logo = PLATFORM_LOGOS[key];
    const name = PLATFORM_NAMES[key] || platform;

    // Thế Giới Di Động gets an extra-large container; Lazada slightly larger; others uniform
    const isTGDD = key === 'thegioididong';
    const isLazada = key === 'lazada';

    const getContainerSize = () => {
        switch (size) {
            case 'sm': return isTGDD ? 'w-32 h-12' : isLazada ? 'w-28 h-10' : 'w-24 h-8';
            case 'md': return isTGDD ? 'w-40 h-14' : isLazada ? 'w-36 h-12' : 'w-32 h-10';
            case 'lg': return isTGDD ? 'w-48 h-18' : isLazada ? 'w-44 h-16' : 'w-40 h-14';
            default: return 'w-32 h-10';
        }
    };

    if (!logo) {
        return (
            <div className={`${getContainerSize()} flex items-center justify-start`}>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                    {name}
                </span>
            </div>
        );
    }

    return (
        <div className={`${getContainerSize()} flex items-center justify-start overflow-hidden`}>
            <img
                src={logo}
                alt={name}
                title={name}
                className="w-full h-full object-contain object-left"
                onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                }}
            />
        </div>
    );
}
