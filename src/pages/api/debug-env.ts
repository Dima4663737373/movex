import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const sbAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const envStatus = {
        NEXT_PUBLIC_SUPABASE_URL: sbUrl ? sbUrl.trim() : 'MISSING',
        SUPABASE_SERVICE_ROLE_KEY: sbKey ? `${sbKey.trim().substring(0, 5)}...${sbKey.trim().substring(sbKey.trim().length - 5)} (len: ${sbKey.trim().length})` : 'MISSING',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: sbAnon ? `${sbAnon.trim().substring(0, 5)}...${sbAnon.trim().substring(sbAnon.trim().length - 5)} (len: ${sbAnon.trim().length})` : 'MISSING',
    };

    let connectionTest = "SKIPPED";
    let connectionError = null;

    if (sbUrl && sbKey) {
        try {
            const client = createClient(sbUrl.trim(), sbKey.trim());
            // Try to fetch something innocuous, e.g. check if we can connect
            // We use a query that should return empty or error but verify auth
            const { data, error } = await client.from('votes').select('count', { count: 'exact', head: true });
            
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
