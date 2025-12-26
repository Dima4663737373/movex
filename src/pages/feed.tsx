import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useNotifications } from "@/components/Notifications";
import PostCard from "@/components/PostCard";
import { CreatePostForm } from "@/components/CreatePostForm";
import { getDisplayName, getUserPostsPaginated, getUserPostsCount, OnChainPost, getAvatar, getGlobalPostsCount, getGlobalPosts, getAllPosts, getPost, getCommentsForPost } from "@/lib/microThreadsClient";
import { getTipHistory, getStats } from "@/lib/movementClient";
import { octasToMove } from "@/lib/movement";
import AuthGuard from "@/components/AuthGuard";
import StatsBlock from "@/components/StatsBlock";
import { useLanguage } from "@/contexts/LanguageContext";
import RightSidebar from "@/components/RightSidebar";

export default function FeedPage() {
    const { connected, account } = useWallet();
    const { t } = useLanguage();
    const { addNotification } = useNotifications();

    // Global Feed State
    const [globalPosts, setGlobalPosts] = useState<OnChainPost[]>([]);
    const [optimisticPosts, setOptimisticPosts] = useState<OnChainPost[]>([]);
    const [loadingGlobal, setLoadingGlobal] = useState(true);
    const [profiles, setProfiles] = useState<Record<string, any>>({});
    const [stats, setStats] = useState({ totalTips: 0, totalVolume: 0, topTipper: "" });
    const [commentCounts, setCommentCounts] = useState<Record<number, number>>({});

    // Pagination State
    const [cursor, setCursor] = useState<number | null>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const POSTS_PER_PAGE = 10;

    // Profile State
    const [userPosts, setUserPosts] = useState<OnChainPost[]>([]);
    const [postsCount, setPostsCount] = useState(0);
    const [tipHistory, setTipHistory] = useState<any[]>([]);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [myDisplayName, setMyDisplayName] = useState("");
    const [myAvatar, setMyAvatar] = useState("");

    // Interaction State
    const [hiddenUsers, setHiddenUsers] = useState<Set<string>>(new Set());
    const [hiddenPosts, setHiddenPosts] = useState<Set<string>>(new Set());

    const userAddress = account?.address.toString() || "";

    // Load cached feed on mount
    useEffect(() => {
        const cached = localStorage.getItem('feed_cache');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setGlobalPosts(parsed);
                    setLoadingGlobal(false); // Show content immediately
                }
            } catch (e) {
                console.error("Failed to parse feed cache", e);
            }
        }
    }, []);

    // Save feed to cache whenever it changes (only the first page)
    useEffect(() => {
        if (globalPosts.length > 0 && !loadingGlobal) {
            // Only cache the first 20 posts to keep it lightweight
            const postsToCache = globalPosts.slice(0, 20);
            localStorage.setItem('feed_cache', JSON.stringify(postsToCache));
        }
    }, [globalPosts, loadingGlobal]);

    // Infinite Scroll Observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoadingMore && !loadingGlobal) {
                    loadMorePosts();
                }
            },
            { threshold: 0.1 } // Trigger when 10% of the sentinel is visible
        );

        const sentinel = document.getElementById('feed-sentinel');
        if (sentinel) observer.observe(sentinel);

        return () => {
            if (sentinel) observer.unobserve(sentinel);
        };
    }, [hasMore, isLoadingMore, loadingGlobal, cursor]);

    // Fetch Global Posts & Stats (Initial Load)
    const fetchGlobalData = async () => {
        // Check if we have data in state OR in local storage to avoid spinner
        const hasCache = typeof window !== 'undefined' && localStorage.getItem('feed_cache');
        if (globalPosts.length === 0 && !hasCache) setLoadingGlobal(true);

        try {
            // Get stats and global count first
            const [statsData, globalCount] = await Promise.all([
                getStats(),
                getGlobalPostsCount()
            ]);
            
            // console.log("Global posts count:", globalCount);
            setStats(statsData);

            if (globalCount === 0) {
                setGlobalPosts([]);
                setLoadingGlobal(false);
                return;
            }

            // Fetch only the latest page (page 0)
            const displayPosts = await getGlobalPosts(0, POSTS_PER_PAGE);
            
            // Sort by timestamp descending (newest first)
            displayPosts.sort((a, b) => b.timestamp - a.timestamp);
            
            // If we have cached posts, we should try to merge cleanly or just replace if it's a fresh load
            // For simplicity and correctness on refresh, we replace the "head" of the feed
            setGlobalPosts(displayPosts);
            setCursor(1); // Next fetch will start at page 1
            setHasMore(displayPosts.length === POSTS_PER_PAGE);
            
            // Fetch profiles for these posts
            fetchProfilesForPosts(displayPosts);
            
            // Calculate comment counts (local first)
            updateCommentCounts(displayPosts);
            
            // Fetch accurate comment counts (async)
            fetchCommentCountsForPosts(displayPosts);

        } catch (error) {
            console.error("Error fetching global data:", error);
            addNotification("Failed to load feed", 'error');
        } finally {
            setLoadingGlobal(false);
        }
    };

    // Load More Posts (Pagination)
    const loadMorePosts = async () => {
        if (isLoadingMore || !hasMore || cursor === null) return;
        
        setIsLoadingMore(true);
        
        try {
            // Fetch next page
            const olderPostsRaw = await getGlobalPosts(cursor, POSTS_PER_PAGE);
            
            if (olderPostsRaw.length === 0) {
                setHasMore(false);
                return;
            }

            // Filter out comments
            const olderPosts = olderPostsRaw.filter(p => !p.is_comment && p.parent_id === 0);
            
            // Sort descending
            olderPosts.sort((a, b) => b.timestamp - a.timestamp);
            
            setGlobalPosts(prev => {
                // Deduplicate just in case
                const existingIds = new Set(prev.map(p => p.id));
                const uniqueNewPosts = olderPosts.filter(p => !existingIds.has(p.id));
                return [...prev, ...uniqueNewPosts];
            });
            
            setCursor(prev => (prev || 0) + 1);
            setHasMore(olderPostsRaw.length === POSTS_PER_PAGE);
            
            // Fetch profiles for new posts
            fetchProfilesForPosts(olderPosts);
            
            // Update comment counts
            updateCommentCounts(olderPosts, true);
            
            // Fetch accurate comment counts (async)
            fetchCommentCountsForPosts(olderPosts);
            
        } catch (error) {
            console.error("Error loading more posts:", error);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const fetchProfilesForPosts = async (posts: OnChainPost[]) => {
        const uniqueCreators = [...new Set(posts.map(p => p.creator))];
        const profileMap: Record<string, any> = { ...profiles };
        let newProfilesFound = false;

        await Promise.all(uniqueCreators.map(async (creator) => {
            if (!profileMap[creator]) {
                try {
                    const displayName = await getDisplayName(creator);
                    const avatar = await getAvatar(creator);
                    if (displayName || avatar) {
                        profileMap[creator] = { displayName, avatar };
                        newProfilesFound = true;
                    }
                } catch (err) {
                    console.error(`Failed to load profile for ${creator}`, err);
                }
            }
        }));

        if (newProfilesFound) {
            setProfiles(prev => ({ ...prev, ...profileMap }));
        }
    };

    const updateCommentCounts = (posts: OnChainPost[], merge = false) => {
        const counts: Record<number, number> = merge ? { ...commentCounts } : {};
        posts.forEach(post => {
            if (post.is_comment && post.parent_id) {
                counts[post.parent_id] = (counts[post.parent_id] || 0) + 1;
            }
        });
        setCommentCounts(counts);
    };

    const fetchCommentCountsForPosts = async (posts: OnChainPost[]) => {
        const postsToFetch = posts.filter(p => !p.is_comment);
        if (postsToFetch.length === 0) return;

        const newCounts: Record<number, number> = {};
        
        await Promise.all(postsToFetch.map(async (post) => {
            try {
                const comments = await getCommentsForPost(post.id);
                newCounts[post.id] = comments.length;
            } catch (err) {
                // ignore
            }
        }));
        
        setCommentCounts(prev => ({ ...prev, ...newCounts }));
    };

    // Fetch Profile Data
    const fetchProfileData = async () => {
        if (!userAddress) return;

        setLoadingProfile(true);

        try {
            // Fetch count first for pagination logic
            const count = await getUserPostsCount(userAddress);
            const LIMIT = 20; 
            const start = Math.max(0, count - LIMIT);

            const [posts, tips, name, avatar] = await Promise.all([
                getUserPostsPaginated(userAddress, start, LIMIT),
                getTipHistory(),
                getDisplayName(userAddress),
                getAvatar(userAddress)
            ]);

            // Sort user posts by timestamp desc
            posts.sort((a, b) => b.timestamp - a.timestamp);

            setUserPosts(posts);
            setPostsCount(count);
            setMyDisplayName(name);
            setMyAvatar(avatar);

            const userTips = tips.filter((t: any) =>
                t.receiver === userAddress || t.sender === userAddress
            );
            setTipHistory(userTips);
        } catch (error) {
            console.error("Error fetching profile data:", error);
        } finally {
            setLoadingProfile(false);
        }
    };

    // Fetch Interactions (Blocks, Mutes, Not Interested)
    const fetchInteractions = async () => {
        if (!userAddress) return;
        try {
            const [blocksRes, mutesRes, notInterestedRes] = await Promise.all([
                fetch(`/api/interactions?userAddress=${userAddress}&type=blocks`),
                fetch(`/api/interactions?userAddress=${userAddress}&type=mutes`),
                fetch(`/api/interactions?userAddress=${userAddress}&type=not_interested`)
            ]);

            const blocks = blocksRes.ok ? await blocksRes.json() : { blocks: [] };
            const mutes = mutesRes.ok ? await mutesRes.json() : { mutes: [] };
            const notInterested = notInterestedRes.ok ? await notInterestedRes.json() : { not_interested: [] };

            const users = new Set<string>();
            blocks.blocks?.forEach((b: any) => b.blocked_user && users.add(b.blocked_user.toLowerCase()));
            mutes.mutes?.forEach((m: any) => m.muted_user && users.add(m.muted_user.toLowerCase()));

            const posts = new Set<string>();
            notInterested.not_interested?.forEach((n: any) => posts.add(String(n.post_id)));

            setHiddenUsers(users);
            setHiddenPosts(posts);
        } catch (e) {
            console.error("Error fetching interactions", e);
        }
    };

    useEffect(() => {
        fetchGlobalData();
    }, []);

    useEffect(() => {
        if (connected && userAddress) {
            fetchProfileData();
            fetchInteractions();
        }
    }, [connected, userAddress]);

    // Listen for interaction updates
    useEffect(() => {
        const handleInteractionUpdate = () => {
             if (connected && userAddress) fetchInteractions();
        };
        window.addEventListener('interaction_update', handleInteractionUpdate); // Dispatch this from PostCard if needed
        return () => window.removeEventListener('interaction_update', handleInteractionUpdate);
    }, [connected, userAddress]);

    // Optimistic Post Event Handlers
    useEffect(() => {
        const handlePostPending = (e: Event) => {
            const customEvent = e as CustomEvent<OnChainPost>;
            if (customEvent.detail) {
                setOptimisticPosts(prev => [customEvent.detail, ...prev]);
            }
        };

        const handlePostSuccess = (e: Event) => {
             const customEvent = e as CustomEvent<{ tempId: string; finalId: number; post: OnChainPost }>;
             if (customEvent.detail) {
                 const { tempId, finalId, post } = customEvent.detail;
                 
                 // Ensure we have the profile for the new post (it's likely us)
                 if (post.creator === userAddress && (myDisplayName || myAvatar)) {
                     setProfiles(prev => ({
                         ...prev,
                         [post.creator]: { displayName: myDisplayName, avatar: myAvatar }
                     }));
                 }

                 setOptimisticPosts(prev => {
                     const exists = prev.some(p => p.id.toString() === tempId);
                     if (exists) {
                         return prev.map(p => {
                             if (p.id.toString() === tempId) {
                                 return { ...post, id: finalId };
                             }
                             return p;
                         });
                     } else {
                         // Add new post
                         return [{ ...post, id: finalId }, ...prev];
                     }
                 });
             }
        };

        const handlePostFail = (e: Event) => {
            const customEvent = e as CustomEvent<{ tempId: string; error: string }>;
            if (customEvent.detail) {
                const { tempId } = customEvent.detail;
                setOptimisticPosts(prev => prev.filter(p => p.id.toString() !== tempId));
            }
        };

        const handleTipSent = () => {
             // When a tip is sent, we refresh to update counts/balances
             fetchGlobalData();
             if (connected && userAddress) {
                 fetchProfileData();
             }
        };

        window.addEventListener('post_pending', handlePostPending);
        window.addEventListener('post_success', handlePostSuccess);
        window.addEventListener('post_fail', handlePostFail);
        window.addEventListener('tip_sent', handleTipSent);
        
        return () => {
            window.removeEventListener('post_pending', handlePostPending);
            window.removeEventListener('post_success', handlePostSuccess);
            window.removeEventListener('post_fail', handlePostFail);
            window.removeEventListener('tip_sent', handleTipSent);
        };
    }, [connected, userAddress]);

    useEffect(() => {
        const handleRefresh = () => {
            fetchGlobalData();
            if (connected && userAddress) {
                fetchProfileData();
            }
            // Clear optimistic posts after a delay to ensure the real one is fetched
            setTimeout(() => setOptimisticPosts([]), 2000);
        };
        window.addEventListener('tip_sent', handleRefresh);

        return () => {
            window.removeEventListener('tip_sent', handleRefresh);
        };

    }, [connected, userAddress]);

    // Calculate stats
    const totalTipsReceived = userPosts.reduce((acc, post) => acc + post.total_tips, 0);
    const totalTipsSent = tipHistory
        .filter((t: any) => t.sender === userAddress && t.type === 'sent')
        .reduce((acc, t) => acc + t.amount, 0);

    // Prepare display posts with robust deduplication
    const allPosts = [...optimisticPosts, ...globalPosts];
    const uniquePostsMap = new Map<string, OnChainPost>();

    allPosts.forEach(post => {
        // We use a composite key for uniqueness: creator + id
        // This handles cases where we have the real ID but maybe not the global_id yet
        const key = `${post.creator}-${post.id}`;
        
        const existing = uniquePostsMap.get(key);
        if (!existing) {
            uniquePostsMap.set(key, post);
        } else {
            // If we have a duplicate, prefer the one with a valid global_id (from chain/indexer)
            // over the one with global_id=0 (optimistic)
            // Also prefer the one that is NOT 'pending' if available
            const isExistingReal = (existing.global_id || 0) > 0;
            const isNewReal = (post.global_id || 0) > 0;
            
            if (isNewReal && !isExistingReal) {
                uniquePostsMap.set(key, post);
            }
        }
    });
    
    const displayPosts = Array.from(uniquePostsMap.values())
        .filter(post => !post.is_comment)
        .filter(post => post.creator && !hiddenUsers.has(post.creator.toLowerCase()))
        .filter(post => {
            const id = post.id.toString();
            const globalId = post.global_id?.toString() || "";
            return !hiddenPosts.has(id) && (globalId === "" || !hiddenPosts.has(globalId));
        })
        .sort((a, b) => b.timestamp - a.timestamp);

    return (
        <AuthGuard>
            <Head>
                <title>Feed - MoveX</title>
            </Head>

            {/* MainLayout applied in _app.tsx */}
            <div className="w-full">
                {/* CENTER: Feed */}
                <div className="w-full">
                    <CreatePostForm 
                        onPostCreated={(post) => {
                            // Optimistic update handled by event listener
                        }}
                    />
                    
                    <div className="">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)]">
                            <h2 className="text-xl font-bold text-[var(--text-primary)]">{t.latestPosts}</h2>
                            <div className="flex gap-2">
                                <button 
                                    onClick={fetchGlobalData}
                                    className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--card-bg)] rounded-full transition-colors"
                                    title={t.refreshFeed}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                                
                                {loadingGlobal && globalPosts.length === 0 ? (
                                    <div className="">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="bg-[var(--card-bg)] border-b border-[var(--card-border)] p-4 animate-pulse h-48">
                                                <div className="flex gap-4">
                                                    <div className="w-12 h-12 rounded-full bg-[var(--card-border)]"></div>
                                                    <div className="flex-1 space-y-3">
                                                        <div className="h-4 bg-[var(--card-border)] rounded w-1/4"></div>
                                                        <div className="h-16 w-full bg-[var(--card-border)] rounded"></div>
                                                    </div>
                                                </div>
                                                <div className="mt-4 space-y-2">
                                                    <div className="h-4 bg-[var(--card-border)] rounded w-full"></div>
                                                    <div className="h-4 bg-[var(--card-border)] rounded w-5/6"></div>
                                                    <div className="h-4 bg-[var(--card-border)] rounded w-4/6"></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (displayPosts.length > 0) ? (
                                    <div>
                                        {displayPosts.map(post => (
                                            <PostCard
                                                key={(post.global_id || 0) > 0 ? post.global_id : `${post.creator}-${post.id}-${post.timestamp}`}
                                                post={{
                                                    id: post.id.toString(),
                                                    global_id: post.global_id,
                                                    creatorAddress: post.creator,
                                                    creatorHandle: profiles[post.creator]?.displayName || (post.creator === userAddress ? myDisplayName : undefined),
                                                    creatorAvatar: profiles[post.creator]?.avatar || (post.creator === userAddress ? myAvatar : undefined),
                                                    content: post.content,
                                                    image_url: post.image_url,
                                                    style: post.style,
                                                    totalTips: octasToMove(post.total_tips),
                                                    createdAt: post.timestamp * 1000,
                                                    commentCount: commentCounts[post.id] || 0
                                                }}
                                                isOwner={post.creator === userAddress}
                                                previewCount={1}
                                                hideComments={true}
                                            />
                                        ))}
                                        
                                        {/* Infinite Scroll Sentinel */}
                                        <div id="feed-sentinel" className="h-10 w-full flex items-center justify-center mt-4">
                                            {isLoadingMore && (
                                                <div className="flex items-center gap-2 text-[var(--accent)] animate-pulse">
                                                    <div className="w-2 h-2 rounded-full bg-current animate-bounce"></div>
                                                    <div className="w-2 h-2 rounded-full bg-current animate-bounce delay-100"></div>
                                                    <div className="w-2 h-2 rounded-full bg-current animate-bounce delay-200"></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-12 text-center">
                                        <div className="w-16 h-16 bg-[var(--card-border)] rounded-full flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-8 h-8 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">{t.noFeedTitle}</h3>
                                        <p className="text-[var(--text-secondary)]">{t.noFeedDesc}</p>
                                    </div>
                                )}
                            </div>
                    </div>
            </div>
                
        </AuthGuard>
    );
}
