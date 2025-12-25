import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Hex } from "@aptos-labs/ts-sdk";
import Link from 'next/link';
import { formatMovementAddress, octasToMove, convertToMovementAddress } from '@/lib/movement';
import { getDisplayName, setDisplayName, getUserTipStats, getAvatar, setAvatar, setProfile, getUserPostsPaginated, getUserPostsCount, OnChainPost, getGlobalPostsCount, getGlobalPosts } from '@/lib/microThreadsClient';
import { getTipHistory, getStats, getUserBadges } from '@/lib/movementClient';
import TipHistory from '@/components/TipHistory';
import PostCard from '@/components/PostCard';
import Head from 'next/head';
import UserListModal from '@/components/UserListModal';
import { CreatePostForm } from '@/components/CreatePostForm';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNetwork } from '@/contexts/NetworkContext';
import { useNotifications } from '@/components/Notifications';
import { sendSocialNotification } from '@/contexts/SocialActivityContext';

export default function CreatorPage() {
    const router = useRouter();
    const { handle } = router.query;
    const { t } = useLanguage();
    const { currentNetwork } = useNetwork();
    const { addNotification } = useNotifications();
    const { account, signAndSubmitTransaction, signMessage } = useWallet();

    const address = handle as string;
    
    // Normalize addresses for consistent comparison (EVM vs Move formats)
    const normalizedAddress = convertToMovementAddress(address);
    const normalizedAccountAddress = convertToMovementAddress(account?.address.toString() || "");
    
    // Check ownership using normalized addresses
    const isOwner = normalizedAccountAddress === normalizedAddress && normalizedAddress !== "";
    
    const currentUserAddress = account?.address.toString() || "";

    // Profile Data
    const [displayName, setDisplayNameState] = useState<string>('');
    const [avatarUrl, setAvatarUrl] = useState<string>('');
    const [bio, setBio] = useState('');
    const [website, setWebsite] = useState('');
    const [location, setLocation] = useState('');
    const [bannerUrl, setBannerUrl] = useState('');
    
    const [tips, setTips] = useState<any[]>([]);
    const [userBadges, setUserBadges] = useState<any[]>([]);
    const [userStats, setUserStats] = useState({ totalSent: 0, totalReceived: 0, tipsSentCount: 0 });
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    
    // Edit State
    const [editName, setEditName] = useState('');
    const [editAvatar, setEditAvatar] = useState('');
    const [editBio, setEditBio] = useState('');
    const [editWebsite, setEditWebsite] = useState('');
    const [editLocation, setEditLocation] = useState('');
    const [editBanner, setEditBanner] = useState('');
    const [usernameError, setUsernameError] = useState<string | null>(null);
    
    // Privacy & Joined Date
    const [joinedDate, setJoinedDate] = useState<string | null>(null);
    const [joinedDateVisibility, setJoinedDateVisibility] = useState<'public' | 'followers' | 'me'>('public');
    const [editJoinedDateVisibility, setEditJoinedDateVisibility] = useState<'public' | 'followers' | 'me'>('public');

    const [saving, setSaving] = useState(false);
    const [userPosts, setUserPosts] = useState<OnChainPost[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [commentCounts, setCommentCounts] = useState<Record<number, number>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    // Search State
    const [showProfileSearch, setShowProfileSearch] = useState(false);
    const [profileSearchQuery, setProfileSearchQuery] = useState('');

    // UI State
    const [activeTab, setActiveTab] = useState<'posts' | 'received' | 'sent'>('posts');
    const [isFollowing, setIsFollowing] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [showFollowers, setShowFollowers] = useState(false);
    const [showFollowing, setShowFollowing] = useState(false);
    const [followersList, setFollowersList] = useState<string[]>([]);
    const [followingList, setFollowingList] = useState<string[]>([]);
    const [isNotified, setIsNotified] = useState(false);
    const [showMoreOptions, setShowMoreOptions] = useState(false);



    const handleShowFollowers = async () => {
        if (followersCount === 0) return;
        setShowFollowers(true);
        try {
            const res = await fetch(`/api/follow?targetAddress=${address}&includeLists=true`);
            const data = await res.json();
            setFollowersList(data.followers || []);
        } catch(e) { console.error(e); }
    };

    const handleShowFollowing = async () => {
        if (followingCount === 0) return;
        setShowFollowing(true);
        try {
            const res = await fetch(`/api/follow?targetAddress=${address}&includeLists=true`);
            const data = await res.json();
            setFollowingList(data.following || []);
        } catch(e) { console.error(e); }
    };

    useEffect(() => {
        if (address) {
            const stored = localStorage.getItem('notifications_list');
            if (stored) {
                const list = JSON.parse(stored);
                setIsNotified(list.includes(address));
            }
        }
    }, [address]);

    const handleToggleNotify = () => {
        const stored = localStorage.getItem('notifications_list');
        let list: string[] = stored ? JSON.parse(stored) : [];
        
        if (isNotified) {
            list = list.filter(a => a !== address);
            addNotification("Notifications turned off for this user", "success");
        } else {
            if (!list.includes(address)) list.push(address);
            addNotification("Notifications turned on for this user", "success");
        }
        
        localStorage.setItem('notifications_list', JSON.stringify(list));
        setIsNotified(!isNotified);
    };

    const handleMessage = () => {
        router.push(`/chat?user=${address}`);
    };

    // Global Data for Right Sidebar
    const [globalPosts, setGlobalPosts] = useState<OnChainPost[]>([]);
    const [globalStats, setGlobalStats] = useState({ totalTips: 0, totalVolume: 0, topTipper: "" });
    const [profiles, setProfiles] = useState<Record<string, any>>({});

    useEffect(() => {
        if (address && address !== 'undefined') {
            const fetchData = async () => {
                try {
                    const name = await getDisplayName(address);
                    if (name) setDisplayNameState(name);

                    const avatar = await getAvatar(address);
                    if (avatar) setAvatarUrl(avatar);
                    
                    // Fetch extended profile from Supabase
                    try {
                        const res = await fetch(`/api/profile?address=${address}`);
                        if (res.ok) {
                            const data = await res.json();
                            setBio(data.bio || '');
                            setWebsite(data.website || '');
                            setLocation(data.location || '');
                            setBannerUrl(data.banner_url || '');
                            setJoinedDate(data.created_at || null);
                            setJoinedDateVisibility(data.joined_date_visibility || 'public');
                        }
                    } catch (e) {
                        console.error("Error fetching extended profile:", e);
                    }

                    const userTips = await getTipHistory(address);
                    setTips(userTips);

                    // Fetch User Badges
                    try {
                        const badges = await getUserBadges(address);
                        if (badges && badges.length > 0) setUserBadges(badges);
                    } catch (e) { console.error("Error fetching badges:", e); }

                    const stats = await getUserTipStats(address);
                    setUserStats(stats);

                    // Fetch user posts
                    setLoadingPosts(true);
                    try {
                        const LIMIT = 5; // Reduced for testing
                        // Fetch newest posts (start at 0)
                        const posts = await getUserPostsPaginated(address, 0, LIMIT);
                        // Sort by timestamp desc (redundant as client already sorts by ID desc, but safe)
                        posts.sort((a, b) => b.timestamp - a.timestamp);
                        setUserPosts(posts);
                    } catch (err) {
                        console.error("Error fetching user posts:", err);
                        setUserPosts([]);
                    }
                    setLoadingPosts(false);

                    // Fetch global data for sidebar (paginated)
                    const [gStats, globalCount] = await Promise.all([
                        getStats(),
                        getGlobalPostsCount()
                    ]);
                    setGlobalStats(gStats);

                    const LIMIT = 50;
                    // getGlobalPosts takes page index, not item offset. Page 0 = newest posts.
                    const allPosts = await getGlobalPosts(0, LIMIT);
                    setGlobalPosts(allPosts);

                    // Calculate comment counts (based on recent posts)
                    const counts: Record<number, number> = {};
                    allPosts.forEach(post => {
                        if (post.is_comment && post.parent_id) {
                            counts[post.parent_id] = (counts[post.parent_id] || 0) + 1;
                        }
                    });
                    setCommentCounts(counts);

                    // Load profiles for sidebar suggestions
                    const uniqueCreators = [...new Set(allPosts.map(p => p.creator))].slice(0, 5);
                    const profileMap: Record<string, any> = {};

                    await Promise.all(uniqueCreators.map(async (creator) => {
                        try {
                            const dName = await getDisplayName(creator);
                            const dAvatar = await getAvatar(creator);
                            if (dName || dAvatar) {
                                profileMap[creator] = { displayName: dName, avatar: dAvatar };
                            }
                        } catch (e) { console.error(e); }
                    }));
                    setProfiles(profileMap);

                    // Check Follow Status (API)
                    if (currentUserAddress) {
                        try {
                            const res = await fetch(`/api/follow?userAddress=${currentUserAddress}&targetAddress=${address}`);
                            const data = await res.json();
                            setIsFollowing(data.isFollowing);
                            setFollowersCount(data.followersCount);
                            setFollowingCount(data.followingCount);
                        } catch (e) {
                            console.error("Error fetching follow status:", e);
                        }
                    } else {
                        // Just fetch counts if not logged in
                        try {
                            const res = await fetch(`/api/follow?targetAddress=${address}`);
                            const data = await res.json();
                            setFollowersCount(data.followersCount);
                            setFollowingCount(data.followingCount);
                        } catch (e) {
                            console.error("Error fetching follow counts:", e);
                        }
                    }

                } catch (e) {
                    console.error("Error fetching data", e);
                } finally {
                    setLoading(false);
                }
            };
            fetchData();

            const handleTipSent = () => fetchData();
            window.addEventListener('tip_sent', handleTipSent);
            window.addEventListener('comment_added', handleTipSent);

            return () => {
                window.removeEventListener('tip_sent', handleTipSent);
                window.removeEventListener('comment_added', handleTipSent);
            };
        }
    }, [address, currentUserAddress]);

    useEffect(() => {
        const checkAvailability = async () => {
            if (!editName || editName.trim() === displayName) {
                setUsernameError(null);
                return;
            }
            
            try {
                const res = await fetch(`/api/check-username?username=${encodeURIComponent(editName.trim())}&currentAddress=${address}`);
                const data = await res.json();
                if (data.isTaken) {
                    setUsernameError(t.usernameTaken || "Username is already taken");
                } else {
                    setUsernameError(null);
                }
            } catch (e) {
                console.error(e);
            }
        };

        const timeoutId = setTimeout(checkAvailability, 500);
        return () => clearTimeout(timeoutId);
    }, [editName, displayName, address, t]);

    useEffect(() => {
        if (displayName) setEditName(displayName);
        if (avatarUrl) setEditAvatar(avatarUrl);
        setEditBio(bio);
        setEditWebsite(website);
        setEditLocation(location);
        setEditBanner(bannerUrl);
        setEditJoinedDateVisibility(joinedDateVisibility);
    }, [displayName, avatarUrl, bio, website, location, bannerUrl, joinedDateVisibility]);

    const handleSaveProfile = async () => {
        try {
            setSaving(true);

            // Update on-chain data if changed
            const nameChanged = editName.trim() && editName !== displayName;
            const avatarChanged = editAvatar.trim() !== avatarUrl;
            const bioChanged = editBio.trim() !== bio;
            const websiteChanged = editWebsite.trim() !== website;
            const locationChanged = editLocation.trim() !== location;
            const bannerChanged = editBanner.trim() !== bannerUrl;
            const visibilityChanged = editJoinedDateVisibility !== joinedDateVisibility;

            if (!nameChanged && !avatarChanged && !bioChanged && !websiteChanged && !locationChanged && !bannerChanged && !visibilityChanged) {
                setIsEditing(false);
                setSaving(false);
                return;
            }

            if (nameChanged || avatarChanged || bioChanged) {
                await setProfile(editName, editBio, editAvatar, signAndSubmitTransaction);
                if (nameChanged) setDisplayNameState(editName);
                if (avatarChanged) setAvatarUrl(editAvatar);
                if (bioChanged) setBio(editBio);
            }

            // Update extended profile in Supabase
            try {
                // Sign message for authentication
                const timestamp = Date.now();
                const messageToSign = `Update profile for ${address} at ${timestamp}`;
                
                let signature, fullMessage;
                try {
                    const response = await signMessage({
                        message: messageToSign,
                        nonce: timestamp.toString()
                    });
                    
                    // Ensure signature is a hex string
                    if (typeof response.signature === 'string') {
                        signature = response.signature;
                    } else if (Array.isArray(response.signature) || response.signature instanceof Uint8Array) {
                        // Manual conversion for array/Uint8Array to hex string
                        // @ts-ignore
                        signature = Array.from(response.signature)
                            .map((b: any) => b.toString(16).padStart(2, '0'))
                            .join('');
                    } else if (typeof response.signature === 'object' && response.signature !== null) {
                        // Handle object case (e.g. { data: Uint8Array } or Ed25519Signature object)
                        const sigObj = response.signature as any;
                        if (sigObj.data && (Array.isArray(sigObj.data) || sigObj.data instanceof Uint8Array)) {
                             signature = Array.from(sigObj.data)
                                .map((b: any) => b.toString(16).padStart(2, '0'))
                                .join('');
                        } else {
                             // Try toString as fallback
                             signature = sigObj.toString();
                             // console.warn("Signature object handled via toString:", signature);
                        }
                    } else {
                         // Fallback
                         console.error("Unknown signature format:", response.signature);
                         signature = String(response.signature);
                    }
                    
                    // Clean signature (remove 0x prefix if present) just in case
                    if (signature.startsWith('0x')) {
                        signature = signature.slice(2);
                    }
                    
                    fullMessage = response.fullMessage;
                } catch (err) {
                    console.error("User rejected signature", err);
                    setSaving(false);
                    return;
                }

                const res = await fetch('/api/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wallet_address: address,
                        display_name: editName,
                        bio: editBio,
                        website: editWebsite,
                        location: editLocation,
                        banner_url: editBanner,
                        joined_date_visibility: editJoinedDateVisibility,
                        signature,
                        message: fullMessage,
                        publicKey: account?.publicKey?.toString()
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    setBio(data.bio);
                    setWebsite(data.website);
                    setLocation(data.location);
                    setBannerUrl(data.banner_url);
                    // Use local state if DB doesn't return it (graceful degradation for missing columns)
                    setJoinedDateVisibility(data.joined_date_visibility || editJoinedDateVisibility);
                } else {
                    const err = await res.json();
                    console.error("Failed to update extended profile:", err);
                    addNotification(`Error: ${err.error}`, 'error');
                }
            } catch (e) {
                console.error("Error saving to Supabase:", e);
                // Don't show error to user for background sync issues unless critical
            }

            setIsEditing(false);
            addNotification(t.profileUpdated, 'success');
        } catch (error) {
            console.error('Failed to update profile:', error);
            addNotification(t.profileUpdateError, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleFollow = async () => {
        if (!currentUserAddress) return;

        try {
            // Simplified follow (no signature required)
            const res = await fetch('/api/follow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userAddress: currentUserAddress,
                    targetAddress: address
                })
            });

            if (res.ok) {
                const data = await res.json();
                setIsFollowing(data.isFollowing);
                setFollowersCount(data.followersCount);
                setFollowingCount(data.followingCount);

                // Notify user if followed
                if (data.isFollowing) {
                    sendSocialNotification(address, {
                        type: 'follow',
                        actorAddress: currentUserAddress,
                        content: 'started following you'
                    });
                }
            } else {
                console.error("Follow failed", await res.text());
            }
        } catch (e) {
            console.error("Error toggling follow:", e);
        }
    };

    const handleInteraction = async (action: 'unfollow' | 'mute' | 'block') => {
        if (!currentUserAddress) {
            addNotification(t.connectWallet, "error");
            return;
        }

        if (action === 'unfollow') {
            await handleFollow();
            setShowMoreOptions(false);
            return;
        }

        try {
            const res = await fetch('/api/interactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userAddress: currentUserAddress,
                    targetAddress: address,
                    type: action
                })
            });

            if (res.ok) {
                addNotification(t.success || "Success", "success");
                if (action === 'block') {
                    // Redirect to feed if blocked
                    window.location.href = '/feed';
                }
            } else {
                throw new Error("Action failed");
            }
        } catch (e) {
            console.error("Interaction error:", e);
            addNotification(t.error || "Action failed", "error");
        }
        setShowMoreOptions(false);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            addNotification(t.imageTooLarge5MB, "error");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Resize to max 400x400 for avatar
                const maxSize = 400;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxSize) {
                        height *= maxSize / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width *= maxSize / height;
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx?.drawImage(img, 0, 0, width, height);

                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                setEditAvatar(compressedBase64);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            addNotification(t.imageTooLarge5MB, "error");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Resize to max 1500x500 for banner (approx 3:1 ratio)
                const maxWidth = 1500;
                const maxHeight = 500;
                let width = img.width;
                let height = img.height;

                // Simple scaling logic to fit within box while maintaining aspect ratio
                // Actually for banner we might want to cover, but let's just limit max dimensions
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx?.drawImage(img, 0, 0, width, height);

                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                setEditBanner(compressedBase64);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    // Filter posts for profile search (Legacy in-memory fallback, though we use router now)
    const displayedPosts = userPosts;


    if (loading) {
        return (
            <>
                <Head>
                    <title>Loading... - MoveFeed</title>
                </Head>

                <main className="container-custom py-6 md:py-10">
                    <div className="max-w-[1280px] mx-auto">
                        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 xl:divide-x xl:divide-[var(--card-border)]">

                            {/* CENTER: Profile Info & Posts SKELETON */}
                            <div className="space-y-8 min-w-0 lg:px-6">
                                {/* Profile Header Card Skeleton */}
                                <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden relative h-[450px] animate-pulse">
                                    <div className="h-48 bg-[var(--card-border)] w-full"></div>
                                    <div className="absolute top-36 left-6 w-32 h-32 rounded-full bg-[var(--card-border)] border-4 border-[var(--card-bg)]"></div>
                                    <div className="mt-16 px-6 space-y-4">
                                        <div className="h-8 w-48 bg-[var(--card-border)] rounded"></div>
                                        <div className="h-4 w-32 bg-[var(--card-border)] rounded"></div>
                                        <div className="flex gap-4 pt-2">
                                            <div className="h-10 w-24 bg-[var(--card-border)] rounded-lg"></div>
                                            <div className="h-10 w-24 bg-[var(--card-border)] rounded-lg"></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Posts Skeleton */}
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="bg-[var(--card-bg)] border border-[var(--card-border)] p-4 rounded-xl animate-pulse h-48">
                                            <div className="flex gap-4">
                                                <div className="w-12 h-12 rounded-full bg-[var(--card-border)]"></div>
                                                <div className="flex-1 space-y-3">
                                                    <div className="h-4 w-1/3 bg-[var(--card-border)] rounded"></div>
                                                    <div className="h-16 w-full bg-[var(--card-border)] rounded"></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </>
        );
    }

    return (
        <>
            <Head>
                <title>{displayName || formatMovementAddress(address)} - MoveFeed</title>
            </Head>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 xl:divide-x xl:divide-[var(--card-border)]">
                {/* CENTER: Profile Info & Posts */}
                <div className="space-y-8 min-w-0 lg:px-6">
                    {/* Profile Header Card */}
                    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl relative">
                                {/* Cover Image */}
                                <div className="h-48 relative bg-gradient-to-r from-neutral-800 to-neutral-900 group rounded-t-2xl overflow-hidden">
                                    {(bannerUrl || editBanner) && (
                                        <img 
                                            src={isEditing ? editBanner : bannerUrl} 
                                            alt="Banner" 
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                    {isEditing && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => bannerInputRef.current?.click()}
                                                className="bg-black/50 p-2 rounded-full text-white hover:bg-black/70 transition-colors"
                                            >
                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        ref={bannerInputRef}
                                        onChange={handleBannerSelect}
                                        className="hidden"
                                        accept="image/*"
                                    />
                                </div>

                                <div className="px-8 pb-8">
                                    <div className="flex justify-between items-end -mt-16 mb-6">
                                        <div className="relative group">
                                            <div className="w-32 h-32 rounded-full bg-[var(--card-bg)] p-1">
                                                <div className="w-full h-full rounded-full bg-gradient-to-br from-[#FFEB3B] to-[#FFC107] flex items-center justify-center text-4xl font-bold text-black overflow-hidden border-4 border-[var(--card-bg)]">
                                                    {isEditing ? (
                                                        editAvatar ? (
                                                            <img src={editAvatar} alt="Avatar Preview" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-white">
                                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                            </div>
                                                        )
                                                    ) : avatarUrl ? (
                                                        <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span>{displayName ? displayName[0].toUpperCase() : "U"}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {isEditing && (
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                >
                                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                </button>
                                            )}
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleImageSelect}
                                                className="hidden"
                                                accept="image/*"
                                            />
                                        </div>

                                        <div className="flex gap-4">
                                            {!isOwner && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleFollow}
                                                        className={`px-6 py-2 rounded-full font-bold transition-all ${isFollowing
                                                            ? 'bg-transparent border border-[var(--card-border)] text-[var(--text-primary)] hover:border-red-500 hover:text-red-500'
                                                            : 'bg-[var(--text-primary)] text-[var(--card-bg)] hover:opacity-90'
                                                            }`}
                                                    >
                                                        {isFollowing ? t.followingBtn : t.follow}
                                                    </button>
                                                    
                                                    <button
                                                        onClick={handleMessage}
                                                        className="p-2 rounded-full border border-[var(--card-border)] text-[var(--text-primary)] hover:bg-[var(--card-border)] transition-colors"
                                                        title="Message"
                                                    >
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                        </svg>
                                                    </button>

                                                    <div className="relative">
                                                        <button
                                                            onClick={() => {
                                                                setShowProfileSearch(!showProfileSearch);
                                                                if (!showProfileSearch) setTimeout(() => document.getElementById('profile-search-input')?.focus(), 100);
                                                            }}
                                                            className={`p-2 rounded-full border transition-colors ${
                                                                showProfileSearch
                                                                ? 'bg-[var(--accent)] border-[var(--accent)] text-black'
                                                                : 'border-[var(--card-border)] text-[var(--text-primary)] hover:bg-[var(--card-border)]'
                                                            }`}
                                                            title="Search in Profile"
                                                        >
                                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                            </svg>
                                                        </button>
                                                        {showProfileSearch && (
                                                            <div className="absolute right-0 top-full mt-2 w-64 z-30">
                                                                <input
                                                                    id="profile-search-input"
                                                                    type="text"
                                                                    value={profileSearchQuery}
                                                                    onChange={(e) => setProfileSearchQuery(e.target.value)}
                                                                    placeholder="Search posts..."
                                                                    className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-4 py-2 text-[var(--text-primary)] shadow-xl focus:outline-none focus:border-[var(--accent)]"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={handleToggleNotify}
                                                        className={`p-2 rounded-full border transition-colors ${
                                                            isNotified 
                                                            ? 'bg-[var(--accent)] border-[var(--accent)] text-black' 
                                                            : 'border-[var(--card-border)] text-[var(--text-primary)] hover:bg-[var(--card-border)]'
                                                        }`}
                                                        title="Notifications"
                                                    >
                                                        {isNotified ? (
                                                             <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                                                 <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                                            </svg>
                                                        ) : (
                                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                                            </svg>
                                                        )}
                                                    </button>

                                                    <div className="relative">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setShowMoreOptions(!showMoreOptions);
                                                            }}
                                                            className="p-2 rounded-full border border-[var(--card-border)] text-[var(--text-primary)] hover:bg-[var(--card-border)] transition-colors"
                                                            title={t.moreOptions || "More"}
                                                        >
                                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                                                            </svg>
                                                        </button>

                                                        {showMoreOptions && (
                                                            <div className="absolute top-full right-0 mt-2 w-48 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl shadow-xl z-50 overflow-hidden animate-fadeIn">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleInteraction('unfollow'); }}
                                                                    className="w-full text-left px-4 py-3 hover:bg-[var(--hover-bg)] flex items-center gap-3 transition-colors text-[var(--text-primary)] font-medium text-sm"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.75 6.75l-3.5 3.5m0 0l3.5 3.5m-3.5-3.5h7.5M10.5 10.5H6.75m3.75 0h-3.75" /></svg>
                                                                    {t.unfollow}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleInteraction('mute'); }}
                                                                    className="w-full text-left px-4 py-3 hover:bg-[var(--hover-bg)] flex items-center gap-3 transition-colors text-[var(--text-primary)] font-medium text-sm"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" stroke="currentColor" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                                                                    {t.mute}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleInteraction('block'); }}
                                                                    className="w-full text-left px-4 py-3 hover:bg-[var(--hover-bg)] flex items-center gap-3 transition-colors text-red-500 font-medium text-sm"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                                                    {t.block}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {isOwner && (
                                                <div>
                                                    {isEditing ? (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setIsEditing(false)}
                                                                className="px-4 py-2 rounded-xl border border-[var(--card-border)] text-[var(--text-primary)] font-bold hover:bg-[var(--card-border)] transition-colors"
                                                                disabled={saving}
                                                            >
                                                                {t.cancel}
                                                            </button>
                                                            <button
                                                                onClick={handleSaveProfile}
                                                                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--btn-text-primary)] font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                                                disabled={saving}
                                                            >
                                                                {saving ? t.saving : t.saveProfile}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setIsEditing(true)}
                                                            className="px-4 py-2 rounded-xl border border-[var(--card-border)] text-[var(--text-primary)] font-bold hover:bg-[var(--card-border)] transition-colors"
                                                        >
                                                            {t.editProfile}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        {isEditing ? (
                                            <div>
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className={`text-3xl font-bold bg-[var(--input-bg)] border ${usernameError ? 'border-red-500' : 'border-[var(--input-border)]'} rounded-lg px-2 py-1 text-[var(--text-primary)] w-full max-w-md mb-1 focus:outline-none focus:border-[var(--accent)]`}
                                                    placeholder={t.displayNamePlaceholder}
                                                />
                                                {usernameError && (
                                                    <p className="text-red-500 text-sm mt-1">{usernameError}</p>
                                                )}
                                            </div>
                                        ) : (
                                            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">{displayName || "Anonymous User"}</h1>
                                        )}
                                        <div className="text-[var(--text-secondary)] font-mono flex items-center gap-2 mb-4">
                                            {formatMovementAddress(address)}
                                            <button
                                                onClick={() => navigator.clipboard.writeText(address)}
                                                className="hover:text-[var(--accent)] transition-colors"
                                                title={t.copyAddress}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        </div>

                                        {/* Extended Profile Info */}
                                        <div className="space-y-3 mb-6">
                                            {isEditing ? (
                                                <div className="space-y-3 max-w-lg">
                                                    <textarea
                                                        value={editBio}
                                                        onChange={(e) => setEditBio(e.target.value)}
                                                        className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                                                        placeholder={t.bioPlaceholder}
                                                        rows={3}
                                                    />
                                                    <div className="flex gap-4">
                                                        <input
                                                            type="text"
                                                            value={editLocation}
                                                            onChange={(e) => setEditLocation(e.target.value)}
                                                            className="flex-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                                                            placeholder={t.locationPlaceholder}
                                                        />
                                                        <input
                                                            type="text"
                                                            value={editWebsite}
                                                            onChange={(e) => setEditWebsite(e.target.value)}
                                                            className="flex-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                                                            placeholder={t.websitePlaceholder}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-sm text-[var(--text-secondary)]">Joined Date Visibility:</label>
                                                        <select
                                                            value={editJoinedDateVisibility}
                                                            onChange={(e) => setEditJoinedDateVisibility(e.target.value as any)}
                                                            className="bg-[var(--bg-secondary)] border border-[var(--input-border)] rounded-lg px-2 py-1 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                                                        >
                                                            <option value="public" className="bg-neutral-800 text-white">Everyone</option>
                                                            <option value="followers" className="bg-neutral-800 text-white">Followers</option>
                                                            <option value="me" className="bg-neutral-800 text-white">Only Me</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {bio && <p className="text-[var(--text-primary)] whitespace-pre-wrap">{bio}</p>}
                                                    <div className="flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
                                                        {location && (
                                                            <div className="flex items-center gap-1">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                </svg>
                                                                {location}
                                                            </div>
                                                        )}
                                                        {website && (
                                                            <a href={website.startsWith('http') ? website : `https://${website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-[var(--accent)] transition-colors">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                                </svg>
                                                                {website}
                                                            </a>
                                                        )}
                                                        {joinedDate && (
                                                            (joinedDateVisibility === 'public' || 
                                                            (joinedDateVisibility === 'followers' && isFollowing) ||
                                                            (joinedDateVisibility === 'me' && isOwner)) && (
                                                                <div className="flex items-center gap-1 text-[var(--text-secondary)]">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                    </svg>
                                                                    <span>Joined {new Date(joinedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Badges */}
                                        {userBadges.length > 0 && (
                                            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                                                {userBadges.map((badge) => (
                                                    <div 
                                                        key={badge.id} 
                                                        className="relative group w-10 h-10 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center border border-[var(--card-border)] cursor-help shrink-0"
                                                        title={badge.name}
                                                    >
                                                        {badge.image_url.startsWith('http') ? (
                                                            <img src={badge.image_url} alt={badge.name} className="w-full h-full rounded-full object-cover" />
                                                        ) : (
                                                            <span className="text-xl select-none">{badge.image_url}</span>
                                                        )}
                                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
                                                            {badge.name}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex gap-6 text-[var(--text-secondary)]">
                                            <div 
                                                className="flex gap-1 cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                                                onClick={handleShowFollowing}
                                            >
                                                <span className="font-bold text-[var(--text-primary)]">{followingCount}</span>
                                                <span>{t.following}</span>
                                            </div>
                                            <div 
                                                className="flex gap-1 cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                                                onClick={handleShowFollowers}
                                            >
                                                <span className="font-bold text-[var(--text-primary)]">{followersCount}</span>
                                                <span>{t.followers}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats Row */}
                                    <div className="flex gap-8 border-t border-[var(--card-border)] pt-6">
                                        <div>
                                            <span className="font-bold text-[var(--text-primary)] text-xl">{userPosts.length}</span>
                                            <span className="text-[var(--text-secondary)] ml-2">{t.posts}</span>
                                        </div>
                                        <div>
                                            <span className="font-bold text-[var(--text-primary)] text-xl">{octasToMove(userStats.totalReceived).toFixed(2)} MOVE</span>
                                            <span className="text-[var(--text-secondary)] ml-2">{t.moveReceived}</span>
                                        </div>
                                        <div>
                                            <span className="font-bold text-[var(--text-primary)] text-xl">{octasToMove(userStats.totalSent).toFixed(2)} MOVE</span>
                                            <span className="text-[var(--text-secondary)] ml-2">{t.moveSent}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Content Tabs */}
                            <div className="border-b border-[var(--card-border)] flex gap-8 px-4">
                                <button
                                    onClick={() => setActiveTab('posts')}
                                    className={`py-4 border-b-2 font-bold transition-colors ${activeTab === 'posts'
                                        ? 'border-[var(--accent)] text-[var(--text-primary)]'
                                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                        }`}
                                >
                                    {t.posts}
                                </button>
                                <button
                                    onClick={() => setActiveTab('received')}
                                    className={`py-4 border-b-2 font-bold transition-colors ${activeTab === 'received'
                                        ? 'border-[var(--accent)] text-[var(--text-primary)]'
                                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                        }`}
                                >
                                    {t.tipsReceived}
                                </button>
                                <button
                                    onClick={() => setActiveTab('sent')}
                                    className={`py-4 border-b-2 font-bold transition-colors ${activeTab === 'sent'
                                        ? 'border-[var(--accent)] text-[var(--text-primary)]'
                                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                        }`}
                                >
                                    {t.tipsSent}
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="min-w-0">
                                {activeTab === 'posts' && (
                                    <>
                                        {loadingPosts ? (
                                            <div className="space-y-4">
                                                {[1, 2].map(i => (
                                                    <div key={i} className="bg-[var(--card-bg)] border-b border-[var(--card-border)] p-4 animate-pulse h-32"></div>
                                                ))}
                                            </div>
                                        ) : displayedPosts.length > 0 ? (
                                            <div className="border-t border-[var(--card-border)]">
                                                {displayedPosts.map(post => (
                                                    <PostCard
                                                        key={post.id}
                                                        post={{
                                                            id: post.id.toString(),
                                                            creatorAddress: post.creator,
                                                            creatorHandle: displayName,
                                                            creatorAvatar: avatarUrl,
                                                            content: post.content,
                                                            image_url: post.image_url,
                                                            style: post.style,
                                                            totalTips: octasToMove(post.total_tips),
                                                            createdAt: post.timestamp * 1000,
                                                            commentCount: commentCounts[post.id] || 0
                                                        }}
                                                        isOwner={isOwner}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-12 text-center border-t border-[var(--card-border)]">
                                                <div className="w-16 h-16 bg-[var(--card-border)] rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <svg className="w-8 h-8 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                    </svg>
                                                </div>
                                                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">{t.noPostsTitle}</h3>
                                                <p className="text-[var(--text-secondary)]">{t.noPostsDesc}</p>
                                            </div>
                                        )}
                                    </>
                                )}

                                {activeTab === 'received' && (
                                    <TipHistory
                                        tips={tips.filter(t => t.receiver === address)}
                                        loading={loading}
                                    />
                                )}

                                {activeTab === 'sent' && (
                                    <TipHistory
                                        tips={tips.filter(t => t.sender === address)}
                                        loading={loading}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

            <UserListModal
                isOpen={showFollowers}
                onClose={() => setShowFollowers(false)}
                title="Followers"
                users={followersList}
                currentUserAddress={currentUserAddress}
            />

            <UserListModal
                isOpen={showFollowing}
                onClose={() => setShowFollowing(false)}
                title="Following"
                users={followingList}
                currentUserAddress={currentUserAddress}
            />
        </>
    );
}
