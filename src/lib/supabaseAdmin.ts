
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
// Use Service Role Key if available, otherwise undefined
// We trim whitespace to avoid copy-paste errors
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is missing. Admin actions requiring bypass-RLS will fail.');
} else {
    // Debug logging (safe)
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
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
            return createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim());
          })()
        : null);
