import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase Admin client not initialized.' });
    }

    if (req.method === 'GET') {
        const { postId } = req.query;

        if (!postId) {
            return res.status(400).json({ error: 'Post ID is required' });
        }

        const pid = postId as string;
        if (pid.startsWith('temp-') || pid.startsWith('pending-')) {
             return res.status(200).json({ viewCount: 0 });
        }

        const { data, error } = await supabaseAdmin
            .from('post_views')
            .select('view_count')
            .eq('post_id', postId as string)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
            // Gracefully handle missing table (42P01) or other DB errors
            console.warn("Error fetching views (likely missing table):", error.message);
            return res.status(200).json({ viewCount: 0 });
        }

        return res.status(200).json({ viewCount: data?.view_count || 0 });

    } else if (req.method === 'POST') {
        const { postId, viewerAddress } = req.body;

        if (!postId) {
            return res.status(400).json({ error: 'Post ID is required' });
        }

        try {
            // Generate unique viewer hash
            let viewerHash: string;
            
            if (viewerAddress) {
                // Trust the wallet address if provided (could be spoofed but low incentive for views)
                viewerHash = `wallet_${viewerAddress}`;
            } else {
                // Guest: Hash IP + User Agent
                const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
                const userAgent = req.headers['user-agent'] || 'unknown';
                const raw = `${Array.isArray(ip) ? ip[0] : ip}-${userAgent}`;
                viewerHash = `guest_${crypto.createHash('sha256').update(raw).digest('hex')}`;
            }

            // Use the new atomic register_view function
            const { error: rpcError } = await supabaseAdmin.rpc('register_view', {
                p_post_id: postId.toString(),
                p_viewer_hash: viewerHash
            });

            if (rpcError) {
                // If register_view doesn't exist yet (migration pending), fall back to simple increment
                // BUT only if the error indicates function missing. 
                if (rpcError.code === '42883') { // undefined_function
                     console.warn("register_view RPC missing, falling back to simple increment");
                     await supabaseAdmin.rpc('increment_view_count', {
                        p_post_id: postId.toString()
                     });
                } else {
                    throw rpcError;
                }
            }
        } catch (e: any) {
             console.error("View increment failed:", e.message);
             // Return 200 to prevent client retries/errors
             return res.status(200).json({ success: false, error: e.message });
        }

        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
