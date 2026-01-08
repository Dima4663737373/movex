import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { verifySignature, formatPublicKey } from '../../lib/verify';
import { Ed25519PublicKey } from "@aptos-labs/ts-sdk";

export interface Message {
    id: string;
    sender: string;
    receiver: string;
    content: string;
    timestamp: number;
    read: boolean;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase Admin client not initialized. Check environment variables.' });
    }

    const { method } = req;

    if (method === 'GET') {
        const { user, otherUser } = req.query;

        if (!user) {
            return res.status(400).json({ error: 'Missing user parameter' });
        }

        const userAddress = (user as string).toLowerCase();

        // If otherUser is provided, return messages between user and otherUser
        if (otherUser) {
            const otherAddress = (otherUser as string).toLowerCase();
            
            const { data: messages, error } = await supabaseAdmin
                .from('messages')
                .select('*')
                .or(`and(sender.eq.${userAddress},receiver.eq.${otherAddress}),and(sender.eq.${otherAddress},receiver.eq.${userAddress})`)
                .order('timestamp', { ascending: true });

            if (error) {
                console.error('Error fetching messages:', error);
                return res.status(500).json({ error: error.message });
            }
            
            return res.status(200).json(messages);
        }

        // Otherwise, return list of conversations (latest message per contact)
        // This is complex in SQL/Supabase without a dedicated conversations table or complex query.
        // We can fetch all messages for the user and process in memory for now, 
        // or use a better query.
        // Fetching all messages for user might be heavy if there are many.
        // Let's try to fetch all distinct contacts first?
        // Or just fetch all messages involving the user.
        
        const { data: messagesData, error } = await supabaseAdmin
            .from('messages')
            .select('*')
            .or(`sender.eq.${userAddress},receiver.eq.${userAddress}`)
            .order('created_at', { ascending: false });

        if (error) {
            console.error(`Error fetching conversations for ${userAddress}:`, JSON.stringify(error, null, 2));
            return res.status(500).json({ error: error.message, details: error });
        }

        if (!messagesData) {
             return res.status(200).json([]);
        }

        const messages = messagesData.map((m: any) => ({
            ...m,
            timestamp: new Date(m.created_at).getTime()
        }));
        const contacts = new Set<string>();
        messages.forEach((m: Message) => {
            if (m.sender.toLowerCase() === userAddress) contacts.add(m.receiver.toLowerCase());
            if (m.receiver.toLowerCase() === userAddress) contacts.add(m.sender.toLowerCase());
        });

        const conversations = Array.from(contacts).map(contact => {
            // Find latest message for this contact
            // Since messages are already sorted by timestamp desc, find first match
            const lastMessage = messages.find((m: Message) => 
                (m.sender.toLowerCase() === userAddress && m.receiver.toLowerCase() === contact) ||
                (m.sender.toLowerCase() === contact && m.receiver.toLowerCase() === userAddress)
            );

            // Count unread messages from this contact
            const unreadCount = messages.filter((m: Message) => 
                m.sender.toLowerCase() === contact && 
                m.receiver.toLowerCase() === userAddress && 
                !m.read &&
                m.sender.toLowerCase() !== userAddress // Don't count self-messages as unread
            ).length;
            
            return {
                contact,
                lastMessage,
                unreadCount
            };
        }).filter(c => c.lastMessage) // Should always exist
        .sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);

        return res.status(200).json(conversations);
    }

    if (method === 'POST') {
        const { sender, receiver, content } = req.body;

        if (!sender || !receiver || !content) {
            return res.status(400).json({ error: 'Missing required fields: sender, receiver, content' });
        }

        // Security Check SKIPPED as per user request for seamless UX
        // In a production app, we should use a session token or at least a signature
        // to verify the request comes from the owner of sender.
        // Since this is a demo/hackathon project, we trust the client for now.

        const newMessage = {
            sender: sender.toLowerCase(),
            receiver: receiver.toLowerCase(),
            content,
            timestamp: Date.now(),
            created_at: new Date().toISOString(),
            read: false
        };

        console.log(`Sending message from ${sender} to ${receiver}`);

        const { data, error } = await supabaseAdmin
            .from('messages')
            .insert([newMessage])
            .select()
            .single();

        if (error) {
            console.error('Error sending message:', error);
            // If error is about missing column "timestamp", we might need to remove it in future
            // If error is about missing column "created_at", we just added it.
            return res.status(500).json({ error: error.message, details: error });
        }

        // Also mark previous messages from receiver to sender as read
        // Since the user is replying, they have implicitly read the messages.
        await supabaseAdmin
            .from('messages')
            .update({ read: true })
            .eq('sender', receiver.toLowerCase())
            .eq('receiver', sender.toLowerCase());

        return res.status(201).json(data);
    }

    if (method === 'PUT') {
        // Mark messages as read
        const { user, otherUser } = req.body;
        
        if (!user || !otherUser) {
            return res.status(400).json({ error: 'Missing required fields: user, otherUser' });
        }

        const userAddress = user.toLowerCase();
        const otherAddress = otherUser.toLowerCase();

        // Update where receiver is user AND sender is otherUser
        const { error } = await supabaseAdmin
            .from('messages')
            .update({ read: true })
            .eq('receiver', userAddress)
            .eq('sender', otherAddress)
            .eq('read', false);

        if (error) {
            console.error('Error updating read status:', error);
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT']);
    res.status(405).end(`Method ${method} Not Allowed`);
}
