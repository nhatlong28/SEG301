
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLazada() {
    console.log('Checking for Lazada products (source_id = 3)...');

    const { count, error } = await supabase
        .from('raw_products')
        .select('*', { count: 'exact', head: true })
        .eq('source_id', 3);

    if (error) console.error(error);
    else console.log(`Total Lazada products found: ${count}`);

    const { data } = await supabase
        .from('raw_products')
        .select('id, name, created_at')
        .eq('source_id', 3)
        .order('created_at', { ascending: false })
        .limit(5);

    if (data && data.length > 0) {
        console.log('Most recent entries:');
        console.log(JSON.stringify(data, null, 2));
    }
}

checkLazada();
