/**
 * Explore Page
 * 
 * Discover trending posts and popular content
 */

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import PostCard from "@/components/PostCard";
import { SearchBar } from "@/components/SearchBar";
import { getDisplayName, OnChainPost, getAvatar, getGlobalPosts, getGlobalPostsCount } from "@/lib/microThreadsClient";
import { getStats } from "@/lib/movementClient";
import { octasToMove } from "@/lib/movement";
import AuthGuard from "@/components/AuthGuard";

export default function ExplorePage() {
    const { connected, account } = useWallet();
    const [posts, setPosts] = useState<OnChainPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [profiles, setProfiles] = useState<Record<string, any>>({});
    const [stats, setStats] = useState({ totalTips: 0, totalVolume: 0, topTipper: "" });
    const [myDisplayName, setMyDisplayName] = useState("");
    const [myAvatar, setMyAvatar] = useState("");
    const [filteredPosts, setFilteredPosts] = useState<OnChainPost[]>([]);

    const userAddress = account?.address.toString() || "";

    const [searchQuery, setSearchQuery] = useState("");

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setFilteredPosts(posts);
            return;
        }
        const lowerQuery = query.toLowerCase();
        const filtered = posts.filter(p => 
            (p.content && p.content.toLowerCase().includes(lowerQuery)) || 
            (p.creator && p.creator.toLowerCase().includes(lowerQuery)) ||
            (profiles[p.creator]?.displayName && profiles[p.creator].displayName.toLowerCase().includes(lowerQuery))
        );
        setFilteredPosts(filtered);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [globalCount, statsData] = await Promise.all([
                getGlobalPostsCount(),
                getStats()
            ]);

            // For Explore/Trending, we fetch a larger chunk of recent posts
            // In a real app, this would use a dedicated indexer or trending API
            // For now, we fetch the last 100 posts (page 0 with limit 100) and sort by tips
            const LIMIT = 100;
            // getGlobalPosts takes page index, not offset
            const allPosts = await getGlobalPosts(0, LIMIT);

            // Sort by total tips (trending)
            const sortedPosts = [...allPosts].sort((a, b) => b.total_tips - a.total_tips);
            setPosts(sortedPosts);
            setFilteredPosts(sortedPosts);
            setStats(statsData);

            // Load profiles
            const uniqueCreators = [...new Set(sortedPosts.map(p => p.creator))];
            const profileMap: Record<string, any> = {};

            await Promise.all(uniqueCreators.map(async (creator) => {
                try {
                    const displayName = await getDisplayName(creator);
                    const avatar = await getAvatar(creator);
                    if (displayName || avatar) {
                        profileMap[creator] = { displayName, avatar };
                    }
                } catch (err) {
                    console.error(`Failed to load profile for ${creator}`, err);
                }
            }));

            setProfiles(profileMap);

            // Load current user profile
            if (userAddress) {
                try {
                    const name = await getDisplayName(userAddress);
                    const userAvatar = await getAvatar(userAddress);
                    setMyDisplayName(name);
                    setMyAvatar(userAvatar);
                } catch (err) {
                    console.error('Failed to load user profile', err);
                }
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (connected) {
            fetchData();
        }
    }, [connected]);

    return (
        <AuthGuard>
            <Head>
                <title>Explore - MoveX</title>
            </Head>

            <div className="pt-6">
                    
                    {/* CENTER: Trending Posts */}
                    <div className="min-w-0 lg:px-6">
                            <div className="mb-8">
                                <SearchBar posts={posts} profiles={profiles} onSearch={handleSearch} />
                            </div>



                            {loading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className="bg-[var(--card-bg)] border-b border-[var(--card-border)] p-4 animate-pulse">
                                            <div className="flex gap-3">
                                                <div className="w-10 h-10 bg-neutral-800 rounded-full"></div>
                                                <div className="flex-1 space-y-2 py-1">
                                                    <div className="h-4 bg-neutral-800 rounded w-1/3"></div>
                                                    <div className="h-3 bg-neutral-800 rounded w-1/4"></div>
                                                </div>
                                            </div>
                                            <div className="mt-4 space-y-2">
                                                <div className="h-4 bg-neutral-800 rounded w-full"></div>
                                                <div className="h-4 bg-neutral-800 rounded w-5/6"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : filteredPosts.length > 0 ? (
                                <div className="border-t border-[var(--card-border)]">
                                    {filteredPosts.map(post => (
                                        <PostCard
                                            key={post.id}
                                            post={{
                                                id: post.id.toString(),
                                                creatorAddress: post.creator,
                                                creatorHandle: profiles[post.creator]?.displayName,
                                                creatorAvatar: profiles[post.creator]?.avatar,
                                                content: post.content,
                                                image_url: post.image_url,
                                                style: post.style,
                                                totalTips: octasToMove(post.total_tips),
                                                createdAt: post.timestamp * 1000
                                            }}
                                            isOwner={post.creator === userAddress}
                                            highlight={searchQuery}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center border-t border-[var(--card-border)]">
                                    <div className="w-16 h-16 bg-[var(--card-border)] rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No Trending Posts</h3>
                                    <p className="text-[var(--text-secondary)]">Check back later for trending content!</p>
                                </div>
                            )}
                        </div>
                    </div>
        </AuthGuard>
    );
}
