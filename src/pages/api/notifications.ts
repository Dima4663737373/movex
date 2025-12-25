import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { verifySignature, formatPublicKey } from '../../lib/verify';
import { Ed25519PublicKey } from "@aptos-labs/ts-sdk";

export interface NotificationData {
    id: string;
    message: string;
    type: 'success' | 'info' | 'error' | 'like' | 'comment' | 'repost' | 'follow' | 'mention';
    timestamp: number;
    read: boolean;
    relatedUser?: string;
    data?: any; // For additional metadata like targetPostId
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase Admin client not initialized.' });
    }

    const { userAddress } = req.query;

    if (!userAddress && req.method !== 'POST') {
        return res.status(400).json({ error: 'Missing userAddress' });
    }

    if (req.method === 'GET') {
        const user = (userAddress as string).toLowerCase();

        const { data: notifications, error } = await supabaseAdmin
            .from('notifications')
            .select('*')
            .eq('user_address', user)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
             return res.status(500).json({ error: error.message });
        }

        const mappedNotifications = notifications.map(n => ({
            id: n.id,
            message: n.message,
            type: n.type,
            timestamp: new Date(n.created_at).getTime(),
            read: n.read,
            relatedUser: n.related_user,
            data: n.data // Assuming 'data' column exists (JSONB)
        }));

        return res.status(200).json(mappedNotifications);
    } else if (req.method === 'POST') {
        const { action, ...body } = req.body;
        
        // Create Notification
        if (action === 'create') {
            const { targetAddress, type, message, relatedUser, data } = body;
            
            if (!targetAddress || !message) {
                return res.status(400).json({ error: 'Missing targetAddress or message' });
            }

            let insertPayload: any = {
                user_address: targetAddress.toLowerCase(),
                type: type || 'info',
                message,
                related_user: relatedUser?.toLowerCase(),
                read: false,
                created_at: new Date().toISOString(),
                timestamp: Date.now(), // Try with timestamp first
                data: data || {}
            };

            console.log("Attempting to create notification with payload:", JSON.stringify(insertPayload));

            let { data: newNotification, error } = await supabaseAdmin
                .from('notifications')
                .insert(insertPayload)
                .select()
                .single();

            // Retry logic for common schema mismatches
            if (error) {
                console.warn("Initial notification creation failed:", error.message);

                // 1. If timestamp column doesn't exist, remove it
                if (error.message?.includes('column "timestamp" does not exist')) {
                    console.log("Retrying without 'timestamp' column...");
                    delete insertPayload.timestamp;
                    const retry1 = await supabaseAdmin.from('notifications').insert(insertPayload).select().single();
                    newNotification = retry1.data;
                    error = retry1.error;
                }
                
                // 2. If data column doesn't exist, remove it (if error persists)
                if (error && error.message?.includes('column "data" does not exist')) {
                     console.log("Retrying without 'data' column...");
                     delete insertPayload.data;
                     const retry2 = await supabaseAdmin.from('notifications').insert(insertPayload).select().single();
                     newNotification = retry2.data;
                     error = retry2.error;
                }
                
                 // 3. If related_user column doesn't exist, remove it
                if (error && error.message?.includes('column "related_user" does not exist')) {
                     console.log("Retrying without 'related_user' column...");
                     delete insertPayload.related_user;
                     const retry3 = await supabaseAdmin.from('notifications').insert(insertPayload).select().single();
                     newNotification = retry3.data;
                     error = retry3.error;
                }
            }

            if (error) {
                console.error("Final error creating notification:", error);
                return res.status(500).json({ error: error.message, details: error, hint: "Check database schema for 'notifications' table." });
            }

            return res.status(200).json(newNotification);
        }

        // Mark as read (existing logic)
        const { userAddress: bodyUserAddress, notificationId: bodyNotificationId, action: bodyAction } = req.body;
        
        if (bodyUserAddress && bodyAction === 'mark_read') {
             // Direct processing without signature
             if (!supabaseAdmin) return res.status(500).json({ error: 'DB not initialized' });

             const targetAddress = bodyUserAddress.toLowerCase();
             
             if (bodyNotificationId) {
                 // Mark specific
                 const { error } = await supabaseAdmin
                     .from('notifications')
                     .update({ read: true })
                     .eq('id', bodyNotificationId)
                     .eq('user_address', targetAddress); // Security check: Ensure it belongs to user
                     
                 if (error) return res.status(500).json({ error: error.message });
             } else {
                 // Mark all
                 const { error } = await supabaseAdmin
                     .from('notifications')
                     .update({ read: true })
                     .eq('user_address', targetAddress)
                     .eq('read', false);
                     
                 if (error) return res.status(500).json({ error: error.message });
             }
             
             return res.status(200).json({ success: true });
        }

        // Legacy/Signed path (kept for backward compatibility or other actions)
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
             // Try to extract JSON from prefixed message (e.g. "Aptos Signed Message: ...")
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

        const { userAddress: msgUserAddress, notificationId: msgNotificationId, action: msgAction } = parsedMessage;

        if (!msgUserAddress) {
             return res.status(400).json({ error: 'Missing userAddress' });
        }

        // Verify sender matches public key
        try {
            const pubKeyStr = formatPublicKey(publicKey);
            const pubKey = new Ed25519PublicKey(pubKeyStr);
            const derivedAddress = pubKey.authKey().derivedAddress().toString();
            
            const normalize = (addr: string) => {
                const lower = addr.toLowerCase();
                return lower.startsWith('0x') ? lower : `0x${lower}`;
            };

            if (normalize(derivedAddress) !== normalize(msgUserAddress)) {
                 return res.status(401).json({ error: 'Public key does not match user address' });
            }
        } catch (e: any) {
             return res.status(400).json({ error: `Invalid public key: ${e.message}` });
        }

        const user = msgUserAddress.toLowerCase();

        if (msgAction === 'mark_read') {
            if (msgNotificationId) {
                const { error } = await supabaseAdmin
                    .from('notifications')
                    .update({ read: true })
                    .eq('id', msgNotificationId)
                    .eq('user_address', user);

                if (error) {
                    return res.status(500).json({ error: error.message });
                }
            } else {
                // Mark all as read
                const { error } = await supabaseAdmin
                    .from('notifications')
                    .update({ read: true })
                    .eq('user_address', user)
                    .eq('read', false);

                if (error) {
                    return res.status(500).json({ error: error.message });
                }
            }
        } else if (msgAction === 'clear') {
             // Delete all for user
             const { error } = await supabaseAdmin
                .from('notifications')
                .delete()
                .eq('user_address', user);

             if (error) {
                 return res.status(500).json({ error: error.message });
             }
        }

        // Fetch updated list to return
        const { data: updatedList, error: fetchError } = await supabaseAdmin
            .from('notifications')
            .select('*')
            .eq('user_address', user)
            .order('timestamp', { ascending: false })
            .limit(50);

        if (fetchError) {
             return res.status(500).json({ error: fetchError.message });
        }

        const mappedList = updatedList.map(n => ({
            id: n.id,
            message: n.message,
            type: n.type as 'success' | 'info',
            timestamp: n.timestamp,
            read: n.read,
            relatedUser: n.related_user
        }));

        return res.status(200).json({ success: true, notifications: mappedList });
    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}
