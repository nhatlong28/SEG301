/**
 * IMPORT JSONL TO DATABASE
 * Import crawled products from JSONL files into Supabase database
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

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
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const DATA_DIR = path.join(process.cwd(), 'data');

// Source ID mapping (matches database)
const SOURCE_IDS: Record<string, number> = {
    tiki: 2,
    lazada: 3,
    cellphones: 4,
    dienmayxanh: 5,
    thegioididong: 6,
    chotot: 7,
};

interface ProductRecord {
    source_id: number;
    external_id: string;
    external_url: string;
    name: string;
    price: number;
    image_url: string | null;
    brand_raw: string | null;
    category_raw: string | null;
    crawled_at: string;
}

function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .trim();
}

function generateHash(name: string): string {
    const normalized = normalizeName(name);
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
}

async function importSourceData(sourceName: string): Promise<{ imported: number; skipped: number; errors: number }> {
    const sourceId = SOURCE_IDS[sourceName];
    if (!sourceId) {
        console.error(`Unknown source: ${sourceName}`);
        return { imported: 0, skipped: 0, errors: 0 };
    }

    const jsonlPath = path.join(DATA_DIR, sourceName, 'products.jsonl');
    if (!fs.existsSync(jsonlPath)) {
        console.log(`No JSONL file found for ${sourceName}`);
        return { imported: 0, skipped: 0, errors: 0 };
    }

    console.log(`\n📂 Importing ${sourceName} from ${jsonlPath}...`);

    const fileStream = fs.createReadStream(jsonlPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const BATCH_SIZE = 500;
    const PARALLEL_BATCHES = 5;
    let lineCount = 0;
    const allLines: string[] = [];

    // Read all lines first
    for await (const line of rl) {
        if (line.trim()) allLines.push(line);
    }
    
    console.log(`   Found ${allLines.length.toLocaleString()} products to import...`);

    // Process in parallel batches
    const batches: any[][] = [];
    let currentBatch: any[] = [];

    for (const line of allLines) {
        lineCount++;
        try {
            const product: ProductRecord = JSON.parse(line);
            
            if (!product.external_id || !product.name || !product.price || product.price <= 0) {
                skipped++;
                continue;
            }

            currentBatch.push({
                source_id: sourceId,
                external_id: String(product.external_id).trim(),
                external_url: product.external_url,
                name: product.name,
                name_normalized: normalizeName(product.name),
                price: product.price,
                image_url: product.image_url,
                brand_raw: product.brand_raw,
                category_raw: product.category_raw,
                hash_name: generateHash(product.name),
                crawled_at: product.crawled_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });

            if (currentBatch.length >= BATCH_SIZE) {
                batches.push(currentBatch);
                currentBatch = [];
            }
        } catch (e) {
            errors++;
        }
    }
    if (currentBatch.length > 0) batches.push(currentBatch);

    console.log(`   Created ${batches.length} batches, processing ${PARALLEL_BATCHES} at a time...`);

    // Process batches in parallel groups
    for (let i = 0; i < batches.length; i += PARALLEL_BATCHES) {
        const group = batches.slice(i, i + PARALLEL_BATCHES);
        const results = await Promise.all(group.map(b => upsertBatch(b)));
        
        for (const r of results) {
            imported += r.inserted;
            errors += r.errors;
        }

        const progress = Math.min(i + PARALLEL_BATCHES, batches.length);
        console.log(`   Progress: ${progress}/${batches.length} batches (${imported.toLocaleString()} imported)`);
    }

    console.log(`✅ ${sourceName}: ${imported.toLocaleString()} imported, ${skipped.toLocaleString()} skipped, ${errors} errors`);
    return { imported, skipped, errors };
}

async function upsertBatch(batch: any[]): Promise<{ inserted: number; errors: number }> {
    try {
        // Deduplicate within batch
        const uniqueMap = new Map<string, any>();
        for (const item of batch) {
            const key = `${item.source_id}-${item.external_id}`;
            uniqueMap.set(key, item);
        }
        const uniqueBatch = Array.from(uniqueMap.values());

        const { data, error } = await (supabaseAdmin as any)
            .from('raw_products')
            .upsert(uniqueBatch, {
                onConflict: 'source_id, external_id',
                ignoreDuplicates: false
            })
            .select('id');

        if (error) {
            console.error('   Batch upsert error:', error.message);
            return { inserted: 0, errors: batch.length };
        }

        return { inserted: data?.length || 0, errors: 0 };
    } catch (e) {
        console.error('   Batch exception:', e);
        return { inserted: 0, errors: batch.length };
    }
}

async function main() {
    const args = process.argv.slice(2);
    const targetSource = args[0]?.toLowerCase();

    console.log('🚀 JSONL TO DATABASE IMPORTER\n');

    const sources = targetSource 
        ? [targetSource]
        : Object.keys(SOURCE_IDS);

    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const source of sources) {
        const result = await importSourceData(source);
        totalImported += result.imported;
        totalSkipped += result.skipped;
        totalErrors += result.errors;
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 TOTAL: ${totalImported.toLocaleString()} imported, ${totalSkipped.toLocaleString()} skipped, ${totalErrors} errors`);
    console.log('='.repeat(50));
}

main().catch(console.error);
