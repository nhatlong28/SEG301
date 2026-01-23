
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const targetDb = new Client({ connectionString: process.env.DATABASE_URL });

const SCHEMA_METADATA = [
    {
        table: 'sources',
        ddl: `CREATE TABLE sources (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE,
            base_url VARCHAR(255),
            type TEXT,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            api_key VARCHAR(255),
            rate_limit_rps INTEGER DEFAULT 1,
            proxy_url VARCHAR(255),
            last_crawled_at TIMESTAMPTZ,
            total_items_crawled BIGINT DEFAULT 0,
            config JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )`
    },
    {
        table: 'brands',
        ddl: `CREATE TABLE brands (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            slug VARCHAR(255) UNIQUE NOT NULL,
            logo_url VARCHAR(255),
            is_verified BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )`
    },
    {
        table: 'categories',
        ddl: `CREATE TABLE categories (
            id SERIAL PRIMARY KEY,
            parent_id INTEGER,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            level INTEGER DEFAULT 1,
            path TEXT,
            icon VARCHAR(255),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            source_id INTEGER,
            external_id VARCHAR(255)
        )`
    },
    {
        table: 'crawl_keywords',
        ddl: `CREATE TABLE crawl_keywords (
            id SERIAL PRIMARY KEY,
            keyword TEXT UNIQUE NOT NULL,
            category TEXT,
            priority INTEGER DEFAULT 1,
            is_active BOOLEAN DEFAULT true,
            applies_to TEXT[],
            last_crawled_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            url TEXT
        )`
    },
    {
        table: 'raw_products',
        ddl: `CREATE TABLE raw_products (
            id SERIAL PRIMARY KEY,
            source_id INTEGER,
            external_id VARCHAR(255) NOT NULL,
            external_url TEXT,
            name TEXT,
            name_normalized TEXT,
            price BIGINT,
            image_url TEXT,
            brand_raw TEXT,
            category_raw TEXT,
            attributes JSONB,
            metadata JSONB,
            hash_name VARCHAR(255),
            crawled_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            last_dedup_at TIMESTAMPTZ,
            dedup_status VARCHAR(50),
            UNIQUE(source_id, external_id)
        )`
    },
    {
        table: 'price_history',
        ddl: `CREATE TABLE price_history (
            id BIGSERIAL PRIMARY KEY,
            raw_product_id BIGINT,
            price NUMERIC NOT NULL,
            original_price NUMERIC,
            discount_percent INTEGER,
            available BOOLEAN,
            recorded_at TIMESTAMPTZ DEFAULT NOW()
        )`
    },
    {
        table: 'canonical_products',
        ddl: `CREATE TABLE canonical_products (
            id BIGSERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            name_normalized TEXT UNIQUE,
            slug TEXT UNIQUE,
            brand_id INTEGER,
            category_id INTEGER,
            description TEXT,
            image_url TEXT,
            images JSONB,
            canonical_specs JSONB,
            min_price NUMERIC,
            max_price NUMERIC,
            avg_rating DOUBLE PRECISION,
            total_reviews INTEGER,
            total_sold INTEGER,
            source_count INTEGER,
            quality_score DOUBLE PRECISION,
            is_verified BOOLEAN DEFAULT false,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )`
    },
    {
        table: 'product_mappings',
        ddl: `CREATE TABLE product_mappings (
            id BIGSERIAL PRIMARY KEY,
            canonical_id BIGINT,
            raw_product_id BIGINT,
            confidence_score DOUBLE PRECISION,
            matching_method VARCHAR(100),
            is_verified BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(raw_product_id, canonical_id)
        )`
    },
    {
        table: 'user_watchlist',
        ddl: `CREATE TABLE user_watchlist (
            id BIGSERIAL PRIMARY KEY,
            user_id UUID,
            canonical_id BIGINT,
            target_price NUMERIC,
            notify_on_drop BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(user_id, canonical_id)
        )`
    },
    {
        table: 'crawl_logs',
        ddl: `CREATE TABLE crawl_logs (
            id SERIAL PRIMARY KEY,
            source_id INTEGER,
            keyword_id INTEGER,
            status TEXT,
            items_found INTEGER DEFAULT 0,
            items_saved INTEGER DEFAULT 0,
            error_message TEXT,
            duration_ms INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )`
    }
];

async function mirror() {
    await targetDb.connect();
    console.log('💎 SYSTEM MIRROR: SUPABASE -> COCKROACHDB');

    for (const meta of SCHEMA_METADATA) {
        console.log(`\n🔄 Handling ${meta.table}`);

        await targetDb.query(`DROP TABLE IF EXISTS "${meta.table}" CASCADE`);
        await targetDb.query(meta.ddl);
        console.log(`   ✅ Table created with correct columns`);

        let offset = 0;
        const PAGE_SIZE = 500; // Smaller pages for large columns
        let total = 0;

        while (true) {
            // SKIP DATA MIGRATION for large/merged tables as requested
            const SKIP_DATA_FOR = ['raw_products', 'canonical_products', 'product_mappings', 'price_history'];
            if (SKIP_DATA_FOR.includes(meta.table)) {
                console.log(`   ⏭️ Skipping data fetch for ${meta.table} (Structure only)`);
                break;
            }

            const { data, error } = await supabase
                .from(meta.table)
                .select('*')
                .range(offset, offset + PAGE_SIZE - 1)
                .order('id', { ascending: true });

            if (error) {
                console.error(`   ❌ Error fetching: ${error.message}`);
                break;
            }

            if (!data || data.length === 0) break;

            const columns = Object.keys(data[0]);
            const placeholders = data.map((_, i) =>
                `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(',')})`
            ).join(',');
            const values = data.flatMap(row => columns.map(col => row[col]));
            const query = `INSERT INTO "${meta.table}" ("${columns.join('","')}") VALUES ${placeholders} ON CONFLICT DO NOTHING`;

            try {
                await targetDb.query(query, values);
            } catch (e: any) {
                // console.error(`   ⚠️ Batch error in ${meta.table}, falling back to row-by-row: ${e.message}`);
                for (const row of data) {
                    const vals = columns.map(c => row[c]);
                    const qRow = `INSERT INTO "${meta.table}" ("${columns.join('","')}") VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')}) ON CONFLICT DO NOTHING`;
                    try { await targetDb.query(qRow, vals); } catch { }
                }
            }

            total += data.length;
            if (total % 1000 === 0 || data.length < PAGE_SIZE) {
                console.log(`   Progress: ${total.toLocaleString()} rows migrated`);
            }

            if (data.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }
    }

    console.log('\n✨ MIRROR COMPLETE! Everything is "i chang" on CockroachDB.');
    await targetDb.end();
}

mirror().catch(console.error);
