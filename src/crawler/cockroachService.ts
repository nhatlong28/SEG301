
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

let client: Client | null = null;

async function getClient() {
    if (!client) {
        client = new Client({ connectionString: process.env.DATABASE_URL });
        await client.connect();
    }
    return client;
}

export class CockroachService {
    static async getKeywords(source: string = 'all', freshnessHours?: number) {
        const db = await getClient();
        let query = 'SELECT * FROM crawl_keywords WHERE is_active = true';
        const params: any[] = [];

        const { rows } = await db.query(query, params);

        // Filter by source
        let filtered = rows.filter(kw =>
            source === 'all' ||
            (kw.applies_to && (kw.applies_to.includes('all') || kw.applies_to.includes(source)))
        );

        if (freshnessHours) {
            const threshold = new Date(Date.now() - freshnessHours * 60 * 60 * 1000);
            filtered = filtered.filter(kw => !kw.last_crawled_at || new Date(kw.last_crawled_at) < threshold);
        }

        return filtered;
    }

    static async markCrawled(keywordId: number) {
        const db = await getClient();
        await db.query('UPDATE crawl_keywords SET last_crawled_at = NOW() WHERE id = $1', [keywordId]);
    }

    static async insertProducts(products: any[]) {
        const db = await getClient();
        for (const p of products) {
            try {
                await db.query(`
                    INSERT INTO raw_products (
                        source_id, external_id, external_url, name, price, image_url, brand_raw, category_raw, crawled_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                    ON CONFLICT (source_id, external_id) DO UPDATE SET 
                        price = EXCLUDED.price,
                        updated_at = NOW();
                `, [p.source_id, p.external_id, p.external_url, p.name, p.price, p.image_url, p.brand_raw, p.category_raw]);
            } catch (e) {
                // console.error('Insert error', e);
            }
        }
    }
}
