import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl) {
    throw new Error('Missing env.SUPABASE_URL');
}

// Client for public access (anon key)
export const supabase = createClient<Database>(
    supabaseUrl,
    supabaseAnonKey || ''
);

// Admin client for bypass RLS and server-side operations
export const supabaseAdmin = createClient<Database>(
    supabaseUrl,
    supabaseServiceRoleKey || '',
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);
