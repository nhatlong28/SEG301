/**
 * Price Alerts Service
 * Monitors product prices and notifies users when prices drop
 */

import { supabaseAdmin } from '@/lib/db/supabase';
import logger from '@/lib/utils/logger';

export interface PriceAlert {
    id: number;
    userId: string;
    canonicalId: number;
    targetPrice?: number;
    percentThreshold?: number;
    isActive: boolean;
    productName?: string;
    currentPrice?: number;
    createdAt: string;
}

export interface PriceAlertNotification {
    id: number;
    userId: string;
    canonicalId: number;
    oldPrice: number;
    newPrice: number;
    dropPercent: number;
    sourceId: number;
    productName: string;
    isSent: boolean;
}

export class PriceAlertService {
    /**
     * Create a price alert for a user
     */
    async createAlert(
        userId: string,
        canonicalId: number,
        options: {
            targetPrice?: number;
            percentThreshold?: number;
        }
    ): Promise<PriceAlert | null> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabaseAdmin as any)
                .from('user_price_alerts')
                .insert({
                    user_id: userId,
                    canonical_id: canonicalId,
                    target_price: options.targetPrice,
                    percent_threshold: options.percentThreshold || 10,
                    is_active: true,
                })
                .select()
                .single();

            if (error) throw error;
            return this.mapAlert(data);
        } catch (error) {
            logger.error('Failed to create price alert:', error);
            return null;
        }
    }

    /**
     * Get alerts for a user
     */
    async getUserAlerts(userId: string): Promise<PriceAlert[]> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabaseAdmin as any)
                .from('user_price_alerts')
                .select(`
                    *,
                    canonical_products(name, min_price)
                `)
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (data || []).map((d: any) => ({
                ...this.mapAlert(d),
                productName: d.canonical_products?.name,
                currentPrice: d.canonical_products?.min_price,
            }));
        } catch (error) {
            logger.error('Failed to get user alerts:', error);
            return [];
        }
    }

    /**
     * Delete a price alert
     */
    async deleteAlert(alertId: number, userId: string): Promise<boolean> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabaseAdmin as any)
                .from('user_price_alerts')
                .delete()
                .eq('id', alertId)
                .eq('user_id', userId);

            return !error;
        } catch (error) {
            logger.error('Failed to delete price alert:', error);
            return false;
        }
    }

    /**
     * Check all alerts and create notifications for price drops
     * This should be run periodically (e.g., after crawl)
     */
    async checkAllAlerts(): Promise<number> {
        let notificationsCreated = 0;

        try {
            // Get all active alerts with product info
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: alerts, error } = await (supabaseAdmin as any)
                .from('user_price_alerts')
                .select(`
                    id,
                    user_id,
                    canonical_id,
                    target_price,
                    percent_threshold,
                    last_checked_price,
                    canonical_products(name, min_price)
                `)
                .eq('is_active', true);

            if (error || !alerts) return 0;

            for (const alert of alerts) {
                const product = alert.canonical_products;
                if (!product) continue;

                const currentPrice = product.min_price;
                const lastPrice = alert.last_checked_price || currentPrice;
                const targetPrice = alert.target_price;
                const threshold = alert.percent_threshold || 10;

                let shouldNotify = false;
                let dropPercent = 0;

                // Check if price dropped below target
                if (targetPrice && currentPrice && currentPrice <= targetPrice) {
                    shouldNotify = true;
                    dropPercent = lastPrice > 0 ? ((lastPrice - currentPrice) / lastPrice) * 100 : 0;
                }

                // Check if price dropped by threshold percent
                if (!shouldNotify && lastPrice > 0 && currentPrice < lastPrice) {
                    dropPercent = ((lastPrice - currentPrice) / lastPrice) * 100;
                    if (dropPercent >= threshold) {
                        shouldNotify = true;
                    }
                }

                if (shouldNotify && currentPrice) {
                    // Create notification
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (supabaseAdmin as any)
                        .from('price_alerts')
                        .insert({
                            user_id: alert.user_id,
                            canonical_id: alert.canonical_id,
                            old_price: lastPrice,
                            new_price: currentPrice,
                            drop_percent: dropPercent,
                            is_sent: false,
                        });

                    notificationsCreated++;
                }

                // Update last checked price
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabaseAdmin as any)
                    .from('user_price_alerts')
                    .update({ last_checked_price: currentPrice })
                    .eq('id', alert.id);
            }

            logger.info(`Price alerts checked: ${notificationsCreated} notifications created`);
        } catch (error) {
            logger.error('Failed to check price alerts:', error);
        }

        return notificationsCreated;
    }

    /**
     * Get pending notifications to send
     */
    async getPendingNotifications(): Promise<PriceAlertNotification[]> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabaseAdmin as any)
                .from('price_alerts')
                .select(`
                    *,
                    canonical_products(name)
                `)
                .eq('is_sent', false)
                .order('created_at', { ascending: true })
                .limit(100);

            if (error) return [];

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (data || []).map((d: any) => ({
                id: d.id,
                userId: d.user_id,
                canonicalId: d.canonical_id,
                oldPrice: d.old_price,
                newPrice: d.new_price,
                dropPercent: d.drop_percent,
                sourceId: d.source_id,
                productName: d.canonical_products?.name || '',
                isSent: d.is_sent,
            }));
        } catch (error) {
            logger.error('Failed to get pending notifications:', error);
            return [];
        }
    }

    /**
     * Mark notification as sent
     */
    async markAsSent(notificationId: number): Promise<boolean> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (supabaseAdmin as any)
                .from('price_alerts')
                .update({ is_sent: true, sent_at: new Date().toISOString() })
                .eq('id', notificationId);

            return !error;
        } catch (error) {
            logger.error('Failed to mark notification as sent:', error);
            return false;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private mapAlert(data: any): PriceAlert {
        return {
            id: data.id,
            userId: data.user_id,
            canonicalId: data.canonical_id,
            targetPrice: data.target_price,
            percentThreshold: data.percent_threshold,
            isActive: data.is_active,
            createdAt: data.created_at,
        };
    }
}

// Singleton
let priceAlertServiceInstance: PriceAlertService | null = null;

export function getPriceAlertService(): PriceAlertService {
    if (!priceAlertServiceInstance) {
        priceAlertServiceInstance = new PriceAlertService();
    }
    return priceAlertServiceInstance;
}
