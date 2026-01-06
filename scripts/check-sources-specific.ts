
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSources() {
    const { data, error } = await supabase.from('sources')
        .select('*')
        .in('type', ['lazada', 'tiki']);

    console.log(JSON.stringify(data, null, 2));
}

checkSources();
