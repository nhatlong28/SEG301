
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndFix() {
    console.log('Checking for mismatched source IDs...');

    // Fetch products with source_id = 2 (Tiki) but lazada in URL
    const { data: wrongLazada, error } = await supabase
        .from('raw_products')
        .select('id, name, external_url')
        .eq('source_id', 2)
        .ilike('external_url', '%lazada%')
        .limit(1000);

    if (error) {
        console.error('Error fetching wrong Lazada products:', error);
        return;
    }

    if (wrongLazada && wrongLazada.length > 0) {
        console.log(`Found ${wrongLazada.length} products labeled as Tiki (ID 2) but having Lazada URL.`);
        console.log('Sample:', wrongLazada[0].name, wrongLazada[0].external_url);

        // Fix them
        const ids = wrongLazada.map(p => p.id);
        const { error: updateError } = await supabase
            .from('raw_products')
            .update({ source_id: 3 }) // Update to Lazada ID 3
            .in('id', ids);

        if (updateError) {
            console.error('Failed to update:', updateError);
        } else {
            console.log(`✅ Successfully corrected ${ids.length} products to Source ID 3 (Lazada).`);
        }
    } else {
        console.log('No Lazada products found within Tiki source ID (2).');
    }

    // Check if any Shopee products ended up in Tiki/Lazada?
    // ...
}

checkAndFix();
