
import { NextRequest, NextResponse } from 'next/server';
import { getOrchestrator } from '@/lib/crawler';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, source, cookie } = body;
        const orchestrator = getOrchestrator();

        if (!source || typeof source !== 'string') {
            return NextResponse.json({ error: 'Source is required' }, { status: 400 });
        }

        if (action === 'start') {
            await orchestrator.startCrawler(source, { cookie });
            return NextResponse.json({ message: `Started ${source}` });
        } else if (action === 'stop') {
            await orchestrator.stopCrawler(source);
            return NextResponse.json({ message: `Stopped ${source}` });
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Control error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
