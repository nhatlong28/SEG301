import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Ensure environment variables are loaded
try {
    require('dotenv').config({ path: '.env.local' });
    require('dotenv').config();
} catch (e) { }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('❌ CRITICAL: Supabase URL or Anon Key missing from environment variables');
}

if (!supabaseServiceKey) {
    console.warn('⚠️ WARNING: Supabase Service Role Key missing. supabaseAdmin will not be functional.');
}

// Client for browser (anon key)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Admin client for server-side operations (service role key)
// We use a fallback empty string for the service key to avoid crash if not provided, 
// as supabaseAdmin might only be used in specific server-side contexts.
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey || '', {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
