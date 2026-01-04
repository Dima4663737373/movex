import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState, useEffect } from "react";
import Head from "next/head";
import AuthGuard from "@/components/AuthGuard";
import { useLanguage } from '@/contexts/LanguageContext';
import { getCurrentNetworkConfig } from "@/lib/movement";
import { getUserCompletedChallenges } from "@/lib/movementClient";
import { useNotifications } from "@/components/Notifications";

interface Challenge {
    id: number;
    title: string;
    description: string;
    targetAmount: number;
    currentAmount: number;
    rewardUri: string;
    status: 'active' | 'completed' | 'not_started';
}

const MOCK_CHALLENGES: Challenge[] = [
    {
        id: 1,
        title: "Novice Tipper",
        description: "Send a total of 10 MOVE in tips to content creators.",
        targetAmount: 10,
        currentAmount: 0,
        rewardUri: "/badges/novice_tipper.png",
        status: 'not_started'
    },
    {
        id: 2,
        title: "Generous Soul",
        description: "Send 50 MOVE in tips this week.",
        targetAmount: 50,
        currentAmount: 12.5,
        rewardUri: "/badges/generous_soul.png",
        status: 'active'
    },
    {
        id: 3,
        title: "Whale Alert",
        description: "Tip a single creator 100 MOVE or more.",
        targetAmount: 100,
        currentAmount: 0,
        rewardUri: "/badges/whale.png",
        status: 'not_started'
    }
];

export default function ChallengesPage() {
    const { account, signAndSubmitTransaction } = useWallet();
    const userAddress = account?.address.toString() || "";
    const { t } = useLanguage();
    const { addNotification } = useNotifications();
    
    const [challenges, setChallenges] = useState<Challenge[]>(MOCK_CHALLENGES);
    const [isLoading, setIsLoading] = useState(false);
    
    // Fetch Challenge Status from Chain
    const fetchChallengeStatus = async () => {
        if (!userAddress) return;
        try {
            const completedIds = await getUserCompletedChallenges(userAddress);
            // completedIds is array of strings or numbers
            
            setChallenges(prev => prev.map(c => {
                // Check if completed on chain
                // Convert both to string to be safe
                const isCompleted = completedIds.some(id => String(id) === String(c.id));
                
                if (isCompleted && c.status !== 'completed') {
                    return { ...c, status: 'completed', currentAmount: c.targetAmount };
                }
                return c;
            }));
        } catch (e) {
            console.error("Error fetching challenge status:", e);
        }
    };

    useEffect(() => {
        fetchChallengeStatus();
        const interval = setInterval(fetchChallengeStatus, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [userAddress]);

    const handleAcceptChallenge = async (challengeId: number) => {
        if (!account) return;
        setIsLoading(true);
        try {
            const config = getCurrentNetworkConfig();
            const minesAddress = config.minesAddress;
            
            await signAndSubmitTransaction({
                data: {
                    function: `${minesAddress}::challenges_v12::join_challenge`,
                    functionArguments: [challengeId]
                }
            });
            
            setChallenges(prev => prev.map(c => 
                c.id === challengeId ? { ...c, status: 'active' } : c
            ));
            
             addNotification("Challenge Accepted!", "success", { persist: false });

        } catch (e) {
            console.error("Error accepting challenge:", e);
             addNotification("Failed to join challenge", "error", { persist: true });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClaimChallenge = async (challengeId: number) => {
        if (!account) return;
        setIsLoading(true);
        try {
            const config = getCurrentNetworkConfig();
            const minesAddress = config.minesAddress;
            
            await signAndSubmitTransaction({
                data: {
                    function: `${minesAddress}::challenges_v10::complete_challenge`,
                    functionArguments: [challengeId]
                }
            });
            
            setChallenges(prev => prev.map(c => 
                c.id === challengeId ? { ...c, status: 'completed' } : c
            ));
            
            addNotification("Reward Claimed! NFT Minted.", "success", { persist: false });

        } catch (e) {
            console.error("Error claiming challenge:", e);
             addNotification("Failed to claim reward", "error", { persist: true });
        } finally {
            setIsLoading(false);
        }
    };

    // Listen for real-time tip events
    useEffect(() => {
        const handleTipSent = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { amount } = customEvent.detail || {};
            
            if (amount) {
                setChallenges(prev => prev.map(c => {
                    if (c.status === 'active') {
                        const newAmount = c.currentAmount + amount;
                        const isCompleted = newAmount >= c.targetAmount;
                        
                        if (isCompleted) {
                            // Trigger completion effect or notification here if desired
                            console.log(`Challenge ${c.title} completed!`);
                             addNotification(`Challenge "${c.title}" Completed! Claim your reward.`, "success", { persist: false });
                        }

                        return {
                            ...c,
                            currentAmount: newAmount,
                            status: isCompleted ? 'completed' : 'active'
                        };
                    }
                    return c;
                }));
            }
        };

        window.addEventListener('tip_sent', handleTipSent);
        return () => window.removeEventListener('tip_sent', handleTipSent);
    }, []);

    return (
        <AuthGuard>
            <Head>
                <title>Challenges | MicroThreads</title>
            </Head>

            <main className="container-custom pb-6 md:pb-10">
                <div className="max-w-[1280px] mx-auto">
                    {/* Simplified grid - Main Layout handles sidebar */}
                    <div className="grid grid-cols-1 gap-6">

                        {/* MAIN CONTENT */}
                        <div className="min-h-screen">
                            <div className="mb-6">
                                <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Micro-Challenges</h1>
                                <p className="text-[var(--text-secondary)]">Complete tasks, earn NFTs and badges.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {challenges.map((challenge) => (
                                    <div key={challenge.id} className="bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)] p-6 shadow-sm flex flex-col">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-lg font-bold text-[var(--text-primary)]">{challenge.title}</h3>
                                                <p className="text-sm text-[var(--text-secondary)] mt-1">{challenge.description}</p>
                                            </div>
                                            <div className="text-2xl">
                                                {challenge.status === 'completed' ? '✅' : '🎯'}
                                            </div>
                                        </div>

                                        <div className="mt-auto space-y-4">
                                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4">
                                                <div 
                                                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                                                    style={{ width: `${Math.min(100, (challenge.currentAmount / challenge.targetAmount) * 100)}%` }}
                                                ></div>
                                            </div>
                                            
                                            {challenge.status === 'not_started' && (
                                                <button 
                                                    onClick={() => handleAcceptChallenge(challenge.id)}
                                                    disabled={isLoading}
                                                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    {isLoading ? 'Processing...' : t.acceptChallenge}
                                                </button>
                                            )}

                                            {challenge.status === 'active' && (
                                                <button 
                                                    className="w-full py-2 bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-lg cursor-not-allowed"
                                                    disabled
                                                >
                                                    {t.inProgress}
                                                </button>
                                            )}

                                            {challenge.status === 'completed' && challenge.currentAmount >= challenge.targetAmount && (
                                                 <button 
                                                    onClick={() => handleClaimChallenge(challenge.id)}
                                                    disabled={isLoading}
                                                    className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    {isLoading ? 'Processing...' : t.claimReward}
                                                </button>
                                            )}
                                            
                                            {challenge.status === 'completed' && challenge.currentAmount < challenge.targetAmount && ( // Already claimed but logic says completed
                                                <button 
                                                    className="w-full py-2 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 rounded-lg cursor-default"
                                                >
                                                    {t.completed}
                                                </button>
                                            )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
                    </div>
                </div>
            </main>
        </AuthGuard>
    );
}
