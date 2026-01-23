
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const targetDb = new Client({ connectionString: process.env.DATABASE_URL });

async function migrate() {
    console.log('🚀 DEPLOYING FULL MIGRATION: SUPABASE -> COCKROACHDB');
    await targetDb.connect();

    // 0. CLEAN START (Optional but recommended for "i chang")
    console.log('🧹 Cleaning up Target DB...');
    const tablesInReverse = [
        'product_mappings', 'canonical_products', 'price_history',
        'raw_products', 'crawl_keywords', 'categories', 'brands', 'sources'
    ];
    for (const t of tablesInReverse) {
        await targetDb.query(`DROP TABLE IF EXISTS ${t} CASCADE;`);
    }

    // 1. CREATE ENUMS
    console.log('🎨 Creating Enums...');
    const enums = [
        `CREATE TYPE crawl_status AS ENUM ('success', 'failed', 'partial');`,
        `CREATE TYPE sentiment_label AS ENUM ('positive', 'neutral', 'negative');`,
        `CREATE TYPE source_type AS ENUM ('shopee', 'tiki', 'lazada', 'cellphones', 'dienmayxanh', 'thegioididong', 'chotot');`,
        `CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');`,
        `CREATE TYPE dedup_status AS ENUM ('master', 'duplicate', 'merged');`
    ];

    for (const sql of enums) {
        try { await targetDb.query(sql); } catch (e) { } // Ignore if exists
    }

    // 2. DEFINE TABLES (Dependency-aware order)
    const tableQueries = [
        // Sources
        `CREATE TABLE IF NOT EXISTS sources (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE,
            base_url VARCHAR(255),
            type source_type DEFAULT 'tiki',
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            api_key VARCHAR(255),
            rate_limit_rps INTEGER DEFAULT 1,
            proxy_url VARCHAR(255),
            last_crawled_at TIMESTAMPTZ,
            total_items_crawled BIGINT DEFAULT 0,
            config JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,

        // Brands
        `CREATE TABLE IF NOT EXISTS brands (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            slug VARCHAR(255) UNIQUE NOT NULL,
            logo_url VARCHAR(255),
            is_verified BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,

        // Categories
        `CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            parent_id INTEGER REFERENCES categories(id),
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            level INTEGER DEFAULT 1,
            path TEXT,
            icon_url VARCHAR(255),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,

        // Keywords
        `CREATE TABLE IF NOT EXISTS crawl_keywords (
            id SERIAL PRIMARY KEY,
            keyword TEXT UNIQUE NOT NULL,
            category TEXT,
            priority INTEGER DEFAULT 1,
            is_active BOOLEAN DEFAULT true,
            applies_to TEXT[],
            last_crawled_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,

        // Raw Products (The big one)
        `CREATE TABLE IF NOT EXISTS raw_products (
            id SERIAL PRIMARY KEY,
            source_id INTEGER REFERENCES sources(id),
            external_id VARCHAR(255) NOT NULL,
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
        );`,

        // Price History
        `CREATE TABLE IF NOT EXISTS price_history (
            id BIGSERIAL PRIMARY KEY,
            raw_product_id INTEGER REFERENCES raw_products(id) ON DELETE CASCADE,
            price BIGINT NOT NULL,
            price_original BIGINT,
            discount_percent INTEGER,
            is_on_sale BOOLEAN,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,

        // Canonical Products
        `CREATE TABLE IF NOT EXISTS canonical_products (
            id BIGSERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            name_normalized TEXT UNIQUE,
            slug TEXT UNIQUE,
            description TEXT,
            brand_id INTEGER REFERENCES brands(id),
            category_id INTEGER REFERENCES categories(id),
            min_price BIGINT,
            max_price BIGINT,
            image_url TEXT,
            attributes JSONB DEFAULT '{}'::jsonb,
            embedding_vector TEXT, 
            status processing_status DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );`,

        // Product Mappings
        `CREATE TABLE IF NOT EXISTS product_mappings (
            id BIGSERIAL PRIMARY KEY,
            raw_product_id INTEGER REFERENCES raw_products(id) ON DELETE CASCADE,
            canonical_id BIGINT REFERENCES canonical_products(id) ON DELETE CASCADE,
            confidence NUMERIC(5,4),
            mapping_type VARCHAR(100),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(raw_product_id, canonical_id)
        );`
    ];

    console.log('🏗 Building tables...');
    for (const sql of tableQueries) {
        await targetDb.query(sql);
    }

    // 3. DATA MIGRATION
    const tablesToMigrate = [
        'sources', 'brands', 'categories', 'crawl_keywords', 'raw_products',
        'price_history', 'canonical_products', 'product_mappings'
    ];

    for (const table of tablesToMigrate) {
        console.log(`\n📦 Migrating table: ${table}`);
        let count = 0;
        let offset = 0;
        const PAGE_SIZE = 1000;

        while (true) {
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .range(offset, offset + PAGE_SIZE - 1)
                .order('id', { ascending: true });

            if (error) {
                console.error(`   ❌ Error fetching ${table}:`, error.message);
                break;
            }

            if (!data || data.length === 0) break;

            // Prepare batch insert
            const columns = Object.keys(data[0]);
            const placeholders = data.map((_, i) =>
                `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(',')})`
            ).join(',');

            const values = data.flatMap(row => columns.map(col => row[col]));
            const query = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`;

            try {
                await targetDb.query(query, values);
                count += data.length;
                console.log(`   Progress: ${count.toLocaleString()} rows migrated`);
            } catch (e: any) {
                console.error(`   ⚠️ Batch error in ${table}:`, e.message);
                // Fallback to row-by-row if batch fails (for complex constraints)
                for (const row of data) {
                    try {
                        const vals = columns.map(c => row[c]);
                        const q = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map((_, idx) => `$${idx + 1}`).join(',')}) ON CONFLICT DO NOTHING`;
                        await targetDb.query(q, vals);
                    } catch { }
                }
            }

            offset += PAGE_SIZE;
            if (data.length < PAGE_SIZE) break;
        }
    }

    console.log('\n🎉 ALL-IN-ONE MIGRATION FINISHED!');
    await targetDb.end();
}

migrate().catch(console.error);
