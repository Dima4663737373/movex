import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const sbUrlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKeyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const sbAnonRaw = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    // Helper to clean keys (replication of lib/supabaseAdmin logic)
    const cleanKey = (key: string | undefined) => {
        if (!key) return undefined;
        let cleaned = key.trim().replace(/^["']|["']$/g, '');
        
        // Double-key fix logic
        if (cleaned.includes(' ') || (cleaned.match(/\./g) || []).length > 2) {
             let parts = cleaned.split(/[\s,]+/);
             if (parts.length === 1 && cleaned.includes('.')) {
                  const dotParts = cleaned.split('.');
                  if (dotParts.length >= 6) {
                      parts = [dotParts.slice(0, 3).join('.')];
                  }
             }
             if (parts.length > 0) {
                 const validPart = parts.find(p => (p.match(/\./g) || []).length === 2);
                 if (validPart) cleaned = validPart;
                 else cleaned = parts[0];
             }
        }
        return cleaned;
    };

    const sbUrl = sbUrlRaw ? sbUrlRaw.trim().replace(/^["']|["']$/g, '') : undefined;
    const sbKey = cleanKey(sbKeyRaw);
    const sbAnon = cleanKey(sbAnonRaw);

    const envStatus = {
        NEXT_PUBLIC_SUPABASE_URL: {
            raw: sbUrlRaw ? 'PRESENT' : 'MISSING',
            cleaned: sbUrl || 'MISSING'
        },
        SUPABASE_SERVICE_ROLE_KEY: {
            raw: sbKeyRaw ? `Len: ${sbKeyRaw.length}, Dots: ${(sbKeyRaw.match(/\./g) || []).length}` : 'MISSING',
            cleaned: sbKey ? `Len: ${sbKey.length}, Dots: ${(sbKey.match(/\./g) || []).length}, Start: ${sbKey.substring(0, 5)}...` : 'MISSING'
        },
        NEXT_PUBLIC_SUPABASE_ANON_KEY: {
            raw: sbAnonRaw ? `Len: ${sbAnonRaw.length}, Dots: ${(sbAnonRaw.match(/\./g) || []).length}` : 'MISSING',
            cleaned: sbAnon ? `Len: ${sbAnon.length}, Dots: ${(sbAnon.match(/\./g) || []).length}` : 'MISSING'
        }
    };

    let connectionTest = "SKIPPED";
    let connectionError = null;

    if (sbUrl && sbKey) {
        try {
            const client = createClient(sbUrl, sbKey);
            // Try to fetch notifications table specifically as that's failing
            const { data, error } = await client.from('notifications').select('count', { count: 'exact', head: true });
            
            if (error) {
                connectionTest = "FAILED";
                connectionError = error;
            } else {
                connectionTest = "SUCCESS";
            }
        } catch (e: any) {
            connectionTest = "EXCEPTION";
            connectionError = e.message;
        }
    }

    res.status(200).json({
        env: envStatus,
        test: connectionTest,
        error: connectionError
    });
}
