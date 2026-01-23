import { supabaseAdmin } from '../db/supabase';
import logger from '../utils/logger';
import axios from 'axios';

export interface CrawlCategory {
    id: number;
    name: string;
    slug: string;
    level: number;
    is_active: boolean;
    external_id?: string;
    parent_id?: number;
    product_count?: number;
}

export interface CategoryNode {
    id: number | string;
    name: string;
    slug: string;
    level: number;
    children: CategoryNode[];
    productCount?: number;
}

// Tiki category structure from API
interface TikiCategory {
    id: number;
    name: string;
    url_path: string;
    children?: TikiCategory[];
}

// Shopee category structure from API
interface ShopeeCategory {
    catid: number;
    display_name: string;
    parent_catid?: number;
    children?: ShopeeCategory[];
}

/**
 * Enhanced CategoryService with deep category tree traversal
 */
export class CategoryService {
    private static readonly TIKI_CATEGORY_API = 'https://tiki.vn/api/v2/categories';
    private static readonly SHOPEE_CATEGORY_API = 'https://shopee.vn/api/v4/pages/get_category_tree';

    /**
     * Get all active categories from database
     */
    static async getCategories(
        sourceId?: number,
        freshnessHours?: number
    ): Promise<CrawlCategory[]> {
        try {
            const query = (supabaseAdmin as any)
                .from('categories')
                .select('*')
                .eq('is_active', true);

            // Filter by source if specified
            if (sourceId) {
                query.or(`source_id.eq.${sourceId},source_id.is.null`);
            }

            const { data, error } = await query.order('id', { ascending: true });

            if (error) {
                logger.error('[CategoryService] Error fetching categories:', error);
                return [];
            }

            let categories = data || [];

            // Intelligent freshness check using crawl_logs
            if (freshnessHours && sourceId) {
                const threshold = new Date(Date.now() - freshnessHours * 60 * 60 * 1000).toISOString();

                const { data: recentLogs } = await (supabaseAdmin as any)
                    .from('crawl_logs')
                    .select('category_id')
                    .eq('source_id', sourceId)
                    .eq('status', 'completed')
                    .gte('started_at', threshold)
                    .not('category_id', 'is', null);

                if (recentLogs && recentLogs.length > 0) {
                    const recentlyCrawledIds = new Set(recentLogs.map((l: any) => l.category_id));
                    categories = categories.filter((cat: CrawlCategory) => !recentlyCrawledIds.has(cat.id));

                    if (categories.length < (data?.length || 0)) {
                        logger.info(`[CategoryService] Skipped ${(data?.length || 0) - categories.length} recently crawled categories`);
                    }
                }
            }

            return categories;
        } catch (error) {
            logger.error('[CategoryService] Failed to get categories:', error);
            return [];
        }
    }

    /**
     * Fetch FULL category tree from Tiki API
     * Returns all ~2000+ subcategories, with fallback to hardcoded list
     */
    static async fetchTikiCategoryTree(): Promise<CategoryNode[]> {
        try {
            logger.info('[CategoryService] Fetching Tiki category tree from API...');

            const response = await axios.get(this.TIKI_CATEGORY_API, {
                params: { include: 'children' },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                timeout: 10000,
            });

            const data = response.data?.data || response.data || [];
            const categories = this.parseTikiCategories(data, 0);

            if (categories.length > 0) {
                logger.info(`[CategoryService] Fetched ${this.countCategories(categories)} Tiki categories from API`);
                return categories;
            }
        } catch (error) {
            logger.warn('[CategoryService] Tiki API fail, using static categories');
        }

        // Fallback to comprehensive static list
        return [
            { id: '1789', name: 'Điện Thoại - Máy Tính Bảng', slug: 'dien-thoai-may-tinh-bang' },
            { id: '1883', name: 'Nhà Cửa - Đời Sống', slug: 'nha-cua-doi-song' },
            { id: '1815', name: 'Thiết Bị Số - Phụ Kiện Số', slug: 'thiet-bi-kts-phu-kien-so' },
            { id: '1882', name: 'Điện Gia Dụng', slug: 'dien-gia-dung' },
            { id: '1520', name: 'Làm Đẹp - Sức Khỏe', slug: 'lam-dep-suc-khoe' },
            { id: '1846', name: 'Laptop - Máy Vi Tính', slug: 'laptop-may-vi-tinh-linh-kien' },
            { id: '4221', name: 'Điện Tử - Điện Lạnh', slug: 'dien-tu-dien-lanh' },
            { id: '1801', name: 'Máy Ảnh - Máy Quay Phim', slug: 'may-anh' },
            { id: '915', name: 'Thời trang nam', slug: 'thoi-trang-nam' },
            { id: '931', name: 'Thời trang nữ', slug: 'thoi-trang-nu' },
            { id: '1686', name: 'Giày - Dép nam', slug: 'giay-dep-nam' },
            { id: '1703', name: 'Giày - Dép nữ', slug: 'giay-dep-nu' },
            { id: '8322', name: 'Nhà Sách Tiki', slug: 'nha-sach-tiki' },
            { id: '1975', name: 'Thể Thao - Dã Ngoại', slug: 'the-thao-da-ngoai' },
            { id: '2549', name: 'Mẹ & bé', slug: 'do-choi-me-be' },
            { id: '4384', name: 'Bách Hóa Online', slug: 'bach-hoa-online' },
            { id: '17166', name: 'Hàng Quốc Tế', slug: 'cross-border-hang-quoc-te' }
        ].map(c => ({ ...c, level: 0, children: [] }));
    }

    /**
     * Recursively parse Tiki category structure
     */
    private static parseTikiCategories(cats: TikiCategory[], level: number): CategoryNode[] {
        return cats.map(cat => ({
            id: cat.id,
            name: cat.name,
            slug: cat.url_path || String(cat.id),
            level,
            children: cat.children ? this.parseTikiCategories(cat.children, level + 1) : [],
        }));
    }

    /**
     * Fetch Shopee category tree with fallback
     */
    static async fetchShopeeCategoryTree(): Promise<CategoryNode[]> {
        try {
            logger.info('[CategoryService] Fetching Shopee category tree from API...');

            const response = await axios.get(this.SHOPEE_CATEGORY_API, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://shopee.vn/',
                },
                timeout: 10000,
            });

            const data = response.data?.data?.category_list || [];
            const categories = this.parseShopeeCategories(data, 0);

            if (categories.length > 0) {
                logger.info(`[CategoryService] Fetched ${this.countCategories(categories)} Shopee categories from API`);
                return categories;
            }
        } catch (error) {
            logger.warn('[CategoryService] Shopee API fail, using static categories');
        }

        // Fallback to comprehensive static list
        return [
            { id: '11036030', name: 'Điện Thoại & Phụ Kiện', slug: 'dien-thoai-phu-kien' },
            { id: '11035954', name: 'Máy Tính & Laptop', slug: 'may-tinh-laptop' },
            { id: '11036132', name: 'Thiết Bị Điện Tử', slug: 'thiet-bi-dien-tu' },
            { id: '11036971', name: 'Thiết Bị Điện Gia Dụng', slug: 'thiet-bi-dien-gia-dung' },
            { id: '11036101', name: 'Máy Ảnh & Máy Quay Phim', slug: 'may-anh-may-quay-phim' },
            { id: '11036279', name: 'Sắc Đẹp', slug: 'sac-dep' },
            { id: '11036345', name: 'Sức Khỏe', slug: 'suc-khoe' },
            { id: '11035567', name: 'Thời Trang Nam', slug: 'thoi-trang-nam' },
            { id: '11035639', name: 'Thời Trang Nữ', slug: 'thoi-trang-nữ' },
            { id: '11035801', name: 'Giày Dép Nam', slug: 'giay-dep-nam' },
            { id: '11035825', name: 'Giày Dép Nữ', slug: 'giay-dep-nu' },
            { id: '11036670', name: 'Nhà Cửa & Đời Sống', slug: 'nha-cua-doi-song' }
        ].map(c => ({ ...c, level: 0, children: [] }));
    }

    /**
     * Recursively parse Shopee category structure
     */
    private static parseShopeeCategories(cats: ShopeeCategory[], level: number): CategoryNode[] {
        return cats.map(cat => ({
            id: cat.catid,
            name: cat.display_name,
            slug: String(cat.catid),
            level,
            children: cat.children ? this.parseShopeeCategories(cat.children, level + 1) : [],
        }));
    }

    /**
     * Flatten category tree to list (for crawling)
     */
    static flattenCategories(tree: CategoryNode[]): CategoryNode[] {
        const result: CategoryNode[] = [];

        const traverse = (nodes: CategoryNode[]) => {
            for (const node of nodes) {
                result.push({ ...node, children: [] });
                if (node.children.length > 0) {
                    traverse(node.children);
                }
            }
        };

        traverse(tree);
        return result;
    }

    /**
     * Get all LEAF categories (categories with no children)
     * These are the most specific and have the most targeted products
     */
    static getLeafCategories(tree: CategoryNode[]): CategoryNode[] {
        const leaves: CategoryNode[] = [];

        const traverse = (nodes: CategoryNode[]) => {
            for (const node of nodes) {
                if (node.children.length === 0) {
                    leaves.push(node);
                } else {
                    traverse(node.children);
                }
            }
        };

        traverse(tree);
        return leaves;
    }

    /**
     * Count total categories in tree
     */
    private static countCategories(tree: CategoryNode[]): number {
        let count = tree.length;
        for (const node of tree) {
            count += this.countCategories(node.children);
        }
        return count;
    }

    /**
     * Fetch Lazada category tree (comprehensive hardcoded list)
     * Lazada doesn't have a public category API, so we use a comprehensive list
     */
    static async fetchLazadaCategoryTree(): Promise<CategoryNode[]> {
        return [
            { id: 'dien-thoai-di-dong', name: 'Mobiles', slug: 'dien-thoai-di-dong' },
            { id: 'shop-portable-speakers-&-boomboxes', name: 'Portable Speakers', slug: 'shop-portable-speakers-&-boomboxes' },
            { id: 'shop-smartwatch-&-fitness-trackers', name: 'Smartwatch', slug: 'shop-smartwatch-&-fitness-trackers' },
            { id: 'micro-phones', name: 'Microphones', slug: 'micro-phones' },
            { id: 'cap-dien-thoai', name: 'Phone Cables', slug: 'cap-dien-thoai' },
            { id: 'bo-sac-co-day-cho-dien-thoai', name: 'Wall Chargers', slug: 'bo-sac-co-day-cho-dien-thoai' },
            { id: 'shop-in-ear-headphones', name: 'In-Ear Headphones', slug: 'shop-in-ear-headphones' },
            { id: 'camera-ip-ket-noi-internet', name: 'IP Security Cameras', slug: 'camera-ip-ket-noi-internet' },
            { id: 'den-trang-tri-chuyen-dung', name: 'Fairy Lights', slug: 'den-trang-tri-chuyen-dung' },
            { id: 'op-lung-bao-da-dien-thoai', name: 'Phone Cases', slug: 'op-lung-bao-da-dien-thoai' },
            { id: 'duong-da-va-serum', name: 'Serum & Essence', slug: 'duong-da-va-serum' },
            { id: 'may-tinh-bang', name: 'Tablets', slug: 'may-tinh-bang' },
            { id: 'laptop', name: 'Laptops', slug: 'laptop' },
            { id: 'smart-tivi', name: 'Televisions', slug: 'smart-tivi' },
            { id: 'am-thanh', name: 'Audio', slug: 'am-thanh' },
            { id: 'tu-lanh', name: 'Refrigerators', slug: 'tu-lanh' },
            { id: 'may-giat', name: 'Washing Machines', slug: 'may-giat' },
            { id: 'lo-vi-song', name: 'Microwaves', slug: 'lo-vi-song' },
            { id: 'o-to-xe-may-thiet-bi-dinh-vi', name: 'Automotive', slug: 'o-to-xe-may-thiet-bi-dinh-vi' },
            { id: 'bach-hoa-online', name: 'Grocery', slug: 'bach-hoa-online' }
        ].map(c => ({ ...c, level: 0, children: [] }));
    }

    static async fetchDienmayxanhCategoryTree(): Promise<CategoryNode[]> {
        return [
            { id: 'may-lanh', name: 'Máy lạnh', slug: 'may-lanh' },
            { id: 'may-giat', name: 'Máy giặt', slug: 'may-giat' },
            { id: 'tu-lanh', name: 'Tủ lạnh', slug: 'tu-lanh' },
            { id: 'tivi', name: 'Tivi', slug: 'tivi' },
            { id: 'may-say-quan-ao', name: 'Máy sấy quần áo', slug: 'may-say-quan-ao' },
            { id: 'may-nuoc-nong', name: 'Máy nước nóng', slug: 'may-nuoc-nong' },
            { id: 'tu-dong', name: 'Tủ đông', slug: 'tu-dong' },
            { id: 'may-rua-chen', name: 'Máy rửa chén', slug: 'may-rua-chen' },
            { id: 'loa-ldp', name: 'Loa, Dàn âm thanh', slug: 'loa-ldp' },
            { id: 'micro-cac-loai', name: 'Micro', slug: 'micro-cac-loai' },
            { id: 'may-loc-nuoc', name: 'Máy lọc nước', slug: 'may-loc-nuoc' },
            { id: 'noi-com-dien', name: 'Nồi cơm điện', slug: 'noi-com-dien' },
            { id: 'noi-chien-khong-dau', name: 'Nồi chiên không dầu', slug: 'noi-chien-khong-dau' },
            { id: 'may-loc-khong-khi', name: 'Máy lọc không khí', slug: 'may-loc-khong-khi' },
            { id: 'robot-hut-bui', name: 'Robot hút bụi', slug: 'robot-hut-bui' },
            { id: 'may-hut-bui', name: 'Máy hút bụi', slug: 'may-hut-bui' },
            { id: 'bep-tu', name: 'Bếp từ', slug: 'bep-tu' },
            { id: 'bep-ga', name: 'Bếp ga', slug: 'bep-ga' },
            { id: 'quat', name: 'Quạt', slug: 'quat' },
            { id: 'dien-thoai', name: 'Điện thoại', slug: 'dien-thoai' },
            { id: 'laptop', name: 'Laptop', slug: 'laptop' },
            { id: 'may-tinh-bang', name: 'Tablet', slug: 'may-tinh-bang' },
            { id: 'dong-ho-thong-minh', name: 'Đồng hồ thông minh', slug: 'dong-ho-thong-minh' },
            { id: 'may-in', name: 'Máy in', slug: 'may-in' },
            { id: 'may-say-toc', name: 'Máy sấy tóc', slug: 'may-say-toc' },
            { id: 'ghe-massage', name: 'Ghế massage', slug: 'ghe-massage' },
            { id: 'camera-giam-sat', name: 'Camera giám sát', slug: 'camera-giam-sat' },
            { id: 'tai-nghe', name: 'Tai nghe', slug: 'tai-nghe' },
            { id: 'sac-dtdd', name: 'Sạc dự phòng', slug: 'sac-dtdd' }
        ].map(c => ({ ...c, level: 0, children: [] }));
    }

    static async fetchCellphonesCategoryTree(): Promise<CategoryNode[]> {
        return [
            { id: 'mobile', name: 'Điện thoại', slug: 'mobile' },
            { id: 'mobile/apple', name: 'iPhone', slug: 'mobile/apple' },
            { id: 'mobile/samsung', name: 'Samsung', slug: 'mobile/samsung' },
            { id: 'tablet', name: 'Tablet', slug: 'tablet' },
            { id: 'laptop', name: 'Laptop', slug: 'laptop' },
            { id: 'laptop/mac', name: 'MacBook', slug: 'laptop/mac' },
            { id: 'thiet-bi-am-thanh', name: 'Âm thanh', slug: 'thiet-bi-am-thanh' },
            { id: 'do-choi-cong-nghe', name: 'Đồng hồ', slug: 'do-choi-cong-nghe' },
            { id: 'do-gia-dung', name: 'Gia dụng', slug: 'do-gia-dung' },
            { id: 'tivi', name: 'Tivi', slug: 'tivi' }
        ].map(c => ({ ...c, level: 0, children: [] }));
    }


    /**
     * Get source-specific slug mapping
     */
    static getSourceSlug(category: CrawlCategory, source: string): string {
        const mapping: Record<string, Record<string, string>> = {
            'lazada': {
                'dien-thoai': 'dien-thoai-di-dong',
                'tablet': 'may-tinh-bang',
                'phu-kien': 'phu-kien-dien-thoai',
                'do-gia-dung': 'do-gia-dung-dien-tu',
                'dong-ho': 'thiet-bi-deo-thong-minh',
                'may-anh': 'may-anh-may-quay-phim',
                'laptop': 'laptop',
                'tivi': 'tivi',
            },
            'tiki': {
                'dien-thoai': '1789',
                'laptop': '1846',
                'tablet': '1789',
                'tivi': '1815',
                'may-anh': '1882',
                'do-gia-dung': '1883',
                'phu-kien': '1801',
                'dong-ho': '8594',
            },
            'dienmayxanh': {
                'dien-thoai': 'dien-thoai',
                'laptop': 'laptop',
                'tablet': 'may-tinh-bang',
                'tivi': 'tivi',
                'tu-lanh': 'tu-lanh',
                'may-giat': 'may-giat',
                'do-gia-dung': 'do-gia-dung',
            },
            'shopee': {
                'dien-thoai': 'Điện thoại',
                'laptop': 'Laptop',
                'tablet': 'Máy tính bảng',
            },
            'cellphones': {
                'dien-thoai': 'mobile',
                'laptop': 'laptop',
                'tablet': 'tablet',
                'phu-kien': 'phu-kien',
                'dong-ho': 'do-choi-cong-nghe/dong-ho-thong-minh',
            }
        };

        return mapping[source]?.[category.slug] || category.slug;
    }

    /**
     * Get all category IDs for a platform (flattened)
     */
    static async getAllCategoryIds(platform: 'tiki' | 'shopee' | 'lazada' | 'dienmayxanh' | 'cellphones'): Promise<string[]> {
        let tree: CategoryNode[] = [];

        switch (platform) {
            case 'tiki':
                tree = await this.fetchTikiCategoryTree();
                break;
            case 'shopee':
                tree = await this.fetchShopeeCategoryTree();
                break;
            case 'lazada':
                tree = await this.fetchLazadaCategoryTree();
                break;
            case 'dienmayxanh':
                tree = await this.fetchDienmayxanhCategoryTree();
                break;
            case 'cellphones':
                tree = await this.fetchCellphonesCategoryTree();
                break;
        }

        const flat = this.flattenCategories(tree);
        return flat.map(c => String(c.id));
    }

    /**
     * Fetch category tree for any platform
     */
    static async fetchCategoryTree(platform: string): Promise<CategoryNode[]> {
        switch (platform) {
            case 'tiki':
                return this.fetchTikiCategoryTree();
            case 'shopee':
                return this.fetchShopeeCategoryTree();
            case 'lazada':
                return this.fetchLazadaCategoryTree();
            case 'dienmayxanh':
                return this.fetchDienmayxanhCategoryTree();
            case 'cellphones':
                return this.fetchCellphonesCategoryTree();
            default:
                logger.warn(`[CategoryService] Unknown platform: ${platform}`);
                return [];
        }
    }
}

export default CategoryService;
