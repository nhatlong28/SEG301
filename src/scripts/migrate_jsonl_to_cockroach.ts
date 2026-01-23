
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const db = new Client({ connectionString: process.env.DATABASE_URL });

async function migrate() {
    await db.connect();
    console.log('📡 Connected to CockroachDB');

    const sources = ['tiki', 'lazada', 'cellphones', 'dienmayxanh', 'thegioididong', 'chotot'];
    const SOURCE_MAP: any = { tiki: 2, lazada: 3, cellphones: 4, dienmayxanh: 5, thegioididong: 6, chotot: 7 };

    for (const source of sources) {
        const filePath = path.join(process.cwd(), 'data', source, 'products.jsonl');
        if (!fs.existsSync(filePath)) continue;

        console.log(`📦 Migrating ${source.toUpperCase()}...`);
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        let batch: any[] = [];
        let count = 0;

        for await (const line of rl) {
            try {
                const p = JSON.parse(line);
                batch.push(p);
                if (batch.length >= 100) {
                    await insertBatch(batch);
                    count += batch.length;
                    batch = [];
                    if (count % 1000 === 0) console.log(`   - ${count.toLocaleString()} products migrated`);
                }
            } catch { }
        }
        if (batch.length > 0) await insertBatch(batch);
        console.log(`✅ ${source} DONE!`);
    }

    console.log('🎉 ALL DATA MIGRATED TO COCKROACHDB!');
    await db.end();
}

async function insertBatch(batch: any[]) {
    for (const p of batch) {
        try {
            await db.query(`
                INSERT INTO raw_products (source_id, external_id, external_url, name, price, image_url, brand_raw, category_raw, crawled_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (source_id, external_id) DO NOTHING
            `, [p.source_id, p.external_id, p.external_url, p.name, p.price, p.image_url, p.brand_raw, p.category_raw, p.crawled_at]);
        } catch { }
    }
}

migrate().catch(console.error);
