// Crawler exports
export { BaseCrawler } from './base';
export type { CrawlOptions, CrawledProduct } from './base';

// Puppeteer base
export { PuppeteerCrawlerBase } from './puppeteerBase';
export type { PuppeteerCrawlOptions } from './puppeteerBase';

// Browser pool
export { BrowserPool, getGlobalBrowserPool, shutdownGlobalPool } from './browserPool';
export type { BrowserPoolOptions } from './browserPool';

// Individual crawlers
export { ShopeeCrawler } from './shopee';
export { TikiCrawler } from './tiki';
export { LazadaCrawler } from './lazada';
export { CellphonesPuppeteerCrawler } from './cellphones-puppeteer';
export { CellphonesCrawler } from './cellphones'; // Legacy
export { DienmayxanhCrawler } from './dienmayxanh';

// Orchestrator
export { CrawlerOrchestrator, getOrchestrator, runMassCrawl } from './orchestrator';
export type { CrawlStats, MassCrawlOptions, MassCrawlResult } from './orchestrator';

// Keyword Service
export { KeywordService } from './keywordService';
export type { CrawlKeyword } from './keywordService';

// Category Service (Enhanced)
export { CategoryService } from './categoryService';
export type { CrawlCategory, CategoryNode } from './categoryService';

// Sitemap Service (NEW)
export { SitemapService, getSitemapService, PLATFORM_SITEMAPS } from './sitemapService';
export type { SitemapUrl, SitemapIndex } from './sitemapService';

// CrawlProgressService - Smart Auto-Skip Logic
export { CrawlProgressService } from './crawlProgressService';
export type { CrawlProgress, CrawlQueue } from './crawlProgressService';

import { ShopeeCrawler } from './shopee';
import { TikiCrawler } from './tiki';
import { LazadaCrawler } from './lazada';
import { CellphonesPuppeteerCrawler } from './cellphones-puppeteer';
import { DienmayxanhCrawler } from './dienmayxanh';
import type { SourceType } from '../../types/database';

export function getCrawler(sourceType: SourceType) {
    switch (sourceType) {
        case 'shopee':
            return new ShopeeCrawler();
        case 'tiki':
            return new TikiCrawler();
        case 'lazada':
            return new LazadaCrawler();
        case 'cellphones':
            return new CellphonesPuppeteerCrawler();
        case 'dienmayxanh':
            return new DienmayxanhCrawler();
        default:
            throw new Error(`Unknown source type: ${sourceType}`);
    }
}

export async function crawlAllSources(query: string, maxPages = 10) {
    const crawlers = [
        new ShopeeCrawler(),
        new TikiCrawler(),
        new LazadaCrawler(),
        new CellphonesPuppeteerCrawler(),
        new DienmayxanhCrawler(),
    ];

    const results = await Promise.allSettled(
        crawlers.map(crawler => crawler.crawl({ keyword: query, maxPages }))
    );

    return results.map((result, index) => ({
        source: crawlers[index].constructor.name,
        status: result.status,
        products: result.status === 'fulfilled' ? result.value.length : 0,
        error: result.status === 'rejected' ? result.reason : undefined,
    }));
}

