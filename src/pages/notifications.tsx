import { useState } from 'react';
import Head from 'next/head';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSocialActivity, ActivityType } from '@/contexts/SocialActivityContext';
import AuthGuard from '@/components/AuthGuard';
import { formatRelativeTime } from '@/lib/utils';
import { getDisplayName, getAvatar } from '@/lib/microThreadsClient';
import Link from 'next/link';

// Component to render individual activity item
function ActivityItem({ activity }: { activity: any }) {
    const { t } = useLanguage();
    const [actorName, setActorName] = useState(activity.actorAddress.slice(0, 6));
    const [actorAvatar, setActorAvatar] = useState('');

    useState(() => {
        getDisplayName(activity.actorAddress).then(setActorName);
        getAvatar(activity.actorAddress).then(setActorAvatar);
    });

    let icon, content;
    
    switch (activity.type) {
        case 'like':
            icon = <svg className="w-6 h-6 text-pink-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>;
            content = (
                <span>
                    <span className="font-bold text-[var(--text-primary)] hover:underline">{actorName}</span>
                    <span className="text-[var(--text-secondary)]"> liked your post</span>
                    {activity.targetPostContent && <p className="text-[var(--text-secondary)] mt-1 line-clamp-2 border-l-2 border-[var(--card-border)] pl-2 italic">"{activity.targetPostContent}"</p>}
                </span>
            );
            break;
        case 'comment':
            icon = <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>;
            content = (
                <span>
                    <span className="font-bold text-[var(--text-primary)] hover:underline">{actorName}</span>
                    <span className="text-[var(--text-secondary)]"> commented on your post:</span>
                    <p className="text-[var(--text-primary)] mt-1">"{activity.content}"</p>
                </span>
            );
            break;
        case 'repost':
            icon = <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M19 7v4H5.83l3.58-3.59L8 6l-6 6 6 6 1.41-1.41L5.83 13H21V7z"/></svg>;
            content = (
                <span>
                    <span className="font-bold text-[var(--text-primary)] hover:underline">{actorName}</span>
                    <span className="text-[var(--text-secondary)]"> reposted your post</span>
                    {activity.targetPostContent && <p className="text-[var(--text-secondary)] mt-1 line-clamp-2 border-l-2 border-[var(--card-border)] pl-2 italic">"{activity.targetPostContent}"</p>}
                </span>
            );
            break;
        case 'quote':
            icon = <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M19 7v4H5.83l3.58-3.59L8 6l-6 6 6 6 1.41-1.41L5.83 13H21V7z"/></svg>;
            content = (
                <span>
                    <span className="font-bold text-[var(--text-primary)] hover:underline">{actorName}</span>
                    <span className="text-[var(--text-secondary)]"> quoted your post:</span>
                    <p className="text-[var(--text-primary)] mt-1">"{activity.content}"</p>
                </span>
            );
            break;
        case 'mention':
            icon = <svg className="w-6 h-6 text-[var(--accent)]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-2.98 1.66-5.58 4.12-6.93.42.54 1.25 1.55 1.77 2.19-.66.56-1.09 1.4-1.09 2.34 0 1.93 1.57 3.5 3.5 3.5 1.93 0 3.5-1.57 3.5-3.5 0-1.25-.76-2.32-1.84-2.96.26-.31.54-.64.8-1 .31.18.61.39.89.62C18.49 7.78 20 9.73 20 12c0 4.41-3.59 8-8 8z"/></svg>;
            content = (
                <span>
                    <span className="font-bold text-[var(--text-primary)] hover:underline">{actorName}</span>
                    <span className="text-[var(--text-secondary)]"> mentioned you:</span>
                    <p className="text-[var(--text-primary)] mt-1">"{activity.content}"</p>
                </span>
            );
            break;
        case 'follow':
            icon = <svg className="w-6 h-6 text-[var(--accent)]" fill="currentColor" viewBox="0 0 24 24"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>;
            content = (
                <span>
                    <span className="font-bold text-[var(--text-primary)] hover:underline">{actorName}</span>
                    <span className="text-[var(--text-secondary)]"> followed you</span>
                </span>
            );
            break;
        default:
            icon = <div className="w-6 h-6 bg-gray-500 rounded-full" />;
            content = <span>Notification from {actorName}</span>;
    }

    return (
        <Link href={`/${activity.actorAddress}`} className={`block p-4 border-b border-[var(--card-border)] hover:bg-[var(--card-bg-hover)] transition-colors ${!activity.read ? 'bg-[var(--accent)]/5' : ''}`}>
            <div className="flex gap-4">
                <div className="mt-1 flex-shrink-0">
                    {icon}
                </div>
                <div className="flex-1">
                    <div className="flex gap-3 mb-1">
                         <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0">
                            {actorAvatar ? (
                                <img src={actorAvatar} alt={actorName} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-white bg-neutral-700">
                                    {actorName[0]?.toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 text-sm">
                            {content}
                        </div>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 pl-11">
                        {formatRelativeTime(activity.timestamp)}
                    </p>
                </div>
                {!activity.read && (
                    <div className="w-2 h-2 rounded-full bg-[var(--accent)] mt-2"></div>
                )}
            </div>
        </Link>
    );
}

export default function NotificationsPage() {
    const { connected, account } = useWallet();
    const { t } = useLanguage();
    const { activities, markAsRead, addActivity } = useSocialActivity();
    const [activeTab, setActiveTab] = useState<'all' | 'mentions'>('all');

    const filteredActivities = activities.filter(activity => {
        if (activeTab === 'all') {
            return ['like', 'comment', 'repost', 'quote', 'follow'].includes(activity.type);
        }
        if (activeTab === 'mentions') {
            return activity.type === 'mention';
        }
        return false;
    });

    const handleMarkAllRead = () => {
        markAsRead();
    };

    // Debug helper to generate fake notifications
    const generateFakeNotification = () => {
        const types: ActivityType[] = ['like', 'comment', 'repost', 'quote', 'follow', 'mention'];
        const randomType = types[Math.floor(Math.random() * types.length)];
        const randomAddr = "0x" + Math.random().toString(16).substring(2, 40);
        
        addActivity({
            type: randomType,
            actorAddress: randomAddr,
            targetPostId: "fake-post-id",
            targetPostContent: "This is a sample post content that was interacted with...",
            content: randomType === 'comment' || randomType === 'quote' || randomType === 'mention' ? "This is a sample comment or reply!" : undefined
        });
    };

    return (
        <AuthGuard>
            <Head>
                <title>{t.notificationsTitle} - MoveX</title>
            </Head>

            <main className="container-custom py-6 md:py-10">
                <div className="max-w-[1280px] mx-auto">
                    <div className="grid grid-cols-1 gap-6">
                        {/* CENTER: Notifications Feed */}
                        <div className="min-w-0 lg:px-6">
                            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden min-h-[600px]">
                                <div className="p-4 border-b border-[var(--card-border)] flex justify-between items-center sticky top-0 bg-[var(--card-bg)] z-10 backdrop-blur-md bg-opacity-90">
                                    <h1 className="text-xl font-bold text-[var(--text-primary)]">{t.notificationsTitle}</h1>
                                </div>

                                {/* Tabs */}
                                <div className="flex border-b border-[var(--card-border)]">
                                    <button
                                        onClick={() => setActiveTab('all')}
                                        className={`flex-1 py-4 text-center text-sm font-bold border-b-2 transition-colors hover:bg-white/5 ${
                                            activeTab === 'all'
                                                ? 'border-[var(--accent)] text-[var(--text-primary)]'
                                                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                        }`}
                                    >
                                        {t.all}
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('mentions')}
                                        className={`flex-1 py-4 text-center text-sm font-bold border-b-2 transition-colors hover:bg-white/5 ${
                                            activeTab === 'mentions'
                                                ? 'border-[var(--accent)] text-[var(--text-primary)]'
                                                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                        }`}
                                    >
                                        {t.mentions}
                                    </button>
                                </div>

                                {/* List */}
                                <div className="divide-y divide-[var(--card-border)]">
                                    {filteredActivities.length === 0 ? (
                                        <div className="p-12 text-center">
                                            <div className="w-16 h-16 bg-[var(--card-border)] rounded-full flex items-center justify-center mx-auto mb-4 text-[var(--text-secondary)]">
                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                                </svg>
                                            </div>
                                            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">{t.noActivity}</h3>
                                            <p className="text-[var(--text-secondary)]">
                                                When others interact with you, you'll see it here.
                                            </p>
                                        </div>
                                    ) : (
                                        filteredActivities.map(activity => (
                                            <ActivityItem key={activity.id} activity={activity} />
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </AuthGuard>
    );
}
