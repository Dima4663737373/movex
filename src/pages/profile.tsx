/**
 * Profile Page
 * 
 * Main user profile page with post creation and feed
 */

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { CreatePostForm } from "@/components/CreatePostForm";
import PostCard from "@/components/PostCard";
import { getUserPostsPaginated, getUserPostsCount, OnChainPost } from "@/lib/microThreadsClient";
import { getTipHistory } from "@/lib/movementClient";
import { octasToMove } from "@/lib/movement";
import AuthGuard from "@/components/AuthGuard";
import HeaderBalance from "@/components/HeaderBalance";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export default function ProfilePage() {
    const { account, connected } = useWallet();
    const router = useRouter();
    const [posts, setPosts] = useState<OnChainPost[]>([]);
    const [postsCount, setPostsCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [tipHistory, setTipHistory] = useState<any[]>([]);

    const userAddress = account?.address.toString() || "";

    // Fetch user's posts and stats
    useEffect(() => {
        const fetchData = async () => {
            if (!userAddress) return;

            setLoading(true);
            try {
                // Fetch count first
                const count = await getUserPostsCount(userAddress);
                const [tips] = await Promise.all([
                    getTipHistory()
                ]);

                // Fetch latest 5 posts (for testing)
                const LIMIT = 5;
                const start = Math.max(0, count - LIMIT);
                const userPosts = await getUserPostsPaginated(userAddress, start, LIMIT);
                // Sort by timestamp desc
                userPosts.sort((a, b) => b.timestamp - a.timestamp);

                setPosts(userPosts);
                setPostsCount(count);

                // Filter tips for this user
                const userTips = tips.filter((t: any) =>
                    t.receiver === userAddress || t.sender === userAddress
                );
                setTipHistory(userTips);
            } catch (error) {
                console.error("Error fetching profile data:", error);
            } finally {
                setLoading(false);
            }
        };

        if (connected && userAddress) {
            fetchData();
        }

        // Listen for tip events (and edit/delete events) to refresh data
        const handleRefresh = () => {
            if (connected && userAddress) fetchData();
        };
        window.addEventListener('tip_sent', handleRefresh);

        return () => {
            window.removeEventListener('tip_sent', handleRefresh);
        };
    }, [connected, userAddress]);

    // Calculate stats
    const totalTipsReceived = posts.reduce((acc, post) => acc + post.total_tips, 0);

    const totalTipsSent = tipHistory
        .filter((t: any) => t.sender === userAddress && t.type === 'sent')
        .reduce((acc, t) => acc + t.amount, 0);

    const handlePostCreated = async () => {
        // Refresh posts after creating a new one
        if (userAddress) {
            try {
                // Fetch count first
                const count = await getUserPostsCount(userAddress);
                const LIMIT = 5; // Reduced for testing
                
                // Fetch newest posts (start at 0)
                const userPosts = await getUserPostsPaginated(userAddress, 0, LIMIT);
                // Sort by timestamp desc
                userPosts.sort((a, b) => b.timestamp - a.timestamp);
                
                setPosts(userPosts);
                setPostsCount(count);
            } catch (error) {
                console.error("Error refreshing posts:", error);
            }
        }
    };

    return (
        <AuthGuard>
            <Head>
                <title>My Profile - MoveX</title>
            </Head>

            {/* Navigation */}
            <nav className="nav sticky top-0 z-40 bg-black/50 backdrop-blur-md border-b border-white/5">
                <div className="container-custom py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(250,204,21,0.3)]">
                                <span className="text-black font-bold text-lg">M</span>
                            </div>
                            <span className="text-white font-semibold text-lg tracking-tight">MoveX</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link
                                href="/feed"
                                className="text-sm font-medium text-neutral-400 hover:text-yellow-400 transition-colors"
                            >
                                Feed
                            </Link>
                            <Link
                                href="/profile"
                                className="text-sm font-medium text-yellow-400 border-b-2 border-yellow-400 pb-1"
                            >
                                Profile
                            </Link>
                            <Link
                                href={`/${userAddress}`}
                                className="flex items-center gap-1 text-sm font-medium text-neutral-400 hover:text-yellow-400 transition-colors"
                                title="Edit Profile"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                My Profile
                            </Link>



                            <HeaderBalance address={userAddress} />

                            <div className="scale-90 origin-right">
                                <WalletConnectButton />
                            </div>
                            <ThemeSwitcher />
                        </div>
                    </div>
                </div>
            </nav>

            <main className="min-h-screen pb-20">
                {/* Header */}
                <section className="section pt-8 pb-4">
                    <div className="container-custom">
                        <div className="max-w-4xl mx-auto">
                            <h1 className="text-3xl font-bold text-white mb-2">My Profile</h1>
                            <p className="text-neutral-400">Share your thoughts and earn tips</p>

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-4 mt-6">
                                <div className="card">
                                    <div className="text-2xl font-bold text-yellow-400">{postsCount}</div>
                                    <div className="text-sm text-neutral-500">Posts</div>
                                </div>
                                <div className="card">
                                    <div className="text-2xl font-bold text-green-400">{octasToMove(totalTipsReceived).toFixed(2)}</div>
                                    <div className="text-sm text-neutral-500">MOVE Received</div>
                                </div>
                                <div className="card">
                                    <div className="text-2xl font-bold text-blue-400">{totalTipsSent.toFixed(2)}</div>
                                    <div className="text-sm text-neutral-500">MOVE Sent</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Main Content */}
                <section className="section py-0">
                    <div className="container-custom">
                        <div className="max-w-4xl mx-auto space-y-6">
                            {/* Create Post Form */}
                            <CreatePostForm onPostCreated={handlePostCreated} />

                            {/* Posts Feed */}
                            <div>
                                <h2 className="text-xl font-semibold text-white mb-4">Your Posts</h2>

                                {loading ? (
                                    <div className="space-y-4">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="card animate-pulse">
                                                <div className="h-4 bg-neutral-800 rounded w-3/4 mb-2"></div>
                                                <div className="h-4 bg-neutral-800 rounded w-1/2"></div>
                                            </div>
                                        ))}
                                    </div>
                                ) : posts.length === 0 ? (
                                    <div className="card text-center py-12">
                                        <div className="w-16 h-16 mx-auto mb-4 bg-neutral-800 rounded-full flex items-center justify-center">
                                            <svg className="w-8 h-8 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-lg font-medium text-white mb-2">No posts yet</h3>
                                        <p className="text-neutral-500">Create your first post above!</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {posts.map((post) => (
                                            <PostCard
                                                key={`${post.creator}-${post.id}`}
                                                post={{
                                                    id: post.id.toString(),
                                                    creatorAddress: post.creator,
                                                    creatorHandle: userAddress.slice(0, 10) + "...",
                                                    content: post.content,
                                                    style: post.style === 0 ? 'minimal' : post.style === 1 ? 'gradient' : 'bold',
                                                    totalTips: octasToMove(post.total_tips),
                                                    createdAt: post.timestamp,
                                                    updatedAt: post.updated_at
                                                }}
                                                showTipButton={false}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </AuthGuard>
    );
}
