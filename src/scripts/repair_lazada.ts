
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function importLazada() {
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();

    const source = 'lazada';
    const source_id = 3;
    const filePath = path.join(process.cwd(), 'data', source, 'products.jsonl');

    if (!fs.existsSync(filePath)) {
        console.log('File not found');
        process.exit(1);
    }

    console.log(`📦 Repairing ${source.toUpperCase()}...`);
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let count = 0;
    let added = 0;
    let errors = 0;

    for await (const line of rl) {
        try {
            const p = JSON.parse(line);
            const res = await db.query(`
                INSERT INTO raw_products (
                    source_id, external_id, external_url, name, price, image_url, brand_raw, category_raw, crawled_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                ON CONFLICT (source_id, external_id) DO NOTHING
                RETURNING id;
            `, [source_id, String(p.external_id), p.external_url, p.name, p.price, p.image_url, p.brand_raw, p.category_raw, p.crawled_at || new Date().toISOString()]);

            if (res.rowCount && res.rowCount > 0) added++;
            count++;
            if (count % 1000 === 0) console.log(`   Checked ${count}... (Added ${added})`);
        } catch (e) {
            errors++;
            if (errors < 5) console.error('Error on line:', line, e);
        }
    }

    console.log(`✅ DONE: Checked ${count}, Added ${added} new products. Errors: ${errors}`);
    await db.end();
}

importLazada().catch(console.error);
