
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/^["']|["']$/g, '');
let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()?.replace(/^["']|["']$/g, '');

// Validate Key Format
if (supabaseKey) {
    // Check for common copy-paste errors like double keys or spaces
    if (supabaseKey.includes(' ') || (supabaseKey.match(/\./g) || []).length > 2) {
        console.warn("Supabase Key seems malformed (contains spaces or too many dots). Attempting to fix...");
        
        // Strategy 1: Split by space or comma
        let parts = supabaseKey.split(/[\s,]+/); 
        
        // Strategy 2: If no spaces, check for concatenated JWTs (joined by dot)
        if (parts.length === 1 && supabaseKey.includes('.')) {
             const dotParts = supabaseKey.split('.');
             // A valid JWT has 3 parts (2 dots). A doubled one has 6 parts (5 dots) or more.
             if (dotParts.length >= 6) {
                 console.log("Detected dot-concatenated keys. extracting first key.");
                 parts = [dotParts.slice(0, 3).join('.')];
             }
        }

        if (parts.length > 0) {
            // Find the one that looks like a JWT (3 parts separated by dots)
            const validPart = parts.find(p => (p.match(/\./g) || []).length === 2);
            if (validPart) {
                console.log("Supabase Key Fix: Found valid key part, using it.");
                supabaseKey = validPart;
            } else {
                 // Fallback: just take the first chunk
                 console.log("Supabase Key Fix: Using first part as fallback.");
                 supabaseKey = parts[0];
            }
        }
    }
}

if (typeof window !== 'undefined') {
    console.log("Supabase Client Init - Key Length:", supabaseKey?.length);
    if (supabaseKey?.length > 200) {
        console.warn("Supabase Key might still be too long!");
    }
}

// Only create the client if environment variables are available
export const supabase = supabaseUrl && supabaseKey 
    ? createClient(supabaseUrl, supabaseKey) 
    : null;
