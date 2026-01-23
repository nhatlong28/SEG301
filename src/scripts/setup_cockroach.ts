
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const db = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function setup() {
    console.log('📡 Connecting to CockroachDB...');
    await db.connect();
    console.log('✅ Connected!');

    console.log('🛠 Creating tables...');

    // 1. sources
    await db.query(`
        CREATE TABLE IF NOT EXISTS sources (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE,
            base_url VARCHAR(255),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);

    // 2. crawl_keywords
    await db.query(`
        CREATE TABLE IF NOT EXISTS crawl_keywords (
            id SERIAL PRIMARY KEY,
            keyword TEXT UNIQUE NOT NULL,
            category TEXT,
            priority INTEGER DEFAULT 1,
            is_active BOOLEAN DEFAULT true,
            applies_to TEXT[],
            last_crawled_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);

    // 3. raw_products
    await db.query(`
        CREATE TABLE IF NOT EXISTS raw_products (
            id SERIAL PRIMARY KEY,
            source_id INTEGER,
            external_id VARCHAR(255),
            external_url TEXT,
            name TEXT,
            name_normalized TEXT,
            price BIGINT,
            image_url TEXT,
            brand_raw TEXT,
            category_raw TEXT,
            hash_name VARCHAR(255),
            crawled_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(source_id, external_id)
        );
    `);

    // Seed sources
    const sources = [
        [2, 'tiki', 'https://tiki.vn'],
        [3, 'lazada', 'https://www.lazada.vn'],
        [4, 'cellphones', 'https://cellphones.com.vn'],
        [5, 'dienmayxanh', 'https://www.dienmayxanh.com'],
        [6, 'thegioididong', 'https://www.thegioididong.com'],
        [7, 'chotot', 'https://www.chotot.com']
    ];

    for (const [id, name, url] of sources) {
        await db.query(`
            INSERT INTO sources (id, name, base_url) 
            VALUES ($1, $2, $3) 
            ON CONFLICT (id) DO UPDATE SET base_url = EXCLUDED.base_url;
        `, [id, name, url]);
    }

    console.log('✅ Setup complete!');
    await db.end();
}

setup().catch(console.error);
