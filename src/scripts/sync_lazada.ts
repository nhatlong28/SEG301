
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function syncLazada() {
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();

    const source = 'lazada';
    const source_id = 3;
    const filePath = path.join(process.cwd(), 'data', source, 'products.jsonl');

    console.log('🔄 SYNCING LAZADA JSONL -> DATABASE');

    // Get existing IDs from DB for this source to avoid unnecessary inserts
    console.log('📡 Fetching existing IDs from DB...');
    const { rows } = await db.query('SELECT external_id FROM raw_products WHERE source_id = $1', [source_id]);
    const dbIds = new Set(rows.map(r => r.external_id));
    console.log(`✅ Found ${dbIds.size.toLocaleString()} products in DB.`);

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let batch: any[] = [];
    let added = 0;
    let totalInFile = 0;
    const BATCH_SIZE = 100;

    for await (const line of rl) {
        try {
            totalInFile++;
            const p = JSON.parse(line);
            const extId = String(p.external_id);

            if (!dbIds.has(extId)) {
                batch.push(p);
                dbIds.add(extId); // Mark as added to avoid duplicates in file

                if (batch.length >= BATCH_SIZE) {
                    await insertBatch(db, batch, source_id);
                    added += batch.length;
                    batch = [];
                    console.log(`   ⚡ Progress: Added ${added.toLocaleString()} missing products...`);
                }
            }
        } catch { }
    }

    if (batch.length > 0) {
        await insertBatch(db, batch, source_id);
        added += batch.length;
    }

    console.log(`\n🎉 SYNC COMPLETE!`);
    console.log(`   File Total Lines: ${totalInFile.toLocaleString()}`);
    console.log(`   Added to DB:      ${added.toLocaleString()}`);

    // Final count check
    const finalRes = await db.query('SELECT COUNT(*) FROM raw_products WHERE source_id = $1', [source_id]);
    console.log(`   New DB Total:     ${parseInt(finalRes.rows[0].count).toLocaleString()}`);

    await db.end();
}

async function insertBatch(db: Client, batch: any[], sourceId: number) {
    const columns = [
        'source_id', 'external_id', 'external_url', 'name', 'price',
        'image_url', 'brand_raw', 'category_raw', 'crawled_at', 'updated_at'
    ];

    const placeholders = batch.map((_, i) =>
        `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(',')})`
    ).join(',');

    const values = batch.flatMap(p => [
        sourceId, String(p.external_id), p.external_url, p.name, p.price,
        p.image_url, p.brand_raw, p.category_raw, p.crawled_at || new Date().toISOString(), new Date().toISOString()
    ]);

    const query = `
        INSERT INTO raw_products ("${columns.join('","')}") 
        VALUES ${placeholders} 
        ON CONFLICT (source_id, external_id) DO NOTHING
    `;

    try {
        await db.query(query, values);
    } catch (e: any) {
        // Fallback row by row
        for (const p of batch) {
            try {
                await db.query(`
                    INSERT INTO raw_products ("source_id", "external_id", "external_url", "name", "price", "image_url", "brand_raw", "category_raw", "crawled_at", "updated_at")
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT DO NOTHING
                `, [sourceId, String(p.external_id), p.external_url, p.name, p.price, p.image_url, p.brand_raw, p.category_raw, p.crawled_at || new Date().toISOString(), new Date().toISOString()]);
            } catch { }
        }
    }
}

syncLazada().catch(console.error);
