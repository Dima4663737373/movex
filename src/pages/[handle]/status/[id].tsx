import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import Head from 'next/head';
import RightSidebar from '@/components/RightSidebar';
import PostCard from '@/components/PostCard';
import CommentSection from '@/components/CommentSection';
import { getPost, getCommentsForPost, getDisplayName, getAvatar, OnChainPost, getUserPostsPaginated } from '@/lib/microThreadsClient';
import { octasToMove } from '@/lib/movement';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SinglePostPage() {
    const router = useRouter();
    const { id } = router.query;
    const { account, connected } = useWallet();
    const { t } = useLanguage();
    const userAddress = account?.address.toString() || "";

    const [post, setPost] = useState<any>(null);
    const [parentPost, setParentPost] = useState<any>(null);
    const [comments, setComments] = useState<OnChainPost[]>([]);
    const [commentCounts, setCommentCounts] = useState<Record<number, number>>({});
    const [loading, setLoading] = useState(true);
    const [profiles, setProfiles] = useState<Record<string, any>>({});
    const [stats, setStats] = useState({ totalTips: 0, totalVolume: 0, topTipper: "None" });
    const [myDisplayName, setMyDisplayName] = useState("");
    const [myAvatar, setMyAvatar] = useState("");

    const fetchPostAndComments = async () => {
        if (!id) return;

        setLoading(true);
        try {
            const postId = Number(id);
            const creatorHandle = Array.isArray(router.query.handle) ? router.query.handle[0] : router.query.handle;
            
            // Try standard fetch first
            let fetchedPost = await getPost(postId);

            // Fallback: If not found and we have a creator handle (address), try finding it in their recent posts
            // This handles cases where get_post_by_id might be missing or failing on the contract
            if (!fetchedPost && creatorHandle && creatorHandle.startsWith('0x')) {
                console.log(`Post ${postId} not found via direct fetch, scanning creator ${creatorHandle} posts...`);
                try {
                    // Fetch first 100 posts (should cover most recent clicks)
                    const userPosts = await getUserPostsPaginated(creatorHandle, 0, 100);
                    fetchedPost = userPosts.find(p => p.id === postId) || null;
                } catch (err) {
                    console.error("Fallback fetch failed:", err);
                }
            }
            
            // Fetch comments independently
            const postComments = await getCommentsForPost(postId);

            if (fetchedPost) {
                // Fetch creator profile
                const name = await getDisplayName(fetchedPost.creator);
                const avatar = await getAvatar(fetchedPost.creator);

                setPost({
                    ...fetchedPost,
                    creatorHandle: name,
                    creatorAvatar: avatar
                });

                // Calculate comment counts
                const counts: Record<number, number> = {};
                counts[postId] = postComments.length;
                setCommentCounts(counts);

                setComments(postComments);

                // Fetch profiles for comments
                const uniqueCreators = [...new Set(postComments.map(p => p.creator))];
                const profileMap: Record<string, any> = {};
                await Promise.all(uniqueCreators.map(async (creator) => {
                    const cName = await getDisplayName(creator);
                    const cAvatar = await getAvatar(creator);
                    profileMap[creator] = { displayName: cName, avatar: cAvatar };
                }));
                setProfiles(profileMap);

                // Fetch parent post if this is a reply (parent_id > 0)
                if (fetchedPost.parent_id > 0) {
                    try {
                        const parent = await getPost(fetchedPost.parent_id);
                        if (parent) {
                            const pName = await getDisplayName(parent.creator);
                            const pAvatar = await getAvatar(parent.creator);
                            setParentPost({
                                ...parent,
                                creatorHandle: pName,
                                creatorAvatar: pAvatar
                            });
                            
                            // Get comment count for parent
                            const pComments = await getCommentsForPost(parent.id);
                            const newCounts = { ...counts };
                            newCounts[parent.id] = pComments.length;
                            setCommentCounts(newCounts);
                        }
                    } catch (e) {
                        console.error("Failed to fetch parent post", e);
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching post:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchPostAndComments();
        }
    }, [id]);

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

    return (
        <>
            <Head>
                <title>Post by {myDisplayName || "User"} - MoveX</title>
            </Head>

            {/* Header - Movement Labs Style */}
            <main className="container-custom py-6 md:py-10">
                <div className="max-w-[800px] mx-auto">
                    
                        {/* CENTER: Post & Comments */}
                        <div className="min-w-0">
                            {/* Header with Back Button */}
                            <div className="flex items-center gap-4 mb-6">
                                <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-[var(--hover-bg)] transition-colors">
                                    <svg className="w-5 h-5 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                </button>
                                <h2 className="text-xl font-bold text-[var(--text-primary)]">{t.post}</h2>
                            </div>

                            {loading ? (
                                <div className="space-y-4">
                                    {/* Main Post Skeleton */}
                                    <div className="bg-[var(--card-bg)] border-b border-[var(--card-border)] p-4 animate-pulse">
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
                                            <div className="h-4 bg-neutral-800 rounded w-4/6"></div>
                                        </div>
                                    </div>
                                    {/* Comments Skeleton */}
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="bg-[var(--card-bg)] border-b border-[var(--card-border)] p-4 animate-pulse">
                                            <div className="flex gap-3">
                                                <div className="w-8 h-8 bg-neutral-800 rounded-full"></div>
                                                <div className="flex-1 space-y-2 py-1">
                                                    <div className="h-3 bg-neutral-800 rounded w-1/4"></div>
                                                    <div className="h-3 bg-neutral-800 rounded w-3/4"></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : post ? (
                                <>
                                    {parentPost && (
                                        <div className="relative">
                                            <div className="border-b border-[var(--card-border)] opacity-80 hover:opacity-100 transition-opacity">
                                                <PostCard
                                                    post={{
                                                        id: parentPost.id.toString(),
                                                        creatorAddress: parentPost.creator,
                                                        creatorHandle: parentPost.creatorHandle,
                                                        creatorAvatar: parentPost.creatorAvatar,
                                                        content: parentPost.content,
                                                        image_url: parentPost.image_url,
                                                        style: parentPost.style,
                                                        totalTips: octasToMove(parentPost.total_tips),
                                                        createdAt: parentPost.timestamp * 1000,
                                                        updatedAt: parentPost.updated_at,
                                                        commentCount: commentCounts[parentPost.id] || 0
                                                    }}
                                                    isOwner={parentPost.creator === userAddress}
                                                />
                                            </div>
                                            {/* Thread connector line */}
                                            <div className="absolute left-8 bottom-0 top-16 w-0.5 bg-[var(--card-border)] -z-10" />
                                        </div>
                                    )}
                                    <div className="border-b border-[var(--card-border)]">
                                        <PostCard
                                                post={{
                                                    id: post.id.toString(),
                                                    creatorAddress: post.creator,
                                                    creatorHandle: post.creatorHandle,
                                                    creatorAvatar: post.creatorAvatar,
                                                    content: post.content,
                                                    image_url: post.image_url,
                                                    style: post.style,
                                                    totalTips: octasToMove(post.total_tips),
                                                    createdAt: post.timestamp * 1000,
                                                    updatedAt: post.updated_at,
                                                    commentCount: commentCounts[post.id] || 0
                                                }}
                                                isOwner={post.creator === userAddress}
                                                hideComments={true}
                                            />
                                    </div>
                                    <CommentSection
                                        postId={post.id}
                                        comments={comments}
                                        commentCounts={commentCounts}
                                        onCommentAdded={fetchPostAndComments}
                                        profiles={profiles}
                                    />
                                </>
                            ) : (
                                <div className="p-8 text-center text-[var(--text-secondary)] bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)]">
                                    <p className="text-lg">{t.postNotFound}</p>
                                    <button 
                                        onClick={() => router.push(connected ? '/feed' : '/')}
                                        className="mt-4 text-[var(--accent)] hover:underline"
                                    >
                                        {t.returnToFeed}
                                    </button>
                                </div>
                            )}
                        </div>
                </div>
            </main>
        </>
    );
}
