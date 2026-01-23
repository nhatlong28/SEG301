
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const db = new Client({ connectionString: process.env.DATABASE_URL });

const SOURCE_MAP: Record<string, number> = {
    tiki: 2,
    lazada: 3,
    cellphones: 4,
    dienmayxanh: 5,
    thegioididong: 6,
    chotot: 7
};

async function turboImport() {
    await db.connect();
    console.log('🚀 TURBO IMPORTER: JSONL -> COCKROACHDB');

    const sources = Object.keys(SOURCE_MAP);

    for (const source of sources) {
        const filePath = path.join(process.cwd(), 'data', source, 'products.jsonl');
        if (!fs.existsSync(filePath)) {
            console.log(`⏩ Skipping ${source}: File not found`);
            continue;
        }

        console.log(`\n📦 Importing ${source.toUpperCase()}...`);
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        let batch: any[] = [];
        let total = 0;
        const BATCH_SIZE = 500;

        for await (const line of rl) {
            try {
                const p = JSON.parse(line);
                // Ensure correct source_id
                p.source_id = SOURCE_MAP[source];
                batch.push(p);

                if (batch.length >= BATCH_SIZE) {
                    await insertBatch(batch);
                    total += batch.length;
                    batch = [];
                    if (total % 5000 === 0) console.log(`   ⚡ Progress: ${total.toLocaleString()} products...`);
                }
            } catch { }
        }

        if (batch.length > 0) {
            await insertBatch(batch);
            total += batch.length;
        }
        console.log(`✅ ${source.toUpperCase()} DONE: ${total.toLocaleString()} products`);
    }

    console.log('\n🎉 ALL JSONL DATA IMPORTED SUCCESSFULLY!');
    await db.end();
}

async function insertBatch(batch: any[]) {
    const columns = [
        'source_id', 'external_id', 'external_url', 'name', 'price',
        'image_url', 'brand_raw', 'category_raw', 'crawled_at'
    ];

    const placeholders = batch.map((_, i) =>
        `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(',')})`
    ).join(',');

    const values = batch.flatMap(p => [
        p.source_id, p.external_id, p.external_url, p.name, p.price,
        p.image_url, p.brand_raw, p.category_raw, p.crawled_at || new Date().toISOString()
    ]);

    const query = `
        INSERT INTO raw_products ("${columns.join('","')}") 
        VALUES ${placeholders} 
        ON CONFLICT (source_id, external_id) DO NOTHING
    `;

    try {
        await db.query(query, values);
    } catch (e: any) {
        // Fallback row by row if batch fails for some weird data issue
        for (const p of batch) {
            try {
                await db.query(`
                    INSERT INTO raw_products ("${columns.join('","')}")
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT DO NOTHING
                `, [p.source_id, p.external_id, p.external_url, p.name, p.price, p.image_url, p.brand_raw, p.category_raw, p.crawled_at || new Date().toISOString()]);
            } catch { }
        }
    }
}

turboImport().catch(console.error);
