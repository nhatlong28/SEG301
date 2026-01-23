/**
 * SMART IMPORT - CHECK DB FIRST, ONLY IMPORT MISSING
 * 1. Fetch all existing external_ids from DB for a source
 * 2. Compare with JSONL file
 * 3. Only import products that are NOT in DB
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

const MAX_PER_SOURCE = 5000; // Keep it small to stay in Free Tier 500MB limit
const MAX_TOTAL_ROWS_TARGET = 80000; // Target total rows in DB


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

/**
 * Fetch all existing external_ids for a source from database
 */
async function fetchExistingIds(sourceId: number): Promise<{ ids: Set<string>, names: Set<string> }> {
    console.log(`   📥 Fetching existing products from DB for source ${sourceId}...`);

    const existingIds = new Set<string>();
    const existingNames = new Set<string>();
    let offset = 0;
    const PAGE_SIZE = 10000;

    while (true) {
        const { data, error } = await supabaseAdmin
            .from('raw_products')
            .select('external_id, name')
            .eq('source_id', sourceId)
            .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
            console.error(`   ❌ Error fetching existing IDs:`, error.message);
            await new Promise(r => setTimeout(r, 2000));
            continue;
        }

        if (!data || data.length === 0) break;

        for (const row of data) {
            existingIds.add(String(row.external_id));
            if (row.name) existingNames.add(normalizeName(row.name));
        }

        offset += PAGE_SIZE;

        if (offset % 50000 === 0) {
            console.log(`   📥 Fetched ${existingIds.size.toLocaleString()} products so far...`);
        }

        if (data.length < PAGE_SIZE) break;
    }

    console.log(`   ✅ Found ${existingIds.size.toLocaleString()} existing products in DB`);
    return { ids: existingIds, names: existingNames };
}

/**
 * Read products from JSONL that are NOT in existingIds OR existingNames
 */
async function readMissingProducts(jsonlPath: string, sourceId: number, existing: { ids: Set<string>, names: Set<string> }): Promise<any[]> {
    console.log(`   📂 Reading JSONL and filtering missing products (Limit: ${MAX_PER_SOURCE})...`);

    const fileStream = fs.createReadStream(jsonlPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const missingProducts: any[] = [];
    const localNames = new Set<string>();
    let totalInFile = 0;
    let skippedInvalid = 0;
    let alreadyExists = 0;
    let nameDuplicate = 0;

    for await (const line of rl) {
        if (!line.trim()) continue;
        totalInFile++;

        try {
            const product = JSON.parse(line);

            if (!product.external_id || !product.name || !product.price || product.price <= 0) {
                skippedInvalid++;
                continue;
            }

            const externalId = String(product.external_id).trim();
            const normName = normalizeName(product.name);

            // Skip if ID exists in DB
            if (existing.ids.has(externalId)) {
                alreadyExists++;
                continue;
            }

            // Skip if name exists in DB or in current batch
            if (existing.names.has(normName) || localNames.has(normName)) {
                nameDuplicate++;
                continue;
            }

            // Add to missing list
            missingProducts.push({
                source_id: sourceId,
                external_id: externalId,
                external_url: product.external_url,
                name: product.name,
                name_normalized: normName,
                price: product.price,
                image_url: product.image_url,
                brand_raw: product.brand_raw,
                category_raw: product.category_raw,
                hash_name: generateHash(product.name),
                crawled_at: product.crawled_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });

            localNames.add(normName);

            // Stop if reached limit for this source
            if (missingProducts.length >= MAX_PER_SOURCE) {
                break;
            }
        } catch (e) {
            skippedInvalid++;
        }
    }

    console.log(`   📊 JSONL Stats:`);
    console.log(`      - Total scanned: ${totalInFile.toLocaleString()}`);
    console.log(`      - Already in DB (ID): ${alreadyExists.toLocaleString()}`);
    console.log(`      - Name Duplicates: ${nameDuplicate.toLocaleString()}`);
    console.log(`      - Missing (to import): ${missingProducts.length.toLocaleString()}`);

    return missingProducts;
}


/**
 * Import missing products in small batches with retry
 */
async function importMissingProducts(products: any[]): Promise<{ imported: number; errors: number }> {
    if (products.length === 0) {
        console.log(`   ✅ No missing products to import!`);
        return { imported: 0, errors: 0 };
    }

    const BATCH_SIZE = 100; // Efficient batch for Supabase
    const batches: any[][] = [];

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
        batches.push(products.slice(i, i + BATCH_SIZE));
    }

    console.log(`   🚀 Importing ${products.length.toLocaleString()} missing products in ${batches.length} batches...`);

    let imported = 0;
    let errors = 0;

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        let success = false;
        let retries = 0;
        const MAX_RETRIES = 3;

        while (!success && retries < MAX_RETRIES) {
            try {
                const { data, error } = await supabaseAdmin
                    .from('raw_products')
                    .upsert(batch, {
                        onConflict: 'source_id, external_id',
                        ignoreDuplicates: false
                    })
                    .select('id');

                if (error) {
                    retries++;
                    if (error.message.includes('timeout') || error.message.includes('rate limit')) {
                        console.log(`   ⏳ Batch ${i + 1} issue, retrying (${retries}/${MAX_RETRIES})...`);
                        await new Promise(r => setTimeout(r, 2000 * retries));
                    } else {
                        console.error(`   ❌ Batch ${i + 1} error:`, error.message);
                        break;
                    }
                } else {
                    imported += data?.length || batch.length;
                    success = true;
                }
            } catch (e: any) {
                retries++;
                console.error(`   ❌ Batch ${i + 1} exception:`, e.message);
                await new Promise(r => setTimeout(r, 2000 * retries));
            }
        }

        if (!success) {
            errors += batch.length;
        }

        // Progress log every 10 batches
        if ((i + 1) % 10 === 0 || i === batches.length - 1) {
            console.log(`   Progress: ${i + 1}/${batches.length} batches (${imported.toLocaleString()} imported, ${errors} errors)`);
        }

        // Dynamic delay
        await new Promise(r => setTimeout(r, 100));
    }

    return { imported, errors };
}

async function importSourceMissing(sourceName: string): Promise<{ imported: number; errors: number }> {
    const sourceId = SOURCE_IDS[sourceName];
    if (!sourceId) {
        console.error(`❌ Unknown source: ${sourceName}`);
        return { imported: 0, errors: 0 };
    }

    const jsonlPath = path.join(DATA_DIR, sourceName, 'products.jsonl');
    if (!fs.existsSync(jsonlPath)) {
        console.log(`❌ No JSONL file found for ${sourceName}`);
        return { imported: 0, errors: 0 };
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 SMART IMPORT: ${sourceName.toUpperCase()}`);
    console.log(`${'='.repeat(60)}`);

    // Step 1: Fetch existing IDs and names from DB
    const existing = await fetchExistingIds(sourceId);

    // Step 2: Read JSONL and find missing products
    const missingProducts = await readMissingProducts(jsonlPath, sourceId, existing);

    // Step 3: Import missing products
    const result = await importMissingProducts(missingProducts);

    console.log(`\n✅ ${sourceName}: ${result.imported.toLocaleString()} newly imported, ${result.errors} errors`);

    return result;
}


async function main() {
    const args = process.argv.slice(2);
    const targetSource = args[0]?.toLowerCase();

    console.log('🚀 SMART IMPORT - ONLY MISSING PRODUCTS\n');

    const sources = targetSource
        ? [targetSource]
        : Object.keys(SOURCE_IDS);

    let totalImported = 0;
    let totalErrors = 0;

    for (const source of sources) {
        const result = await importSourceMissing(source);
        totalImported += result.imported;
        totalErrors += result.errors;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 TOTAL: ${totalImported.toLocaleString()} newly imported, ${totalErrors} errors`);
    console.log('='.repeat(60));
}

main().catch(console.error);
