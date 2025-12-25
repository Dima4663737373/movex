import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (!supabaseAdmin) {
            const missingEnv = [];
            if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missingEnv.push('NEXT_PUBLIC_SUPABASE_URL');
            if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingEnv.push('SUPABASE_SERVICE_ROLE_KEY');
            
            console.error("Supabase Admin client not initialized. Missing:", missingEnv);
            return res.status(500).json({ error: 'Supabase Admin client not initialized.', missingEnv });
        }
    } catch (error: any) {
        console.error("Unexpected error in tips API:", error);
        return res.status(500).json({ error: "Unexpected server error", details: error.message, stack: error.stack });
    }

    if (req.method === 'GET') {
        const { userAddress } = req.query;

        if (!userAddress) {
            return res.status(400).json({ error: 'Missing userAddress' });
        }

        const address = (userAddress as string).toLowerCase();

        // Fetch sent tips from DB
        // We assume a 'tips' table exists. If not, this will fail, but we're following the pattern.
        // If the table doesn't exist, I might need to provide a SQL snippet to the user or assume it's there.
        // Given I can't create tables, I'll write the code and if it fails, I'll inform the user.
        // Fields matching local storage: sender, receiver, amount, timestamp, hash, postId, type
        
        const { data: tips, error } = await supabaseAdmin
            .from('tips')
            .select('*')
            .or(`sender.eq.${address},receiver.eq.${address}`)
            .order('timestamp', { ascending: false })
            .limit(100);

        if (error) {
            console.error('Error fetching tips:', error);
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json(tips);

    } else if (req.method === 'POST') {
        const { sender, receiver, amount, timestamp, hash, postId, type } = req.body;

        if (!sender || !amount || !hash) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // We don't verify signature here to keep it "one-click" / seamless as requested.
        // The client has already executed the transaction on chain (hash provided).
        // Ideally we would verify the hash on chain, but for now we just save the record.

        const { data, error } = await supabaseAdmin
            .from('tips')
            .upsert({
                sender: sender.toLowerCase(),
                receiver: receiver?.toLowerCase(),
                amount,
                timestamp,
                hash,
                post_id: postId,
                type: type || 'sent',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Supabase Error saving tip:', error);
            return res.status(500).json({ error: error.message, code: error.code, details: error });
        }

        return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
