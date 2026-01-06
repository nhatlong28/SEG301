/**
 * Browser Pool Manager - 5 Concurrent Workers
 * Manages Puppeteer browser instances for parallel crawling
 */

import { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import puppeteerExtra from 'puppeteer-extra';
import logger from '../utils/logger';

// Apply stealth plugin
puppeteerExtra.use(StealthPlugin());

export interface BrowserPoolOptions {
    maxBrowsers?: number;
    headless?: boolean;
    proxy?: string;
    userDataDir?: string;
    disableInterception?: boolean;
}

interface PooledBrowser {
    browser: Browser;
    inUse: boolean;
    id: number;
    pagesCreated: number;
    createdAt: Date;
}

export class BrowserPool {
    private browsers: PooledBrowser[] = [];
    private maxBrowsers: number;
    private headless: boolean;
    private proxy?: string;
    private isShuttingDown = false;
    private browserIdCounter = 0;

    // Random viewports for fingerprint diversity
    private readonly viewports = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1536, height: 864 },
        { width: 1440, height: 900 },
        { width: 1280, height: 720 },
    ];

    // Random User-Agents 2026 (Chrome 130-131)
    private readonly userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        // Mobile UAs
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    ];

    private userDataDir?: string;
    private disableInterception: boolean;

    constructor(options: BrowserPoolOptions = {}) {
        this.maxBrowsers = options.maxBrowsers || 3;
        this.headless = options.headless !== false;
        this.proxy = options.proxy;
        this.userDataDir = options.userDataDir || process.env.BROWSER_USER_DATA_DIR;
        this.disableInterception = options.disableInterception || false;

        if (this.userDataDir) {
            logger.info(`[BrowserPool] Using base data directory: ${this.userDataDir}`);
            // Ensure the directory exists
            if (!fs.existsSync(this.userDataDir)) {
                fs.mkdirSync(this.userDataDir, { recursive: true });
            }
        }

        // Allow overriding headless mode via env (defaults to true if not set)
        const envHeadless = process.env.HEADLESS === 'false' ? false : true;
        this.headless = options.headless !== undefined ? options.headless : envHeadless;
    }

    /**
     * Get launch options with stealth settings
     */
    private getLaunchOptions(browserId?: number): any {
        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920,1080',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-blink-features=AutomationControlled',
            '--lang=vi-VN,vi',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            '--disable-blink-features=AutomationControlled'
        ];

        if (this.proxy) {
            let proxyServer = this.proxy;
            try {
                const url = new URL(this.proxy);
                proxyServer = url.host; // This gets host:port without protocol or user:pass
            } catch (e) {
                // Keep as is if parsing fails
            }
            args.push(`--proxy-server=${proxyServer}`);
        }

        const launchOptions: any = {
            headless: this.headless,
            args,
            defaultViewport: null,
            ignoreHTTPSErrors: true,
            // STRATEGIC STEALTH: Hide automation signals
            ignoreDefaultArgs: ['--enable-automation'],
            // For Chromium-based browsers
            excludeSwitches: ['enable-automation'],
            // Disable automation extension
            useAutomationExtension: false,
        };

        if (this.userDataDir) {
            // Give each browser instance its own subdirectory to prevent profile locking
            const specificDir = browserId ? path.join(this.userDataDir, `worker-${browserId}`) : this.userDataDir;
            launchOptions.userDataDir = specificDir;

            // Try to find Edge if on Windows and using Edge profile
            if (process.platform === 'win32' && (this.userDataDir.includes('Edge') || specificDir.includes('Edge'))) {
                const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
                if (fs.existsSync(edgePath)) {
                    launchOptions.executablePath = edgePath;
                    logger.info(`[BrowserPool] Using Edge executable at: ${edgePath}`);
                }
            }
        }

        return launchOptions;
    }

    /**
     * Create a new browser instance
     */
    private async createBrowser(): Promise<PooledBrowser> {
        const id = ++this.browserIdCounter;
        logger.info(`🌐 [BrowserPool] Creating browser #${id}`);

        const browser = await puppeteerExtra.launch(this.getLaunchOptions(id));

        const pooledBrowser: PooledBrowser = {
            browser,
            inUse: false,
            id,
            pagesCreated: 0,
            createdAt: new Date(),
        };

        // Handle browser disconnect
        browser.on('disconnected', () => {
            logger.warn(`⚠️ [BrowserPool] Browser #${id} disconnected`);
            this.browsers = this.browsers.filter(b => b.id !== id);
        });

        this.browsers.push(pooledBrowser);
        return pooledBrowser;
    }

    /**
     * Acquire an available browser from the pool
     */
    async acquire(): Promise<Browser> {
        if (this.isShuttingDown) {
            throw new Error('Browser pool is shutting down');
        }

        // Find available browser
        let pooledBrowser = this.browsers.find(b => !b.inUse);

        // Create new if none available and under limit
        if (!pooledBrowser && this.browsers.length < this.maxBrowsers) {
            pooledBrowser = await this.createBrowser();
        }

        // Wait for available browser
        if (!pooledBrowser) {
            logger.debug('[BrowserPool] Waiting for available browser...');
            await this.sleep(500);
            return this.acquire();
        }

        pooledBrowser.inUse = true;
        logger.debug(`[BrowserPool] Acquired browser #${pooledBrowser.id}`);
        return pooledBrowser.browser;
    }

    /**
     * Release a browser back to the pool
     */
    release(browser: Browser): void {
        const pooledBrowser = this.browsers.find(b => b.browser === browser);
        if (pooledBrowser) {
            pooledBrowser.inUse = false;
            pooledBrowser.pagesCreated++;
            logger.debug(`[BrowserPool] Released browser #${pooledBrowser.id}`);

            // Recycle browser after 10 pages to prevent memory leaks (aggressive)
            if (pooledBrowser.pagesCreated >= 10) {
                this.recycleBrowser(pooledBrowser);
            }
        }
    }

    /**
     * Recycle a browser (close and create new one)
     */
    private async recycleBrowser(pooledBrowser: PooledBrowser): Promise<void> {
        logger.info(`♻️ [BrowserPool] Recycling browser #${pooledBrowser.id} after ${pooledBrowser.pagesCreated} pages`);

        this.browsers = this.browsers.filter(b => b.id !== pooledBrowser.id);

        try {
            await pooledBrowser.browser.close();
        } catch (error) {
            logger.debug('[BrowserPool] Error closing browser during recycle:', error);
        }
    }

    async createPage(browser: Browser): Promise<Page> {
        const page = await browser.newPage();

        // Handle proxy authentication if needed
        if (this.proxy && this.proxy.includes('@')) {
            try {
                const url = new URL(this.proxy);
                if (url.username && url.password) {
                    await page.authenticate({
                        username: decodeURIComponent(url.username),
                        password: decodeURIComponent(url.password),
                    });
                    logger.debug(`[BrowserPool] Authenticated proxy for new page`);
                }
            } catch (error) {
                logger.warn(`[BrowserPool] Failed to parse proxy for auth: ${error}`);
            }
        }

        // Random viewport
        const viewport = this.viewports[Math.floor(Math.random() * this.viewports.length)];
        await page.setViewport(viewport);

        // Random User-Agent
        const userAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
        await page.setUserAgent(userAgent);

        // Set Vietnamese locale
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        });

        // Override navigator properties for better stealth
        await page.evaluateOnNewDocument(() => {
            // Override webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });

            // Override plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                    { name: 'Native Client', filename: 'internal-nacl-plugin' },
                ],
            });

            // Override languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['vi-VN', 'vi', 'en-US', 'en'],
            });

            // Override platform
            Object.defineProperty(navigator, 'platform', {
                get: () => 'Win32',
            });

            // Mock chrome runtime
            (window as unknown as { chrome: unknown }).chrome = {
                runtime: {},
                loadTimes: () => ({}),
                csi: () => ({}),
                app: {},
            };
        });

        // Block unnecessary resources for faster loading (Skip if interception is disabled)
        if (!this.disableInterception) {
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                const url = request.url();
                const resourceType = request.resourceType();

                // Block tracking, analytics, and heavy resources (images, fonts, media)
                if (
                    ['font', 'image', 'media'].includes(resourceType) ||
                    url.includes('google-analytics') ||
                    url.includes('facebook.com') ||
                    url.includes('googletagmanager') ||
                    url.includes('doubleclick') ||
                    url.includes('google-ads')
                ) {
                    request.abort();
                } else {
                    request.continue();
                }
            });
        }

        return page;
    }

    /**
     * Close all browsers
     */
    async closeAll(): Promise<void> {
        this.isShuttingDown = true;
        logger.info(`🔒 [BrowserPool] Closing all ${this.browsers.length} browsers...`);

        const closePromises = this.browsers.map(async (pooled) => {
            try {
                await pooled.browser.close();
                logger.debug(`[BrowserPool] Closed browser #${pooled.id}`);
            } catch (error) {
                logger.debug(`[BrowserPool] Error closing browser #${pooled.id}:`, error);
            }
        });

        await Promise.all(closePromises);
        this.browsers = [];
        this.isShuttingDown = false;
        logger.info('✅ [BrowserPool] All browsers closed');
    }

    /**
     * Get pool statistics
     */
    getStats(): { total: number; inUse: number; available: number } {
        const inUse = this.browsers.filter(b => b.inUse).length;
        return {
            total: this.browsers.length,
            inUse,
            available: this.browsers.length - inUse,
        };
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance for global use
let globalPool: BrowserPool | null = null;

export function getGlobalBrowserPool(options?: BrowserPoolOptions): BrowserPool {
    if (!globalPool) {
        globalPool = new BrowserPool(options);
    }
    return globalPool;
}

export async function shutdownGlobalPool(): Promise<void> {
    if (globalPool) {
        await globalPool.closeAll();
        globalPool = null;
    }
}
