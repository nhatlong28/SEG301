/**
 * Test Deduplication on Real Database Data (Supabase)
 */

try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) { }

import { createClient } from '@supabase/supabase-js';
import { MLEntityMatcher, ProductData } from './src/lib/entity-resolution/mlMatcher';
import { getEmbeddingService } from './src/lib/search/embeddingService';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Must use service role for full access

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const matcher = new MLEntityMatcher();
const embeddingService = getEmbeddingService();

async function runRealDataTest() {
    console.log('🔌 Connecting to Supabase...');

    // 1. Fetch products (iPhone related)
    console.log('📥 Fetching raw products matching "iphone"...');
    const { data: rawProducts, error } = await supabase
        .from('raw_products')
        .select('*')
        .ilike('name', '%iphone%')
        .limit(50);

    if (error || !rawProducts || rawProducts.length === 0) {
        console.error('❌ Error fetching products:', error);
        return;
    }

    console.log(`📦 Fetched ${rawProducts.length} products.`);

    // 2. Map to ProductData interface
    const products: ProductData[] = rawProducts.map(p => ({
        externalId: p.external_id,
        sourceId: p.source_id,
        name: p.name,
        brand: p.brand_raw || 'Apple', // Assuming search term implies brand if missing
        category: p.category_raw,
        price: p.price ? parseFloat(p.price) : undefined,
        rating: p.rating,
        specs: p.specs as Record<string, string>,
    }));

    // 3. Generate embeddings (optional but recommended for test accuracy)
    if (embeddingService.isAvailable()) {
        console.log('🧠 Generating embeddings for test batch...');
        // Process in small batches
        const batchSize = 10;
        for (let i = 0; i < products.length; i += batchSize) {
            const chunk = products.slice(i, i + batchSize);
            const texts = chunk.map(p => p.name);
            try {
                const embeddings = await embeddingService.generateBatchDocumentEmbeddings(texts);
                chunk.forEach((p, idx) => {
                    if (embeddings[idx]) p.embedding = embeddings[idx]!;
                });
                process.stdout.write('.');
            } catch (e) {
                console.error(`Error embedding batch ${i}:`, e);
            }
        }
        console.log('\n✅ Embeddings generated.');
    }

    // 4. Cluster Products
    console.log('🔍 Clustering products (minScore = 0.65)...');
    const clusters = await matcher.clusterProducts(products, 0.65);

    // 5. Display Results
    console.log(`\n🎉 Found ${clusters.length} distinct product groups from ${products.length} raw items:\n`);

    clusters.forEach((cluster, i) => {
        if (cluster.length > 1) { // Only show groups with matches for brevity
            console.log(`📂 Cluster ${i + 1} (${cluster.length} items):`);
            // Sort by price to see variants easily
            cluster.sort((a, b) => (a.price || 0) - (b.price || 0));

            cluster.forEach(p => {
                const price = p.price ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.price) : 'N/A';
                console.log(`   🔸 [${p.sourceId == 1 ? 'TIKI' : p.sourceId == 2 ? 'SHOPEE' : 'OTHER'}] ${p.name.substring(0, 60)}... (${price})`);
            });
            console.log('');
        }
    });

    console.log(`ℹ️  Single items (no matches): ${clusters.filter(c => c.length === 1).length}`);
}

runRealDataTest().catch(console.error);
