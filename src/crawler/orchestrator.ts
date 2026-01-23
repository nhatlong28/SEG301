try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) { }
import fs from 'fs';
import path from 'path';
import { getGlobalBrowserPool, shutdownGlobalPool } from './browserPool';
import { ShopeeCrawler } from './shopee';
import { LazadaCrawler } from './lazada';
import { TikiCrawler } from './tiki';
import { CellphonesCrawler } from './cellphones';
import { DienmayxanhCrawler } from './dienmayxanh';
import { CrawledProduct } from './base';
import logger from '../utils/logger';

// Union type for all crawler instances
type CrawlerInstance = ShopeeCrawler | LazadaCrawler | TikiCrawler | CellphonesCrawler | DienmayxanhCrawler;

export interface CrawlStats {
    source: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped' | 'idle';
    products: number;
    errors: number;
    startTime?: Date;
    endTime?: Date;
    duration?: number;
    currentAction?: string; // what is it doing right now?
}

export class CrawlerOrchestrator {
    private activeCrawlers: Map<string, CrawlerInstance> = new Map();
    private stats: Map<string, CrawlStats> = new Map();
    private readonly logDir: string;

    constructor() {
        // Use /tmp for logs in Vercel/production environment if standard logs dir implies read-only
        const isVercel = process.env.VERCEL === '1';
        this.logDir = isVercel
            ? path.join('/tmp', 'logs', 'crawls')
            : path.join(process.cwd(), 'logs', 'crawls');

        // Ensure log directory exists
        try {
            if (!fs.existsSync(this.logDir)) {
                fs.mkdirSync(this.logDir, { recursive: true });
            }
        } catch (error) {
            console.error('[Orchestrator] Failed to create log directory (logging to file disabled):', error);
            // Fallback to null or flag to disable file logging
            (this as any).fileLoggingDisabled = true;
        }
    }

    /**
     * Start a specific crawler
     */
    async startCrawler(source: string, options?: { cookie?: string }): Promise<void> {
        if (this.activeCrawlers.has(source)) {
            throw new Error(`Crawler ${source} is already running`);
        }

        logger.info(`[Orchestrator] 🚀 Starting crawler: ${source}`);

        // Initialize stats
        this.updateStats(source, {
            source,
            status: 'running',
            products: 0,
            errors: 0,
            startTime: new Date(),
            currentAction: 'Initializing...',
        });

        // Initialize global browser pool if needed (for puppeteer crawlers)
        // Initialize global browser pool if needed (for puppeteer crawlers)
        // Note: BaseCrawler doesn't strictly need it but PuppeteerCrawlerBase does
        getGlobalBrowserPool({ maxBrowsers: 10 });

        let crawler: CrawlerInstance;

        try {
            switch (source) {
                case 'shopee': crawler = new ShopeeCrawler(options); break;
                case 'tiki': crawler = new TikiCrawler(); break;
                case 'lazada': crawler = new LazadaCrawler(options); break;
                case 'cellphones': crawler = new CellphonesCrawler(); break;
                case 'dienmayxanh': crawler = new DienmayxanhCrawler(); break;
                default: throw new Error(`Unknown source: ${source}`);
            }

            this.activeCrawlers.set(source, crawler);

            // Set progress callback to sync internal crawler stats with orchestrator's live stats
            (crawler as any).onProgress = (pStats: any) => {
                this.updateStats(source, {
                    products: pStats.products,
                    errors: pStats.errors,
                    currentAction: pStats.currentAction
                });
            };

            // Run in background
            this.runCrawlerInBackground(source, crawler).catch(err => {
                logger.error(`[Orchestrator] Uncaught error in ${source} background runner:`, err);
            });

        } catch (error) {
            this.updateStats(source, { status: 'failed', errors: 1 });
            this.activeCrawlers.delete(source);
            throw error;
        }
    }

    /**
     * Stop a specific crawler
     */
    async stopCrawler(source: string): Promise<void> {
        const crawler = this.activeCrawlers.get(source);
        if (crawler) {
            logger.info(`[Orchestrator] 🛑 Stopping crawler: ${source}`);
            this.updateStats(source, { currentAction: 'Stopping...' });

            // Call stop method on the crawler instance
            // Assuming we added stop() to BaseCrawler/PuppeteerCrawlerBase
            if (typeof (crawler as any).stop === 'function') {
                (crawler as any).stop();
            }

            // We don't delete from map immediately, wait for background runner to finish and clean up
        } else {
            logger.warn(`[Orchestrator] Crawler ${source} is not running`);
        }
    }

    /**
     * Internal background runner
     */
    private async runCrawlerInBackground(source: string, crawler: CrawlerInstance) {
        try {
            this.updateStats(source, { currentAction: 'Crawling...' });

            // Run mass crawl with default settings
            // We can make pages configurable later via startCrawler arguments if needed
            const products = await crawler.massCrawl();
            const currentStats = this.stats.get(source);

            this.updateStats(source, {
                status: 'completed',
                products: products && products.length > 0 ? products.length : (currentStats?.products || 0),
                endTime: new Date(),
                currentAction: 'Idle',
            });

            await this.saveLogFile(source, 'completed');

        } catch (error) {
            logger.error(`[Orchestrator] ${source} failed:`, error);
            this.updateStats(source, {
                status: 'failed',
                errors: (this.stats.get(source)?.errors || 0) + 1,
                endTime: new Date(),
                currentAction: 'Failed',
            });
            await this.saveLogFile(source, 'failed');
        } finally {
            // Cleanup
            this.activeCrawlers.delete(source);

            // If no more crawlers, maybe shutdown browser pool to save resources?
            if (this.activeCrawlers.size === 0) {
                // Optimization: shutdown after a delay if no new requests come in
                // For now, let's keep it simple
            }

            // Verify if it was manually stopped
            const currentStats = this.stats.get(source);
            if (currentStats?.status === 'running') {
                // If we here and status is still running, it might have been stopped internally
                // but let's ensure we mark it as stopped if we know 'shouldStop' was triggered
                // Actually the updateStats above handles 'completed' or 'failed'.
                // If the loop broke due to stop, it usually reaches 'completed' block but with fewer items.
                // We can refine this logic if needed.
                // Let's check 'stopped' status explicitly if possible?
                // Since we don't assume we have access to 'shouldStop' here easily without casting, 
                // we rely on the loop finishing.
            }
        }
    }

    /**
     * Save crawl log to JSON file
     */
    private async saveLogFile(source: string, status: string) {
        if ((this as any).fileLoggingDisabled) return; // Skip if logging disabled

        try {
            const stats = this.stats.get(source);
            if (!stats) return;

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${timestamp}_${source}_${status}.json`;
            const filepath = path.join(this.logDir, filename);

            const logData = {
                ...stats,
                savedAt: new Date().toISOString(),
            };

            fs.writeFileSync(filepath, JSON.stringify(logData, null, 2));
            logger.info(`[Orchestrator] 💾 Saved log to ${filename}`);
        } catch (error) {
            logger.error(`[Orchestrator] Failed to save log file:`, error);
        }
    }

    /**
     * Update stats helper
     */
    private updateStats(source: string, update: Partial<CrawlStats>): void {
        const current = this.stats.get(source) || {
            source,
            status: 'pending',
            products: 0,
            errors: 0,
        };

        const updated = { ...current, ...update };

        if (updated.startTime && updated.endTime) {
            updated.duration = updated.endTime.getTime() - updated.startTime.getTime();
        }

        this.stats.set(source, updated as CrawlStats);
    }

    /**
     * Get current stats for all
     */
    getStats(): CrawlStats[] {
        // We might want to return "Stopped" status for crawlers not in activeCrawlers but in stats
        // Actually stats map persists until restart, which is fine
        return Array.from(this.stats.values());
    }

    /**
     * Get active status of a source
     */
    isRunning(source: string): boolean {
        return this.activeCrawlers.has(source);
    }
}


// Singleton
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalForOrchestrator = globalThis as unknown as {
    orchestrator: CrawlerOrchestrator | undefined;
};

export function getOrchestrator(): CrawlerOrchestrator {
    if (!globalForOrchestrator.orchestrator) {
        globalForOrchestrator.orchestrator = new CrawlerOrchestrator();
    }
    return globalForOrchestrator.orchestrator;
}


/**
 * Backward compatibility wrapper (optional, or deprecated)
 */
// Backward compatibility interfaces
export interface MassCrawlOptions {
    workers?: number;
    pagesPerKeyword?: number;
    sources?: string[];
    onProgress?: (stats: CrawlStats) => void;
}

export interface MassCrawlResult {
    totalProducts: number;
    totalErrors: number;
    duration: number;
    stats: CrawlStats[];
}

/**
 * Backward compatibility wrapper - NOW FUNCTIONAL
 * Runs mass crawl by triggering all specified sources
 */
export async function runMassCrawl(options: MassCrawlOptions = {}): Promise<MassCrawlResult> {
    const orchestrator = getOrchestrator();

    // Default: ALL 5 platforms
    const sources = options.sources || ['shopee', 'tiki', 'lazada', 'cellphones', 'dienmayxanh'];
    const startTime = Date.now();

    logger.info(`🚀 [runMassCrawl] Triggering mass crawl for sources: ${sources.join(', ')}`);

    const promises = sources.map(async (source) => {
        try {
            if (!orchestrator.isRunning(source)) {
                await orchestrator.startCrawler(source);
            } else {
                logger.warn(`[runMassCrawl] ${source} is already running, skipping start`);
            }

            // Wait for it to finish?
            // The previous runMassCrawl implementation waited for all to finish.
            // To be fully compatible, we should poll until they are done.
            return waitForCrawlerCompletion(orchestrator, source);
        } catch (error) {
            logger.error(`[runMassCrawl] Failed to start ${source}:`, error);
            return null;
        }
    });

    await Promise.all(promises);

    const duration = Date.now() - startTime;
    const allStats = orchestrator.getStats().filter(s => sources.includes(s.source));
    const totalProducts = allStats.reduce((sum, s) => sum + s.products, 0);
    const totalErrors = allStats.reduce((sum, s) => sum + s.errors, 0);

    return {
        totalProducts,
        totalErrors,
        duration,
        stats: allStats,
    };
}

async function waitForCrawlerCompletion(orchestrator: CrawlerOrchestrator, source: string): Promise<void> {
    return new Promise((resolve) => {
        const check = setInterval(() => {
            if (!orchestrator.isRunning(source)) {
                clearInterval(check);
                resolve();
            }
        }, 5000);
    });
}
