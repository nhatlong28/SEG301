
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentData() {
    console.log('Checking recent crawled data...');

    // Get count of products created in the last 60 minutes
    const timeAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data, error, count } = await supabase
        .from('raw_products')
        .select('id, name, price, source_id, crawled_at', { count: 'exact' })
        .gt('crawled_at', timeAgo)
        .order('crawled_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`\nFound ${count} new products in the last 60 minutes.`);

    if (data && data.length > 0) {
        console.log('\nLatest 20 products:');
        data.forEach((p: any) => {
            let sourceName = 'Unknown';
            if (p.source_id === 1) sourceName = 'Shopee';
            else if (p.source_id === 2) sourceName = 'Tiki';
            else if (p.source_id === 3) sourceName = 'Lazada';
            else if (p.source_id === 4) sourceName = 'CellphoneS';
            else if (p.source_id === 5) sourceName = 'DMX';

            console.log(`[ID:${p.source_id} ${sourceName}] ${p.name.substring(0, 30)}... | URL: ${p.external_url ? (p.external_url.substring(0, 40) + '...') : 'N/A'}`);
        });
    } else {
        console.log('No new data found.');
    }
}

checkRecentData();
