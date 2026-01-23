/**
 * CLEANUP DUPLICATES - Free up database space
 * 1. Analyze table sizes and duplicate counts
 * 2. Delete duplicate products (keep newest)
 * 3. Vacuum to reclaim space
 */

import fs from 'fs';
import path from 'path';

// Manual .env loading
const loadEnv = () => {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            content.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^["']|["']$/g, '');
                    process.env[key] = value;
                }
            });
            console.log('✅ Loaded .env.local');
        }
    } catch (e) {
        console.error('Failed to load .env.local', e);
    }
};
loadEnv();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SOURCE_NAMES: Record<number, string> = {
    2: 'Tiki',
    3: 'Lazada',
    4: 'CellphoneS',
    5: 'DMX',
    6: 'TGDĐ',
    7: 'Chợ Tốt',
};

async function analyzeDatabase() {
    console.log('\n📊 ANALYZING DATABASE...\n');

    // Get counts per source
    console.log('📦 Products per source:');
    for (const [sourceId, name] of Object.entries(SOURCE_NAMES)) {
        const { count, error } = await supabase
            .from('raw_products')
            .select('*', { count: 'exact', head: true })
            .eq('source_id', parseInt(sourceId));

        if (!error) {
            console.log(`   ${name}: ${count?.toLocaleString() || 0} products`);
        }
    }

    // Get total count
    const { count: total } = await supabase
        .from('raw_products')
        .select('*', { count: 'exact', head: true });

    console.log(`\n   TOTAL: ${total?.toLocaleString() || 0} products`);
}

async function findDuplicatesByHashName(): Promise<{ hash_name: string; count: number }[]> {
    console.log('\n🔍 Finding products with same name (hash_name)...');

    // We need to do this in chunks since Supabase doesn't support GROUP BY easily
    // Instead, let's find potential duplicates by fetching hash_names and counting locally

    const duplicates: Map<string, number> = new Map();
    let offset = 0;
    const PAGE_SIZE = 10000;

    while (true) {
        const { data, error } = await supabase
            .from('raw_products')
            .select('hash_name')
            .range(offset, offset + PAGE_SIZE - 1);

        if (error || !data || data.length === 0) break;

        for (const row of data) {
            if (row.hash_name) {
                duplicates.set(row.hash_name, (duplicates.get(row.hash_name) || 0) + 1);
            }
        }

        offset += PAGE_SIZE;
        if (offset % 50000 === 0) {
            console.log(`   Scanned ${offset.toLocaleString()} products...`);
        }

        if (data.length < PAGE_SIZE) break;
    }

    // Filter to only duplicates (count > 1)
    const result = Array.from(duplicates.entries())
        .filter(([_, count]) => count > 1)
        .map(([hash_name, count]) => ({ hash_name, count }))
        .sort((a, b) => b.count - a.count);

    console.log(`   Found ${result.length.toLocaleString()} hash_names with duplicates`);
    const totalDupes = result.reduce((sum, d) => sum + d.count - 1, 0);
    console.log(`   Total duplicate records: ${totalDupes.toLocaleString()}`);

    return result;
}

async function deleteDuplicatesKeepNewest() {
    console.log('\n🗑️ DELETING DUPLICATES (keeping newest per hash_name)...\n');

    const duplicates = await findDuplicatesByHashName();

    if (duplicates.length === 0) {
        console.log('   No duplicates found!');
        return;
    }

    let totalDeleted = 0;
    let processed = 0;
    const BATCH_SIZE = 50; // Process 50 hash_names at a time

    for (let i = 0; i < duplicates.length; i += BATCH_SIZE) {
        const batch = duplicates.slice(i, i + BATCH_SIZE);

        for (const dup of batch) {
            try {
                // Get all products with this hash_name, ordered by updated_at DESC
                const { data: products, error: fetchError } = await supabase
                    .from('raw_products')
                    .select('id, updated_at')
                    .eq('hash_name', dup.hash_name)
                    .order('updated_at', { ascending: false });

                if (fetchError || !products || products.length <= 1) continue;

                // Keep the first (newest), delete the rest
                const idsToDelete = products.slice(1).map(p => p.id);

                if (idsToDelete.length > 0) {
                    const { error: deleteError } = await supabase
                        .from('raw_products')
                        .delete()
                        .in('id', idsToDelete);

                    if (!deleteError) {
                        totalDeleted += idsToDelete.length;
                    }
                }
            } catch (e) {
                // Continue on error
            }

            processed++;
        }

        console.log(`   Progress: ${processed}/${duplicates.length} hash_names, ${totalDeleted.toLocaleString()} deleted`);

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`\n✅ CLEANUP COMPLETE: ${totalDeleted.toLocaleString()} duplicates deleted`);
}

async function deleteOldestBySource(sourceId: number, keepCount: number) {
    const sourceName = SOURCE_NAMES[sourceId] || `Source ${sourceId}`;
    console.log(`\n🗑️ Keeping only ${keepCount.toLocaleString()} newest for ${sourceName}...`);

    // Get count
    const { count } = await supabase
        .from('raw_products')
        .select('*', { count: 'exact', head: true })
        .eq('source_id', sourceId);

    if (!count || count <= keepCount) {
        console.log(`   ${sourceName} has only ${count} products, nothing to delete`);
        return;
    }

    const toDelete = count - keepCount;
    console.log(`   Will delete ${toDelete.toLocaleString()} oldest products...`);

    // Delete in batches - get oldest IDs first
    let deleted = 0;
    const BATCH_SIZE = 500;

    while (deleted < toDelete) {
        const remaining = Math.min(BATCH_SIZE, toDelete - deleted);

        // Get oldest IDs
        const { data: oldest, error: fetchError } = await supabase
            .from('raw_products')
            .select('id')
            .eq('source_id', sourceId)
            .order('crawled_at', { ascending: true })
            .limit(remaining);

        if (fetchError || !oldest || oldest.length === 0) break;

        const idsToDelete = oldest.map(p => p.id);

        const { error: deleteError } = await supabase
            .from('raw_products')
            .delete()
            .in('id', idsToDelete);

        if (deleteError) {
            console.log(`   Delete error:`, deleteError.message);
            break;
        }

        deleted += idsToDelete.length;
        console.log(`   Deleted ${deleted.toLocaleString()} / ${toDelete.toLocaleString()}`);

        await new Promise(r => setTimeout(r, 300));
    }

    console.log(`   ✅ ${sourceName}: Deleted ${deleted.toLocaleString()} old products`);
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    console.log('🧹 DATABASE CLEANUP TOOL\n');
    console.log('Commands:');
    console.log('  analyze     - Show database statistics');
    console.log('  duplicates  - Delete duplicate products (same name)');
    console.log('  trim <source> <keep> - Keep only N newest for a source');
    console.log('');

    if (command === 'analyze' || !command) {
        await analyzeDatabase();
    } else if (command === 'duplicates') {
        await analyzeDatabase();
        await deleteDuplicatesKeepNewest();
        await analyzeDatabase();
    } else if (command === 'trim') {
        const sourceId = parseInt(args[1]);
        const keepCount = parseInt(args[2]) || 50000;

        if (!sourceId || !SOURCE_NAMES[sourceId]) {
            console.log('Valid source IDs:', Object.entries(SOURCE_NAMES).map(([id, name]) => `${id}=${name}`).join(', '));
            return;
        }

        await deleteOldestBySource(sourceId, keepCount);
    }
}

main().catch(console.error);
