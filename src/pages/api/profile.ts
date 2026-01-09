import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifySignature, formatPublicKey } from '@/lib/verify';
import { Ed25519PublicKey, AccountAddress, AuthenticationKey } from "@aptos-labs/ts-sdk";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Graceful fallback if Supabase is not configured
    if (!supabaseAdmin) {
        if (req.method === 'GET') {
            console.warn("Supabase Admin not initialized. Returning empty profile.");
            return res.status(200).json({});
        } else {
            console.error("Supabase Admin client not initialized. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
            return res.status(503).json({ error: 'Profile storage service unavailable' });
        }
    }

    const { method } = req;

    if (method === 'GET') {
        const { address } = req.query;

        if (!address) {
            return res.status(400).json({ error: 'Missing address parameter' });
        }

        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('wallet_address', (address as string).toLowerCase())
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
            console.error('Error fetching profile:', error);
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json(data || {});
    }

    if (method === 'POST') {
        const { wallet_address, display_name, bio, website, location, banner_url, joined_date_visibility, signature, message, publicKey } = req.body;

        if (!wallet_address) {
            return res.status(400).json({ error: 'Missing wallet_address' });
        }

        // Security Check
        if (!signature || !message || !publicKey) {
            return res.status(401).json({ error: 'Missing authentication signature' });
        }

        try {
            // 1. Verify Signature
            const { valid, error: sigError } = verifySignature(message, signature, publicKey);
            if (!valid) {
                console.error("Signature verification failed. Sig:", signature.substring(0, 20) + "...");
                return res.status(401).json({ error: `Invalid signature: ${sigError}` });
            }

            // 2. Verify Message Intent
            if (!message.includes(`Update profile for ${wallet_address}`)) {
                return res.status(401).json({ error: 'Message does not match intent' });
            }

            // 3. Verify Signer is the Wallet Owner
            try {
                const pubKeyStr = formatPublicKey(publicKey);
                const pubKey = new Ed25519PublicKey(pubKeyStr);
                const authKey = AuthenticationKey.fromPublicKey({ publicKey: pubKey });
                const derivedAddress = authKey.derivedAddress();
                const targetAddress = AccountAddress.from(wallet_address);
                
                if (!targetAddress.equals(derivedAddress)) {
                     return res.status(403).json({ 
                        error: `Signer does not own this profile. Derived: ${derivedAddress.toString()}, Target: ${targetAddress.toString()}` 
                     });
                }
            } catch (e: any) {
                console.error("Address verification failed:", e);
                return res.status(401).json({ error: `Address verification failed: ${e?.message || e}` });
            }
            
            // 4. Check Timestamp
            const timestampMatch = message.match(/at (\d+)$/);
            if (timestampMatch) {
                const timestamp = parseInt(timestampMatch[1]);
                const now = Date.now();
                if (now - timestamp > 5 * 60 * 1000 || timestamp > now + 60 * 1000) {
                     return res.status(401).json({ error: 'Signature expired' });
                }
            }

        } catch (e: any) {
            console.error("Auth error:", e);
            return res.status(401).json({ error: `Authentication failed: ${e?.message || e}` });
        }

        const updates: any = {
            wallet_address: wallet_address.toLowerCase(),
            display_name,
            name,
            bio,
            website,
            location,
            banner_url,
            joined_date_visibility,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabaseAdmin
            .from('profiles')
            .upsert(updates)
            .select('wallet_address, display_name, name, bio, website, location, banner_url, joined_date_visibility, created_at, updated_at')
            .single();

        if (error) {
            console.error('Error updating profile:', error);
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json(data);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${method} Not Allowed`);
}
