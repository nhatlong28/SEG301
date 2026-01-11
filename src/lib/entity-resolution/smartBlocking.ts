/**
 * Smart Blocking Strategy (Gap 1 Fix)
 * Multi-level blocking for improved variant handling and matching accuracy
 */

import { ProductCodeExtractor, ExtractedCode } from './codeExtractor';

export interface BlockingKey {
    level: number;
    type: 'brand' | 'model' | 'storage' | 'category_price';
    key: string;
}

export class SmartBlockingStrategy {
    private extractor = new ProductCodeExtractor();

    /**
     * Generate multiple blocking keys for a product
     * Products in the same block are potential matches
     */
    generateBlocks(product: {
        name: string;
        name_normalized?: string;
        brand_raw?: string;
        category_raw?: string;
        price?: number;
    }): BlockingKey[] {
        const blocks: BlockingKey[] = [];
        const name = product.name_normalized || product.name;
        const extracted = this.extractor.extract(name);

        // Level 1: Brand (widest, catches most variants)
        const brand = this.normalizeBrand(product.brand_raw || extracted.brand || 'unknown');
        blocks.push({
            level: 1,
            type: 'brand',
            key: `brand:${brand}`,
        });

        // Level 2: Brand + Model (narrower, more precise)
        const model = this.extractModel(name, extracted);
        if (model) {
            blocks.push({
                level: 2,
                type: 'model',
                key: `model:${brand}|${model}`,
            });
        }

        // Level 3: Brand + Storage (for variant grouping)
        const storage = extracted.storage || this.extractStorage(name);
        if (storage) {
            blocks.push({
                level: 3,
                type: 'storage',
                key: `storage:${brand}|${storage}`,
            });
        }

        // Level 4: Category + Price Range (cross-category matching)
        const category = this.normalizeCategory(product.category_raw);
        const priceRange = this.getPriceRange(product.price);
        if (category) {
            blocks.push({
                level: 4,
                type: 'category_price',
                key: `catprice:${category}|${priceRange}`,
            });
        }

        return blocks;
    }

    /**
     * Get primary blocking key for efficient grouping
     */
    getPrimaryBlockKey(product: {
        name: string;
        name_normalized?: string;
        brand_raw?: string;
    }): string {
        const name = product.name_normalized || product.name;
        const extracted = this.extractor.extract(name);
        const brand = this.normalizeBrand(product.brand_raw || extracted.brand || 'unknown');
        const model = this.extractModel(name, extracted);

        if (model) {
            return `${brand}|${model}`;
        }

        // Fallback to brand + first 25 chars
        const prefix = name.toLowerCase().substring(0, 25).replace(/\s+/g, ' ').trim();
        return `${brand}|${prefix}`;
    }

    /**
     * Extract model identifier from product name
     */
    private extractModel(name: string, extracted: ExtractedCode): string | null {
        // Use extracted model if available
        if (extracted.modelNumber) {
            return extracted.modelNumber;
        }

        // Common model patterns
        const modelPatterns = [
            // iPhone patterns: iPhone 15 Pro Max -> iphone15promax
            /iphone\s*(\d{1,2})\s*(pro\s*max|pro|plus|mini)?/i,
            // Samsung patterns: Galaxy S24 Ultra -> galaxys24ultra
            /galaxy\s*(s|a|m|z|note|fold|flip)?\s*(\d{1,2})\s*(ultra|plus|fe|5g)?/i,
            // Xiaomi patterns: Redmi Note 13 Pro -> redminote13pro
            /(redmi|poco|mi)\s*(note)?\s*(\d{1,2})\s*(pro|ultra|lite)?/i,
            // MacBook patterns: MacBook Air M2 -> macbookairm2
            /macbook\s*(air|pro)?\s*(m\d)?/i,
            // Generic laptop patterns: Dell XPS 15 -> dellxps15
            /(xps|inspiron|thinkpad|ideapad|legion)\s*(\d{2,4})?/i,
        ];

        const lowerName = name.toLowerCase();
        for (const pattern of modelPatterns) {
            const match = lowerName.match(pattern);
            if (match) {
                return match[0].replace(/\s+/g, '').toLowerCase();
            }
        }

        return null;
    }

    /**
     * Extract storage from product name
     */
    private extractStorage(name: string): string | null {
        const match = name.match(/(\d{2,4})\s*gb/i);
        if (match) {
            return `${match[1]}GB`;
        }
        const tbMatch = name.match(/(\d)\s*tb/i);
        if (tbMatch) {
            return `${parseInt(tbMatch[1]) * 1024}GB`;
        }
        return null;
    }

    /**
     * Normalize brand name
     */
    private normalizeBrand(brand: string): string {
        const normalized = brand.toLowerCase().trim();

        // Brand aliases
        const aliases: Record<string, string> = {
            'apple': 'apple',
            'iphone': 'apple',
            'ipad': 'apple',
            'macbook': 'apple',
            'samsung': 'samsung',
            'galaxy': 'samsung',
            'xiaomi': 'xiaomi',
            'redmi': 'xiaomi',
            'poco': 'xiaomi',
            'oppo': 'oppo',
            'reno': 'oppo',
            'vivo': 'vivo',
            'realme': 'realme',
            'oneplus': 'oneplus',
            'one plus': 'oneplus',
            'huawei': 'huawei',
            'honor': 'huawei',
        };

        return aliases[normalized] || normalized;
    }

    /**
     * Normalize category name
     */
    private normalizeCategory(category?: string): string | null {
        if (!category) return null;

        const lowerCat = category.toLowerCase();

        const categoryMap: Record<string, string[]> = {
            'phone': ['điện thoại', 'mobile', 'smartphone', 'phone'],
            'laptop': ['laptop', 'máy tính xách tay', 'macbook', 'notebook'],
            'tablet': ['tablet', 'máy tính bảng', 'ipad'],
            'audio': ['tai nghe', 'headphone', 'earphone', 'airpods', 'speaker', 'loa'],
            'watch': ['đồng hồ', 'smartwatch', 'watch', 'apple watch'],
            'tv': ['tivi', 'tv', 'television', 'smart tv'],
            'appliance': ['tủ lạnh', 'máy giặt', 'điều hòa', 'fridge', 'washer', 'ac'],
        };

        for (const [normalized, keywords] of Object.entries(categoryMap)) {
            if (keywords.some(kw => lowerCat.includes(kw))) {
                return normalized;
            }
        }

        return category.toLowerCase().substring(0, 20);
    }

    /**
     * Get price range bucket
     */
    getPriceRange(price?: number): 'budget' | 'mid' | 'premium' | 'flagship' | 'unknown' {
        if (!price || price <= 0) return 'unknown';

        if (price < 3000000) return 'budget';      // < 3M VND
        if (price < 10000000) return 'mid';        // 3-10M VND
        if (price < 25000000) return 'premium';    // 10-25M VND
        return 'flagship';                          // > 25M VND
    }

    /**
     * Check if two products should be in the same block
     */
    shouldBeInSameBlock(
        product1: { name: string; brand_raw?: string; price?: number },
        product2: { name: string; brand_raw?: string; price?: number },
        minBlockLevel: number = 2
    ): boolean {
        const blocks1 = this.generateBlocks(product1);
        const blocks2 = this.generateBlocks(product2);

        // Check if any blocks match at or above minimum level
        for (const b1 of blocks1) {
            if (b1.level < minBlockLevel) continue;
            for (const b2 of blocks2) {
                if (b2.level < minBlockLevel) continue;
                if (b1.key === b2.key) {
                    return true;
                }
            }
        }

        return false;
    }
}

export const smartBlockingStrategy = new SmartBlockingStrategy();
