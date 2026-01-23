
import { KeywordService } from '../crawler/keywordService';

const BRANDS = [
    'Apple', 'Samsung', 'Xiaomi', 'Oppo', 'Vivo', 'Realme', 'Sony', 'LG', 'Panasonic', 'Toshiba',
    'Dyson', 'Philips', 'Electrolux', 'Daikin', 'Sharp', 'Asus', 'Dell', 'HP', 'Lenovo', 'MSI',
    'Acer', 'Logitech', 'Razer', 'Corsair', 'Nike', 'Adidas', 'Puma', 'MLB', 'New Balance',
    'Uniqlo', 'Zara', 'H&M', 'Honora', 'VinFast', 'Honda', 'Yamaha', 'Toyota', 'Mazda'
];

const MODELS = [
    '2024', '2025', '2026', 'Pro', 'Max', 'Ultra', 'Air', 'Mini', 'Plus', 'Series',
    'Gen 1', 'Gen 2', 'Gen 3', 'M1', 'M2', 'M3', 'M4', 'M5', 'Core i5', 'Core i7', 'Ryzen'
];

const CATEGORIES = [
    'Điện thoại', 'iPhone', 'Laptop', 'Máy tính', 'Tủ lạnh', 'Máy giặt', 'Điều hòa',
    'Máy lọc không khí', 'Robot hút bụi', 'Tai nghe', 'Loa', 'Đồng hồ', 'Máy ảnh',
    'Giày', 'Áo', 'Túi xách', 'Xe máy', 'Ghế massage'
];

async function main() {
    console.log('🚀 Generating 2000+ keywords...');
    let count = 0;

    for (const cat of CATEGORIES) {
        for (const brand of BRANDS) {
            // Variation 1: Category + Brand
            const kw1 = `${cat} ${brand}`;
            await KeywordService.addKeyword(kw1, 'Mass-Gen', 3, ['all']);
            count++;

            // Variation 2: Brand + Model
            for (const model of MODELS.slice(0, 5)) {
                const kw2 = `${brand} ${cat} ${model}`;
                await KeywordService.addKeyword(kw2, 'Mass-Gen', 3, ['all']);
                count++;
            }

            if (count > 2500) break;
        }
        if (count > 2500) break;
    }

    console.log(`\n✅ Generated total of ~${count} combinations (attempted injection).`);
}

main().catch(console.error);
