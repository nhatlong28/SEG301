/**
 * Puppeteer Crawler Base Class
 * Provides common functionality for browser-based crawlers
 */

import { Browser, Page, HTTPResponse, WaitForOptions } from 'puppeteer';
import { BaseCrawler, CrawlOptions, CrawledProduct, CrawlRequest } from './base';
import { BrowserPool, getGlobalBrowserPool } from './browserPool';
import logger from '../utils/logger';
import type { SourceType } from '../types/database';

export interface PuppeteerCrawlOptions extends CrawlRequest {
    // Add any puppeteer-specific options here if needed in the future
}

export abstract class PuppeteerCrawlerBase extends BaseCrawler {
    protected pool: BrowserPool;
    protected browser: Browser | null = null;
    protected page: Page | null = null;

    constructor(sourceType: SourceType, options: CrawlOptions = {}) {
        super(sourceType, options);
        this.pool = getGlobalBrowserPool();
    }

    /**
     * Get a browser instance from the pool
     */
    async getBrowser(): Promise<Browser> {
        if (!this.browser) {
            this.browser = await this.pool.acquire();
        }
        return this.browser;
    }

    /**
     * Get a new page from the current browser
     */
    async getPage(): Promise<Page> {
        const browser = await this.getBrowser();
        if (!this.page || this.page.isClosed()) {
            this.page = await this.pool.createPage(browser);
        }
        return this.page;
    }

    /**
     * Release the browser and page back to the pool
     */
    async releaseBrowser(): Promise<void> {
        if (this.page && !this.page.isClosed()) {
            await this.page.close().catch(() => { });
            this.page = null;
        }

        if (this.browser) {
            this.pool.release(this.browser);
            this.browser = null;
        }
    }

    /**
     * Scroll the page down to trigger lazy loading
     */
    protected async scrollPage(page: Page, times = 5): Promise<void> {
        for (let i = 0; i < times; i++) {
            await page.evaluate(() => {
                window.scrollBy(0, window.innerHeight);
            });
            await this.sleep(1000);
        }
    }

    /**
     * Wait for network to be idle
     */
    protected async waitForNetworkIdle(page: Page, timeout = 1000): Promise<void> {
        try {
            await page.waitForNetworkIdle({ idleTime: timeout, timeout: 5000 });
        } catch (e) {
            // Ignore timeout
        }
    }

    /**
     * Navigate with retry and timeout
     */
    protected async navigateWithRetry(
        page: Page,
        url: string,
        options: { timeout?: number; retries?: number } = {}
    ): Promise<boolean> {
        const timeout = options.timeout || 30000;
        const retries = options.retries || 3;

        for (let i = 0; i < retries; i++) {
            try {
                await page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout
                });
                return true;
            } catch (error) {
                logger.warn(`[${this.sourceName}] Navigation failed (${i + 1}/${retries}): ${url}`);
                await this.sleep(2000);
            }
        }
        return false;
    }
}
