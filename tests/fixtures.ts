/**
 * Test Fixtures
 * Vietnamese e-commerce product test data
 */

import { ProductData } from '../src/lib/entity-resolution/mlMatcher';

// Same product from different sources (should match)
export const iPhoneProducts: ProductData[] = [
    {
        externalId: 'tiki-iphone-001',
        sourceId: 1,
        name: 'iPhone 15 Pro Max 256GB Titanium Xanh Chính Hãng VN/A',
        brand: 'Apple',
        category: 'Điện thoại',
        price: 34990000,
        rating: 4.8,
        specs: { storage: '256GB', color: 'Titanium Blue', network: '5G' }
    },
    {
        externalId: 'shopee-iphone-001',
        sourceId: 2,
        name: 'Điện Thoại iPhone 15 ProMax 256G Xanh - Chính Hãng Apple',
        brand: 'Apple',
        category: 'Smartphone',
        price: 35500000,
        rating: 4.7,
        specs: { storage: '256GB', color: 'Blue Titanium', network: '5G' }
    },
    {
        externalId: 'lazada-iphone-001',
        sourceId: 3,
        name: 'Apple iPhone 15 Pro Max (256GB) - Blue Titanium',
        brand: 'Apple',
        category: 'Phone',
        price: 34800000,
        rating: 4.9,
        specs: { storage: '256GB', color: 'Blue Titanium' }
    },
];

export const samsungProducts: ProductData[] = [
    {
        externalId: 'dmx-samsung-001',
        sourceId: 4,
        name: 'Samsung Galaxy S24 Ultra 5G 256GB Titanium Black',
        brand: 'Samsung',
        category: 'Điện thoại',
        price: 31990000,
        rating: 4.7,
        specs: { storage: '256GB', color: 'Black', network: '5G' }
    },
    {
        externalId: 'cell-samsung-001',
        sourceId: 5,
        name: 'Galaxy S24 Ultra 256GB Đen - Samsung Chính Hãng',
        brand: 'Samsung',
        category: 'Smartphone',
        price: 32500000,
        rating: 4.6,
        specs: { storage: '256GB', color: 'Titanium Black' }
    },
];

export const xiaomiProducts: ProductData[] = [
    {
        externalId: 'shopee-xiaomi-001',
        sourceId: 2,
        name: 'Xiaomi Redmi Note 13 Pro+ 5G 256GB Xanh',
        brand: 'Xiaomi',
        category: 'Điện thoại',
        price: 9990000,
        rating: 4.5,
        specs: { storage: '256GB', color: 'Blue', network: '5G' }
    },
    {
        externalId: 'tiki-xiaomi-001',
        sourceId: 1,
        name: 'Redmi Note 13 Pro Plus 256GB Xanh Dương - Xiaomi',
        brand: 'Xiaomi',
        category: 'Smartphone',
        price: 10200000,
        rating: 4.4,
        specs: { storage: '256GB', color: 'Blue' }
    },
];

export const laptopProducts: ProductData[] = [
    {
        externalId: 'tiki-macbook-001',
        sourceId: 1,
        name: 'Laptop MacBook Air M2 2024 13 inch 8GB/256GB',
        brand: 'Apple',
        category: 'Laptop',
        price: 24990000,
        rating: 4.9,
        specs: { ram: '8GB', storage: '256GB', screen: '13.6 inch' }
    },
    {
        externalId: 'lazada-macbook-001',
        sourceId: 3,
        name: 'Apple MacBook Air 13" M2 Chip 8GB 256GB SSD',
        brand: 'Apple',
        category: 'Máy tính xách tay',
        price: 25200000,
        rating: 4.8,
        specs: { ram: '8GB', storage: '256GB', screen: '13.3"' }
    },
];

export const audioProducts: ProductData[] = [
    {
        externalId: 'shopee-airpods-001',
        sourceId: 2,
        name: 'Tai nghe AirPods Pro 2 USB-C Chính Hãng Apple',
        brand: 'Apple',
        category: 'Phụ kiện',
        price: 5990000,
        rating: 4.8,
    },
    {
        externalId: 'tiki-airpods-001',
        sourceId: 1,
        name: 'Apple AirPods Pro (2nd Gen) USB-C - Chính Hãng VN/A',
        brand: 'Apple',
        category: 'Tai nghe',
        price: 6190000,
        rating: 4.9,
    },
];

// Different products (should NOT match)
export const differentProducts: ProductData[] = [
    {
        externalId: 'tv-001',
        sourceId: 1,
        name: 'Tivi Sony Bravia XR-55X90L 55 inch 4K HDR',
        brand: 'Sony',
        category: 'Tivi',
        price: 22990000,
        rating: 4.7,
    },
    {
        externalId: 'washer-001',
        sourceId: 4,
        name: 'Máy giặt LG TurboDrum T2555VSAB 15.5kg',
        brand: 'LG',
        category: 'Đồ gia dụng',
        price: 15990000,
        rating: 4.5,
    },
    {
        externalId: 'fridge-001',
        sourceId: 4,
        name: 'Tủ lạnh Samsung Inverter 345L RT35K50822C/SV',
        brand: 'Samsung',
        category: 'Tủ lạnh',
        price: 12990000,
        rating: 4.6,
    },
];

// Variant products (same base product, different specs)
export const iPhoneVariants: ProductData[] = [
    {
        externalId: 'iphone-128gb-blue',
        sourceId: 1,
        name: 'iPhone 15 Pro Max 128GB Titanium Blue',
        brand: 'Apple',
        category: 'Điện thoại',
        price: 32990000,
        specs: { storage: '128GB', color: 'Blue' }
    },
    {
        externalId: 'iphone-256gb-blue',
        sourceId: 1,
        name: 'iPhone 15 Pro Max 256GB Titanium Blue',
        brand: 'Apple',
        category: 'Điện thoại',
        price: 34990000,
        specs: { storage: '256GB', color: 'Blue' }
    },
    {
        externalId: 'iphone-256gb-black',
        sourceId: 1,
        name: 'iPhone 15 Pro Max 256GB Titanium Black',
        brand: 'Apple',
        category: 'Điện thoại',
        price: 34990000,
        specs: { storage: '256GB', color: 'Black' }
    },
    {
        externalId: 'iphone-512gb-blue',
        sourceId: 1,
        name: 'iPhone 15 Pro Max 512GB Titanium Blue',
        brand: 'Apple',
        category: 'Điện thoại',
        price: 40990000,
        specs: { storage: '512GB', color: 'Blue' }
    },
];

// All test products combined
export const allTestProducts: ProductData[] = [
    ...iPhoneProducts,
    ...samsungProducts,
    ...xiaomiProducts,
    ...laptopProducts,
    ...audioProducts,
    ...differentProducts,
];

// String pairs for similarity testing
export const similarStringPairs: [string, string][] = [
    ['iPhone 15 Pro Max 256GB', 'Điện thoại iPhone 15 ProMax 256G'],
    ['Samsung Galaxy S24 Ultra', 'Galaxy S24 Ultra Samsung'],
    ['MacBook Air M2 2024 13 inch', 'Apple MacBook Air 13" M2'],
    ['AirPods Pro 2 USB-C', 'Apple AirPods Pro Gen 2 USB-C'],
    ['Xiaomi Redmi Note 13 Pro+', 'Redmi Note 13 Pro Plus Xiaomi'],
];

export const differentStringPairs: [string, string][] = [
    ['iPhone 15 Pro Max', 'Samsung Galaxy S24 Ultra'],
    ['MacBook Air', 'iPad Pro'],
    ['AirPods Pro', 'Galaxy Buds'],
    ['Tivi Sony', 'Máy giặt LG'],
];

// Product names for code extraction testing
export const productNamesForExtraction = [
    'iPhone 15 Pro Max 256GB Titanium Blue VN/A',
    'Samsung Galaxy S24 Ultra 512GB 5G Black',
    'Laptop Dell XPS 15 9530 Core i7-13700H 16GB 512GB',
    'Tivi Sony Bravia XR-55X90L 55 inch 4K HDR',
    'Máy giặt LG TurboDrum T2555VSAB 15.5kg',
    'Xiaomi Redmi Note 13 Pro+ 256GB RAM 8GB Xanh',
    'OPPO Reno 11 5G 256GB Xanh Dương',
    'MacBook Pro 14 inch M3 Pro 18GB 512GB 2023',
    'iPad Pro 12.9" M2 256GB WiFi + Cellular',
    'Apple Watch Series 9 GPS 45mm Aluminum',
];

// Mock raw products for intra-source dedup testing
export interface MockRawProduct {
    id: number;
    source_id: number;
    external_id: string;
    name: string;
    name_normalized?: string;
    brand_raw?: string;
    price?: number;
    rating?: number;
    review_count?: number;
    available?: boolean;
    url?: string;
    shop_id?: string;
}

export const intraSourceDuplicates: MockRawProduct[] = [
    // Same product, same source, different shops
    {
        id: 1,
        source_id: 2, // Shopee
        external_id: 'shopee-123',
        name: 'iPhone 15 Pro Max 256GB Chính Hãng',
        brand_raw: 'Apple',
        price: 34990000,
        rating: 4.8,
        review_count: 150,
        available: true,
        shop_id: 'shop-001'
    },
    {
        id: 2,
        source_id: 2, // Shopee (same source)
        external_id: 'shopee-456',
        name: 'iPhone 15 ProMax 256GB Chính Hãng VN/A',
        brand_raw: 'Apple',
        price: 34990000, // Same price
        rating: 4.7,
        review_count: 80,
        available: true,
        shop_id: 'shop-002'
    },
    // Different product same source
    {
        id: 3,
        source_id: 2, // Shopee
        external_id: 'shopee-789',
        name: 'Samsung Galaxy S24 Ultra 256GB',
        brand_raw: 'Samsung',
        price: 31990000,
        rating: 4.6,
        review_count: 200,
        available: true,
        shop_id: 'shop-003'
    },
    // Products from different source (not duplicates)
    {
        id: 4,
        source_id: 1, // Tiki
        external_id: 'tiki-123',
        name: 'iPhone 15 Pro Max 256GB Chính Hãng',
        brand_raw: 'Apple',
        price: 35000000,
        rating: 4.9,
        review_count: 300,
        available: true,
    },
];

// Canonical product mock for quality scoring
export const mockCanonical = {
    id: 1,
    name: 'iPhone 15 Pro Max 256GB',
    name_normalized: 'iphone 15 pro max 256gb',
    brand_id: 1,
    category_id: 1,
    description: 'Apple iPhone 15 Pro Max với chip A17 Pro',
    image_url: 'https://example.com/iphone15.jpg',
    min_price: 34800000,
    max_price: 35500000,
    avg_rating: 4.8,
    total_reviews: 530,
    source_count: 3,
};

// Cluster for quality scoring
export const mockCluster = [
    { id: 1, price: 34990000, rating: 4.8, review_count: 150, available: true, name: 'iPhone 15 Pro Max', specs: { storage: '256GB' } },
    { id: 2, price: 34800000, rating: 4.9, review_count: 200, available: true, name: 'iPhone 15 Pro Max', specs: { storage: '256GB' } },
    { id: 3, price: 35500000, rating: 4.7, review_count: 180, available: true, name: 'iPhone 15 Pro Max', specs: { storage: '256GB' } },
];
