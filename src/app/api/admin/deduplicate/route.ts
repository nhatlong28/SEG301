import { NextRequest, NextResponse } from 'next/server';
import { SmartDeduplicator, DeduplicationMode, DeduplicationProgress } from '@/lib/entity-resolution/smartDeduplicator';
import { supabaseAdmin } from '@/lib/db/supabase';
import logger from '@/lib/utils/logger';

// Global state for active deduplication job
let activeDeduplicator: SmartDeduplicator | null = null;
let currentProgress: DeduplicationProgress | null = null;
let isRunning = false;
const progressListeners: Array<(progress: DeduplicationProgress) => void> = [];

/**
 * POST: Start a new deduplication job
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const mode: DeduplicationMode = body.mode || 'incremental';
        const batchSize = body.batchSize || 500;
        const minMatchScore = body.minMatchScore || 0.75;

        if (isRunning) {
            return NextResponse.json({
                error: 'Deduplication already running',
                currentProgress,
            }, { status: 400 });
        }

        // Start deduplication in background
        isRunning = true;
        activeDeduplicator = new SmartDeduplicator();

        // Run in background
        runDeduplication(mode, batchSize, minMatchScore);

        return NextResponse.json({
            message: `Deduplication started in ${mode} mode`,
            status: 'started',
        });
    } catch (error) {
        logger.error('Deduplication API error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

/**
 * GET: Stream real-time progress via SSE
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const stream = searchParams.get('stream') === 'true';

    if (stream) {
        // Return SSE stream
        const encoder = new TextEncoder();

        const readable = new ReadableStream({
            start(controller) {
                // Send current progress immediately if available
                if (currentProgress) {
                    const data = `data: ${JSON.stringify(currentProgress)}\n\n`;
                    controller.enqueue(encoder.encode(data));
                }

                // Listen for future progress updates
                const listener = (progress: DeduplicationProgress) => {
                    try {
                        const data = `data: ${JSON.stringify(progress)}\n\n`;
                        controller.enqueue(encoder.encode(data));

                        // Close stream when done
                        if (progress.phase === 'done' || progress.phase === 'error') {
                            setTimeout(() => {
                                controller.close();
                            }, 1000);
                        }
                    } catch {
                        // Stream closed
                    }
                };

                progressListeners.push(listener);

                // Cleanup when stream closes
                request.signal.addEventListener('abort', () => {
                    const index = progressListeners.indexOf(listener);
                    if (index > -1) {
                        progressListeners.splice(index, 1);
                    }
                });
            },
        });

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    }

    // Return current status
    return NextResponse.json({
        isRunning,
        currentProgress,
        lastUpdate: new Date().toISOString(),
    });
}

/**
 * Background deduplication runner
 */
async function runDeduplication(
    mode: DeduplicationMode,
    batchSize: number,
    minMatchScore: number
) {
    try {
        logger.info(`🚀 Starting ${mode} deduplication...`);

        const stats = await activeDeduplicator!.deduplicate({
            mode,
            batchSize,
            minMatchScore,
            onProgress: (progress) => {
                currentProgress = progress;
                // Notify all listeners
                for (const listener of progressListeners) {
                    try {
                        listener(progress);
                    } catch {
                        // Listener error, ignore
                    }
                }
            },
        });

        logger.info(`✅ Deduplication completed! Job #${stats.jobId}: ${stats.totalCanonical} canonical, ${stats.totalMappings} mappings`);
    } catch (error) {
        logger.error('❌ Deduplication failed:', error);
    } finally {
        isRunning = false;
        activeDeduplicator = null;
    }
}
