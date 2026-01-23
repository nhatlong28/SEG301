
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

let pool: Client | null = null;

export async function getDbClient() {
    if (!pool) {
        pool = new Client({
            connectionString: process.env.DATABASE_URL,
        });
        await pool.connect();
    }
    return pool;
}


export async function insertProducts(products: any[]) {
    if (!products.length) return;
    const client = await getDbClient();

    const columns = [
        'source_id', 'external_id', 'external_url', 'name', 'price',
        'image_url', 'brand_raw', 'category_raw', 'crawled_at', 'updated_at'
    ];

    const placeholders = products.map((_, i) =>
        `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(',')})`
    ).join(',');

    const values = products.flatMap(p => [
        p.source_id, String(p.external_id), p.external_url, p.name, p.price,
        p.image_url, p.brand_raw, p.category_raw, p.crawled_at || new Date().toISOString(), new Date().toISOString()
    ]);

    const query = `
        INSERT INTO raw_products ("${columns.join('","')}") 
        VALUES ${placeholders} 
        ON CONFLICT (source_id, external_id) DO UPDATE SET 
            price = EXCLUDED.price,
            updated_at = EXCLUDED.updated_at
    `;

    try {
        await client.query(query, values);
    } catch (e: any) {
        // Fallback row by row if batch fails
        for (const p of products) {
            try {
                await client.query(`
                    INSERT INTO raw_products ("source_id", "external_id", "external_url", "name", "price", "image_url", "brand_raw", "category_raw", "crawled_at", "updated_at")
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (source_id, external_id) DO UPDATE SET 
                        price = EXCLUDED.price,
                        updated_at = NOW()
                `, [p.source_id, String(p.external_id), p.external_url, p.name, p.price, p.image_url, p.brand_raw, p.category_raw, p.crawled_at || new Date().toISOString(), new Date().toISOString()]);
            } catch { }
        }
    }
}
