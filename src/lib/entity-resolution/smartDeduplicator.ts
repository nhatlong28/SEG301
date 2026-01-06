/**
 * Smart Incremental Deduplication Engine
 * Provides incremental merging with real-time progress tracking
 * Enhanced with Gap 1-10 fixes for world-class entity resolution
 */

import { supabaseAdmin } from '@/lib/db/supabase';
import { MLEntityMatcher, ProductData } from './mlMatcher';
import { ProductCodeExtractor } from './codeExtractor';
import { getEmbeddingService } from '../search/embeddingService';
import { SmartBlockingStrategy } from './smartBlocking';
import { VariantManager } from './variantManager';
import { CanonicalQualityScorer } from './qualityScorer';
import { IntraSourceDeduplicator } from './intraSourceDedup';
import { ManualReviewQueue } from './reviewQueue';
import { CanonicalHistoryTracker } from './historyTracker';
import { AdaptiveThresholdManager } from './adaptiveThresholds';
import logger from '@/lib/utils/logger';

// ===================== TYPES =====================

export interface DeduplicationProgress {
    jobId: number;
    phase: 'init' | 'embedding' | 'clustering' | 'matching' | 'saving' | 'done' | 'error';
    totalProducts: number;
    processedProducts: number;
    currentSource: string;
    sourcesProcessed: number;
    totalSources: number;
    matchesFound: number;
    canonicalCreated: number;
    mappingsCreated: number;
    timeElapsed: number;
    estimatedTimeRemaining: number;
    currentBatch: number;
    totalBatches: number;
    recentMatches: Array<{
        product1: { name: string; source: string };
        product2: { name: string; source: string };
        score: number;
    }>;
    sourceBreakdown: Record<string, { processed: number; matched: number }>;
}

export interface DeduplicationStats {
    jobId: number;
    totalRaw: number;
    totalCanonical: number;
    totalMappings: number;
    reductionRate: number;
    executionTimeMs: number;
    sourceBreakdown: Record<string, { processed: number; matched: number }>;
    crossSourceMatrix: Record<string, Record<string, number>>;
}

export type ProgressCallback = (progress: DeduplicationProgress) => void;

export type DeduplicationMode = 'incremental' | 'fresh';

interface RawProduct {
    id: number;
    source_id: number;
    external_id: string;
    name: string;
    name_normalized?: string;
    brand_raw?: string;
    category_raw?: string;
    price?: number;
    rating?: number;
    specs?: Record<string, unknown>;
    review_count?: number;
    available?: boolean;
    description?: string;
    image_url?: string;
    images?: string[];
    dedup_status?: string;
    [key: string]: unknown;
}

interface SourceInfo {
    id: number;
    name: string;
    type: string;
}

// ===================== SMART DEDUPLICATOR =====================

export class SmartDeduplicator {
    private matcher = new MLEntityMatcher();
    private extractor = new ProductCodeExtractor();
    private embeddingService = getEmbeddingService();

    // Gap 1-9 fix components
    private blockingStrategy = new SmartBlockingStrategy();
    private variantManager = new VariantManager();
    private qualityScorer = new CanonicalQualityScorer();
    private intraDedup = new IntraSourceDeduplicator();
    private reviewQueue = new ManualReviewQueue();
    private historyTracker = new CanonicalHistoryTracker();
    private thresholdManager = new AdaptiveThresholdManager();

    private progressCallback?: ProgressCallback;
    private currentJobId = 0;
    private startTime = 0;
    private sources: SourceInfo[] = [];
    private crossSourceMatrix: Record<string, Record<string, number>> = {};

    private progress: DeduplicationProgress = {
        jobId: 0,
        phase: 'init',
        totalProducts: 0,
        processedProducts: 0,
        currentSource: '',
        sourcesProcessed: 0,
        totalSources: 5,
        matchesFound: 0,
        canonicalCreated: 0,
        mappingsCreated: 0,
        timeElapsed: 0,
        estimatedTimeRemaining: 0,
        currentBatch: 0,
        totalBatches: 0,
        recentMatches: [],
        sourceBreakdown: {},
    };

    /**
     * Main entry point - Smart deduplication with mode selection
     */
    async deduplicate(options: {
        mode: DeduplicationMode;
        batchSize?: number;
        minMatchScore?: number;
        onProgress?: ProgressCallback;
    }): Promise<DeduplicationStats> {
        const { mode, batchSize = 500, minMatchScore = 0.75, onProgress } = options;
        this.progressCallback = onProgress;
        this.startTime = Date.now();

        // Load sources
        await this.loadSources();

        // Create job record
        await this.createJob(mode);

        try {
            if (mode === 'fresh') {
                await this.cleanupExistingData();
            }

            // Run deduplication
            const stats = await this.runDeduplication(batchSize, minMatchScore, mode);

            // Mark job complete
            await this.completeJob(stats);

            return stats;
        } catch (error) {
            await this.failJob(error);
            throw error;
        }
    }

    // ===================== JOB MANAGEMENT =====================

    private async loadSources(): Promise<void> {
        const { data } = await supabaseAdmin
            .from('sources')
            .select('id, name, type')
            .eq('is_active', true);

        this.sources = (data || []) as SourceInfo[];
        this.progress.totalSources = this.sources.length;

        // Initialize cross-source matrix
        for (const s1 of this.sources) {
            this.crossSourceMatrix[s1.name] = {};
            for (const s2 of this.sources) {
                this.crossSourceMatrix[s1.name][s2.name] = 0;
            }
        }
    }

    private async createJob(mode: DeduplicationMode): Promise<void> {
        const { count } = await supabaseAdmin
            .from('raw_products')
            .select('*', { count: 'exact', head: true });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabaseAdmin as any)
            .from('deduplication_jobs')
            .insert({
                status: 'running',
                mode,
                total_raw: count || 0,
                current_phase: 'init',
            })
            .select('id')
            .single();

        if (error) {
            logger.error('Failed to create deduplication job:', error);
            throw error;
        }

        this.currentJobId = data.id;
        this.progress.jobId = data.id;
        this.progress.totalProducts = count || 0;
        this.progress.totalBatches = Math.ceil((count || 0) / 500);

        this.emitProgress();
        logger.info(`📊 Created deduplication job #${this.currentJobId} (mode: ${mode})`);
    }

    private async updateJobPhase(phase: string): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin as any)
            .from('deduplication_jobs')
            .update({ current_phase: phase })
            .eq('id', this.currentJobId);

        this.progress.phase = phase as DeduplicationProgress['phase'];
        this.emitProgress();
    }

    private async completeJob(stats: DeduplicationStats): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin as any)
            .from('deduplication_jobs')
            .update({
                status: 'completed',
                processed: stats.totalRaw,
                canonical_created: stats.totalCanonical,
                mappings_created: stats.totalMappings,
                source_breakdown: stats.sourceBreakdown,
                current_phase: 'done',
                completed_at: new Date().toISOString(),
            })
            .eq('id', this.currentJobId);

        this.progress.phase = 'done';
        this.emitProgress();
    }

    private async failJob(error: unknown): Promise<void> {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin as any)
            .from('deduplication_jobs')
            .update({
                status: 'failed',
                current_phase: 'error',
                error_message: errorMessage,
                completed_at: new Date().toISOString(),
            })
            .eq('id', this.currentJobId);

        this.progress.phase = 'error';
        this.emitProgress();
        logger.error(`❌ Deduplication job #${this.currentJobId} failed:`, error);
    }

    // ===================== DEDUPLICATION LOGIC =====================

    private async cleanupExistingData(): Promise<void> {
        logger.info('🧹 Fresh mode: Cleaning up existing canonical data...');
        await this.updateJobPhase('init');

        await supabaseAdmin.from('matching_pairs').delete().neq('id', 0);
        await supabaseAdmin.from('product_mappings').delete().neq('id', 0);
        await supabaseAdmin.from('canonical_products').delete().neq('id', 0);

        // Reset dedup status
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin as any)
            .from('raw_products')
            .update({ dedup_status: 'pending', last_dedup_at: null })
            .neq('id', 0);

        logger.info('✅ Cleanup complete');
    }

    private async runDeduplication(
        batchSize: number,
        minMatchScore: number,
        mode: DeduplicationMode
    ): Promise<DeduplicationStats> {
        let canonicalCount = 0;
        let mappingCount = 0;
        let offset = 0;

        // For incremental mode, only get unprocessed products
        const statusFilter = mode === 'incremental' ? 'pending' : undefined;

        // Get total count for this run
        let totalQuery = supabaseAdmin
            .from('raw_products')
            .select('*', { count: 'exact', head: true });

        if (statusFilter) {
            totalQuery = totalQuery.eq('dedup_status', statusFilter);
        }

        const { count: totalToProcess } = await totalQuery;
        this.progress.totalProducts = totalToProcess || 0;
        this.progress.totalBatches = Math.ceil((totalToProcess || 0) / batchSize);

        logger.info(`🔄 Processing ${totalToProcess} products in ${mode} mode`);

        while (true) {
            this.progress.currentBatch = Math.floor(offset / batchSize) + 1;
            await this.updateJobPhase('clustering');

            // Fetch batch
            let query = supabaseAdmin
                .from('raw_products')
                .select('id, source_id, external_id, name, name_normalized, brand_raw, category_raw, price, rating, specs, review_count, available, image_url, description, images')
                .range(offset, offset + batchSize - 1)
                .order('brand_raw')
                .order('name_normalized');

            if (statusFilter) {
                query = query.eq('dedup_status', statusFilter);
            }

            const { data: products, error } = await query;

            if (error) {
                logger.error('Failed to fetch products:', error);
                break;
            }

            if (!products?.length) {
                break;
            }

            // Process batch
            await this.updateJobPhase('matching');
            const batchResult = await this.processBatchWithProgress(
                products as RawProduct[],
                minMatchScore
            );

            canonicalCount += batchResult.canonicalCreated;
            mappingCount += batchResult.mappingsCreated;

            // Update progress
            offset += batchSize;
            this.progress.processedProducts = Math.min(offset, totalToProcess || 0);
            this.progress.canonicalCreated = canonicalCount;
            this.progress.mappingsCreated = mappingCount;
            this.updateTimeEstimates();
            this.emitProgress();

            // Update job progress in DB periodically
            if (offset % (batchSize * 5) === 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabaseAdmin as any)
                    .from('deduplication_jobs')
                    .update({
                        processed: this.progress.processedProducts,
                        canonical_created: canonicalCount,
                        mappings_created: mappingCount,
                        source_breakdown: this.progress.sourceBreakdown,
                    })
                    .eq('id', this.currentJobId);
            }

            logger.info(`📦 Batch ${this.progress.currentBatch}/${this.progress.totalBatches}: ${canonicalCount} canonical, ${mappingCount} mappings`);
        }

        // PHASE 2: Cross-source matching for canonical products with single source
        logger.info('🔗 Starting cross-source matching phase...');
        await this.updateJobPhase('matching');

        const crossSourceResults = await this.runCrossSourceMatching(minMatchScore);
        mappingCount += crossSourceResults.mappingsCreated;

        // Update source_count for canonicals that got new mappings
        await this.updateCanonicalSourceCounts();

        return {
            jobId: this.currentJobId,
            totalRaw: totalToProcess || 0,
            totalCanonical: canonicalCount,
            totalMappings: mappingCount,
            reductionRate: canonicalCount > 0 ? (totalToProcess || 0) / canonicalCount : 1,
            executionTimeMs: Date.now() - this.startTime,
            sourceBreakdown: this.progress.sourceBreakdown,
            crossSourceMatrix: this.crossSourceMatrix,
        };
    }

    /**
     * Cross-source matching: Find similar products across different sources
     * and merge them into existing canonical products
     */
    private async runCrossSourceMatching(minMatchScore: number): Promise<{ mappingsCreated: number }> {
        let mappingsCreated = 0;
        let totalCandidatesFound = 0;
        let totalScored = 0;
        let totalPassed = 0;

        // Get all canonical products with source_count = 1 (single source)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: singleSourceCanonicals } = await (supabaseAdmin as any)
            .from('canonical_products')
            .select('id, name, name_normalized, brand_id, category_id')
            .eq('source_count', 1)
            .eq('is_active', true);

        if (!singleSourceCanonicals?.length) {
            logger.info('No single-source canonicals to match');
            return { mappingsCreated: 0 };
        }

        logger.info(`🔍 Cross-source matching: ${singleSourceCanonicals.length} single-source canonicals (minScore: ${minMatchScore})`);

        // For each single-source canonical, find potential matches from other sources
        for (let i = 0; i < singleSourceCanonicals.length; i++) {
            const canonical = singleSourceCanonicals[i];

            // Get current source of this canonical
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: currentMappings } = await (supabaseAdmin as any)
                .from('product_mappings')
                .select('raw_product_id, raw_products(id, source_id)')
                .eq('canonical_id', canonical.id)
                .limit(1);

            const currentSourceId = currentMappings?.[0]?.raw_products?.source_id;
            const currentRawProductId = currentMappings?.[0]?.raw_products?.id;

            if (!currentSourceId) {
                if (i < 5) logger.debug(`[CrossMatch] Skip canonical ${canonical.id}: no source mapping found`);
                continue;
            }

            // Extract product code from canonical name
            const canonicalCode = this.extractor.extract(canonical.name);

            // Log first few extractions for debugging
            if (i < 5) {
                logger.info(`[CrossMatch] #${i + 1} "${canonical.name.substring(0, 50)}..." → brand:${canonicalCode.brand || 'null'} model:${canonicalCode.model || 'null'} storage:${canonicalCode.storage || 'null'}`);
            }

            // If no brand or model extracted, skip (can't match reliably)
            if (!canonicalCode.brand && !canonicalCode.model) {
                if (i < 5) logger.debug(`[CrossMatch] Skip: no extractable info`);
                continue;
            }

            // Build smarter search queries based on extracted code
            const searchTerms: string[] = [];

            // Primary search: use model (most reliable)
            if (canonicalCode.model) {
                // Extract key model info: e.g., "iPhone 17 Pro" → search for "iphone%17%pro"
                const modelParts = canonicalCode.model.toLowerCase().split(/\s+/).filter(p => p.length > 1);
                if (modelParts.length >= 2) {
                    searchTerms.push(`%${modelParts.join('%')}%`);
                }
            }

            // Secondary search: brand + storage
            if (canonicalCode.brand && canonicalCode.storage) {
                searchTerms.push(`%${canonicalCode.brand}%${canonicalCode.storage.replace('GB', '')}%`);
            }

            // Tertiary: just use first 20 chars of name_normalized
            searchTerms.push(`%${(canonical.name_normalized || canonical.name).toLowerCase().substring(0, 20)}%`);

            let candidates: Array<{
                id: number;
                source_id: number;
                external_id: string;
                name: string;
                name_normalized?: string;
                brand_raw?: string;
                price?: number;
                rating?: number;
            }> = [];

            // Try each search term until we find candidates
            for (const searchTerm of searchTerms) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: found } = await (supabaseAdmin as any)
                    .from('raw_products')
                    .select('id, source_id, external_id, name, name_normalized, brand_raw, price, rating')
                    .neq('source_id', currentSourceId)
                    .ilike('name_normalized', searchTerm)
                    .limit(30);

                if (found?.length) {
                    candidates = found;
                    if (i < 5) logger.info(`[CrossMatch] Found ${found.length} candidates with term: "${searchTerm.substring(0, 30)}..."`);
                    break;
                }
            }

            if (!candidates?.length) {
                if (i < 5) logger.debug(`[CrossMatch] No candidates found for "${canonical.name.substring(0, 30)}..."`);
                continue;
            }

            totalCandidatesFound += candidates.length;

            // Score each candidate
            for (const candidate of candidates) {
                totalScored++;
                const candidateCode = this.extractor.extract(candidate.name);
                const codeMatch = this.extractor.compareExtractedCodes(canonicalCode, candidateCode);

                if (i < 5 && candidates.indexOf(candidate) < 3) {
                    logger.debug(`[CrossMatch] Scoring: "${candidate.name.substring(0, 30)}..." → score: ${codeMatch.toFixed(2)} (need ≥${minMatchScore})`);
                }

                // Check if already mapped
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: existingMapping } = await (supabaseAdmin as any)
                    .from('product_mappings')
                    .select('id')
                    .eq('raw_product_id', candidate.id)
                    .limit(1);

                if (existingMapping?.length) continue; // Already mapped

                // If good match, add mapping
                if (codeMatch >= minMatchScore) {
                    totalPassed++;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { error } = await (supabaseAdmin as any)
                        .from('product_mappings')
                        .insert({
                            canonical_id: canonical.id,
                            raw_product_id: candidate.id,
                            confidence_score: codeMatch,
                            matching_method: 'cross_source',
                        });

                    if (!error) {
                        mappingsCreated++;
                        this.progress.matchesFound++;

                        // Record cross-source matrix
                        const sourceName1 = this.getSourceName(currentSourceId);
                        const sourceName2 = this.getSourceName(candidate.source_id);
                        if (this.crossSourceMatrix[sourceName1]?.[sourceName2] !== undefined) {
                            this.crossSourceMatrix[sourceName1][sourceName2]++;
                            this.crossSourceMatrix[sourceName2][sourceName1]++;
                        }

                        // Record matching pair
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (supabaseAdmin as any).from('matching_pairs').insert({
                            job_id: this.currentJobId,
                            raw_product_1: currentRawProductId || 0,
                            raw_product_2: candidate.id,
                            source_1: currentSourceId,
                            source_2: candidate.source_id,
                            match_score: codeMatch,
                            match_method: 'cross_source',
                            canonical_id: canonical.id,
                        });

                        logger.info(`✓ MATCH: "${canonical.name.substring(0, 30)}..." ↔ "${candidate.name.substring(0, 30)}..." (${codeMatch.toFixed(2)})`);
                    } else {
                        logger.error(`Failed to create mapping: ${JSON.stringify(error)}`);
                    }
                }
            }

            // Log progress every 100 canonicals
            if (i > 0 && i % 100 === 0) {
                logger.info(`[CrossMatch] Progress: ${i}/${singleSourceCanonicals.length} canonicals, ${mappingsCreated} matches found`);
            }
        }

        // Final statistics
        logger.info(`📊 Cross-source matching complete:`);
        logger.info(`   - Canonicals checked: ${singleSourceCanonicals.length}`);
        logger.info(`   - Total candidates found: ${totalCandidatesFound}`);
        logger.info(`   - Total scored: ${totalScored}`);
        logger.info(`   - Passed threshold (${minMatchScore}): ${totalPassed}`);
        logger.info(`   - Mappings created: ${mappingsCreated}`);

        return { mappingsCreated };
    }

    /**
     * Update source_count for all canonical products based on actual mappings
     */
    private async updateCanonicalSourceCounts(): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin as any).rpc('update_canonical_source_counts');

        // Fallback if RPC doesn't exist
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: canonicals } = await (supabaseAdmin as any)
            .from('canonical_products')
            .select('id');

        for (const c of canonicals || []) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: mappings } = await (supabaseAdmin as any)
                .from('product_mappings')
                .select('raw_products(source_id)')
                .eq('canonical_id', c.id);

            const uniqueSources = new Set((mappings || []).map((m: { raw_products: { source_id: number } }) => m.raw_products?.source_id).filter(Boolean));

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabaseAdmin as any)
                .from('canonical_products')
                .update({ source_count: uniqueSources.size })
                .eq('id', c.id);
        }
    }

    private async processBatchWithProgress(
        products: RawProduct[],
        minMatchScore: number
    ): Promise<{ canonicalCreated: number; mappingsCreated: number }> {
        let canonicalCreated = 0;
        let mappingsCreated = 0;

        // Gap 5 Fix: Perform intra-source deduplication first
        const dedupedProducts = this.intraDedup.deduplicateWithinSource(products);

        // Generate embeddings for deduped list
        await this.updateJobPhase('embedding');
        let embeddings: (number[] | null)[] = [];
        if (this.embeddingService.isAvailable()) {
            embeddings = await this.embeddingService.generateBatchDocumentEmbeddings(
                dedupedProducts.map(p => p.name)
            );
        }

        // Group by smart blocking key
        const groups = this.groupProducts(dedupedProducts as unknown as RawProduct[]);

        for (const [groupKey, groupProducts] of groups) {
            // Track source info
            for (const p of groupProducts) {
                const sourceName = this.getSourceName(p.source_id);
                if (!this.progress.sourceBreakdown[sourceName]) {
                    this.progress.sourceBreakdown[sourceName] = { processed: 0, matched: 0 };
                }
                this.progress.sourceBreakdown[sourceName].processed++;
            }

            // Create ProductData with embeddings
            const productData: ProductData[] = groupProducts.map(p => {
                const originalIndex = dedupedProducts.findIndex(origP => origP.id === p.id);
                const embedding = originalIndex !== -1 ? embeddings[originalIndex] : undefined;

                return {
                    externalId: p.external_id,
                    sourceId: p.source_id,
                    name: p.name,
                    brand: p.brand_raw,
                    category: p.category_raw,
                    price: p.price,
                    rating: p.rating,
                    specs: p.specs as Record<string, string>,
                    embedding: embedding || undefined,
                };
            });

            // Cluster products
            // Gap 9: Use Adaptive Thresholds based on category
            const category = groupProducts[0].category_raw;
            const dynamicThreshold = await this.thresholdManager.getThreshold(category);
            const clusters = await this.matcher.clusterProducts(productData, Math.max(minMatchScore, dynamicThreshold));

            // Process each cluster
            for (const cluster of clusters) {
                if (cluster.length === 0) continue;

                // Gap 3 Fix: Handle variants within the cluster
                const variantResult = this.variantManager.handleVariants(
                    groupProducts.filter(p => cluster.some(c => c.externalId === p.external_id))
                );

                // Track cross-source matches
                this.recordCrossSourceMatches(cluster);

                // Check for existing canonical
                const existingCanonical = await this.findExistingCanonical(cluster[0]);

                if (existingCanonical) {
                    const newMappings = await this.addMappingsToCanonical(
                        existingCanonical.id,
                        cluster,
                        groupProducts
                    );
                    mappingsCreated += newMappings;

                    // Gap 8: Track history of updates
                    await this.historyTracker.trackChange(
                        existingCanonical.id,
                        'updated',
                        {
                            job_id: { old: null, new: this.currentJobId },
                            new_mappings: { old: 0, new: cluster.length }
                        },
                        'auto_dedup'
                    );

                    // Record match pairs
                    if (cluster.length > 1) {
                        await this.recordMatchingPairs(cluster, existingCanonical.id, groupProducts);
                    }
                } else {
                    // Gap 6: Use Quality Scorer to select best product
                    const bestProduct = this.selectBestProduct(cluster, groupProducts);
                    const canonical = await this.createCanonical(bestProduct, cluster, groupProducts);

                    if (canonical) {
                        canonicalCreated++;
                        mappingsCreated += cluster.length;

                        // Gap 3: Save variant info if detected
                        if (variantResult.isVariantGroup) {
                            await this.variantManager.saveVariants(canonical.id, variantResult.variants);
                        }

                        // Gap 6: Calculate and store quality score
                        const quality = this.qualityScorer.calculateQuality(canonical as any, groupProducts as any);
                        await this.qualityScorer.updateCanonicalQuality(canonical.id, quality);

                        // Gap 8: Track history of creation
                        await this.historyTracker.trackCreation(canonical.id, canonical as any);

                        // Record match pairs
                        if (cluster.length > 1) {
                            await this.recordMatchingPairs(cluster, canonical.id, groupProducts);
                            this.addRecentMatch(cluster, groupProducts);
                        }
                    } else if (cluster.length > 1) {
                        // Gap 7: If clustering is high confidence but canonical creation failed, 
                        // could be a candidate for manual review
                        await this.reviewQueue.queueForReview([{
                            type: 'ambiguous',
                            data_json: {
                                cluster: cluster.map(c => ({ name: c.name, source_id: c.sourceId })),
                                job_id: this.currentJobId
                            },
                            reason: 'Ambiguous cluster - failed to create canonical',
                            priority: 50
                        }]);
                    }
                }
            }

            // Mark products as processed
            const productIds = groupProducts.map(p => p.id);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabaseAdmin as any)
                .from('raw_products')
                .update({ dedup_status: 'processed', last_dedup_at: new Date().toISOString() })
                .in('id', productIds);
        }

        return { canonicalCreated, mappingsCreated };
    }

    // ===================== HELPER METHODS =====================

    private groupProducts(products: RawProduct[]): Map<string, RawProduct[]> {
        const groups = new Map<string, RawProduct[]>();

        for (const product of products) {
            // Gap 1 Fix: Use Smart Blocking Strategy for improved grouping
            const key = this.blockingStrategy.getPrimaryBlockKey(product);

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(product);
        }

        return groups;
    }

    private selectBestProduct(cluster: ProductData[], rawProducts: RawProduct[]): RawProduct {
        const clusterRaw = rawProducts.filter(rp =>
            cluster.some(cp => cp.externalId === rp.external_id && cp.sourceId === rp.source_id)
        );

        return clusterRaw.sort((a, b) => {
            if ((b.review_count || 0) !== (a.review_count || 0)) {
                return (b.review_count || 0) - (a.review_count || 0);
            }
            if ((b.rating || 0) !== (a.rating || 0)) {
                return (b.rating || 0) - (a.rating || 0);
            }
            return (b.available ? 1 : 0) - (a.available ? 1 : 0);
        })[0];
    }

    private async findExistingCanonical(product: ProductData): Promise<{ id: number } | null> {
        const code = this.extractor.extract(product.name);
        const canonicalCode = this.extractor.toCanonicalCode(code);

        if (canonicalCode) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: codeMatches } = await (supabaseAdmin as any)
                .from('canonical_products')
                .select('id')
                .eq('slug', canonicalCode)
                .limit(1);
            if (codeMatches?.length) return { id: codeMatches[0].id };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabaseAdmin as any)
            .from('canonical_products')
            .select('id, name_normalized')
            .ilike('name_normalized', `%${product.name.substring(0, 30)}%`)
            .limit(5);

        if (!data?.length) return null;

        for (const candidate of data) {
            const candidateCode = this.extractor.extract(candidate.name_normalized || '');
            const similarity = this.extractor.compareExtractedCodes(code, candidateCode);

            if (similarity > 0.8) {
                return { id: candidate.id };
            }
        }

        return null;
    }

    private async createCanonical(
        bestProduct: RawProduct,
        cluster: ProductData[],
        rawProducts: RawProduct[]
    ): Promise<any> {
        try {
            const prices = cluster.map(p => p.price).filter((p): p is number => p !== undefined && p > 0);
            const ratings = cluster.map(p => p.rating).filter((r): r is number => r !== undefined && r > 0);

            const code = this.extractor.extract(bestProduct.name);
            // Truncate slug to max 200 chars to prevent varchar overflow
            const rawSlug = this.extractor.toCanonicalCode(code) + '-' + Date.now();
            const slug = rawSlug.substring(0, 200);

            // Truncate ALL string fields to safe lengths
            const safeName = (bestProduct.name || '').substring(0, 500);
            const safeNameNormalized = (bestProduct.name_normalized || '').substring(0, 500);
            const safeImageUrl = (bestProduct.image_url || '').substring(0, 999); // varchar(1000)
            const safeDescription = (bestProduct.description || '').substring(0, 10000);

            // Log field lengths for debugging
            logger.debug(`[CreateCanonical] Fields: name=${safeName.length}, slug=${slug.length}, imageUrl=${safeImageUrl.length}`);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabaseAdmin as any)
                .from('canonical_products')
                .insert({
                    name: safeName,
                    name_normalized: safeNameNormalized,
                    slug: slug,
                    brand_id: await this.getBrandId(bestProduct.brand_raw),
                    category_id: await this.getCategoryId(bestProduct.category_raw),
                    description: safeDescription,
                    image_url: safeImageUrl,
                    images: (bestProduct.images || []).slice(0, 10), // Limit to 10 images
                    canonical_specs: bestProduct.specs || {},
                    min_price: prices.length > 0 ? Math.min(...prices) : null,
                    max_price: prices.length > 0 ? Math.max(...prices) : null,
                    avg_rating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
                    total_reviews: 0,
                    source_count: new Set(cluster.map(p => p.sourceId)).size,
                    quality_score: this.calculateQualityScore(bestProduct),
                    is_active: true,
                })
                .select('*')
                .single();

            if (error) {
                logger.error(`[CreateCanonical] Failed: ${JSON.stringify(error)} for product: "${safeName.substring(0, 50)}..."`);
                return null;
            }

            // Create mappings
            const mappings = rawProducts
                .filter(rp => cluster.some(cp => cp.externalId === rp.external_id && cp.sourceId === rp.source_id))
                .map(rp => ({
                    canonical_id: data.id,
                    raw_product_id: rp.id,
                    confidence_score: 0.9,
                    matching_method: 'ml_classifier',
                }));

            if (mappings.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabaseAdmin as any).from('product_mappings').insert(mappings);
            }

            return data;
        } catch (error) {
            logger.error('Error creating canonical:', error);
            return null;
        }
    }

    private async addMappingsToCanonical(
        canonicalId: number,
        cluster: ProductData[],
        rawProducts: RawProduct[]
    ): Promise<number> {
        const mappings = rawProducts
            .filter(rp => cluster.some(cp => cp.externalId === rp.external_id && cp.sourceId === rp.source_id))
            .map(rp => ({
                canonical_id: canonicalId,
                raw_product_id: rp.id,
                confidence_score: 0.85,
                matching_method: 'ml_classifier',
            }));

        if (mappings.length === 0) return 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabaseAdmin as any)
            .from('product_mappings')
            .upsert(mappings, { onConflict: 'canonical_id,raw_product_id' });

        if (error) {
            logger.error('Failed to add mappings:', error);
            return 0;
        }

        return mappings.length;
    }

    private async recordMatchingPairs(
        cluster: ProductData[],
        canonicalId: number,
        rawProducts: RawProduct[]
    ): Promise<void> {
        if (cluster.length < 2) return;

        const pairs: Array<{
            job_id: number;
            raw_product_1: number;
            raw_product_2: number;
            source_1: number;
            source_2: number;
            match_score: number;
            match_method: string;
            canonical_id: number;
        }> = [];

        // Create pairs from cross-source matches only
        for (let i = 0; i < cluster.length; i++) {
            for (let j = i + 1; j < cluster.length; j++) {
                const p1 = cluster[i];
                const p2 = cluster[j];

                // Only record cross-source pairs
                if (p1.sourceId !== p2.sourceId) {
                    const raw1 = rawProducts.find(rp => rp.external_id === p1.externalId && rp.source_id === p1.sourceId);
                    const raw2 = rawProducts.find(rp => rp.external_id === p2.externalId && rp.source_id === p2.sourceId);

                    if (raw1 && raw2) {
                        pairs.push({
                            job_id: this.currentJobId,
                            raw_product_1: raw1.id,
                            raw_product_2: raw2.id,
                            source_1: p1.sourceId || 0,
                            source_2: p2.sourceId || 0,
                            match_score: 0.85, // Estimated score
                            match_method: 'ml_classifier',
                            canonical_id: canonicalId,
                        });
                    }
                }
            }
        }

        if (pairs.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabaseAdmin as any).from('matching_pairs').insert(pairs);
            this.progress.matchesFound += pairs.length;
        }
    }

    private recordCrossSourceMatches(cluster: ProductData[]): void {
        const sourceSet = new Set(cluster.map(p => p.sourceId));
        if (sourceSet.size < 2) return;

        const sourceNames = [...sourceSet].map(id => this.getSourceName(id || 0));

        for (let i = 0; i < sourceNames.length; i++) {
            for (let j = i + 1; j < sourceNames.length; j++) {
                const s1 = sourceNames[i];
                const s2 = sourceNames[j];
                if (this.crossSourceMatrix[s1]?.[s2] !== undefined) {
                    this.crossSourceMatrix[s1][s2]++;
                    this.crossSourceMatrix[s2][s1]++;
                }

                // Update source breakdown matched count
                if (this.progress.sourceBreakdown[s1]) {
                    this.progress.sourceBreakdown[s1].matched++;
                }
                if (this.progress.sourceBreakdown[s2]) {
                    this.progress.sourceBreakdown[s2].matched++;
                }
            }
        }
    }

    private addRecentMatch(cluster: ProductData[], rawProducts: RawProduct[]): void {
        if (cluster.length < 2) return;

        // Get first two products from different sources
        const sourceGroups: Record<number, ProductData> = {};
        for (const p of cluster) {
            if (p.sourceId && !sourceGroups[p.sourceId]) {
                sourceGroups[p.sourceId] = p;
            }
        }

        const sources = Object.entries(sourceGroups);
        if (sources.length >= 2) {
            const [, p1] = sources[0];
            const [, p2] = sources[1];

            this.progress.recentMatches.unshift({
                product1: { name: p1.name.substring(0, 50), source: this.getSourceName(p1.sourceId || 0) },
                product2: { name: p2.name.substring(0, 50), source: this.getSourceName(p2.sourceId || 0) },
                score: 0.85,
            });

            // Keep only last 10 matches
            if (this.progress.recentMatches.length > 10) {
                this.progress.recentMatches = this.progress.recentMatches.slice(0, 10);
            }
        }
    }

    private getSourceName(sourceId: number): string {
        const source = this.sources.find(s => s.id === sourceId);
        return source?.name || 'Unknown';
    }

    private async getBrandId(brandName?: string): Promise<number | null> {
        if (!brandName) return null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabaseAdmin as any)
            .from('brands')
            .select('id')
            .ilike('name', brandName)
            .single();

        return data?.id || null;
    }

    private async getCategoryId(categoryName?: string): Promise<number | null> {
        if (!categoryName) return null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabaseAdmin as any)
            .from('categories')
            .select('id')
            .ilike('name', `%${categoryName}%`)
            .single();

        return data?.id || null;
    }

    private calculateQualityScore(product: RawProduct): number {
        let score = 0;

        if (product.rating) {
            score += Math.min(product.rating / 5, 1) * 0.2;
        }
        if (product.review_count) {
            score += Math.min(product.review_count / 1000, 1) * 0.3;
        }
        if (product.available) {
            score += 0.2;
        }
        const specCount = Object.keys(product.specs || {}).length;
        if (specCount > 3) {
            score += 0.15;
        } else if (specCount > 0) {
            score += 0.1;
        }
        if (product.image_url) {
            score += 0.15;
        }

        return Math.min(score, 1);
    }

    private updateTimeEstimates(): void {
        this.progress.timeElapsed = Date.now() - this.startTime;

        if (this.progress.processedProducts > 0) {
            const msPerProduct = this.progress.timeElapsed / this.progress.processedProducts;
            const remaining = this.progress.totalProducts - this.progress.processedProducts;
            this.progress.estimatedTimeRemaining = Math.round(msPerProduct * remaining);
        }
    }

    private emitProgress(): void {
        if (this.progressCallback) {
            this.progressCallback({ ...this.progress });
        }
    }

    // ===================== PUBLIC QUERY METHODS =====================

    /**
     * Get cross-source comparison matrix for a completed job
     */
    async getCrossSourceMatrix(jobId?: number): Promise<Record<string, Record<string, number>>> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query = (supabaseAdmin as any)
            .from('matching_pairs')
            .select(`
                source_1,
                source_2,
                sources!matching_pairs_source_1_fkey(name)
            `);

        if (jobId) {
            query.eq('job_id', jobId);
        }

        const { data } = await query;

        const matrix: Record<string, Record<string, number>> = {};
        await this.loadSources();

        for (const s of this.sources) {
            matrix[s.name] = {};
            for (const s2 of this.sources) {
                matrix[s.name][s2.name] = 0;
            }
        }

        for (const pair of data || []) {
            const s1Name = this.getSourceName(pair.source_1);
            const s2Name = this.getSourceName(pair.source_2);
            if (matrix[s1Name]?.[s2Name] !== undefined) {
                matrix[s1Name][s2Name]++;
            }
        }

        return matrix;
    }

    /**
     * Get recent matching pairs for visualization
     */
    async getRecentMatchingPairs(limit = 20, jobId?: number): Promise<Array<{
        product1: { name: string; source: string; price?: number };
        product2: { name: string; source: string; price?: number };
        score: number;
        canonicalId: number;
    }>> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (supabaseAdmin as any)
            .from('matching_pairs')
            .select(`
                match_score,
                canonical_id,
                raw_products!matching_pairs_raw_product_1_fkey(name, price, source_id),
                raw_products!matching_pairs_raw_product_2_fkey(name, price, source_id)
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (jobId) {
            query = query.eq('job_id', jobId);
        }

        const { data } = await query;

        return (data || []).map((pair: {
            match_score: number;
            canonical_id: number;
            raw_products: { name: string; price?: number; source_id: number };
        }) => ({
            product1: {
                name: pair.raw_products?.name || 'Unknown',
                source: this.getSourceName(pair.raw_products?.source_id || 0),
                price: pair.raw_products?.price,
            },
            product2: {
                name: pair.raw_products?.name || 'Unknown',
                source: this.getSourceName(pair.raw_products?.source_id || 0),
                price: pair.raw_products?.price,
            },
            score: pair.match_score,
            canonicalId: pair.canonical_id,
        }));
    }
}

// Export a singleton instance
export const smartDeduplicator = new SmartDeduplicator();
