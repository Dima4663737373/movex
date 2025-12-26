import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Gracefully handle missing Supabase configuration
    if (!supabaseAdmin) {
        // Return empty structures so the frontend doesn't break/error
        if (req.method === 'GET') {
            const { type } = req.query;
            if (type === 'mutes') return res.status(200).json({ mutes: [] });
            if (type === 'blocks') return res.status(200).json({ blocks: [] });
            if (type === 'not_interested') return res.status(200).json({ not_interested: [] });
            return res.status(200).json({});
        }
        // For POST, just pretend it worked but log a warning on server
        if (req.method === 'POST') {
             console.warn("Supabase not configured, interaction not saved.");
             return res.status(200).json({ success: true, mock: true });
        }
        return res.status(200).json({});
    }

    if (req.method === 'GET') {
        const { userAddress, type } = req.query;

        if (!userAddress || typeof userAddress !== 'string') {
            return res.status(400).json({ error: 'Missing userAddress' });
        }

        const user = userAddress.toLowerCase();

        try {
            if (type === 'mutes') {
                const { data, error } = await supabaseAdmin
                    .from('mutes')
                    .select('muted_user, created_at')
                    .eq('muter', user);
                
                if (error) {
                    // Handle missing table gracefully
                    if (error.code === '42P01') return res.status(200).json({ mutes: [] });
                    throw error;
                }
                return res.status(200).json({ mutes: data });
            } 
            else if (type === 'blocks') {
                const { data, error } = await supabaseAdmin
                    .from('blocks')
                    .select('blocked_user, created_at')
                    .eq('blocker', user);
                
                if (error) {
                    // Handle missing table gracefully
                    if (error.code === '42P01') return res.status(200).json({ blocks: [] });
                    throw error;
                }
                return res.status(200).json({ blocks: data });
            }
            else if (type === 'not_interested') {
                const { data, error } = await supabaseAdmin
                    .from('not_interested')
                    .select('post_id, created_at')
                    .eq('user_address', user);
                
                if (error) {
                    // Handle missing table gracefully
                    if (error.code === '42P01') return res.status(200).json({ not_interested: [] });
                    throw error;
                }
                return res.status(200).json({ not_interested: data });
            }
            else {
                return res.status(400).json({ error: 'Invalid interaction type for GET' });
            }
        } catch (error: any) {
            console.error(`Error fetching ${type}:`, error);
            return res.status(500).json({ error: error.message });
        }
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { type, userAddress, targetAddress, postId } = req.body;

    if (!userAddress) {
        return res.status(400).json({ error: 'Missing userAddress' });
    }

    const user = userAddress.toLowerCase();

    try {
        if (type === 'mute') {
            if (!targetAddress) return res.status(400).json({ error: 'Missing targetAddress' });
            const target = targetAddress.toLowerCase();
            
            // Check if already muted
            const { data: existing, error: fetchError } = await supabaseAdmin
                .from('mutes')
                .select('*')
                .eq('muter', user)
                .eq('muted_user', target)
                .single();

            if (fetchError && fetchError.code === '42P01') {
                 console.warn("Table 'mutes' missing. Mocking success.");
                 return res.status(200).json({ success: true, action: 'muted', mock: true });
            }

            if (existing) {
                // Unmute
                await supabaseAdmin.from('mutes').delete().eq('muter', user).eq('muted_user', target);
                return res.status(200).json({ success: true, action: 'unmuted' });
            } else {
                // Mute
                const { error: insertError } = await supabaseAdmin.from('mutes').insert({ muter: user, muted_user: target });
                if (insertError && insertError.code === '42P01') {
                    return res.status(200).json({ success: true, action: 'muted', mock: true });
                }
                if (insertError) throw insertError;
                return res.status(200).json({ success: true, action: 'muted' });
            }
        } 
        else if (type === 'block') {
            if (!targetAddress) return res.status(400).json({ error: 'Missing targetAddress' });
            const target = targetAddress.toLowerCase();

            // Check if already blocked
            const { data: existing, error: fetchError } = await supabaseAdmin
                .from('blocks')
                .select('*')
                .eq('blocker', user)
                .eq('blocked_user', target)
                .single();

            if (fetchError && fetchError.code === '42P01') {
                 console.warn("Table 'blocks' missing. Mocking success.");
                 return res.status(200).json({ success: true, action: 'blocked', mock: true });
            }

            if (existing) {
                // Unblock
                await supabaseAdmin.from('blocks').delete().eq('blocker', user).eq('blocked_user', target);
                return res.status(200).json({ success: true, action: 'unblocked' });
            } else {
                // Block
                const { error: insertError } = await supabaseAdmin.from('blocks').insert({ blocker: user, blocked_user: target });
                if (insertError && insertError.code === '42P01') {
                    return res.status(200).json({ success: true, action: 'blocked', mock: true });
                }
                if (insertError) throw insertError;
                
                // Also unfollow if blocked - Best effort
                try {
                    await supabaseAdmin.from('follows').delete().match({ follower: user, following: target });
                    await supabaseAdmin.from('follows').delete().match({ follower: target, following: user });
                } catch (e) { console.warn("Failed to unfollow after block:", e); }
                
                return res.status(200).json({ success: true, action: 'blocked' });
            }
        } 
        else if (type === 'not_interested') {
            if (!postId) return res.status(400).json({ error: 'Missing postId' });
            const pid = postId.toString();

            // Check if already marked
            const { data: existing, error: fetchError } = await supabaseAdmin
                .from('not_interested')
                .select('*')
                .eq('user_address', user)
                .eq('post_id', pid)
                .single();

            if (fetchError && fetchError.code === '42P01') {
                 console.warn("Table 'not_interested' missing. Mocking success.");
                 return res.status(200).json({ success: true, action: 'marked_not_interested', mock: true });
            }

            if (existing) {
                // Undo
                await supabaseAdmin.from('not_interested').delete().eq('id', existing.id);
                return res.status(200).json({ success: true, action: 'undo_not_interested' });
            } else {
                // Mark
                const { error: insertError } = await supabaseAdmin.from('not_interested').insert({ 
                    user_address: user, 
                    post_id: pid 
                });
                if (insertError && insertError.code === '42P01') {
                    return res.status(200).json({ success: true, action: 'marked_not_interested', mock: true });
                }
                if (insertError) throw insertError;

                return res.status(200).json({ success: true, action: 'marked_not_interested' });
            }
        }
        else {
            return res.status(400).json({ error: 'Invalid interaction type' });
        }
    } catch (error: any) {
        console.error(`Error in ${type}:`, error);
        return res.status(500).json({ error: error.message });
    }
}
