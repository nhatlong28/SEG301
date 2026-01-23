
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

export interface CrawlKeyword {
    id: number;
    keyword: string;
    category: string;
    priority: number;
    is_active: boolean;
    applies_to: string[];
    last_crawled_at: string | null;
}

export class KeywordService {
    static async getKeywords(
        source: string = 'all',
        category?: string,
        freshnessHours?: number
    ): Promise<CrawlKeyword[]> {
        const db = await getClient();
        let query = 'SELECT * FROM crawl_keywords WHERE is_active = true';
        const params: any[] = [];

        if (category) {
            query += ' AND category = $1';
            params.push(category);
        }

        query += ' ORDER BY priority ASC, keyword ASC';

        const { rows } = await db.query(query, params);

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

    static async markCrawled(keywordId: number): Promise<void> {
        const db = await getClient();
        await db.query('UPDATE crawl_keywords SET last_crawled_at = NOW() WHERE id = $1', [keywordId]);
    }

    static async addKeyword(
        keyword: string,
        category: string,
        priority: number = 1,
        appliesTo: string[] = ['all']
    ): Promise<boolean> {
        const db = await getClient();
        try {
            await db.query(`
                INSERT INTO crawl_keywords (keyword, category, priority, applies_to, is_active)
                VALUES ($1, $2, $3, $4, true)
                ON CONFLICT (keyword) DO NOTHING
            `, [keyword, category, priority, appliesTo]);
            return true;
        } catch {
            return false;
        }
    }
}
