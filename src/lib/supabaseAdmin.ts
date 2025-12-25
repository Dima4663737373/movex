
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to NEXT_PUBLIC_SUPABASE_ANON_KEY. Some admin actions may fail due to RLS.');
}

// NOTE: This client should ONLY be used in server-side API routes.
// It has full access to the database (bypassing RLS) ONLY if the Service Role Key is used.
export const supabaseAdmin = supabaseUrl && supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey) 
    : null;
