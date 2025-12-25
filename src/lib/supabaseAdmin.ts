
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use Service Role Key if available, otherwise undefined (don't fallback to Anon Key if it causes issues)
// Actually, using Anon Key is better than null, but only if it's valid.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is missing. Admin actions requiring bypass-RLS will fail.');
} else {
    // Debug logging (safe)
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const maskedKey = key.length > 10 ? `${key.substring(0, 5)}...${key.substring(key.length - 5)}` : 'INVALID_KEY_LENGTH';
    console.log(`Supabase Service Key loaded: ${maskedKey} (Length: ${key.length})`);
}

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
     console.log(`Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
} else {
     console.error("NEXT_PUBLIC_SUPABASE_URL is missing!");
}

// NOTE: This client should ONLY be used in server-side API routes.
// It has full access to the database (bypassing RLS) ONLY if the Service Role Key is used.
export const supabaseAdmin = supabaseUrl && supabaseServiceKey 
    ? (() => {
        console.log("Initializing Supabase Admin with SERVICE_ROLE_KEY");
        return createClient(supabaseUrl, supabaseServiceKey);
      })()
    : (supabaseUrl && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
        ? (() => {
            console.warn("Initializing Supabase Admin with ANON_KEY (Limited Access)");
            return createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
          })()
        : null);
