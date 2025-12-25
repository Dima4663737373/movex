
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use Service Role Key if available, otherwise undefined (don't fallback to Anon Key if it causes issues)
// Actually, using Anon Key is better than null, but only if it's valid.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is missing. Admin actions requiring bypass-RLS will fail.');
}

// NOTE: This client should ONLY be used in server-side API routes.
// It has full access to the database (bypassing RLS) ONLY if the Service Role Key is used.
export const supabaseAdmin = supabaseUrl && supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey) 
    : (supabaseUrl && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
        ? createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) 
        : null);
