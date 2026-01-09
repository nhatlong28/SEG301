require('dotenv').config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log('--- ENV CHECK ---');
console.log('URL:', supabaseUrl);
console.log('Anon Key:', supabaseAnonKey ? 'EXISTS' : 'MISSING');
console.log('Service Key:', supabaseServiceKey ? 'EXISTS' : 'MISSING');

try {
    const client = createClient(supabaseUrl, supabaseServiceKey);
    console.log('Client created successfully');
} catch (e: any) {
    console.error('FAILED TO CREATE CLIENT:', e.message);
}
