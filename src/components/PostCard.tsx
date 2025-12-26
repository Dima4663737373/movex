/**
 * PostCard Component
 * 
 * Displays a single post with tipping functionality and image support
 */

'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { formatMovementAddress, octasToMove } from '@/lib/movement';
import { formatRelativeTime, formatPostTime, formatPostStatsDate } from '@/lib/utils';
import { getDisplayName, getAvatar, deletePostOnChain, editPostOnChain, getPost, getCommentsForPost, OnChainPost, createPostOnChain } from '@/lib/microThreadsClient';
import { saveLocalTransaction } from '@/lib/movementClient';
import { useMovementTransaction } from '@/hooks/useMovementTransaction';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useNotifications } from '@/components/Notifications';
import { supabase } from '@/lib/supabaseClient';
import { parseText } from '@/utils/textUtils';
import { CreatePostForm } from '@/components/CreatePostForm';
import TipFeedback from '@/components/TipFeedback';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNetwork } from '@/contexts/NetworkContext';
import { sendSocialNotification } from '@/contexts/SocialActivityContext';
import MiniAppRenderer from '@/components/MiniAppRenderer';
import { v4 as uuidv4 } from 'uuid';

interface PostMedia {
    id: string;
    url: string;
    type: 'image' | 'video' | 'audio';
}

import { AudioPlayer } from './AudioPlayer';

interface PostCardProps {
    post: {
        id: string;
        global_id?: number;
        creatorAddress: string;
        creatorHandle?: string;
        creatorAvatar?: string;
        content: string;
        image_url?: string;
        style: string | number;
        totalTips: number | string;
        createdAt: number;
        updatedAt?: number;
        commentCount?: number;
        status?: 'pending' | 'success' | 'fail';
    };
    isOwner?: boolean;
    showTipButton?: boolean;
    initialIsBookmarked?: boolean;
    hideComments?: boolean;
    compact?: boolean;
    previewCount?: number;
    highlight?: string;
}

import TipStatsModal from './TipStatsModal';

export default function PostCard({ post, isOwner, showTipButton = true, initialIsBookmarked = false, hideComments = false, compact = false, previewCount = 3, highlight }: PostCardProps) {
    const router = useRouter();
    const { account, signAndSubmitTransaction, signMessage, network } = useWallet();
    const { sendTip } = useMovementTransaction();
    const { t } = useLanguage();
    const { currentNetwork } = useNetwork();
    const { addNotification } = useNotifications();
    const [displayName, setDisplayName] = useState<string>(post.creatorHandle || '');
    const [avatarUrl, setAvatarUrl] = useState<string>(post.creatorAvatar || '');
    const [tipping, setTipping] = useState(false);
    const [tipAmount, setTipAmount] = useState('1');
    const [showTipInput, setShowTipInput] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [showTipStats, setShowTipStats] = useState(false);
    const [votes, setVotes] = useState({ up: 0, down: 0 });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedTip = localStorage.getItem('default_tip_amount');
            if (savedTip) {
                setTipAmount(savedTip);
            }
        }
    }, []);

    const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
    const [voting, setVoting] = useState(false);

    // Reply state
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [showRepostForm, setShowRepostForm] = useState(false);

    // Image viewer state
    const [isImageOpen, setIsImageOpen] = useState(false);
    const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);

    // Multi-media state
    const [media, setMedia] = useState<PostMedia[]>([]);
    const [isLoadingMedia, setIsLoadingMedia] = useState(false);

    // Repost state
    const [repostedPost, setRepostedPost] = useState<OnChainPost | null>(null);
    const [isLoadingRepost, setIsLoadingRepost] = useState(false);
    const [showRepostOptions, setShowRepostOptions] = useState(false);
    const [isReposting, setIsReposting] = useState(false);
    
    // Copy link state
    const [isCopied, setIsCopied] = useState(false);

    const handleSimpleRepost = async (e: React.MouseEvent) => {
        e.stopPropagation();
        
        if (!account) return;
        setIsReposting(true);
        setShowRepostOptions(false);
        
        const postRef = uuidv4();

        const tempId = `temp-repost-${Date.now()}`;
        const optimisticPost = {
            id: tempId,
            global_id: 0,
            creator: account.address.toString(),
            creatorAddress: account.address.toString(),
            creatorHandle: account.ansName || undefined,
            content: `[ref:${postRef}]`,
            image_url: '',
            style: 0,
            totalTips: 0,
            createdAt: Date.now() / 1000,
            status: 'pending' as const
        };
        window.dispatchEvent(new CustomEvent('post_pending', { detail: optimisticPost }));
        addNotification("Reposting...", "info", { persist: false });

        try {
            // 1. Insert Metadata
            if (supabase) {
                await supabase.from('post_metadata').insert({
                    post_ref: postRef,
                    repost_of: post.global_id !== undefined ? post.global_id.toString() : post.id,
                    metadata: {}
                });
            }
            
            // 2. Create Post on Chain
            const newPostId = await createPostOnChain(
                `[ref:${postRef}]`, 
                '', 
                0, 
                signAndSubmitTransaction
            );
            
            if (newPostId !== null) {
                window.dispatchEvent(new CustomEvent('post_success', { 
                    detail: { 
                        tempId, 
                        finalId: newPostId,
                        post: { ...optimisticPost, id: newPostId, status: 'success' }
                    } 
                }));
                addNotification(t.postCreatedSuccess, "success", { persist: false });

                // Notify original author
                if (post.creatorAddress !== account.address.toString()) {
                    sendSocialNotification(post.creatorAddress, {
                        type: 'repost',
                        actorAddress: account.address.toString(),
                        targetPostId: post.id,
                        targetPostContent: post.content.substring(0, 100)
                    });
                }
            } else {
                 throw new Error("Transaction failed");
            }
            
            window.dispatchEvent(new Event('tip_sent')); // Refresh feed
        } catch (error) {
            console.error("Repost failed", error);
            window.dispatchEvent(new CustomEvent('post_fail', { 
                detail: { tempId, error: (error as Error).message } 
            }));
            addNotification(t.postCreationError, "error", { persist: true });
        } finally {
            setIsReposting(false);
        }
    };
    
    // Bookmark state
    const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked);
    const [bookmarkCount, setBookmarkCount] = useState(0);
    const [bookmarking, setBookmarking] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Editing state
    const [isEditing, setIsEditing] = useState(false);
    // Initialize editContent without the ref tag if it exists
    const [editContent, setEditContent] = useState(() => {
        return post.content.replace(/\[ref:[a-f0-9\-]+\]/g, '').trim();
    });
    const [editImage, setEditImage] = useState(post.image_url || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Comments state
    const [comments, setComments] = useState<OnChainPost[]>([]);
    const [commentCount, setCommentCount] = useState(post.commentCount || 0);
    const [loadingComments, setLoadingComments] = useState(false);
    
    // Local post state for optimistic updates
    const [localPost, setLocalPost] = useState(post);
    const [viewCount, setViewCount] = useState(0);
    const [localTotalTips, setLocalTotalTips] = useState(typeof post.totalTips === 'number' ? post.totalTips : parseFloat(post.totalTips as string));

    useEffect(() => {
        setLocalPost(post);
        setLocalTotalTips(typeof post.totalTips === 'number' ? post.totalTips : parseFloat(post.totalTips as string));
    }, [post]);

    // Extract special features
    const bountyMatch = localPost.content.match(/\[bounty:([\d.]+)\]/);
    const bountyAmount = bountyMatch ? parseFloat(bountyMatch[1]) : null;

    const pollData = useMemo(() => {
        const match = localPost.content.match(/\[poll:(.*?)\]/);
        if (!match) return null;
        
        try {
            const raw = match[1];
            // Check if it's likely JSON (starts with {) - Legacy format support (might be broken if contained ])
            if (raw.trim().startsWith('{')) {
                return JSON.parse(raw);
            }
            
            // Assume Base64 (New format)
            if (typeof window !== 'undefined') {
                 return JSON.parse(decodeURIComponent(escape(window.atob(raw))));
            } else if (typeof Buffer !== 'undefined') {
                 return JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
            }
            return null;
        } catch (e) {
            // console.error("Failed to parse poll data", e);
            return null;
        }
    }, [localPost.content]);

    const miniAppData = useMemo(() => {
        const match = localPost.content.match(/\[app:(https?:\/\/[^\]]+)\]/);
        if (!match) return null;
        return match[1];
    }, [localPost.content]);

    // Helper to highlight text
    const highlightText = (text: string, query?: string) => {
        if (!query || !text) return text;
        // Escape special regex characters in query
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
        return parts.map((part, i) => 
            part.toLowerCase() === query.toLowerCase() 
                ? <mark key={i} className="bg-[var(--accent)] text-[var(--btn-text-primary)] rounded-sm px-0.5 font-medium">{part}</mark> 
                : part
        );
    };

    // Helper to format content with clickable links and hashtags
    const formatContentWithLinks = (text: string) => {
        if (!text) return null;
        
        // Strip ref tag, bounty tag, poll tag, and app tag
        const cleanText = text
            .replace(/\[ref:[a-f0-9\-]+\]/g, '')
            .replace(/\[bounty:[\d.]+\]/g, '')
            .replace(/\[poll:.*?\]/g, '')
            .replace(/\[app:.*?\]/g, '')
            .trim();
            
        if (!cleanText) return null;

        const segments = parseText(cleanText);
        
        return segments.map((segment, index) => {
            if (segment.type === 'url') {
                return (
                    <a 
                        key={index}
                        href={segment.content} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[var(--accent)] hover:underline break-all relative z-10 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {highlightText(segment.content, highlight)}
                    </a>
                );
            } else if (segment.type === 'hashtag') {
                return (
                    <Link 
                        key={index}
                        href={`/hashtag/${segment.content}`}
                        className="text-[var(--accent)] hover:underline relative z-10 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                    >
                        #{highlightText(segment.content, highlight)}
                    </Link>
                );
            } else if (segment.type === 'cashtag') {
                return (
                    <Link 
                        key={index}
                        href={`/cashtag/${segment.content}`}
                        className="text-[var(--accent)] hover:underline relative z-10 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                    >
                        ${highlightText(segment.content, highlight)}
                    </Link>
                );
            } else {
                return <span key={index}>{highlightText(segment.content, highlight)}</span>;
            }
        });
    };

    // View Counting Logic
    const viewedIdsRef = useRef(new Set<string>());

    useEffect(() => {
        let mounted = true;

        const handleViews = async () => {
            // Strict check: Don't count views for pending, optimistic, or temporary posts
            // Also verify we have a valid numeric ID (unless it's a legacy string ID, but we prefer numeric for DB)
            if (!post.id || 
                post.status === 'pending' || 
                post.id.toString().startsWith('temp-') || 
                post.id.toString().startsWith('pending-')) {
                return;
            }

            try {
                // Generate a stable key for local storage
                const viewedKey = `viewed_${post.id}`;

                // Only increment if not hidden (feed view) and not already viewed
                if (!hideComments) {
                    // Check session ref (fastest, per component instance)
                    if (!viewedIdsRef.current.has(viewedKey)) {
                        viewedIdsRef.current.add(viewedKey);

                        // Check localStorage (persistent across reloads/sessions)
                        const alreadyViewed = localStorage.getItem(viewedKey);
                        
                        if (!alreadyViewed) {
                            // Mark as viewed immediately
                            localStorage.setItem(viewedKey, 'true');
                            
                            // Send to backend
                            // Note: We don't await this to avoid blocking UI, but we catch errors
                            fetch('/api/views', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                    postId: post.id,
                                    viewerAddress: account?.address?.toString() 
                                })
                            }).catch(e => console.error("Failed to register view", e));
                        }
                    }
                }

                // Fetch current view count
                const res = await fetch(`/api/views?postId=${post.id}`);
                if (res.ok && mounted) {
                    const data = await res.json();
                    setViewCount(data.viewCount || 0);
                }
            } catch (e) {
                console.error("Error handling views:", e);
            }
        };

        handleViews();

        return () => { mounted = false; };
    }, [post.id, hideComments, account?.address, post.status]);

    useEffect(() => {
        const fetchMediaAndMetadata = async () => {
            const refMatch = post.content.match(/\[ref:([a-f0-9\-]+)\]/);
            if (refMatch && refMatch[1]) {
                const refId = refMatch[1];
                setIsLoadingMedia(true);
                if (supabase) {
                    // Fetch Media
                    const { data: mediaData } = await supabase
                        .from('post_media')
                        .select('*')
                        .eq('post_ref', refId);
                    
                    if (mediaData) {
                        setMedia(mediaData as PostMedia[]);
                    }

                    // Fetch Metadata (for Reposts)
                    const { data: metaData } = await supabase
                        .from('post_metadata')
                        .select('repost_of')
                        .eq('post_ref', refId)
                        .maybeSingle();
                    
                    if (metaData && metaData.repost_of) {
                        setIsLoadingRepost(true);
                        try {
                            const repostId = parseInt(metaData.repost_of);
                            if (!isNaN(repostId)) {
                                const originalPost = await getPost(repostId);
                                setRepostedPost(originalPost);
                            } else {
                                console.warn("Invalid repost ID:", metaData.repost_of);
                            }
                        } catch (e) {
                            console.error("Failed to fetch reposted post", e);
                        } finally {
                            setIsLoadingRepost(false);
                        }
                    }
                }
                setIsLoadingMedia(false);
            } else {
                setMedia([]);
                setRepostedPost(null);
            }
        };
        fetchMediaAndMetadata();
    }, [post.content]);
    
    useEffect(() => {
        // Reset state when post ID changes to prevent "phantom" data from previous reused component
        setVotes({ up: 0, down: 0 });
        setUserVote(null);

        const fetchProfile = async () => {
            try {
                // Sync from props if available
                if (post.creatorHandle) {
                    setDisplayName(post.creatorHandle);
                } else {
                    // Fetch if not provided
                    const name = await getDisplayName(post.creatorAddress);
                    if (name) setDisplayName(name);
                }

                if (post.creatorAvatar) {
                    setAvatarUrl(post.creatorAvatar);
                } else {
                    const avatar = await getAvatar(post.creatorAddress);
                    if (avatar) setAvatarUrl(avatar);
                }
            } catch (e) {
                console.error("Error fetching profile", e);
            }
        };

        const fetchVotes = async () => {
            // Strict check for valid post ID to prevent "phantom" votes on undefined/null IDs
            if (!post.id || post.id === 'undefined' || post.id === 'null') return;

            try {
                const queryParams = new URLSearchParams({
                    postId: post.id,
                    creatorAddress: post.creatorAddress
                });
                if (account?.address) {
                    queryParams.append('userAddress', account.address.toString());
                }

                const res = await fetch(`/api/votes?${queryParams.toString()}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data) {
                        setVotes({ up: data.up || 0, down: data.down || 0 });
                        setUserVote(data.userVote || null);
                    }
                }
            } catch (e) {
                console.error("Error fetching votes", e);
            }
        };

        fetchProfile();
        fetchVotes();
    }, [post.id, post.creatorAddress, post.creatorHandle, post.creatorAvatar, account?.address]);

    // Interaction state
    const [isHidden, setIsHidden] = useState(false);
    const [showMoreOptions, setShowMoreOptions] = useState(false);

    const handleInteraction = async (action: 'not_interested' | 'mute' | 'block' | 'unfollow', isUndo = false) => {
        if (!account) {
            addNotification(t.connectWallet, "error");
            return;
        }

        // Confirm for severe actions
        if (action === 'block' && !isUndo && !confirm(t.blockConfirm || "Are you sure you want to block this user?")) return;

        try {
            // Optimistic updates
            if (action === 'not_interested') {
                setIsHidden(!isUndo);
                // We don't show "Processing" for this, just hide it immediately
            } else if (action === 'mute' || action === 'block') {
                setIsHidden(!isUndo);
                addNotification(t.processing || "Processing...", "info", { persist: false, duration: 1000 });
            }

            if (action === 'unfollow') {
                const res = await fetch('/api/follow', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userAddress: account.address.toString(),
                        targetAddress: post.creatorAddress
                    })
                });
                
                if (!res.ok) throw new Error("Unfollow failed");
                
                const data = await res.json();
                if (!data.isFollowing) {
                    addNotification(t.unfollowed || "Unfollowed successfully", "success");
                    window.dispatchEvent(new Event('follow_update'));
                } else {
                     // If we tried to unfollow but ended up following (toggle), this is unexpected for "unfollow" action
                     // But acceptable for now
                     addNotification(t.following || "Following", "success");
                }
                return;
            }

            const res = await fetch('/api/interactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userAddress: account.address.toString(),
                    targetAddress: post.creatorAddress,
                    postId: post.id,
                    type: action
                })
            });

            if (!res.ok) throw new Error("Action failed");

            const data = await res.json();
            // Dispatch update so Feed can filter
            window.dispatchEvent(new Event('interaction_update'));
            
            if (isUndo) {
                 addNotification(t.undoSuccess || "Undone", "success");
            } else {
                 if (action === 'not_interested') {
                     addNotification(t.postHidden || "Post hidden. Use 'Mute' to hide posts from this user.", "success");
                 } else {
                     addNotification(t.success || "Success", "success");
                 }
            }

        } catch (e) {
            console.error("Interaction error:", e);
            addNotification(t.error || "Action failed", "error");
            if (!isUndo) setIsHidden(false); // Revert hide if failed
            else setIsHidden(true); // Revert undo if failed
        }
    };

    // Check bookmark status
    useEffect(() => {
        const checkBookmark = async () => {
            try {
                // Ignore if global_id is 0 (pending/optimistic post) to avoid matching with post 0
                const effectiveGlobalId = (post.global_id !== undefined && post.global_id > 0) ? post.global_id : undefined;
                const postId = effectiveGlobalId || post.id;
                
                // If it's a temporary ID, we can skip fetching from server as it won't be there
                // unless we want to check if the user bookmarked the *temp* ID (unlikely)
                if (!effectiveGlobalId && typeof postId === 'string' && (postId.startsWith('temp-') || postId.startsWith('pending-'))) {
                    return;
                }

                let url = `/api/bookmarks?postId=${postId}`;
                if (account?.address) {
                    url += `&userAddress=${account.address}`;
                }

                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (data.bookmarked !== undefined) setIsBookmarked(data.bookmarked);
                    if (data.count !== undefined) setBookmarkCount(data.count);
                }
            } catch (e) {
                console.error("Error checking bookmark", e);
            }
        };
        checkBookmark();
    }, [post.id, post.global_id, account?.address, initialIsBookmarked]);

    // Fetch comment count if needed
    useEffect(() => {
        if (post.commentCount !== undefined) {
             setCommentCount(post.commentCount);
             return;
        }
        
        // If comments are already loaded, use that length
        if (comments.length > 0) {
            setCommentCount(comments.length);
            return;
        }

        // Only fetch if we are in feed view (comments hidden) and count is unknown
        if (hideComments) {
            const fetchCount = async () => {
                try {
                    const fetched = await getCommentsForPost(parseInt(post.id));
                    setCommentCount(fetched.length);
                } catch (e) {
                    // console.error("Error fetching comment count", e);
                }
            };
            fetchCount();
        }
    }, [post.id, post.commentCount, comments.length, hideComments]);

    // Fetch comments
    useEffect(() => {
        if (hideComments) return;
        
        const fetchComments = async () => {
            if (!post.id) return;
            const postId = parseInt(post.id);
            if (isNaN(postId)) {
                // Silence warning for optimistic/pending posts
                if (!post.id.toString().startsWith('pending-')) {
                    console.warn("Invalid post ID for comments:", post.id);
                }
                return;
            }
            try {
                setLoadingComments(true);
                // Don't fetch comments for comments (nested) to avoid infinite recursion if not needed
                // But user might want deep nesting. For now, let's allow it but limit display.
                const fetchedComments = await getCommentsForPost(postId);
                setComments(fetchedComments);
            } catch (e) {
                console.error("Error fetching comments", e);
            } finally {
                setLoadingComments(false);
            }
        };
        fetchComments();

        const handleCommentAdded = () => {
             // Refresh comments when a new one is added
             fetchComments();
        };
        window.addEventListener('comment_added', handleCommentAdded);
        return () => window.removeEventListener('comment_added', handleCommentAdded);
    }, [post.id]);

    const handleVote = async (e: React.MouseEvent, type: 'up' | 'down') => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log(`Voting: type=${type}, current=${userVote}, voting=${voting}`);
        
        if (!account) {
            addNotification(t.connectWallet, "error");
            return;
        }

        if (!post.creatorAddress) {
            console.error("Missing creator address for post:", post);
            addNotification("Unable to vote: Invalid post data", "error");
            return;
        }
        
        // Optimistic update
        const previousUserVote = userVote;
        const previousVotes = { ...votes };
        
        let newUserVote: 'up' | 'down' | null = type;
        if (userVote === type) {
            newUserVote = null; // Toggle off
        }

        // Calculate new counts
        let newUp = votes.up;
        let newDown = votes.down;

        // Remove old vote
        if (userVote === 'up') newUp = Math.max(0, newUp - 1);
        if (userVote === 'down') newDown = Math.max(0, newDown - 1);

        // Add new vote
        if (newUserVote === 'up') newUp++;
        if (newUserVote === 'down') newDown++;

        // Apply optimistic state
        setUserVote(newUserVote);
        setVotes({ up: newUp, down: newDown });

        // Notify if upvote
        if (newUserVote === 'up' && post.creatorAddress !== account.address.toString()) {
            sendSocialNotification(post.creatorAddress, {
                type: 'like',
                actorAddress: account.address.toString(),
                targetPostId: post.id,
                targetPostContent: post.content.substring(0, 100)
            });
        }

        try {
            setVoting(true);
            
            const res = await fetch('/api/votes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postId: post.id,
                    creatorAddress: post.creatorAddress,
                    userAddress: account.address.toString(),
                    type: type
                })
            });

            if (res.ok) {
                const data = await res.json();
                // Ensure server state sync
                setVotes({ up: data.up, down: data.down });
                setUserVote(data.userVote);
            } else {
                const errorData = await res.json().catch(() => ({ error: res.statusText }));
                console.error("Vote API error:", errorData);
                throw new Error(errorData.error || "Vote failed");
            }
        } catch (e) {
            console.error("Error voting", e);
            // Revert on error
            setUserVote(previousUserVote);
            setVotes(previousVotes);
            addNotification(t.voteError, "error", { persist: true });
        } finally {
            setVoting(false);
        }
    };

    const handleBookmark = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!account) return;

        if (!post.creatorAddress) {
            addNotification("Unable to bookmark: Invalid post data", "error");
            return;
        }

        const wasBookmarked = isBookmarked;
        const previousCount = bookmarkCount;

        // Optimistic update
        setIsBookmarked(!wasBookmarked);
        setBookmarkCount(prev => wasBookmarked ? Math.max(0, prev - 1) : prev + 1);
        
        if (!wasBookmarked) {
            addNotification("Saved to bookmarks", "success", { persist: false, duration: 1500 });
        }

        try {
            setBookmarking(true);
            
            const res = await fetch('/api/bookmarks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postId: (post.global_id !== undefined ? post.global_id : post.id).toString(),
                    creatorAddress: post.creatorAddress,
                    userAddress: account.address.toString()
                })
            });

            if (res.ok) {
                const data = await res.json();
                setIsBookmarked(data.bookmarked);
                if (data.count !== undefined) setBookmarkCount(data.count);
                window.dispatchEvent(new Event('bookmark_changed'));
            } else {
                console.error("Bookmark failed", await res.text());
                addNotification("Failed to bookmark", "error", { persist: true });
                // Revert
                setIsBookmarked(wasBookmarked);
                setBookmarkCount(previousCount);
            }
        } catch (e) {
            console.error("Error bookmarking", e);
            addNotification("Error bookmarking", "error", { persist: true });
            // Revert
            setIsBookmarked(wasBookmarked);
            setBookmarkCount(previousCount);
        } finally {
            setBookmarking(false);
        }
    };

    const handleTip = async (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log("Tip button clicked");

        if (!account) {
            console.log("No account connected");
            addNotification(t.connectWallet, 'error');
            return;
        }

        // Strict Network Check
        const requiredChainId = currentNetwork === 'testnet' ? '250' : '126';
        if (network?.chainId?.toString() !== requiredChainId) {
            console.error("Wrong network:", network?.chainId);
            addNotification(`Wrong network! Please switch your wallet to Movement Testnet (Chain ID: 250). Currently on: ${network?.chainId || 'Unknown'}`, 'error');
            return;
        }

        console.log("Account connected:", account.address);
        console.log("SignAndSubmit defined:", !!signAndSubmitTransaction);

        if (!post.creatorAddress) {
            console.error("Missing creator address for post:", post);
            addNotification("Unable to tip: Invalid post data", "error");
            return;
        }

        const amount = parseFloat(tipAmount);
        if (isNaN(amount) || amount <= 0) {
            console.error("Invalid amount:", tipAmount);
            addNotification("Invalid tip amount", "error", { persist: false });
            return;
        }

        if (isNaN(parseInt(post.id))) {
             console.error("Invalid postId:", post.id);
             addNotification("Invalid Post ID", "error", { persist: false });
             return;
        }

        // Optimistic Update
        const previousTips = localTotalTips;
        setLocalTotalTips(prev => (typeof prev === 'number' ? prev : parseFloat(prev as string)) + amount);
        setTipping(true);
        setShowTipInput(false); // Close input immediately
        addNotification("Sending tip...", "info", { persist: false });

        try {
            console.log("Preparing to send tip...");

            const params = {
                creatorAddress: post.creatorAddress,
                postId: parseInt(post.id),
                amount: amount
            };
            
            console.log("Tip params:", params);

            console.log("Calling sendTip...");
            // Use smart contract for tipping
            const result = await sendTip(params.creatorAddress, params.amount, post.id);
            const txHash = result.hash;
            console.log("sendTip returned hash:", txHash);

            // Show Feedback Animation
                setShowFeedback(true);

                // Save to local storage for immediate UI update
                if (account?.address) {
                    saveLocalTransaction({
                        sender: account.address.toString(),
                        receiver: post.creatorAddress,
                        amount: parseFloat(tipAmount),
                        timestamp: Math.floor(Date.now() / 1000), // Store in seconds to match on-chain events
                        hash: txHash,
                        postId: post.id.toString(),
                        type: 'sent'
                    });
                }

                // Dispatch Custom Event with Tip Details
                const tipEvent = new CustomEvent('tip_sent', { 
                    detail: { 
                        amount: amount,
                        sender: account?.address?.toString(),
                        receiver: post.creatorAddress
                    } 
                });
                window.dispatchEvent(tipEvent);
                
                addNotification(t.tipSuccess, "success", { persist: false });
            } catch (error) {
            console.error("Tip failed details:", error);
            // Revert optimistic update
            setLocalTotalTips(previousTips);
            addNotification(t.tipError + ": " + (error instanceof Error ? error.message : String(error)), "error", { persist: true });
        } finally {
            setTipping(false);
        }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log("Image selection triggered");
        const file = e.target.files?.[0];
        if (!file) return;

        console.log("File selected:", file.name, file.size);

        if (file.size > 10 * 1024 * 1024) {
            addNotification(t.imageTooLargeError, "info", { persist: false });
            e.target.value = ''; // Reset input
            return;
        }

        addNotification(t.processingImage, "info", { persist: false });

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const attempts = [
                    { maxSize: 1600, quality: 0.8 },
                    { maxSize: 1200, quality: 0.7 },
                    { maxSize: 1024, quality: 0.6 },
                    { maxSize: 800, quality: 0.6 },
                    { maxSize: 600, quality: 0.5 },
                    { maxSize: 400, quality: 0.5 },
                    { maxSize: 300, quality: 0.4 }, // Deep compression
                ];

                let success = false;
                for (const attempt of attempts) {
                    let width = img.width;
                    let height = img.height;
                    if (width > height) {
                        if (width > attempt.maxSize) {
                            height *= attempt.maxSize / width;
                            width = attempt.maxSize;
                        }
                    } else {
                        if (height > attempt.maxSize) {
                            width *= attempt.maxSize / height;
                            height = attempt.maxSize;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    if (ctx) {
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, width, height);
                        ctx.drawImage(img, 0, 0, width, height);
                    }
                    const compressedBase64 = canvas.toDataURL('image/jpeg', attempt.quality);
                    if (compressedBase64.length <= 50000) {
                        setEditImage(compressedBase64);
                        success = true;
                        console.log("Image compressed successfully");
                        break;
                    }
                }
                if (!success) {
                    addNotification(t.compressionError, "info", { persist: false });
                }
                e.target.value = ''; // Reset input after processing
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleEdit = async () => {
        if (!editContent.trim()) {
            addNotification(t.contentEmpty, 'error');
            return;
        }
        try {
            setIsSaving(true);
            
            // Preserve ref tag if it exists in the original post
            let finalContent = editContent;
            const refMatch = post.content.match(/\[ref:[a-f0-9\-]+\]/);
            if (refMatch) {
                finalContent = `${finalContent}\n${refMatch[0]}`;
            }

            await editPostOnChain(parseInt(post.id), finalContent, editImage, signAndSubmitTransaction);
            
            // Optimistic update
            setLocalPost(prev => ({
                ...prev,
                content: finalContent,
                image_url: editImage
            }));

            setIsEditing(false);
            addNotification(t.postUpdated, "success", { persist: false });
            setTimeout(() => window.dispatchEvent(new Event('tip_sent')), 3000);
        } catch (error) {
            console.error("Edit failed:", error);
            addNotification(t.postUpdateError, "error", { persist: true });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t.deleteConfirm)) return;
        try {
            setIsDeleting(true);
            await deletePostOnChain(parseInt(post.id), signAndSubmitTransaction);
            addNotification(t.postDeleted, "success", { persist: false });
            setTimeout(() => window.dispatchEvent(new Event('tip_sent')), 3000);
        } catch (error) {
            console.error("Delete failed:", error);
            addNotification(t.postDeleteError, "error", { persist: true });
            setIsDeleting(false);
        }
    };

    const handleCardClick = (e: React.MouseEvent) => {
        // Prevent navigation if text is selected
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;
        
        // Don't navigate if we're editing
        if (isEditing) return;

        router.push(`/${post.creatorAddress}/status/${post.id}`);
    };

    if (isHidden) {
        return (
            <div className={`border-b border-[var(--card-border)] px-4 py-8 flex items-center justify-between bg-[var(--bg-secondary)]/10 transition-all duration-200`}>
                    <span className="text-[var(--text-secondary)] font-medium">{t.postHidden || "Post hidden"}</span>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            // Undo the interaction on backend
                            handleInteraction('not_interested', true); 
                        }}
                        className="px-4 py-2 text-[var(--accent)] font-bold hover:bg-[var(--accent)]/10 rounded-full transition-colors"
                    >
                        {t.undo || "Undo"}
                    </button>
                </div>
        );
    }

    return (
        <>
            <TipFeedback 
                isActive={showFeedback} 
                onComplete={() => setShowFeedback(false)} 
                type="coin" 
                amount={parseFloat(tipAmount)}
            />
            <div 
                className={`${compact ? 'py-2 hover:bg-transparent' : 'border-b border-[var(--card-border)] px-4 py-3 lg:px-6 lg:py-4 hover:bg-[var(--hover-bg)]/20'} transition-colors duration-200 cursor-pointer`}
                onClick={handleCardClick}
            >
                {/* Repost Indicator */}
                {repostedPost && !localPost.content.replace(/\[ref:[a-f0-9\-]+\]/g, '').trim() && (
                    <div className="flex items-center gap-2 mb-2 text-[var(--text-secondary)] text-sm font-medium">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19.5v-15m0 0l-6.75 6.75M12 4.5l6.75 6.75" />
                        </svg>
                        <span className="hover:underline cursor-pointer" onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/${post.creatorAddress}`);
                        }}>
                            {displayName || formatMovementAddress(post.creatorAddress)}
                        </span> 
                        <span>reposted</span>
                    </div>
                )}

                {/* Header: Avatar, Name, Time, Menu */}
                <div className="flex gap-3">
                    {/* Avatar Column */}
                    <div className="flex-shrink-0">
                        <Link href={`/${post.creatorAddress}`} onClick={(e) => e.stopPropagation()}>
                            <div className="w-10 h-10 rounded-full bg-[var(--card-border)] overflow-hidden">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center font-bold text-[var(--text-primary)]">
                                        {displayName ? displayName[0].toUpperCase() : 'U'}
                                    </div>
                                )}
                            </div>
                        </Link>
                    </div>

                    {/* Content Column */}
                    <div className="flex-grow min-w-0">
                        {/* Header Row */}
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <Link href={`/${post.creatorAddress}`} className="font-bold text-[var(--text-primary)] hover:underline truncate" onClick={(e) => e.stopPropagation()}>
                                    {displayName || formatMovementAddress(post.creatorAddress)}
                                </Link>
                                <span className="text-[var(--text-secondary)] text-sm truncate">
                                    @{post.creatorAddress ? post.creatorAddress.slice(0, 6) : '...'}...
                                </span>
                                <span className="text-[var(--text-secondary)] text-sm">·</span>
                                {!compact && (
                                <span className="text-[var(--text-secondary)] text-sm whitespace-nowrap" title={new Date(post.createdAt).toLocaleString()}>
                                    {formatPostTime(post.createdAt, router.pathname.includes('/status/'))}
                                </span>
                                )}
                                {post.status === 'pending' && (
                                    <span className="ml-2 flex items-center gap-1 text-xs text-blue-500 font-medium bg-blue-500/10 px-2 py-0.5 rounded-full">
                                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Posting...
                                    </span>
                                )}
                                {post.status === 'fail' && (
                                    <span className="ml-2 text-xs text-red-500 font-medium bg-red-500/10 px-2 py-0.5 rounded-full">
                                        Failed
                                    </span>
                                )}
                                {post.updatedAt && post.updatedAt > post.createdAt + 1000 && (
                                    <span 
                                        className="text-[var(--text-secondary)] text-sm ml-1 whitespace-nowrap" 
                                        title={`Edited: ${new Date(post.updatedAt).toLocaleString()}`}
                                    >
                                        · Edited {formatPostTime(post.updatedAt, false)}
                                    </span>
                                )}
                                {bountyAmount && (
                                    <span 
                                        className="ml-2 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-bold border border-yellow-500/20 flex items-center gap-1 shrink-0"
                                        title={`Bounty: ${bountyAmount} MOVE`}
                                    >
                                        <span>🎯</span>
                                        {bountyAmount} MOVE
                                    </span>
                                )}
                            </div>

                            {/* Menu/Actions */}
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <div className="relative group">
                                    <button className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] rounded-full transition-colors">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 13a1 1 0 100-2 1 1 0 000 2zm0-5a1 1 0 100-2 1 1 0 000 2zm0 10a1 1 0 100-2 1 1 0 000 2z" />
                                        </svg>
                                    </button>
                                    <div className="absolute right-0 mt-2 w-56 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 overflow-hidden">
                                        {isOwner ? (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setEditContent(post.content.replace(/\[ref:[a-f0-9\-]+\]/g, '').trim());
                                                        setIsEditing(true);
                                                    }}
                                                    className="w-full text-left px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)] flex items-center gap-3"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                    {t.edit}
                                                </button>
                                                <button
                                                    onClick={handleDelete}
                                                    className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-[var(--hover-bg)] flex items-center gap-3"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    {t.delete}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleInteraction('not_interested')}
                                                    className="w-full text-left px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)] flex items-center gap-3"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                                    {t.notInterested || "Not interested in this post"}
                                                </button>
                                                <button
                                                    onClick={() => handleInteraction('unfollow')}
                                                    className="w-full text-left px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)] flex items-center gap-3"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" /></svg>
                                                    {t.unfollow} @{post.creatorHandle || post.creatorAddress?.slice(0, 4) || '...'}
                                                </button>
                                                <button
                                                    onClick={() => handleInteraction('mute')}
                                                    className="w-full text-left px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--hover-bg)] flex items-center gap-3"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                                                    {t.mute} @{post.creatorHandle || post.creatorAddress?.slice(0, 4) || '...'}
                                                </button>
                                                <button
                                                    onClick={() => handleInteraction('block')}
                                                    className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-[var(--hover-bg)] flex items-center gap-3 border-t border-[var(--card-border)]"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                    {t.block} @{post.creatorHandle || post.creatorAddress?.slice(0, 4) || '...'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Post Content */}
                        {isEditing ? (
                            <div className="mt-2 space-y-3" onClick={(e) => e.stopPropagation()}>
                                <textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg p-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                                    rows={3}
                                />
                                <div className="space-y-2">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleImageSelect}
                                        className="hidden"
                                        accept="image/*"
                                    />
                                    
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                console.log("Opening file dialog");
                                                fileInputRef.current?.click();
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 bg-[var(--card-border)] rounded-lg hover:bg-[var(--hover-bg)] transition-colors text-sm font-medium"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                            </svg>
                                            {editImage ? t.changeImage : t.addImage}
                                        </button>
                                        
                                        {editImage && (
                                            <button
                                                onClick={() => setEditImage('')}
                                                className="px-3 py-2 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium"
                                            >
                                                {t.remove}
                                            </button>
                                        )}
                                    </div>

                                    {editImage && (
                                        <div className="relative rounded-lg overflow-hidden border border-[var(--card-border)] w-fit max-w-full">
                                            <img src={editImage} alt="Preview" className="max-h-40 object-contain" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                    >
                                        {t.cancel}
                                    </button>
                                    <button
                                        onClick={handleEdit}
                                        disabled={isSaving}
                                        className="px-3 py-1.5 text-sm font-bold bg-[var(--accent)] text-[var(--btn-text-primary)] rounded-full hover:opacity-90 disabled:opacity-50"
                                    >
                                        {isSaving ? t.saving : t.save}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-1">
                                <p className="text-[var(--text-primary)] text-base whitespace-pre-wrap leading-relaxed">
                                    {formatContentWithLinks(localPost.content.replace(/\[ref:[a-f0-9\-]+\]/g, '').trim())}
                                </p>
                                
                                {miniAppData && (
                                    <div className="mt-3 w-full rounded-xl overflow-hidden border border-[var(--card-border)] bg-[var(--bg-secondary)]" onClick={(e) => e.stopPropagation()}>
                                        <MiniAppRenderer appUrl={miniAppData} postId={post.id} />
                                    </div>
                                )}

                                {/* Repost Content */}
                                {repostedPost && (
                                    <div 
                                        className="mt-3 p-3 border border-[var(--card-border)] rounded-xl bg-[var(--hover-bg)] cursor-pointer hover:bg-[var(--card-border)] transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/${repostedPost.creator}/status/${repostedPost.id}`);
                                        }}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                        <div className="w-6 h-6 rounded-full bg-[var(--card-border)] overflow-hidden">
                                            <div className="w-full h-full flex items-center justify-center font-bold text-xs text-[var(--text-primary)]">
                                                {repostedPost.creator ? repostedPost.creator[0].toUpperCase() : '?'}
                                            </div>
                                        </div>
                                        <span className="font-bold text-sm text-[var(--text-primary)]">
                                            @{repostedPost.creator ? repostedPost.creator.slice(0, 6) : 'unknown'}...
                                        </span>
                                        <span className="text-[var(--text-secondary)] text-xs">
                                            · {formatPostTime(repostedPost.timestamp * 1000, false)}
                                        </span>
                                    </div>
                                        <div className="text-sm text-[var(--text-primary)] whitespace-pre-wrap line-clamp-3">
                                            {repostedPost.content.replace(/\[ref:[a-f0-9\-]+\]/g, '').trim()}
                                        </div>
                                        {repostedPost.image_url && (
                                            <div className="mt-2 rounded-lg overflow-hidden h-24 w-full">
                                                <img src={repostedPost.image_url} alt="Reposted content" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {/* Media Grid */}
                                {media.length > 0 ? (
                                    <div className={`mt-3 grid gap-1 rounded-xl overflow-hidden border border-[var(--card-border)] ${
                                        media.length === 1 ? 'grid-cols-1' : 
                                        media.length === 2 ? 'grid-cols-2' : 
                                        'grid-cols-2'
                                    }`}>
                                        {media.map((item, index) => {
                                            const isSingleAudio = media.length === 1 && item.type === 'audio';
                                            return (
                                            <div 
                                                key={item.id}
                                                className={`relative cursor-pointer hover:opacity-95 transition-opacity ${
                                                    media.length === 3 && index === 0 ? 'row-span-2' : ''
                                                } ${
                                                    media.length > 4 && index === 3 ? 'opacity-50' : ''
                                                } ${media.length > 1 ? 'aspect-square' : isSingleAudio ? 'h-auto' : 'h-[210px]'}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (item.type !== 'audio') {
                                                        setSelectedMediaIndex(index);
                                                        setIsImageOpen(true);
                                                    }
                                                }}
                                            >
                                                {item.type === 'video' ? (
                                                    <video src={item.url} controls className="w-full h-full object-cover" />
                                                ) : item.type === 'audio' ? (
                                                    <div className="w-full h-full flex items-center justify-center bg-[var(--bg-secondary)] px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                                        <AudioPlayer src={item.url} className="w-full" />
                                                    </div>
                                                ) : (
                                                    <img src={item.url} alt="Post content" className="w-full h-full object-cover" />
                                                )}
                                                
                                                {/* Overlay for +N images if more than 4 */}
                                                {media.length > 4 && index === 3 && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-bold text-xl">
                                                        +{media.length - 4}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                        }).slice(0, 4)}
                                    </div>
                                ) : localPost.image_url ? (
                                    <div 
                                        className="mt-3 rounded-xl overflow-hidden border border-[var(--card-border)] cursor-pointer hover:opacity-95 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedMediaIndex(0);
                                            setIsImageOpen(true);
                                        }}
                                    >
                                        <img src={localPost.image_url} alt="Post content" className="w-full h-auto max-h-[210px] object-cover" />
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {/* Post Stats Footer */}
                        {!compact && (
                        <div className="flex items-center gap-1 mt-3 text-[var(--text-secondary)] text-[15px] leading-5 border-b border-[var(--card-border)] pb-3" onClick={(e) => e.stopPropagation()}>
                            <span className="hover:underline cursor-pointer">{formatPostStatsDate(localPost.createdAt)}</span>
                            <span>·</span>
                            <span className="font-bold text-[var(--text-primary)]">{viewCount}</span>
                            <span>Views</span>
                        </div>
                        )}

                        {/* Action Bar */}
                        {!compact && (
                        <div className="flex items-center justify-between w-full max-w-[550px] mt-2" onClick={(e) => e.stopPropagation()}>
                            {/* Reply Button */}
                            <div className="flex-1 flex justify-center">
                                <button 
                                    onClick={() => setShowReplyForm(!showReplyForm)}
                                    className="group flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-sky-500 transition-all active:scale-90"
                                    title={t.replyButton}
                                >
                                    <div className="p-2 rounded-full group-hover:bg-sky-500/10 transition-all group-hover:scale-110">
                                        <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                        </svg>
                                    </div>
                                    {commentCount > 0 && (
                                        <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-sky-500">
                                            {commentCount}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Repost Button */}
                            <div className="relative flex-1 flex justify-center">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowRepostOptions(!showRepostOptions);
                                    }}
                                    className="group flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-green-500 transition-all active:scale-90"
                                    title={t.repostButton}
                                >
                                    <div className="p-2 rounded-full group-hover:bg-green-500/10 transition-all group-hover:scale-110">
                                        <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                            <path d="M17 1l4 4-4 4" />
                                            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                            <path d="M7 23l-4-4 4-4" />
                                            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                                        </svg>
                                    </div>
                                </button>
                                
                                {showRepostOptions && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl shadow-xl z-50 overflow-hidden animate-fadeIn">
                                        <button 
                                            onClick={handleSimpleRepost}
                                            disabled={isReposting}
                                            className="w-full text-left px-4 py-3 hover:bg-[var(--hover-bg)] flex items-center gap-3 transition-colors text-[var(--text-primary)] font-medium text-sm"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                                            </svg>
                                            {isReposting ? "Reposting..." : t.repostButton}
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowRepostOptions(false);
                                                setShowRepostForm(true);
                                            }}
                                            className="w-full text-left px-4 py-3 hover:bg-[var(--hover-bg)] flex items-center gap-3 transition-colors text-[var(--text-primary)] font-medium text-sm"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                            </svg>
                                            {t.quoteRepost || "Quote Repost"}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Tip Button */}
                            <div className="flex-1 flex justify-center items-center h-full">
                                {isOwner ? (
                                    <div className="flex items-center gap-1 text-[var(--text-secondary)] opacity-50 cursor-not-allowed" title={t.cannotTipOwn}>
                                        <div className="p-2">
                                            <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <span 
                                            className="text-xs font-medium cursor-pointer hover:underline hover:text-[var(--accent)]"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowTipStats(true);
                                            }}
                                        >
                                            {typeof localTotalTips === 'number' 
                                                ? localTotalTips.toFixed(1) 
                                                : parseFloat(localTotalTips as string).toFixed(1)} MOVE
                                        </span>
                                    </div>
                                ) : showTipInput ? (
                                    <div className="flex items-center gap-1 animate-fadeIn bg-[var(--card-bg)] border border-[var(--accent)] rounded-full px-1 py-0.5 shadow-lg z-20 relative">
                                        <input
                                            type="number"
                                            value={tipAmount}
                                            onChange={(e) => setTipAmount(e.target.value)}
                                            className="w-12 bg-transparent border-none px-1 py-0.5 text-xs font-bold text-[var(--text-primary)] focus:ring-0 focus:outline-none text-center appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            min="0.1"
                                            step="0.1"
                                            placeholder="0.0"
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <button
                                            onClick={handleTip}
                                            disabled={tipping}
                                            className="px-2 py-0.5 bg-[var(--accent)] text-[var(--btn-text-primary)] text-[10px] font-bold rounded-full hover:opacity-90 disabled:opacity-50 transition-all shadow-sm whitespace-nowrap"
                                        >
                                            {tipping ? '...' : t.tip}
                                        </button>
                                        <button
                                            onClick={() => setShowTipInput(false)}
                                            className="p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] rounded-full transition-colors"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => !tipping && setShowTipInput(true)}
                                            disabled={tipping}
                                            className={`group flex items-center gap-1 transition-all active:scale-90 ${tipping ? 'text-yellow-500' : 'text-[var(--text-secondary)] hover:text-yellow-400'}`}
                                            title={t.tip}
                                        >
                                            <div className="p-2 rounded-full group-hover:bg-yellow-400/10 transition-all group-hover:scale-110">
                                                {tipping ? (
                                                    <svg className="animate-spin h-[20px] w-[20px]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                ) : (
                                                    <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                )}
                                            </div>
                                        </button>
                                        <span 
                                            className={`text-xs font-medium cursor-pointer hover:underline ${tipping ? 'text-yellow-500' : 'text-[var(--text-secondary)] hover:text-yellow-400'}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowTipStats(true);
                                            }}
                                            title="View Tip Stats"
                                        >
                                            {typeof localTotalTips === 'number' 
                                                ? localTotalTips.toFixed(1) 
                                                : parseFloat(localTotalTips as string).toFixed(1)} MOVE
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Like Button */}
                            <div className="flex-1 flex justify-center">
                                <button
                                    onClick={(e) => handleVote(e, 'up')}
                                    disabled={voting}
                                    className={`group flex items-center gap-1.5 transition-colors ${userVote === 'up' ? 'text-pink-600' : 'text-[var(--text-secondary)] hover:text-pink-600'}`}
                                    title="Like"
                                >
                                    <div className="p-2 rounded-full group-hover:bg-pink-600/10 transition-all group-hover:scale-110">
                                        {userVote === 'up' ? (
                                            <svg className="w-[20px] h-[20px] fill-current" viewBox="0 0 24 24">
                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                            </svg>
                                        )}
                                    </div>
                                    {(votes.up > 0 || userVote === 'up') && (
                                        <span className={`text-xs font-medium ${userVote === 'up' ? 'text-pink-600' : 'text-[var(--text-secondary)]'}`}>
                                            {votes.up || (userVote === 'up' ? 1 : 0)}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Bookmark Button */}
                            <div className="flex-1 flex justify-center">
                                <button
                                    onClick={handleBookmark}
                                    disabled={bookmarking}
                                    className={`group flex items-center gap-1 transition-colors ${isBookmarked ? 'text-blue-500' : 'text-[var(--text-secondary)] hover:text-blue-500'}`}
                                    title={t.bookmark}
                                >
                                    <div className="p-2 rounded-full group-hover:bg-blue-500/10 transition-all group-hover:scale-110">
                                        {isBookmarked ? (
                                            <svg className="w-[20px] h-[20px] fill-current" viewBox="0 0 24 24">
                                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                            </svg>
                                        )}
                                    </div>
                                </button>
                            </div>

                            {/* Share Button */}
                            <div className="flex-1 flex justify-center">
                                <button 
                                    className={`group flex items-center gap-1 transition-all active:scale-90 ${isCopied ? 'text-green-500' : 'text-[var(--text-secondary)] hover:text-blue-500'}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const url = `${window.location.origin}/post/${post.id}`;
                                        navigator.clipboard.writeText(url).then(() => {
                                            setIsCopied(true);
                                            addNotification("Link copied", "success", { persist: false, duration: 1500 });
                                            setTimeout(() => setIsCopied(false), 2000);
                                        }).catch(() => {
                                            addNotification("Failed to copy", "error", { persist: false });
                                        });
                                    }}
                                    title="Copy link"
                                >
                                    <div className={`p-2 rounded-full transition-colors ${isCopied ? 'bg-green-500/10' : 'group-hover:bg-blue-500/10'}`}>
                                        {isCopied ? (
                                            <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                <path d="M20 6L9 17l-5-5" />
                                            </svg>
                                        ) : (
                                            <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                                <polyline points="16 6 12 2 8 6" />
                                                <line x1="12" y1="2" x2="12" y2="15" />
                                            </svg>
                                        )}
                                    </div>
                                </button>
                            </div>
                        </div>
                        )}

                        {/* Comments Preview (Max previewCount) */}
                        {comments.length > 0 && (
                            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                {comments.slice(0, previewCount).map((comment) => (
                                    <div key={comment.id} className="relative mt-2">
                                        <div className="absolute left-[-32px] top-[-10px] bottom-0 w-[2px] bg-[var(--card-border)] rounded-full"></div>
                                        <PostCard
                                            post={{
                                                id: comment.id.toString(),
                                                creatorAddress: comment.creator,
                                                creatorHandle: undefined,
                                                creatorAvatar: undefined,
                                                content: comment.content,
                                                image_url: comment.image_url,
                                                style: comment.style,
                                                totalTips: octasToMove(comment.total_tips),
                                                createdAt: comment.timestamp * 1000,
                                                updatedAt: comment.updated_at,
                                                commentCount: 0 // We don't need to show comment count for previewed comments usually
                                            }}
                                            isOwner={account?.address?.toString() === comment.creator}
                                            hideComments={true}
                                            compact={true}
                                            showTipButton={true}
                                        />
                                    </div>
                                ))}
                                {comments.length > previewCount && (
                                    <button 
                                        className="text-[13px] text-[var(--accent)] hover:underline w-full text-left mt-2"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/${post.creatorAddress}/status/${post.id}`);
                                        }}
                                    >
                                        {t.viewAllComments} ({comments.length})
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Inline Reply Form */}
                        {showReplyForm && (
                            <div className="mt-4 border-t border-[var(--card-border)] pt-4" onClick={(e) => e.stopPropagation()}>
                                <CreatePostForm 
                                    parentId={parseInt(post.id)}
                                    parentAuthorAddress={post.creatorAddress} 
                                    onPostCreated={() => {
                                        setShowReplyForm(false);
                                        window.dispatchEvent(new Event('comment_added'));
                                        window.dispatchEvent(new Event('tip_sent')); // Trigger global refresh
                                    }} 
                                />
                            </div>
                        )}

                        {/* Inline Repost Form */}
                        {showRepostForm && (
                            <div className="mt-4 border-t border-[var(--card-border)] pt-4" onClick={(e) => e.stopPropagation()}>
                                <h3 className="text-sm font-bold text-[var(--text-secondary)] mb-2">Repost this post</h3>
                                <CreatePostForm 
                                    repostOf={{
                                        id: parseInt(post.id),
                                        global_id: post.global_id,
                                        creator: post.creatorAddress,
                                        content: post.content,
                                        image_url: post.image_url || '',
                                        style: typeof post.style === 'string' ? parseInt(post.style) : post.style,
                                        total_tips: typeof post.totalTips === 'string' ? parseFloat(post.totalTips) : post.totalTips,
                                        timestamp: post.createdAt,
                                        is_deleted: false,
                                        updated_at: post.updatedAt || post.createdAt,
                                        last_tip_timestamp: 0,
                                        parent_id: 0,
                                        is_comment: false
                                    }}
                                    onPostCreated={() => {
                                        setShowRepostForm(false);
                                        window.dispatchEvent(new Event('post_created'));
                                    }} 
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tip Stats Modal */}
            <TipStatsModal
                isOpen={showTipStats}
                onClose={() => setShowTipStats(false)}
                userAddress={post.creatorAddress}
                displayName={displayName || post.creatorHandle || formatMovementAddress(post.creatorAddress)}
            />

            {/* Image Viewer Modal */}
            {isImageOpen && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 cursor-zoom-out animate-fadeIn"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsImageOpen(false);
                    }}
                >
                    <button 
                        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 z-[101]"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsImageOpen(false);
                        }}
                    >
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    
                    {/* Previous Button */}
                    {media.length > 1 && (
                        <button
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 z-[101]"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMediaIndex(prev => (prev - 1 + media.length) % media.length);
                            }}
                        >
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    )}

                    {/* Next Button */}
                    {media.length > 1 && (
                        <button
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 z-[101]"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMediaIndex(prev => (prev + 1) % media.length);
                            }}
                        >
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    )}

                    <div 
                        className="relative max-w-full max-h-full flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {media.length > 0 ? (
                            media[selectedMediaIndex].type === 'video' ? (
                                <video 
                                    src={media[selectedMediaIndex].url} 
                                    controls 
                                    autoPlay 
                                    className="max-w-screen max-h-screen object-contain rounded-sm shadow-2xl" 
                                />
                            ) : (
                                <img 
                                    src={media[selectedMediaIndex].url} 
                                    alt="Full size" 
                                    className="max-w-screen max-h-screen object-contain rounded-sm shadow-2xl"
                                />
                            )
                        ) : post.image_url ? (
                            <img 
                                src={post.image_url} 
                                alt="Full size" 
                                className="max-w-screen max-h-screen object-contain rounded-sm shadow-2xl"
                            />
                        ) : null}
                    </div>
                </div>
            )}
        </>
    );
}
