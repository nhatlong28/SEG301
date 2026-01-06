/**
 * Canonical History Tracker (Gap 8 Fix)
 * Tracks changes to canonical products over time for audit and rollback
 */

import { supabaseAdmin } from '@/lib/db/supabase';
import logger from '@/lib/utils/logger';

export type EventType = 'created' | 'updated' | 'merged' | 'split' | 'deleted';
export type TriggeredBy = 'auto_dedup' | 'manual_review' | 'user_feedback' | 'system';

export interface HistoryEntry {
    id: number;
    canonical_id: number;
    version: number;
    event_type: EventType;
    changes: Record<string, { old: unknown; new: unknown }>;
    triggered_by: TriggeredBy;
    created_by?: string;
    created_at: string;
}

export class CanonicalHistoryTracker {
    /**
     * Track a change to a canonical product
     */
    async trackChange(
        canonicalId: number,
        eventType: EventType,
        changes: Record<string, { old: unknown; new: unknown }>,
        triggeredBy: TriggeredBy,
        userId?: string
    ): Promise<void> {
        // Get current version
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: lastRecord } = await (supabaseAdmin as any)
            .from('canonical_history')
            .select('version')
            .eq('canonical_id', canonicalId)
            .order('version', { ascending: false })
            .limit(1);

        const nextVersion = (lastRecord?.[0]?.version || 0) + 1;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabaseAdmin as any)
            .from('canonical_history')
            .insert({
                canonical_id: canonicalId,
                version: nextVersion,
                event_type: eventType,
                changes: JSON.stringify(changes),
                triggered_by: triggeredBy,
                created_by: userId,
            });

        if (error) {
            logger.error(`[HistoryTracker] Failed to track change for #${canonicalId}:`, error);
        } else {
            logger.debug(`[HistoryTracker] Recorded ${eventType} v${nextVersion} for canonical #${canonicalId}`);
        }
    }

    /**
     * Track creation of a canonical product
     */
    async trackCreation(
        canonicalId: number,
        productData: Record<string, unknown>,
        triggeredBy: TriggeredBy = 'auto_dedup'
    ): Promise<void> {
        const changes: Record<string, { old: unknown; new: unknown }> = {};
        for (const [key, value] of Object.entries(productData)) {
            changes[key] = { old: null, new: value };
        }

        await this.trackChange(canonicalId, 'created', changes, triggeredBy);
    }

    /**
     * Track update to a canonical product
     */
    async trackUpdate(
        canonicalId: number,
        oldData: Record<string, unknown>,
        newData: Record<string, unknown>,
        triggeredBy: TriggeredBy = 'auto_dedup'
    ): Promise<void> {
        const changes: Record<string, { old: unknown; new: unknown }> = {};

        // Find changed fields
        const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
        for (const key of allKeys) {
            if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
                changes[key] = { old: oldData[key], new: newData[key] };
            }
        }

        if (Object.keys(changes).length > 0) {
            await this.trackChange(canonicalId, 'updated', changes, triggeredBy);
        }
    }

    /**
     * Track merge of canonical products
     */
    async trackMerge(
        targetCanonicalId: number,
        sourceCanonicalIds: number[],
        triggeredBy: TriggeredBy = 'auto_dedup'
    ): Promise<void> {
        await this.trackChange(
            targetCanonicalId,
            'merged',
            {
                merged_from: { old: null, new: sourceCanonicalIds },
            },
            triggeredBy
        );
    }

    /**
     * Get history for a canonical product
     */
    async getHistory(canonicalId: number, limit: number = 50): Promise<HistoryEntry[]> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabaseAdmin as any)
            .from('canonical_history')
            .select('*')
            .eq('canonical_id', canonicalId)
            .order('version', { ascending: false })
            .limit(limit);

        if (error) {
            logger.error(`[HistoryTracker] Failed to get history for #${canonicalId}:`, error);
            return [];
        }

        return (data || []).map((entry: Record<string, unknown>) => ({
            ...entry,
            changes: typeof entry.changes === 'string'
                ? JSON.parse(entry.changes as string)
                : entry.changes,
        }));
    }

    /**
     * Get specific version of a canonical product
     */
    async getVersion(canonicalId: number, version: number): Promise<HistoryEntry | null> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabaseAdmin as any)
            .from('canonical_history')
            .select('*')
            .eq('canonical_id', canonicalId)
            .eq('version', version)
            .single();

        if (error || !data) {
            return null;
        }

        return {
            ...data,
            changes: typeof data.changes === 'string'
                ? JSON.parse(data.changes)
                : data.changes,
        };
    }

    /**
     * Rollback canonical to a previous version
     * Note: This creates a new history entry for the rollback
     */
    async rollbackToVersion(
        canonicalId: number,
        targetVersion: number,
        userId?: string
    ): Promise<boolean> {
        // Get all history from target version to reconstruct state
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: history } = await (supabaseAdmin as any)
            .from('canonical_history')
            .select('*')
            .eq('canonical_id', canonicalId)
            .lte('version', targetVersion)
            .order('version', { ascending: true });

        if (!history || history.length === 0) {
            logger.error(`[HistoryTracker] Cannot rollback: no history found for #${canonicalId}`);
            return false;
        }

        // Reconstruct the state at target version
        const reconstructedState: Record<string, unknown> = {};
        for (const entry of history) {
            const changes = typeof entry.changes === 'string'
                ? JSON.parse(entry.changes)
                : entry.changes;

            for (const [key, change] of Object.entries(changes as Record<string, { old: unknown; new: unknown }>)) {
                reconstructedState[key] = change.new;
            }
        }

        // Get current state
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: current } = await (supabaseAdmin as any)
            .from('canonical_products')
            .select('*')
            .eq('id', canonicalId)
            .single();

        if (!current) {
            logger.error(`[HistoryTracker] Canonical #${canonicalId} not found`);
            return false;
        }

        // Apply rollback
        const updateFields: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(reconstructedState)) {
            if (key !== 'id' && key !== 'created_at' && current[key] !== value) {
                updateFields[key] = value;
            }
        }

        if (Object.keys(updateFields).length === 0) {
            logger.info(`[HistoryTracker] No changes needed for rollback`);
            return true;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabaseAdmin as any)
            .from('canonical_products')
            .update(updateFields)
            .eq('id', canonicalId);

        if (error) {
            logger.error(`[HistoryTracker] Failed to rollback:`, error);
            return false;
        }

        // Track the rollback
        const rollbackChanges: Record<string, { old: unknown; new: unknown }> = {};
        for (const [key, value] of Object.entries(updateFields)) {
            rollbackChanges[key] = { old: current[key], new: value };
        }
        rollbackChanges['_rollback_to'] = { old: null, new: targetVersion };

        await this.trackChange(canonicalId, 'updated', rollbackChanges, 'manual_review', userId);

        logger.info(`[HistoryTracker] Rolled back #${canonicalId} to version ${targetVersion}`);
        return true;
    }

    /**
     * Get recent changes across all canonicals
     */
    async getRecentChanges(limit: number = 100): Promise<HistoryEntry[]> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabaseAdmin as any)
            .from('canonical_history')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            logger.error('[HistoryTracker] Failed to get recent changes:', error);
            return [];
        }

        return (data || []).map((entry: Record<string, unknown>) => ({
            ...entry,
            changes: typeof entry.changes === 'string'
                ? JSON.parse(entry.changes as string)
                : entry.changes,
        }));
    }
}

export const historyTracker = new CanonicalHistoryTracker();
