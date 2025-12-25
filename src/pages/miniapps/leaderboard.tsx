import Head from 'next/head';
import Link from 'next/link';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import AuthGuard from "@/components/AuthGuard";
import { useState, useEffect } from "react";
import { getDisplayName, getAvatar } from "@/lib/microThreadsClient";
import { formatMovementAddress, octasToMove } from "@/lib/movement";
import { getAuthorTips, getTopAuthors } from "@/lib/movementClient";

interface AuthorStat {
  address: string;
  shortAddress: string;
  totalTips: number;
  displayName?: string;
  avatar?: string;
  rank: number;
}

export default function LeaderboardPage() {
    const { account } = useWallet();
    const userAddress = account?.address.toString() || "";

    // Leaderboard State
    const [topAuthors, setTopAuthors] = useState<AuthorStat[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<'all' | 'month' | 'week' | 'day'>('all');
    const [userRealTips, setUserRealTips] = useState<number | null>(null);

    // Fetch user profile and stats for sidebars
    useEffect(() => {
        const fetchData = async () => {
            if (userAddress) {
                const realTips = await getAuthorTips(userAddress);
                setUserRealTips(realTips);
            }
        };
        fetchData();
    }, [userAddress]);

    // Listen for real-time tip events
    useEffect(() => {
        const handleTipSent = (event: Event) => {
            const customEvent = event as CustomEvent;
            const { amount, sender, receiver } = customEvent.detail || {};
            
            // Only update if we have a receiver (author)
            if (receiver && amount) {
                setTopAuthors(prev => {
                    const newAuthors = [...prev];
                    const existingAuthorIndex = newAuthors.findIndex(a => a.address === receiver);
                    
                    if (existingAuthorIndex >= 0) {
                        newAuthors[existingAuthorIndex] = {
                            ...newAuthors[existingAuthorIndex],
                            totalTips: newAuthors[existingAuthorIndex].totalTips + amount
                        };
                    } else {
                         // Add new author
                         newAuthors.push({
                            address: receiver,
                            shortAddress: formatMovementAddress(receiver),
                            totalTips: amount,
                            rank: newAuthors.length + 1,
                            displayName: "Unknown",
                            avatar: "👤"
                         });
                    }
                    
                    // Re-sort and re-rank
                    return newAuthors
                        .sort((a, b) => b.totalTips - a.totalTips)
                        .map((a, i) => ({ ...a, rank: i + 1 }));
                });
            }
        };

        window.addEventListener('tip_sent', handleTipSent);
        return () => window.removeEventListener('tip_sent', handleTipSent);
    }, [userAddress]);

    // Fetch Leaderboard Data
    const fetchLeaderboard = async () => {
        // Don't set loading on polling updates to avoid flickering
        // setIsLoading(true); 
        try {
            // Try to fetch from contract first
            let contractAuthors: AuthorStat[] = [];
            try {
                 const topList = await getTopAuthors(50);
                 
                 if (topList && topList.length > 0) {
                    const authorDataPromises = topList.map(async (item: any) => {
                        const addr = item.address;
                        const tips = item.totalTips;
                        const name = await getDisplayName(addr);
                        const av = await getAvatar(addr);
                        
                        // Check if this author is the current user to use real-time data
                        let finalTips = tips;
                        if (addr === userAddress && userRealTips !== null) {
                            finalTips = Math.max(tips, userRealTips);
                        }

                        // Format address for display if name is unknown
                        const shortAddr = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
                        
                        // Force truncation of long names to prevent layout breaking
                        let displayName = name || shortAddr;
                        if (displayName.length > 18) {
                            displayName = displayName.slice(0, 15) + '...';
                        }

                        return {
                            address: addr,
                            shortAddress: shortAddr,
                            totalTips: octasToMove(finalTips), // Contract returns octas
                            displayName: displayName,
                            avatar: av || "👤",
                            rank: 0
                        };
                    });
                    
                    contractAuthors = await Promise.all(authorDataPromises);
                 }
            } catch (err) {
                console.log("Contract fetch failed, using mock data");
            }

            if (contractAuthors.length > 0) {
                // Sort and rank
                const sorted = contractAuthors
                    .sort((a, b) => b.totalTips - a.totalTips)
                    .map((author, index) => ({ ...author, rank: index + 1 }));
                
                setTopAuthors(sorted);
            } else {
                // No data available yet
                setTopAuthors([]);
            }
        } catch (error) {
            console.error("Error fetching leaderboard:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setIsLoading(true);
        fetchLeaderboard();
        
        // Poll every 10 seconds for real-time updates
        const interval = setInterval(fetchLeaderboard, 10000);
        return () => clearInterval(interval);
    }, [userAddress, userRealTips]);

    return (
        <AuthGuard>
            <Head>
                <title>Leaderboard | MicroThreads</title>
            </Head>

            {/* Header removed - handled by MainLayout */}

            <main className="container-custom pb-6 md:pb-10">
                <div className="max-w-[1280px] mx-auto">
                    <div className="grid grid-cols-1 gap-6">
                    
                        {/* MAIN CONTENT */}
                        <div className="min-w-0 lg:px-6 pt-6 min-h-screen">
                            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Leaderboard</h1>
                                    <p className="text-[var(--text-secondary)]">Top content creators earning tips.</p>
                                </div>
                                
                                {/* Timeframe Filter */}
                                <div className="flex bg-[var(--bg-secondary)] rounded-lg p-1">
                                    {(['all', 'month', 'week', 'day'] as const).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setTimeframe(t)}
                                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                                timeframe === t 
                                                ? 'bg-[var(--card-bg)] text-[var(--text-primary)] shadow-sm' 
                                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                            }`}
                                        >
                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Leaderboard Table */}
                            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-[var(--card-border)] bg-[var(--bg-secondary)]">
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider w-16">Rank</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Author</th>
                                                <th className="px-6 py-4 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Total Tips</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--card-border)]">
                                            {isLoading ? (
                                                // Loading Skeletons
                                                [...Array(5)].map((_, i) => (
                                                    <tr key={i} className="animate-pulse">
                                                        <td className="px-6 py-4"><div className="h-4 bg-[var(--bg-secondary)] rounded w-8"></div></td>
                                                        <td className="px-6 py-4"><div className="h-4 bg-[var(--bg-secondary)] rounded w-32"></div></td>
                                                        <td className="px-6 py-4"><div className="h-4 bg-[var(--bg-secondary)] rounded w-16 ml-auto"></div></td>
                                                    </tr>
                                                ))
                                            ) : (
                                                topAuthors.map((author) => (
                                                    <tr key={author.address} className="hover:bg-[var(--hover-bg)] transition-colors">
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className={`
                                                                w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                                                                ${author.rank === 1 ? 'bg-yellow-500/20 text-yellow-500' : 
                                                                  author.rank === 2 ? 'bg-gray-400/20 text-gray-400' : 
                                                                  author.rank === 3 ? 'bg-orange-500/20 text-orange-500' : 
                                                                  'text-[var(--text-secondary)]'}
                                                            `}>
                                                                {author.rank}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap overflow-hidden max-w-[200px]">
                                                            <Link href={`/${author.address}`} className="block hover:opacity-80 transition-opacity">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-lg border border-[var(--card-border)] shrink-0 overflow-hidden">
                                                                        {author.avatar?.startsWith('http') ? (
                                                                            <img src={author.avatar} alt={author.displayName} className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            author.avatar
                                                                        )}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="font-medium text-[var(--text-primary)] truncate" title={author.displayName}>{author.displayName}</div>
                                                                        <div className="text-xs text-[var(--text-secondary)] font-mono opacity-70 truncate">{author.shortAddress}</div>
                                                                    </div>
                                                                </div>
                                                            </Link>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                                            <div className="font-bold text-[var(--accent)]">{author.totalTips} MOVE</div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {!isLoading && topAuthors.length === 0 && (
                                    <div className="p-8 text-center text-[var(--text-secondary)]">
                                        No data available for this period.
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </AuthGuard>
    );
}
