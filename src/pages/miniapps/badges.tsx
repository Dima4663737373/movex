import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState, useEffect } from "react";
import Head from "next/head";
import AuthGuard from "@/components/AuthGuard";
import { getAptosClient, getUserBadges } from "@/lib/movementClient";
import { getCurrentNetworkConfig } from "@/lib/movement";

interface Badge {
    id: number;
    name: string;
    description: string;
    imageUri: string;
    unlockedAt?: number;
    requiredAmount: number;
    currentProgress: number;
}

const MOCK_BADGES: Badge[] = [
    {
        id: 1,
        name: "First Tip",
        description: "Sent your first tip to a creator.",
        imageUri: "🪙",
        requiredAmount: 1,
        currentProgress: 1,
        unlockedAt: 1716190498000
    },
    {
        id: 2,
        name: "Bronze Supporter",
        description: "Donated a total of 10 MOVE.",
        imageUri: "🥉",
        requiredAmount: 10,
        currentProgress: 5.5,
    },
    {
        id: 3,
        name: "Silver Supporter",
        description: "Donated a total of 50 MOVE.",
        imageUri: "🥈",
        requiredAmount: 50,
        currentProgress: 5.5,
    },
    {
        id: 4,
        name: "Gold Supporter",
        description: "Donated a total of 100 MOVE.",
        imageUri: "🥇",
        requiredAmount: 100,
        currentProgress: 5.5,
    },
    {
        id: 5,
        name: "Whale",
        description: "Donated a total of 1000 MOVE.",
        imageUri: "🐋",
        requiredAmount: 1000,
        currentProgress: 5.5,
    },
    {
        id: 101,
        name: "7-Day Streak",
        description: "Checked in for 7 consecutive days.",
        imageUri: "📅",
        requiredAmount: 7,
        currentProgress: 0,
        unlockedAt: undefined
    },
    {
        id: 102,
        name: "14-Day Streak",
        description: "Checked in for 14 consecutive days.",
        imageUri: "🔥",
        requiredAmount: 14,
        currentProgress: 0,
        unlockedAt: undefined
    },
    {
        id: 103,
        name: "30-Day Streak",
        description: "Checked in for 30 consecutive days.",
        imageUri: "🏆",
        requiredAmount: 30,
        currentProgress: 0,
        unlockedAt: undefined
    },
    {
        id: 104,
        name: "90-Day Streak",
        description: "Checked in for 90 consecutive days.",
        imageUri: "👑",
        requiredAmount: 90,
        currentProgress: 0,
        unlockedAt: undefined
    }
];

export default function BadgesPage() {
    const { account } = useWallet();
    const userAddress = account?.address.toString() || "";
    
    const [badges, setBadges] = useState<Badge[]>(MOCK_BADGES);
    const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
    
    // Fetch Badges (with polling)
    const fetchBadges = async () => {
        if (!userAddress) return;
        try {
            // Fetch Standard Badges
            const userBadges = await getUserBadges(userAddress);
            
            // Fetch Check-in Streak
            const client = getAptosClient();
            const config = getCurrentNetworkConfig();
            let currentStreak = 0;
            
            try {
                const resource = await client.getAccountResource({
                    accountAddress: userAddress,
                    resourceType: `${config.minesAddress}::daily_check_in_v10::CheckInState`
                });
                // @ts-ignore
                currentStreak = Number(resource.current_streak);
            } catch (e) {
                // Strict Mode: No local fallback
                currentStreak = 0;
            }

            setBadges(prev => {
                const newBadges = [...prev];

                // Update Streak Badges
                [101, 102, 103, 104].forEach(badgeId => {
                    const badgeIndex = newBadges.findIndex(b => b.id === badgeId);
                    if (badgeIndex !== -1) {
                        const badge = newBadges[badgeIndex];
                        // If streak met and not already unlocked (or just visual progress)
                        // In a real app, we might want to check if the badge was explicitly minted.
                        // But for now, we can show it as unlocked if streak is sufficient.
                        const isUnlocked = currentStreak >= badge.requiredAmount;
                        
                        newBadges[badgeIndex] = {
                            ...badge,
                            currentProgress: currentStreak,
                            unlockedAt: isUnlocked ? (badge.unlockedAt || Date.now()) : undefined
                        };
                    }
                });

                // Update Standard Badges from Contract
                if (userBadges && userBadges.length > 0) {
                    userBadges.forEach((contractBadge: any) => {
                            // Check if badge already exists in our list (by ID or Name)
                            // Contract badge: { id, name, description, image_url, timestamp }
                            const existingIndex = newBadges.findIndex(b => b.id === Number(contractBadge.id) || b.name === contractBadge.name);
                            
                            if (existingIndex >= 0) {
                                // Update existing
                                newBadges[existingIndex] = {
                                    ...newBadges[existingIndex],
                                    unlockedAt: Number(contractBadge.timestamp) * 1000,
                                    currentProgress: newBadges[existingIndex].requiredAmount // Max out progress
                                };
                            }
                    });
                }
                
                return newBadges;
            });

        } catch (e) {
            console.error("Error fetching badges:", e);
        }
    };

    useEffect(() => {
        if (userAddress) {
            fetchBadges();
        }
        
        // Poll for badges
        const interval = setInterval(fetchBadges, 10000);
        return () => clearInterval(interval);
    }, [userAddress]);

    // Listen for real-time tip events
    useEffect(() => {
        const handleTipSent = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { amount } = customEvent.detail || {};
            
            if (amount) {
                setBadges(prev => prev.map(b => {
                    if (b.unlockedAt) return b; // Already unlocked

                    const newProgress = b.currentProgress + amount;
                    const isUnlocked = newProgress >= b.requiredAmount;

                    return {
                        ...b,
                        currentProgress: newProgress,
                        unlockedAt: isUnlocked ? Date.now() : undefined
                    };
                }));
            }
        };

        window.addEventListener('tip_sent', handleTipSent);
        return () => window.removeEventListener('tip_sent', handleTipSent);
    }, []);

    return (
        <AuthGuard>
            <Head>
                <title>Badges | MicroThreads</title>
            </Head>

            <main className="container-custom pb-6 md:pb-10">
                <div className="max-w-[1280px] mx-auto">
                    {/* Simplified grid - Main Layout handles sidebar */}
                    <div className="grid grid-cols-1 gap-6">

                        {/* MAIN CONTENT */}
                        <div className="min-h-screen">
                            <div className="mb-8">
                                <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">My Badges</h1>
                                <p className="text-[var(--text-secondary)]">Collect badges by supporting creators.</p>
                            </div>

                            {/* Badge Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {badges.map((badge) => (
                                    <div 
                                        key={badge.id}
                                        onClick={() => setSelectedBadge(badge)}
                                        className={`
                                            relative aspect-square rounded-xl border p-4 flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105
                                            ${badge.unlockedAt 
                                                ? 'bg-[var(--card-bg)] border-[var(--accent)] shadow-[0_0_10px_rgba(var(--accent-rgb),0.2)]' 
                                                : 'bg-[var(--bg-secondary)] border-[var(--card-border)] opacity-60 grayscale'}
                                        `}
                                    >
                                        <div className="text-5xl mb-3 filter drop-shadow-md">
                                            {badge.imageUri}
                                        </div>
                                        <div className="text-center">
                                            <h3 className="font-bold text-sm text-[var(--text-primary)] line-clamp-1">{badge.name}</h3>
                                            {badge.unlockedAt && (
                                                <span className="text-[10px] text-[var(--accent)] font-medium">UNLOCKED</span>
                                            )}
                                        </div>
                                        
                                        {!badge.unlockedAt && (
                                            <div className="absolute bottom-2 left-2 right-2">
                                                <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                                    <div 
                                                        className="bg-[var(--text-secondary)] h-full" 
                                                        style={{ width: `${Math.min((badge.currentProgress / badge.requiredAmount) * 100, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Badge Detail Modal (Simple Overlay) */}
                            {selectedBadge && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedBadge(null)}>
                                    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-8 max-w-sm w-full shadow-2xl transform transition-all" onClick={e => e.stopPropagation()}>
                                        <div className="flex flex-col items-center text-center">
                                            <div className="text-8xl mb-6 animate-bounce">
                                                {selectedBadge.imageUri}
                                            </div>
                                            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{selectedBadge.name}</h2>
                                            <p className="text-[var(--text-secondary)] mb-6">{selectedBadge.description}</p>
                                            
                                            {selectedBadge.unlockedAt ? (
                                                <div className="px-4 py-2 bg-green-500/10 text-green-500 rounded-full text-sm font-bold border border-green-500/20">
                                                    Unlocked on {new Date(selectedBadge.unlockedAt).toLocaleDateString()}
                                                </div>
                                            ) : (
                                                <div className="w-full space-y-2">
                                                    <div className="flex justify-between text-sm text-[var(--text-secondary)]">
                                                        <span>Progress</span>
                                                        <span>{selectedBadge.currentProgress} / {selectedBadge.requiredAmount} MOVE</span>
                                                    </div>
                                                    <div className="w-full bg-[var(--bg-secondary)] rounded-full h-3 overflow-hidden">
                                                        <div 
                                                            className="bg-[var(--accent)] h-full transition-all duration-500" 
                                                            style={{ width: `${Math.min((selectedBadge.currentProgress / selectedBadge.requiredAmount) * 100, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                    <p className="text-xs text-[var(--text-secondary)] mt-2">
                                                        Send {selectedBadge.requiredAmount - selectedBadge.currentProgress} more MOVE to unlock!
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </AuthGuard>
    );
}
