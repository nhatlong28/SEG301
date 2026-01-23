
import { KeywordService } from '../crawler/keywordService';

const KEYWORDS_LIST = [
    // --- SMARTPHONES & TABLETS ---
    { q: 'iPhone 16 Pro Max', cat: 'Tech', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada', 'chotot'] },
    { q: 'iPhone 16 Plus', cat: 'Tech', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada', 'chotot'] },
    { q: 'iPhone 15 Pro Max cũ', cat: 'Tech', floor: ['cellphones', 'chotot'] },
    { q: 'Samsung Galaxy S24 Ultra', cat: 'Tech', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada', 'chotot'] },
    { q: 'Samsung Galaxy Z Fold6', cat: 'Tech', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { q: 'Samsung Galaxy Z Flip6', cat: 'Tech', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { q: 'Xiaomi 14 Ultra', cat: 'Tech', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { q: 'Xiaomi Redmi Note 13 Pro', cat: 'Tech', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { q: 'Oppo Reno12 Pro', cat: 'Tech', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { q: 'iPad Pro M4 OLED', cat: 'Tech', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { q: 'iPad Air M2', cat: 'Tech', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { q: 'Samsung Galaxy Tab S9 FE', cat: 'Tech', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { q: 'Google Pixel 9 Pro', cat: 'Tech', floor: ['cellphones', 'chotot', 'lazada'] },

    // --- LAPTOPS & PC ---
    { q: 'MacBook Air M3', cat: 'Laptop', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada', 'chotot'] },
    { q: 'MacBook Pro M3 Max', cat: 'Laptop', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada', 'chotot'] },
    { q: 'ASUS ROG Zephyrus G14 2024', cat: 'Laptop', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { q: 'Dell XPS 13 Plus', cat: 'Laptop', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { q: 'HP Spectre x360', cat: 'Laptop', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { q: 'Lenovo Legion 5 Pro', cat: 'Laptop', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { q: 'Acer Predator Helios Neo', cat: 'Laptop', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { q: 'Laptop AI Copilot+', cat: 'Laptop', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { q: 'Màn hình LG DualUp', cat: 'PC', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { q: 'Card đồ họa RTX 4090', cat: 'PC', floor: ['cellphones', 'tiki', 'lazada'] },

    // --- AUDIO & WEARABLES ---
    { q: 'Sony WH-1000XM5', cat: 'Audio', floor: ['all'] },
    { q: 'Sony WF-1000XM5', cat: 'Audio', floor: ['all'] },
    { q: 'AirPods Pro Gen 2 USB-C', cat: 'Audio', floor: ['all'] },
    { q: 'Loa Marshall Emberton II', cat: 'Audio', floor: ['all'] },
    { q: 'Loa JBL Charge 5', cat: 'Audio', floor: ['all'] },
    { q: 'Apple Watch Ultra 2', cat: 'Watch', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { q: 'Garmin Epix Gen 2', cat: 'Watch', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { q: 'Samsung Galaxy Watch Ultra', cat: 'Watch', floor: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },

    // --- HOME APPLIANCES & KITCHEN ---
    { q: 'Máy lọc không khí Xiaomi Elite', cat: 'Home', floor: ['dienmayxanh', 'tiki', 'lazada'] },
    { q: 'Robot hút bụi Dreame X30 Ultra', cat: 'Home', floor: ['dienmayxanh', 'tiki', 'lazada'] },
    { q: 'Robot hút bụi Roborock S8 Pro Ultra', cat: 'Home', floor: ['dienmayxanh', 'tiki', 'lazada'] },
    { q: 'Máy hút bụi Dyson V15 Detect', cat: 'Home', floor: ['dienmayxanh', 'tiki', 'lazada'] },
    { q: 'Nồi chiên không dầu Cosori', cat: 'Kitchen', floor: ['dienmayxanh', 'tiki', 'lazada'] },
    { q: 'Máy pha cà phê Breville 870', cat: 'Kitchen', floor: ['dienmayxanh', 'tiki', 'lazada', 'chotot'] },
    { q: 'Tủ lạnh LG Instaview', cat: 'Appliances', floor: ['dienmayxanh', 'tiki', 'lazada'] },
    { q: 'Máy giặt sấy Samsung Bespoke', cat: 'Appliances', floor: ['dienmayxanh', 'tiki', 'lazada'] },
    { q: 'Máy lọc nước Karofi Hydroen', cat: 'Home', floor: ['dienmayxanh', 'tiki', 'lazada'] },

    // --- FASHION & SNEAKERS ---
    { q: 'Giày Nike Air Force 1', cat: 'Fashion', floor: ['tiki', 'lazada', 'chotot'] },
    { q: 'Giày Adidas Samba OG', cat: 'Fashion', floor: ['tiki', 'lazada', 'chotot'] },
    { q: 'Giày New Balance 530', cat: 'Fashion', floor: ['tiki', 'lazada', 'chotot'] },
    { q: 'Giày MLB Big Ball Chunky', cat: 'Fashion', floor: ['tiki', 'lazada', 'chotot'] },
    { q: 'Áo thun Uniqlo Airism', cat: 'Fashion', floor: ['tiki', 'lazada', 'chotot'] },
    { q: 'Túi xách Coach', cat: 'Fashion', floor: ['tiki', 'lazada', 'chotot'] },
    { q: 'Kính mắt Gentle Monster', cat: 'Fashion', floor: ['tiki', 'lazada', 'chotot'] },

    // --- COSMETICS & HEALTH ---
    { q: 'Serum Estee Lauder Advanced Night Repair', cat: 'Beauty', floor: ['tiki', 'lazada'] },
    { q: 'Kem dưỡng Kiehl\'s Ultra Facial', cat: 'Beauty', floor: ['tiki', 'lazada'] },
    { q: 'Nước hoa Dior Sauvage', cat: 'Beauty', floor: ['tiki', 'lazada', 'chotot'] },
    { q: 'Máy tăm nước ProCare', cat: 'Health', floor: ['all'] },
    { q: 'Bàn chải điện Oral-B iO', cat: 'Health', floor: ['all'] },
    { q: 'Ghế massage toàn thân', cat: 'Health', floor: ['dienmayxanh', 'tiki', 'lazada', 'chotot'] },

    // --- VEHICLES & TOOLS (CHOTOT FAVORITES) ---
    { q: 'Honda Vision 2024', cat: 'Vehicle', floor: ['chotot'] },
    { q: 'Honda Sh Mode', cat: 'Vehicle', floor: ['chotot'] },
    { q: 'Air Blade 125', cat: 'Vehicle', floor: ['chotot'] },
    { q: 'Yamaha Exciter 155', cat: 'Vehicle', floor: ['chotot'] },
    { q: 'VinFast VF3', cat: 'Vehicle', floor: ['chotot'] },
    { q: 'Máy khoan pin Makita', cat: 'Tool', floor: ['tiki', 'lazada', 'chotot'] },
];

// Generate even more variations to reach "as many as possible"
const BRANDS = ['Apple', 'Samsung', 'Xiaomi', 'Sony', 'LG', 'Panasonic', 'Toshiba', 'Dyson', 'Philips', 'Nike', 'Adidas', 'Uniqlo'];
const CATEGORIES = ['Điện thoại', 'Laptop', 'Tủ lạnh', 'Máy giặt', 'Máy lọc không khí', 'Giày', 'Áo', 'Nồi cơm điện'];

async function main() {
    console.log('🚀 Massively injecting keywords...');
    let count = 0;

    // 1. Inject the curated list
    for (const kw of KEYWORDS_LIST) {
        const success = await KeywordService.addKeyword(kw.q, kw.cat, 1, kw.floor);
        if (success) count++;
    }

    // 2. Generate systematic variations
    const suffixes = ['mới nhất', 'chính hãng', 'giá rẻ', 'trả góp', '2025', '2026'];
    for (const brand of BRANDS) {
        for (const cat of CATEGORIES) {
            const kw = `${cat} ${brand}`;
            const success = await KeywordService.addKeyword(kw, 'Systematic', 2, ['all']);
            if (success) count++;
        }
    }

    console.log(`\n✅ Injected ${count} keywords successfully.`);
}

main().catch(console.error);
