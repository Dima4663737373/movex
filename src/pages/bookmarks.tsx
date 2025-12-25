import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState, useEffect } from "react";
import Head from "next/head";
import AuthGuard from "@/components/AuthGuard";
import { getDisplayName, getAvatar, getPost } from "@/lib/microThreadsClient";
import PostCard from "@/components/PostCard";
import { useLanguage } from '@/contexts/LanguageContext';

interface SavedMessage {
    id: string;
    type: 'bookmark';
    content: any; // Post object
    timestamp: number;
}

export default function BookmarksPage() {
    const { account, connected } = useWallet();
    const { t } = useLanguage();
    const userAddress = account?.address.toString() || "";
    
    // Data State
    const [messages, setMessages] = useState<SavedMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [profiles, setProfiles] = useState<Record<string, any>>({});
    
    const [myDisplayName, setMyDisplayName] = useState("");
    const [myAvatar, setMyAvatar] = useState("");

    // Load Profile
    useEffect(() => {
        const fetchProfile = async () => {
            if (connected && userAddress) {
                try {
                    const name = await getDisplayName(userAddress);
                    const avatar = await getAvatar(userAddress);
                    setMyDisplayName(name);
                    setMyAvatar(avatar);
                } catch (err) {
                    console.error('Failed to load profile', err);
                }
            }
        };
        fetchProfile();
    }, [connected, userAddress]);

    // Load Bookmarks
    useEffect(() => {
        const loadBookmarks = async () => {
            if (!connected || !userAddress) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                
                const res = await fetch(`/api/bookmarks?userAddress=${userAddress}`);
                let bookmarkMessages: SavedMessage[] = [];
                
                if (res.ok) {
                    const data = await res.json();
                    const bookmarkIds = data.bookmarks.map((b: any) => {
                        const parts = b.key.split('_');
                        return parseInt(parts[parts.length - 1]);
                    }).filter((id: number) => !isNaN(id));

                    const postPromises = bookmarkIds.map((id: number) => getPost(id));
                    const fetchedPosts = await Promise.all(postPromises);
                    
                    bookmarkMessages = fetchedPosts
                        .filter((p): p is any => p !== null)
                        .map(post => ({
                            id: `bookmark_${post.id}`,
                            type: 'bookmark',
                            content: {
                                ...post,
                                createdAt: (post.createdAt || post.timestamp) * 1000,
                                timestamp: (post.timestamp || post.createdAt) * 1000,
                                totalTips: post.total_tips ? Number(post.total_tips) : (post.totalTips ? Number(post.totalTips) : 0)
                            },
                            timestamp: (post.timestamp || post.createdAt) * 1000 // Convert to ms
                        }));
                }

                // Sort by timestamp descending
                setMessages(bookmarkMessages.sort((a, b) => b.timestamp - a.timestamp));

            } catch (error) {
                console.error("Error loading bookmarks:", error);
            } finally {
                setLoading(false);
            }
        };

        loadBookmarks();
    }, [connected, userAddress]);

    return (
        <AuthGuard>
            <Head>
                <title>{t.bookmarks} - MoveX</title>
            </Head>

            <div className="grid grid-cols-1 gap-6">
                    
                    {/* CENTER CONTENT */}
                    <div className="min-w-0 lg:px-6">
                            <div className="mb-6 flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                    </svg>
                                    {t.bookmarks}
                                </h2>
                            </div>

                            <div className="space-y-4">
                                {loading ? (
                                    <div className="text-center py-10">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent)] mx-auto"></div>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="text-center py-10 text-[var(--text-secondary)]">
                                        <p>No bookmarks yet.</p>
                                    </div>
                                ) : (
                                    messages.map((msg) => (
                                        <div key={msg.id}>
                                            <PostCard 
                                                post={msg.content} 
                                                initialIsBookmarked={true}
                                            />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
        </AuthGuard>
    );
}
