
import { KeywordService } from './src/crawler/keywordService';

const NEW_KEYWORDS = [
    // Electronics / Tech
    { keyword: 'iPhone 16 Pro Max', category: 'Smartphone', applies_to: ['cellphones', 'thegioididong', 'tiki', 'lazada', 'chotot'] },
    { keyword: 'Samsung Galaxy S24 Ultra', category: 'Smartphone', applies_to: ['cellphones', 'thegioididong', 'tiki', 'lazada', 'chotot'] },
    { keyword: 'MacBook Pro M3', category: 'Laptop', applies_to: ['cellphones', 'thegioididong', 'tiki', 'lazada', 'chotot'] },
    { keyword: 'Laptop Gaming ASUS ROG', category: 'Laptop', applies_to: ['cellphones', 'thegioididong', 'tiki', 'lazada', 'chotot'] },
    { keyword: 'Bàn phím cơ không dây', category: 'Accessory', applies_to: ['all'] },
    { keyword: 'Tai nghe Sony WH-1000XM5', category: 'Audio', applies_to: ['all'] },
    { keyword: 'Máy chơi game PlayStation 5', category: 'Gaming', applies_to: ['all'] },
    { keyword: 'Nintendo Switch OLED', category: 'Gaming', applies_to: ['all'] },
    { keyword: 'iPad Pro OLED M4', category: 'Tablet', applies_to: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { keyword: 'Màn hình Dell UltraSharp', category: 'PC', applies_to: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },

    // Home Appliances
    { keyword: 'Máy lọc không khí Xiaomi', category: 'Home', applies_to: ['dienmayxanh', 'tiki', 'lazada'] },
    { keyword: 'Robot hút bụi Dreame L20', category: 'Home', applies_to: ['dienmayxanh', 'tiki', 'lazada'] },
    { keyword: 'Nồi chiên không dầu Philips', category: 'Kitchen', applies_to: ['dienmayxanh', 'tiki', 'lazada'] },
    { keyword: 'Máy pha cà phê Delonghi', category: 'Kitchen', applies_to: ['dienmayxanh', 'tiki', 'lazada'] },
    { keyword: 'Tủ lạnh Samsung Side by Side', category: 'Appliances', applies_to: ['dienmayxanh', 'tiki', 'lazada', 'chotot'] },
    { keyword: 'Máy rửa bát Bosch', category: 'Kitchen', applies_to: ['dienmayxanh', 'tiki', 'lazada'] },

    // Fashion / Beauty
    { keyword: 'Giày Nike Air Jordan 1', category: 'Fashion', applies_to: ['tiki', 'lazada', 'chotot'] },
    { keyword: 'Giày Adidas Samba', category: 'Fashion', applies_to: ['tiki', 'lazada', 'chotot'] },
    { keyword: 'Túi xách MLB chính hãng', category: 'Fashion', applies_to: ['tiki', 'lazada', 'chotot'] },
    { keyword: 'Son dưỡng Dior Lip Glow', category: 'Beauty', applies_to: ['tiki', 'lazada'] },
    { keyword: 'Nước hoa Chanel Bleu', category: 'Beauty', applies_to: ['tiki', 'lazada', 'chotot'] },
    { keyword: 'Kem chống nắng La Roche-Posay', category: 'Beauty', applies_to: ['tiki', 'lazada'] },

    // New Trending 2026
    { keyword: 'Laptop AI Copilot+', category: 'Tech', applies_to: ['cellphones', 'thegioididong', 'tiki', 'lazada'] },
    { keyword: 'Kính thực tế ảo Apple Vision Pro', category: 'Tech', applies_to: ['cellphones', 'tiki', 'lazada', 'chotot'] },
    { keyword: 'Xe đạp điện thông minh', category: 'Vehicle', applies_to: ['chotot', 'tiki', 'lazada'] },
    { keyword: 'Đồng hồ thông minh Garmin Fenix', category: 'Watch', applies_to: ['cellphones', 'thegioididong', 'tiki', 'lazada'] }
];

async function main() {
    console.log('🚀 Injecting new keywords...');
    let count = 0;
    for (const kw of NEW_KEYWORDS) {
        const success = await KeywordService.addKeyword(kw.keyword, kw.category, 1, kw.applies_to);
        if (success) {
            console.log(`✅ Added: ${kw.keyword}`);
            count++;
        }
    }
    console.log(`\n📊 Finished! Injected ${count} new keywords.`);
}

main().catch(console.error);
