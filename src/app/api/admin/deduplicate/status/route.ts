import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase';

/**
 * GET: Get deduplication job status and history
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const jobId = searchParams.get('jobId');
        const limit = parseInt(searchParams.get('limit') || '10');

        if (jobId) {
            // Get specific job
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabaseAdmin as any)
                .from('deduplication_jobs')
                .select('*')
                .eq('id', parseInt(jobId))
                .single();

            if (error) {
                return NextResponse.json({ error: 'Job not found' }, { status: 404 });
            }

            return NextResponse.json({ job: data });
        }

        // Get recent jobs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: jobs, error } = await (supabaseAdmin as any)
            .from('deduplication_jobs')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(limit);

        if (error) {
            return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
        }

        // Get current running job if any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: runningJob } = await (supabaseAdmin as any)
            .from('deduplication_jobs')
            .select('*')
            .eq('status', 'running')
            .single();

        return NextResponse.json({
            jobs: jobs || [],
            runningJob: runningJob || null,
        });
    } catch (error) {
        console.error('Status API error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
