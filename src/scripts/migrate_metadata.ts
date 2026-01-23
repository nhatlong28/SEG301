
import { Client } from 'pg';
import { supabaseAdmin } from '../db/supabase';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const db = new Client({ connectionString: process.env.DATABASE_URL });

async function migrate() {
    await db.connect();
    console.log('📡 Connected to CockroachDB');

    // 1. Migrate Keywords
    console.log('📥 Fetching keywords from Supabase...');
    const { data: keywords } = await supabaseAdmin.from('crawl_keywords').select('*');

    if (keywords) {
        console.log(`🚀 Migrating ${keywords.length} keywords...`);
        for (const kw of keywords) {
            await db.query(`
                INSERT INTO crawl_keywords (keyword, category, priority, is_active, applies_to, last_crawled_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (keyword) DO UPDATE SET is_active = EXCLUDED.is_active;
            `, [kw.keyword, kw.category, kw.priority, kw.is_active, kw.applies_to, kw.last_crawled_at]);
        }
    }

    console.log('✅ Migration complete!');
    await db.end();
}

migrate().catch(console.error);
