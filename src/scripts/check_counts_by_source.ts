
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkCounts() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    console.log('📊 PRODUCT COUNTS BY SOURCE:');

    const res = await client.query(`
        SELECT s.name, COUNT(r.id) as count
        FROM sources s
        LEFT JOIN raw_products r ON s.id = r.source_id
        GROUP BY s.name
        ORDER BY count DESC;
    `);

    res.rows.forEach(row => {
        console.log(`${row.name.padEnd(20)} | ${row.count.toString().padStart(10)}`);
    });

    await client.end();
}

checkCounts().catch(console.error);
