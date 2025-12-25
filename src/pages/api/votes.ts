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
            const { postId, creatorAddress, userAddress } = req.query;

            if (postId && creatorAddress) {
                const creator = (creatorAddress as string).toLowerCase();
                const pid = postId as string;

                // Fetch votes for this post
                const { data: votes, error } = await supabaseAdmin
                    .from('votes')
                    .select('vote_type, user_address')
                    .eq('creator_address', creator)
                    .eq('post_id', pid);

                if (error) {
                    console.error("Database error fetching votes:", error);
                     return res.status(500).json({ error: error.message, details: error });
                }

                const up = votes.filter(v => v.vote_type === 'up').length;
                const down = votes.filter(v => v.vote_type === 'down').length;

                let userVote = null;
                if (userAddress) {
                    const user = (userAddress as string).toLowerCase();
                    const myVote = votes.find(v => v.user_address === user);
                    if (myVote) {
                        userVote = myVote.vote_type;
                    }
                }

                // Explicitly return null if no vote found
                return res.status(200).json({ up, down, userVote: userVote || null });
            }

            return res.status(200).json({ up: 0, down: 0, userVote: null });
            
        } else if (req.method === 'POST') {
            // Allow simplified voting without signature (as per user request)
            let postId, creatorAddress, type, userAddress;

            // Try to parse from top-level body first (simplified mode)
            if (req.body.postId !== undefined && req.body.creatorAddress && req.body.type && req.body.userAddress) {
                ({ postId, creatorAddress, type, userAddress } = req.body);
            } else {
                 // Fallback to legacy/signed mode if params are missing
                 const { message, signature, publicKey } = req.body;
                 
                 if (message && signature && publicKey) {
                     // Verify signature
                     const verification = verifySignature(message, signature, publicKey);
                     if (!verification.valid) {
                          console.error("Invalid vote signature:", verification.error, "Message:", message);
                          return res.status(401).json({ error: `Invalid signature: ${verification.error}` });
                     }
                     
                     try {
                         const parsedMessage = JSON.parse(message);
                         ({ postId, creatorAddress, type, userAddress } = parsedMessage);
                     } catch (e) {
                         // Try to extract JSON from prefixed message
                         try {
                             const jsonStart = message.indexOf('{');
                             const jsonEnd = message.lastIndexOf('}');
                             if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                                 const jsonStr = message.substring(jsonStart, jsonEnd + 1);
                                 const parsed = JSON.parse(jsonStr);
                                 ({ postId, creatorAddress, type, userAddress } = parsed);
                             } else {
                                  throw new Error("No JSON found");
                             }
                         } catch (innerE) {
                             console.error("Invalid vote message format:", message);
                             return res.status(400).json({ error: 'Invalid message format' });
                         }
                     }

                     // Verify public key matches userAddress
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
                      if (req.body.postId === undefined) missing.push('postId');
                      if (!req.body.creatorAddress) missing.push('creatorAddress');
                      if (!req.body.type) missing.push('type');
                      if (!req.body.userAddress) missing.push('userAddress');
                      return res.status(400).json({ error: `Missing parameters: ${missing.join(', ')}. Provide params directly or via signed message.` });
                 }
            }

            if (postId === undefined || !creatorAddress || !['up', 'down'].includes(type) || !userAddress) {
                return res.status(400).json({ error: 'Invalid request. Missing postId, creatorAddress, type, or userAddress.' });
            }

            const { data, error } = await supabaseAdmin
                .from('votes')
                .upsert({
                    user_address: userAddress.toLowerCase(),
                    post_id: postId,
                    creator_address: creatorAddress.toLowerCase(),
                    vote_type: type,
                    timestamp: Date.now()
                }, { onConflict: 'user_address, post_id' })
                .select()
                .single();

            if (error) {
                console.error("Supabase Error recording vote:", error);
                return res.status(500).json({ error: error.message, code: error.code, details: error });
            }

            return res.status(200).json({ success: true, data });
        } else {
            res.setHeader('Allow', ['GET', 'POST']);
            return res.status(405).end(`Method ${req.method} Not Allowed`);
        }
    } catch (error: any) {
        console.error("Unexpected error in votes API:", error);
        return res.status(500).json({ error: "Unexpected server error", details: error.message, stack: error.stack });
    }
}
