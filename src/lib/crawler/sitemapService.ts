/**
 * Sitemap Crawler Service
 * Parses XML sitemaps to discover ALL product URLs for mass crawling
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '@/lib/utils/logger';

export interface SitemapUrl {
    loc: string;
    lastmod?: string;
    changefreq?: string;
    priority?: number;
}

export interface SitemapIndex {
    loc: string;
    lastmod?: string;
}

/**
 * Known sitemap URLs for Vietnamese e-commerce platforms
 */
export const PLATFORM_SITEMAPS: Record<string, string[]> = {
    tiki: [
        'https://tiki.vn/sitemap.xml',
        'https://tiki.vn/sitemap-product.xml',
    ],
    lazada: [
        'https://www.lazada.vn/sitemap.xml',
    ],
    dienmayxanh: [
        'https://www.dienmayxanh.com/sitemap.xml',
        'https://www.dienmayxanh.com/sitemap-san-pham.xml',
    ],
    cellphones: [
        'https://cellphones.com.vn/sitemap.xml',
    ],
    // Shopee doesn't expose public sitemaps - use API instead
};

/**
 * SitemapService - Parse and crawl XML sitemaps
 */
export class SitemapService {
    private readonly timeout = 30000;
    private readonly userAgent = 'Mozilla/5.0 (compatible; ProductCrawler/1.0)';

    /**
     * Fetch and parse a sitemap URL
     */
    async fetchSitemap(url: string): Promise<SitemapUrl[]> {
        try {
            logger.info(`[Sitemap] Fetching: ${url}`);

            const response = await axios.get(url, {
                timeout: this.timeout,
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/xml, text/xml, */*',
                },
                responseType: 'text',
            });

            const xml = response.data;
            return this.parseUrlset(xml);
        } catch (error) {
            logger.error(`[Sitemap] Failed to fetch ${url}:`, error);
            return [];
        }
    }

    /**
     * Fetch sitemap index and get all child sitemaps
     */
    async fetchSitemapIndex(url: string): Promise<SitemapIndex[]> {
        try {
            logger.info(`[Sitemap] Fetching index: ${url}`);

            const response = await axios.get(url, {
                timeout: this.timeout,
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/xml, text/xml, */*',
                },
                responseType: 'text',
            });

            const xml = response.data;
            return this.parseSitemapIndex(xml);
        } catch (error) {
            logger.error(`[Sitemap] Failed to fetch index ${url}:`, error);
            return [];
        }
    }

    /**
     * Parse <urlset> XML structure
     */
    private parseUrlset(xml: string): SitemapUrl[] {
        const urls: SitemapUrl[] = [];
        const $ = cheerio.load(xml, { xmlMode: true });

        $('url').each((_, el) => {
            const loc = $(el).find('loc').text().trim();
            if (loc) {
                urls.push({
                    loc,
                    lastmod: $(el).find('lastmod').text().trim() || undefined,
                    changefreq: $(el).find('changefreq').text().trim() || undefined,
                    priority: parseFloat($(el).find('priority').text()) || undefined,
                });
            }
        });

        logger.info(`[Sitemap] Parsed ${urls.length} URLs`);
        return urls;
    }

    /**
     * Parse <sitemapindex> XML structure
     */
    private parseSitemapIndex(xml: string): SitemapIndex[] {
        const sitemaps: SitemapIndex[] = [];
        const $ = cheerio.load(xml, { xmlMode: true });

        $('sitemap').each((_, el) => {
            const loc = $(el).find('loc').text().trim();
            if (loc) {
                sitemaps.push({
                    loc,
                    lastmod: $(el).find('lastmod').text().trim() || undefined,
                });
            }
        });

        logger.info(`[Sitemap] Found ${sitemaps.length} child sitemaps`);
        return sitemaps;
    }

    /**
     * Recursively crawl all sitemaps from index
     */
    async crawlAllSitemaps(indexUrl: string): Promise<SitemapUrl[]> {
        const allUrls: SitemapUrl[] = [];

        // First, try as sitemap index
        const sitemaps = await this.fetchSitemapIndex(indexUrl);

        if (sitemaps.length > 0) {
            // It's an index, crawl all child sitemaps
            for (const sitemap of sitemaps) {
                const urls = await this.fetchSitemap(sitemap.loc);
                allUrls.push(...urls);

                // Rate limit between sitemaps
                await this.sleep(500);
            }
        } else {
            // It's a direct urlset
            const urls = await this.fetchSitemap(indexUrl);
            allUrls.push(...urls);
        }

        return allUrls;
    }

    /**
     * Filter URLs to only product pages
     */
    filterProductUrls(urls: SitemapUrl[], patterns: RegExp[]): SitemapUrl[] {
        return urls.filter(url => {
            return patterns.some(pattern => pattern.test(url.loc));
        });
    }

    /**
     * Get product URLs for a specific platform
     */
    async getProductUrls(platform: string): Promise<string[]> {
        const sitemapUrls = PLATFORM_SITEMAPS[platform];
        if (!sitemapUrls || sitemapUrls.length === 0) {
            logger.warn(`[Sitemap] No sitemaps configured for ${platform}`);
            return [];
        }

        const allUrls: string[] = [];
        const productPatterns = this.getProductPatterns(platform);

        for (const sitemapUrl of sitemapUrls) {
            try {
                const urls = await this.crawlAllSitemaps(sitemapUrl);
                const productUrls = this.filterProductUrls(urls, productPatterns);
                allUrls.push(...productUrls.map(u => u.loc));
                logger.info(`[Sitemap] ${platform}: Found ${productUrls.length} product URLs from ${sitemapUrl}`);
            } catch (error) {
                logger.error(`[Sitemap] Failed to process ${sitemapUrl}:`, error);
            }
        }

        // Deduplicate
        return [...new Set(allUrls)];
    }

    /**
     * Platform-specific product URL patterns
     */
    private getProductPatterns(platform: string): RegExp[] {
        switch (platform) {
            case 'tiki':
                return [/\/p\d+\.html/, /tiki\.vn\/[^/]+-p\d+/];
            case 'lazada':
                return [/\/products\/.*-i\d+/, /lazada\.vn\/.*\.html/];
            case 'dienmayxanh':
                return [/dienmayxanh\.com\/[^/]+$/, /\/[a-z0-9-]+-\d+$/];
            case 'cellphones':
                return [/cellphones\.com\.vn\/[^/]+\.html$/];
            default:
                return [/.*/]; // Match all
        }
    }

    /**
     * Extract product ID from URL
     */
    extractProductId(url: string, platform: string): string | null {
        switch (platform) {
            case 'tiki': {
                const match = url.match(/-p(\d+)\.html/) || url.match(/\/p(\d+)\.html/);
                return match ? match[1] : null;
            }
            case 'lazada': {
                const match = url.match(/-i(\d+)(?:-s|\.|$)/);
                return match ? match[1] : null;
            }
            case 'dienmayxanh': {
                const match = url.match(/-(\d+)$/);
                return match ? match[1] : null;
            }
            case 'cellphones': {
                const match = url.match(/\/([^/]+)\.html$/);
                return match ? match[1] : null;
            }
            default:
                return null;
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance
let sitemapServiceInstance: SitemapService | null = null;

export function getSitemapService(): SitemapService {
    if (!sitemapServiceInstance) {
        sitemapServiceInstance = new SitemapService();
    }
    return sitemapServiceInstance;
}

export default SitemapService;
