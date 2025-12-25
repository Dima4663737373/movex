import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { verifySignature, formatPublicKey } from '../../lib/verify';
import { Ed25519PublicKey } from "@aptos-labs/ts-sdk";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (!supabaseAdmin) {
            const missingEnv = [];
            if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missingEnv.push('NEXT_PUBLIC_SUPABASE_URL');
            if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingEnv.push('SUPABASE_SERVICE_ROLE_KEY');
            
            console.error("Supabase Admin client not initialized. Missing:", missingEnv);
            return res.status(500).json({ error: 'Supabase Admin client not initialized.', missingEnv });
        }

        if (req.method === 'GET') {
            const { userAddress, postId } = req.query;

            if (userAddress && postId) {
                // Check specific bookmark status
                const user = (userAddress as string).toLowerCase();
                const pid = postId as string; 

                const { data, error } = await supabaseAdmin
                    .from('bookmarks')
                    .select('*')
                    .eq('user_address', user)
                    .eq('post_id', pid)
                    .single();

                if (error && error.code !== 'PGRST116') {
                     console.error(`Error fetching bookmark (User: ${user}, Post: ${pid}):`, error);
                     return res.status(500).json({ error: error.message, code: error.code });
                }

                // Also get total count
                const { count, error: countError } = await supabaseAdmin
                    .from('bookmarks')
                    .select('id', { count: 'exact', head: true })
                    .eq('post_id', pid);

                if (countError) {
                    console.error(`Error fetching bookmark count (Post: ${pid}):`, countError);
                }

                return res.status(200).json({ bookmarked: !!data, count: count || 0 });
            }

            if (postId) {
                // Just get count
                const pid = postId as string;
                const { count, error: countError } = await supabaseAdmin
                    .from('bookmarks')
                    .select('id', { count: 'exact', head: true })
                    .eq('post_id', pid);
                
                if (countError) {
                    return res.status(500).json({ error: countError.message });
                }

                return res.status(200).json({ count: count || 0, bookmarked: false });
            }

            if (userAddress) {
                // Return user's bookmarks
                const user = (userAddress as string).toLowerCase();
                
                const { data: bookmarks, error } = await supabaseAdmin
                    .from('bookmarks')
                    .select('*')
                    .eq('user_address', user)
                    .order('created_at', { ascending: false });

                if (error) {
                     console.error(`Error fetching user bookmarks (User: ${user}):`, JSON.stringify(error, null, 2));
                     return res.status(500).json({ error: error.message, details: error });
                }
                
                const mappedBookmarks = bookmarks.map(b => ({
                    key: `${b.creator_address}_${b.post_id}`,
                    postId: b.post_id,
                    creatorAddress: b.creator_address,
                    timestamp: b.timestamp
                }));

                return res.status(200).json({ bookmarks: mappedBookmarks });
            }

            return res.status(200).json({});

        } else if (req.method === 'POST') {
            // Support both signed (legacy) and unsigned (new UX) requests
            const { message, signature, publicKey, postId: directPostId, creatorAddress: directCreator, userAddress: directUser } = req.body;
            
            let postId, creatorAddress, userAddress;

            // Case 1: Direct Request (No Signature - New UX)
            if (directPostId !== undefined && directCreator && directUser) {
                postId = directPostId;
                creatorAddress = directCreator;
                userAddress = directUser;
            } 
            // Case 2: Signed Request (Legacy)
            else if (message && signature && publicKey) {
                // Verify signature
                const verification = verifySignature(message, signature, publicKey);
                if (!verification.valid) {
                     return res.status(401).json({ error: `Invalid signature: ${verification.error}` });
                }

                let parsedMessage;
                try {
                    parsedMessage = JSON.parse(message);
                } catch (e) {
                     // Try to extract JSON from prefixed message
                     try {
                         const jsonStart = message.indexOf('{');
                         const jsonEnd = message.lastIndexOf('}');
                         if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                             const jsonStr = message.substring(jsonStart, jsonEnd + 1);
                             parsedMessage = JSON.parse(jsonStr);
                         } else {
                              throw new Error("No JSON found");
                         }
                     } catch (innerE) {
                         console.error("Failed to parse message:", message);
                         return res.status(400).json({ error: 'Invalid message format' });
                     }
                }

                postId = parsedMessage.postId;
                creatorAddress = parsedMessage.creatorAddress;
                userAddress = parsedMessage.userAddress;

                // Verify sender matches public key
                try {
                    const pubKeyStr = formatPublicKey(publicKey);
                    const pubKey = new Ed25519PublicKey(pubKeyStr);
                    const derivedAddress = pubKey.authKey().derivedAddress().toString();
                    
                    const normalize = (addr: string) => {
                        const lower = addr.toLowerCase();
                        return lower.startsWith('0x') ? lower : `0x${lower}`;
                    };

                    if (normalize(derivedAddress) !== normalize(userAddress)) {
                         return res.status(401).json({ error: 'Public key does not match user address' });
                    }
                } catch (e: any) {
                     return res.status(400).json({ error: `Invalid public key: ${e.message}` });
                }
            } else {
                const missing = [];
                if (directPostId === undefined) missing.push('postId');
                if (!directCreator) missing.push('creatorAddress');
                if (!directUser) missing.push('userAddress');
                return res.status(400).json({ error: `Invalid request. Missing parameters: ${missing.join(', ')}` });
            }

            if (postId === undefined || !creatorAddress || !userAddress) {
                return res.status(400).json({ error: 'Invalid request data. Missing postId, creatorAddress, or userAddress.' });
            }

            const user = userAddress.toLowerCase();
            const creator = creatorAddress.toLowerCase();
            const pid = postId.toString();

            // Check if exists
            const { data: existing, error: checkError } = await supabaseAdmin
                .from('bookmarks')
                .select('*')
                .eq('user_address', user)
                .eq('post_id', pid)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                 return res.status(500).json({ error: checkError.message });
            }

            if (existing) {
                // Remove bookmark (toggle off)
                const { error } = await supabaseAdmin
                    .from('bookmarks')
                    .delete()
                    .eq('id', existing.id);

                if (error) {
                    return res.status(500).json({ error: error.message });
                }

                // Get updated count
                const { count } = await supabaseAdmin
                    .from('bookmarks')
                    .select('id', { count: 'exact', head: true })
                    .eq('post_id', pid);

                return res.status(200).json({ bookmarked: false, count: count || 0 });
            } else {
                // Add bookmark
                const { error } = await supabaseAdmin
                    .from('bookmarks')
                    .insert([{
                        user_address: user,
                        post_id: pid,
                        creator_address: creator,
                        timestamp: Date.now()
                    }]);

                if (error) {
                    console.error("Supabase Error adding bookmark:", error);
                    return res.status(500).json({ error: error.message, code: error.code, details: error });
                }

                // Get updated count
                const { count } = await supabaseAdmin
                    .from('bookmarks')
                    .select('id', { count: 'exact', head: true })
                    .eq('post_id', pid);

                return res.status(200).json({ bookmarked: true, count: count || 0 });
            }
        } else if (req.method === 'DELETE') {
            // Typically DELETE shouldn't have a body, but Next.js supports it.
            // However, standard fetch might not send body with DELETE.
            // For compatibility, we can accept POST with action='delete' or just handle it here if body is sent.
            // Given we are signing, we need a body.
            
            const { message, signature, publicKey } = req.body;

            if (!message || !signature || !publicKey) {
                return res.status(400).json({ error: 'Missing signature, message, or public key' });
            }

            // Verify signature
            const verification = verifySignature(message, signature, publicKey);
            if (!verification.valid) {
                 return res.status(401).json({ error: `Invalid signature: ${verification.error}` });
            }

            let parsedMessage;
            try {
                parsedMessage = JSON.parse(message);
            } catch (e) {
                return res.status(400).json({ error: 'Invalid message format' });
            }

            const { postId, creatorAddress, userAddress } = parsedMessage;
            
            // ... (Verification logic same as POST)
            try {
                const pubKey = new Ed25519PublicKey(publicKey);
                const derivedAddress = pubKey.authKey().derivedAddress().toString();
                 const normalize = (addr: string) => {
                    const lower = addr.toLowerCase();
                    return lower.startsWith('0x') ? lower : `0x${lower}`;
                };

                if (normalize(derivedAddress) !== normalize(userAddress)) {
                     return res.status(401).json({ error: 'Public key does not match user address' });
                }
            } catch (e: any) {
                 return res.status(400).json({ error: `Invalid public key: ${e.message}` });
            }

            const user = userAddress.toLowerCase();
            const pid = postId.toString();

            const { error } = await supabaseAdmin
                .from('bookmarks')
                .delete()
                .eq('user_address', user)
                .eq('post_id', pid);

            if (error) {
                return res.status(500).json({ error: error.message });
            }

            return res.status(200).json({ success: true });
        } else {
            res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
            return res.status(405).end(`Method ${req.method} Not Allowed`);
        }
    } catch (error: any) {
        console.error("Unexpected error in bookmarks API:", error);
        return res.status(500).json({ error: "Unexpected server error", details: error.message, stack: error.stack });
    }
}
