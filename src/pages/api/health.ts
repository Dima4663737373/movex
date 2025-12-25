import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Masking helper
    const mask = (str?: string) => str ? `${str.substring(0, 5)}...${str.substring(str.length - 5)}` : 'MISSING';

    const health = {
        status: 'unknown',
        env: {
            NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'OK' : 'MISSING',
            SUPABASE_SERVICE_ROLE_KEY: mask(process.env.SUPABASE_SERVICE_ROLE_KEY),
            NEXT_PUBLIC_SUPABASE_ANON_KEY: mask(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
            NODE_ENV: process.env.NODE_ENV,
        },
        supabaseAdminInitialized: !!supabaseAdmin,
        timestamp: new Date().toISOString()
    };

    if (supabaseAdmin) {
        try {
            // Try a lightweight query to verify connection and auth
            // Using 'count' on a public table or just checking if we can query
            const { data, error, count } = await supabaseAdmin
                .from('notifications')
                .select('id', { count: 'exact', head: true });

            if (error) {
                health.status = 'error';
                (health as any).dbError = error.message;
            } else {
                health.status = 'healthy';
                (health as any).dbLatency = 'OK';
            }
        } catch (e: any) {
            health.status = 'exception';
            (health as any).exception = e.message;
        }
    } else {
        health.status = 'uninitialized';
    }

    res.status(200).json(health);
}
