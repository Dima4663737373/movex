import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useNotifications } from '@/components/Notifications';

export type ActivityType = 'like' | 'comment' | 'repost' | 'quote' | 'follow' | 'mention';

export interface SocialActivity {
    id: string;
    type: ActivityType;
    actorAddress: string;
    targetPostId?: string; // ID of the post being acted upon
    targetPostContent?: string; // Snippet of the post
    content?: string; // Comment content or reply text
    timestamp: number;
    read: boolean;
}

interface SocialActivityContextType {
    activities: SocialActivity[];
    unreadCount: number;
    addActivity: (activity: Omit<SocialActivity, 'id' | 'timestamp' | 'read'>) => void;
    markAsRead: (id?: string) => void;
    clearAll: () => void;
}

const SocialActivityContext = createContext<SocialActivityContextType | undefined>(undefined);

export function useSocialActivity() {
    const context = useContext(SocialActivityContext);
    if (!context) {
        throw new Error('useSocialActivity must be used within a SocialActivityProvider');
    }
    return context;
}

export function SocialActivityProvider({ children }: { children: ReactNode }) {
    const { notifications, markAsRead: markNotificationAsRead, setNotifications } = useNotifications();

    const activities = useMemo(() => {
        return notifications
            .filter(n => ['like', 'comment', 'repost', 'quote', 'follow', 'mention'].includes(n.type))
            .map(n => ({
                id: n.id,
                type: n.type as ActivityType,
                actorAddress: n.relatedUser || '',
                targetPostId: n.data?.targetPostId,
                targetPostContent: n.data?.targetPostContent,
                content: n.data?.content,
                timestamp: n.timestamp,
                read: n.read
            }));
    }, [notifications]);

    const unreadCount = activities.filter(a => !a.read).length;

    const addActivity = useCallback((data: Omit<SocialActivity, 'id' | 'timestamp' | 'read'>) => {
        // Deprecated local usage
        console.warn("addActivity is deprecated, use sendSocialNotification for remote or rely on real-time updates");
    }, []);

    const markAsRead = useCallback((id?: string) => {
        markNotificationAsRead(id);
    }, [markNotificationAsRead]);

    const clearAll = useCallback(() => {
         setNotifications(prev => prev.filter(n => !['like', 'comment', 'repost', 'quote', 'follow', 'mention'].includes(n.type)));
    }, [setNotifications]);

    return (
        <SocialActivityContext.Provider value={{ activities, unreadCount, addActivity, markAsRead, clearAll }}>
            {children}
        </SocialActivityContext.Provider>
    );
}

// Helper to send a notification to *another* user (REAL backend)
export async function sendSocialNotification(targetAddress: string, activity: Omit<SocialActivity, 'id' | 'timestamp' | 'read'>) {
    if (!targetAddress) return;
    
    try {
        const res = await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'create',
                targetAddress,
                type: activity.type,
                message: generateMessage(activity),
                relatedUser: activity.actorAddress,
                data: {
                    targetPostId: activity.targetPostId,
                    targetPostContent: activity.targetPostContent,
                    content: activity.content
                }
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.error("Failed to send notification:", res.status, res.statusText, errData);
        }
    } catch (e) {
        console.error("Error sending social notification", e);
    }
}

function generateMessage(activity: Omit<SocialActivity, 'id' | 'timestamp' | 'read'>): string {
    const actor = activity.actorAddress.slice(0, 6) + '...' + activity.actorAddress.slice(-4);
    switch (activity.type) {
        case 'like': return `${actor} liked your post`;
        case 'comment': return `${actor} commented on your post`;
        case 'repost': return `${actor} reposted your post`;
        case 'follow': return `${actor} started following you`;
        case 'mention': return `${actor} mentioned you`;
        default: return `New activity from ${actor}`;
    }
}
