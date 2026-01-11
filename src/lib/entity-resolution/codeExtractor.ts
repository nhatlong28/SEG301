/**
 * Product Code Extraction Engine
 * Extracts brand, model, storage, color, and variant from product names
 */

export interface ExtractedCode {
    brand?: string;
    model?: string;
    modelNumber?: string;
    storage?: string;
    ram?: string;
    color?: string;
    variants?: string[]; // Renamed from single 'variant' string to array to capture multiple
    variant?: string; // Keep for backward compatibility if needed, or deprecate
    year?: string;
    type?: 'device' | 'accessory' | 'unknown';
    confidence: number;
}

export class ProductCodeExtractor {
    // Brand patterns with aliases
    private readonly brandPatterns: Record<string, RegExp> = {
        apple: /\b(apple|iphone|ipad|macbook|airpods?|imac|mac\s*mini|apple\s*watch)\b/i,
        samsung: /\b(samsung|galaxy\s*(s|a|m|z|note|tab|fold|flip)?\d*|galaxy\s*buds?)\b/i,
        xiaomi: /\b(xiaomi|redmi|poco|mi\s*\d+|mi\s*mix|mi\s*note)\b/i,
        oppo: /\b(oppo|reno\s*\d*|find\s*x?\d*|a\d{2,3})\b/i,
        vivo: /\b(vivo|y\d{2}|x\d{2}|v\d{2}|iqoo)\b/i,
        realme: /\b(realme)\b/i,
        oneplus: /\b(oneplus|one\s*plus)\b/i,
        huawei: /\b(huawei|honor|mate\s*\d+|p\d{2})\b/i,
        nokia: /\b(nokia)\b/i,
        sony: /\b(sony|xperia)\b/i,
        lg: /\b(lg\s+\w+|lg)\b/i,
        asus: /\b(asus|rog\s*phone|zenfone)\b/i,
        acer: /\b(acer|predator|aspire|nitro|swift)\b/i,
        dell: /\b(dell|xps|inspiron|latitude|alienware|vostro)\b/i,
        hp: /\b(hp|pavilion|envy|omen|spectre|elitebook|probook)\b/i,
        lenovo: /\b(lenovo|thinkpad|ideapad|legion|yoga)\b/i,
        msi: /\b(msi)\b/i,
        google: /\b(google\s*pixel|pixel\s*\d+)\b/i,
        tcl: /\b(tcl)\b/i,
        philips: /\b(philips)\b/i,
        panasonic: /\b(panasonic)\b/i,
    };

    // Phone model patterns
    private readonly phoneModelPatterns: RegExp[] = [
        // iPhone: "iPhone 13", "iPhone 13 Pro Max"
        /iphone\s*(\d{1,2})(\s*(pro|plus|mini|max|se))?(\s*(pro\s*max|max\s*pro))?/i,
        // Samsung Galaxy: "Galaxy S21", "Galaxy A52"
        /galaxy\s*(s|a|m|z|note|fold|flip)?\s*(\d{1,2})(\s*(ultra|plus|\+|fe|5g))?/i,
        // Xiaomi: "Redmi Note 11", "Mi 11 Ultra"
        /(redmi|poco|mi)\s*(note\s*)?\s*(\d{1,2})(\s*(pro|ultra|lite|5g))?/i,
        // OPPO: "OPPO Reno 7", "OPPO Find X5"
        /(reno|find\s*x?)\s*(\d{1,2})(\s*(pro|lite|5g))?/i,
        // Vivo: "Vivo Y21", "Vivo X70"
        /(vivo\s*)?(y|x|v)\s*(\d{2})(\s*(pro|5g))?/i,
        // OnePlus: "OnePlus 10 Pro"
        /oneplus\s*(\d{1,2})(\s*(pro|t|r))?/i,
        // Google Pixel
        /pixel\s*(\d{1,2})(\s*(pro|a|xl))?/i,
    ];

    // Storage patterns
    private readonly storagePatterns: RegExp[] = [
        /(\d{2,4})\s*gb/i,
        /(\d)\s*tb/i,
        /(\d{3,4})\s*g\b/i,
    ];

    // RAM patterns
    private readonly ramPatterns: RegExp[] = [
        /(\d{1,2})\s*gb\s*ram/i,
        /ram\s*(\d{1,2})\s*gb/i,
        /(\d{1,2})gb\/\d+gb/i, // "8GB/128GB" format
        /(\d{1,2})\s*gb\s+(?=\d{2,4}\s*gb)/i, // "16GB 512GB" context (RAM before Storage)
    ];

    // Color patterns (Vietnamese + English)
    private readonly colorPatterns: Record<string, RegExp> = {
        black: /\b(black|đen|midnight|space\s*gray|graphite)\b/i,
        white: /\b(white|trắng|silver|bạc|starlight)\b/i,
        gold: /\b(gold|vàng|gold|champagne)\b/i,
        blue: /\b(blue|xanh\s*dương|sierra\s*blue|pacific\s*blue|ocean\s*blue)\b/i,
        green: /\b(green|xanh\s*lá|alpine\s*green)\b/i,
        red: /\b(red|đỏ|product\s*red)\b/i,
        purple: /\b(purple|tím|violet)\b/i,
        pink: /\b(pink|hồng|rose)\b/i,
        gray: /\b(gray|grey|xám)\b/i,
    };

    // Accessory keywords
    private readonly accessoryKeywords: RegExp[] = [
        /\b(ốp|case|bao da|bao đựng|túi chống sốc|cover)\b/i,
        /\b(kính|cường lực|screen protector|film|dán màn hình)\b/i,
        /\b(sáp|sạc|charger|adapter|cáp|cable|dây sạc)\b/i,
        /\b(tai nghe|headphone|earphone|airpods|buds|headset)\b/i,
        /\b(đế|stand|giá đỡ|tripod|gậy)\b/i,
        /\b(chuột|mouse|bàn phím|keyboard|pen|bút)\b/i
    ];

    // Device keywords (Explicit)
    private readonly deviceKeywords: RegExp[] = [
        /\b(điện thoại|smartphone|mobile|phone)\b/i,
        /\b(laptop|máy tính|notebook|macbook|imac|surface|zenbook|vivobook|thinkpad|ideapad)\b/i,
        /\b(tivi|tv|television)\b/i,
        /\b(máy tính bảng|tablet|ipad|tab)\b/i,
        /\b(đồng hồ|watch|smartwatch)\b/i,
        /\b(tủ lạnh|fridge|refrigerator)\b/i,
        /\b(máy giặt|washing|washer)\b/i,
        // Specific high-value product lines that imply device if not accessory
        /\b(iphone|galaxy|xperia|pixel|reno|redmi|poco|rog|legion)\b/i
    ];

    // Variant patterns (Vietnamese market specific)
    private readonly variantPatterns: RegExp[] = [
        /\b(vn\/a|vn|chính\s*hãng)\b/i,
        /\b(quốc\s*tế|global)\b/i,
        /\b(like\s*new|99%|likenew)\b/i,
        /\b(fullbox|full\s*box)\b/i,
        /\b(mới|new)\b/i,
    ];

    extract(productName: string): ExtractedCode {
        const lowerName = productName.toLowerCase();
        const code: ExtractedCode = { confidence: 0 };
        let confidencePoints = 0;

        // Detect Type
        code.type = this.detectProductType(lowerName);

        // Extract brand
        for (const [brand, pattern] of Object.entries(this.brandPatterns)) {
            if (pattern.test(lowerName)) {
                code.brand = brand;
                confidencePoints += 0.2;
                break;
            }
        }

        // Extract model
        for (const pattern of this.phoneModelPatterns) {
            const match = productName.match(pattern);
            if (match) {
                code.model = match[0].trim();
                code.modelNumber = this.normalizeModel(match[0]);
                confidencePoints += 0.25;
                break;
            }
        }

        // Extract storage
        for (const pattern of this.storagePatterns) {
            const match = productName.match(pattern);
            if (match) {
                let storage = parseInt(match[1]);
                // Convert TB to GB
                if (pattern.source.includes('tb')) {
                    storage *= 1024;
                }
                code.storage = `${storage}GB`;
                confidencePoints += 0.2;
                break;
            }
        }

        // Extract RAM
        for (const pattern of this.ramPatterns) {
            const match = productName.match(pattern);
            if (match) {
                code.ram = `${match[1]}GB`;
                confidencePoints += 0.1;
                break;
            }
        }

        // Extract color
        for (const [color, pattern] of Object.entries(this.colorPatterns)) {
            if (pattern.test(productName)) {
                code.color = color;
                confidencePoints += 0.1;
                break;
            }
        }

        // Extract variant
        for (const pattern of this.variantPatterns) {
            const match = productName.match(pattern);
            if (match) {
                code.variant = match[0].toLowerCase();
                confidencePoints += 0.05;
                break;
            }
        }

        // Extract year
        const yearMatch = productName.match(/\b(202[0-9]|201[0-9])\b/);
        if (yearMatch) {
            code.year = yearMatch[1];
            confidencePoints += 0.1;
        }

        code.confidence = Math.min(confidencePoints, 1);
        return code;
    }

    /**
     * Create canonical code for matching
     * "iPhone 13 Pro 128GB Black" → "apple-iphone13pro-128gb"
     */
    toCanonicalCode(extracted: ExtractedCode): string {
        const parts: string[] = [];

        if (extracted.brand) {
            parts.push(extracted.brand);
        }

        if (extracted.modelNumber) {
            parts.push(extracted.modelNumber);
        }

        if (extracted.storage) {
            parts.push(extracted.storage.toLowerCase());
        }

        if (extracted.ram) {
            parts.push(`ram${extracted.ram.toLowerCase()}`);
        }

        return parts.join('-') || 'unknown';
    }

    /**
     * Detect product type based on keywords
     */
    private detectProductType(lowerName: string): 'device' | 'accessory' | 'unknown' {
        // Check for accessory keywords first (greedy)
        for (const pattern of this.accessoryKeywords) {
            if (pattern.test(lowerName)) return 'accessory';
        }

        // Check for device keywords
        for (const pattern of this.deviceKeywords) {
            if (pattern.test(lowerName)) return 'device';
        }

        return 'unknown';
    }

    /**
     * Normalize model name for comparison
     */
    private normalizeModel(model: string): string {
        return model
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/plus|\+/g, 'plus')
            .replace(/pro\s*max/g, 'promax')
            .replace(/max\s*pro/g, 'promax')
            .replace(/ultra/g, 'ultra'); // Explicitly handle Ultra
    }

    /**
     * Compare two extracted codes
     */
    compareExtractedCodes(code1: ExtractedCode, code2: ExtractedCode): number {
        // Critical: Type Mismatch Check
        if (code1.type && code2.type) {
            // One is accessory, one is device -> Immediate mismatch
            if (
                (code1.type === 'accessory' && code2.type === 'device') ||
                (code1.type === 'device' && code2.type === 'accessory')
            ) {
                return 0;
            }
        }

        let score = 0;
        let totalWeight = 0;

        // Brand match (weight: 0.2)
        if (code1.brand && code2.brand) {
            totalWeight += 0.2;
            if (code1.brand === code2.brand) {
                score += 0.2;
            }
        }

        // Model match (weight: 0.35)
        if (code1.modelNumber && code2.modelNumber) {
            totalWeight += 0.35;
            if (code1.modelNumber === code2.modelNumber) {
                score += 0.35;
            }
        }

        // Storage match (weight: 0.25)
        if (code1.storage && code2.storage) {
            totalWeight += 0.25;
            if (code1.storage === code2.storage) {
                score += 0.25;
            }
        }

        // RAM match (weight: 0.1)
        if (code1.ram && code2.ram) {
            totalWeight += 0.1;
            if (code1.ram === code2.ram) {
                score += 0.1;
            }
        }

        // Color match (weight: 0.1)
        if (code1.color && code2.color) {
            totalWeight += 0.1;
            if (code1.color === code2.color) {
                score += 0.1;
            }
        }

        return totalWeight > 0 ? score / totalWeight : 0;
    }
}
