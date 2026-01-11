/**
 * Manual Review Queue (Gap 7 Fix)
 * Queue system for flagging and managing dubious matches
 */

import { supabaseAdmin } from '@/lib/db/supabase';
import logger from '@/lib/utils/logger';

export type ReviewType = 'dubious_match' | 'low_quality' | 'conflict' | 'ambiguous';
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'skipped';

export interface ReviewQueueItem {
    id?: number;
    type: ReviewType;
    data_json: unknown;
    reason: string;
    priority: number;
    status?: ReviewStatus;
    reviewed_by?: string;
    reviewed_at?: string;
    created_at?: string;
}

export interface QueuedMatch {
    product1: { id: number; name: string; source: string; price?: number };
    product2: { id: number; name: string; source: string; price?: number };
    confidence: number;
    canonical_id?: number;
}

export class ManualReviewQueue {
    /**
     * Add items to review queue
     */
    async queueForReview(items: Array<Omit<ReviewQueueItem, 'id' | 'status' | 'created_at'>>): Promise<void> {
        if (items.length === 0) return;

        const records = items.map(item => ({
            type: item.type,
            data_json: JSON.stringify(item.data_json),
            reason: item.reason,
            priority: item.priority,
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabaseAdmin as any)
            .from('dedup_review_queue')
            .insert(records);

        if (error) {
            logger.error('[ReviewQueue] Failed to queue items:', error);
        } else {
            logger.debug(`[ReviewQueue] Queued ${items.length} items for review`);
        }
    }

    /**
     * Flag dubious matches for review
     */
    async flagDubiousMatches(
        matches: QueuedMatch[],
        threshold: number = 0.75
    ): Promise<void> {
        const itemsToQueue: Array<Omit<ReviewQueueItem, 'id' | 'status' | 'created_at'>> = [];

        for (const match of matches) {
            if (match.confidence < threshold) {
                itemsToQueue.push({
                    type: 'dubious_match',
                    data_json: match,
                    reason: `Low confidence match (${(match.confidence * 100).toFixed(1)}%): "${match.product1.name.substring(0, 30)}..." ↔ "${match.product2.name.substring(0, 30)}..."`,
                    priority: 100 - Math.round(match.confidence * 100),
                });
            }
        }

        if (itemsToQueue.length > 0) {
            await this.queueForReview(itemsToQueue);
        }
    }

    /**
     * Flag quality issues for review
     */
    async flagQualityIssues(
        canonical: { id: number; name: string },
        issues: string[]
    ): Promise<void> {
        if (issues.length === 0) return;

        await this.queueForReview([{
            type: 'low_quality',
            data_json: { canonical, issues },
            reason: `Quality issues: ${issues.join('; ')}`,
            priority: issues.length * 20,
        }]);
    }

    /**
     * Flag conflicts for review
     */
    async flagConflicts(
        canonical: { id: number; name: string },
        conflicts: Array<{ product_id: number; reason: string }>
    ): Promise<void> {
        if (conflicts.length === 0) return;

        await this.queueForReview([{
            type: 'conflict',
            data_json: { canonical, conflicts },
            reason: `${conflicts.length} conflicting product mappings detected`,
            priority: conflicts.length * 50,
        }]);
    }

    /**
     * Flag ambiguous matches for review
     */
    async flagAmbiguous(
        product: { id: number; name: string },
        candidates: Array<{ canonical_id: number; name: string; score: number }>
    ): Promise<void> {
        if (candidates.length < 2) return;

        await this.queueForReview([{
            type: 'ambiguous',
            data_json: { product, candidates },
            reason: `${candidates.length} possible canonical matches for "${product.name.substring(0, 40)}..."`,
            priority: 60,
        }]);
    }

    /**
     * Get pending review items
     */
    async getPendingItems(options: {
        type?: ReviewType;
        limit?: number;
        offset?: number;
    } = {}): Promise<ReviewQueueItem[]> {
        const { type, limit = 50, offset = 0 } = options;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (supabaseAdmin as any)
            .from('dedup_review_queue')
            .select('*')
            .eq('status', 'pending')
            .order('priority', { ascending: false })
            .order('created_at', { ascending: true })
            .range(offset, offset + limit - 1);

        if (type) {
            query = query.eq('type', type);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('[ReviewQueue] Failed to get pending items:', error);
            return [];
        }

        return (data || []).map((item: Record<string, unknown>) => ({
            ...item,
            data_json: typeof item.data_json === 'string'
                ? JSON.parse(item.data_json as string)
                : item.data_json,
        }));
    }

    /**
     * Update review status
     */
    async updateReviewStatus(
        itemId: number,
        status: ReviewStatus,
        reviewedBy?: string
    ): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabaseAdmin as any)
            .from('dedup_review_queue')
            .update({
                status,
                reviewed_by: reviewedBy,
                reviewed_at: new Date().toISOString(),
            })
            .eq('id', itemId);

        if (error) {
            logger.error('[ReviewQueue] Failed to update status:', error);
        }
    }

    /**
     * Get review queue statistics
     */
    async getStats(): Promise<{
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        by_type: Record<ReviewType, number>;
    }> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabaseAdmin as any)
            .from('dedup_review_queue')
            .select('status, type');

        const items = data || [];
        const byType: Record<ReviewType, number> = {
            dubious_match: 0,
            low_quality: 0,
            conflict: 0,
            ambiguous: 0,
        };

        let pending = 0, approved = 0, rejected = 0;

        for (const item of items) {
            if (item.status === 'pending') pending++;
            else if (item.status === 'approved') approved++;
            else if (item.status === 'rejected') rejected++;

            if (item.type in byType) {
                byType[item.type as ReviewType]++;
            }
        }

        return {
            total: items.length,
            pending,
            approved,
            rejected,
            by_type: byType,
        };
    }

    /**
     * Clear old reviewed items
     */
    async clearOldReviewed(daysOld: number = 30): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabaseAdmin as any)
            .from('dedup_review_queue')
            .delete()
            .neq('status', 'pending')
            .lt('reviewed_at', cutoffDate.toISOString())
            .select('id');

        if (error) {
            logger.error('[ReviewQueue] Failed to clear old items:', error);
            return 0;
        }

        return data?.length || 0;
    }
}

export const reviewQueue = new ManualReviewQueue();
