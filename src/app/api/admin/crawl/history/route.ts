
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Fetch logs from DB, joined with source info
        const { data: logs, error } = await (supabaseAdmin as any)
            .from('crawl_logs')
            .select(`
                id,
                started_at,
                completed_at,
                status,
                total_items,
                new_items,
                updated_items,
                error_count,
                sources (
                    id,
                    type,
                    name
                )
            `)
            .order('started_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('Supabase history error:', error);
            throw error;
        }

        // Transform to frontend format
        const formattedLogs = logs.map((log: any) => {
            const startTime = new Date(log.started_at).getTime();
            const endTime = log.completed_at ? new Date(log.completed_at).getTime() : Date.now();
            const duration = log.completed_at ? endTime - startTime : undefined;

            return {
                source: log.sources?.type || 'unknown',
                status: log.status,
                products: log.new_items + log.updated_items, // Total processed
                errors: log.error_count,
                startTime: log.started_at,
                endTime: log.completed_at,
                savedAt: log.started_at, // Use started_at as savedAt for display
                duration: duration
            };
        });

        return NextResponse.json({ logs: formattedLogs });
    } catch (error) {
        console.error('History API error:', error);
        return NextResponse.json({
            error: 'Failed to fetch history',
            details: error instanceof Error ? error.message : String(error),
            fullError: JSON.stringify(error)
        }, { status: 500 });
    }
}
