import { useState, useEffect } from 'react';
import { getTipHistory } from '@/lib/microThreadsClient';
import { octasToMove } from '@/lib/movement';

interface TipStats {
    today: number;
    month: number;
    year: number;
    allTime: number;
}

interface TipStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    userAddress: string;
    displayName: string;
}

export default function TipStatsModal({ isOpen, onClose, userAddress, displayName }: TipStatsModalProps) {
    const [stats, setStats] = useState<TipStats>({ today: 0, month: 0, year: 0, allTime: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !userAddress) return;

        const fetchStats = async () => {
            setLoading(true);
            try {
                // Fetch all tips received by user
                const tips = await getTipHistory(userAddress);
                const receivedTips = tips.filter(t => t.type === 'received');

                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
                const yearStart = new Date(now.getFullYear(), 0, 1).getTime() / 1000;

                let today = 0;
                let month = 0;
                let year = 0;
                let allTime = 0;

                receivedTips.forEach(tip => {
                    const amount = parseFloat(tip.amount.toString());
                    const ts = tip.timestamp;

                    if (ts >= todayStart) today += amount;
                    if (ts >= monthStart) month += amount;
                    if (ts >= yearStart) year += amount;
                    allTime += amount;
                });

                setStats({ today, month, year, allTime });
            } catch (e) {
                console.error("Error fetching tip stats", e);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [isOpen, userAddress]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fadeIn" onClick={onClose}>
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="p-6">
                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-1">Tip Stats</h3>
                    <p className="text-sm text-[var(--text-secondary)] mb-6">Earnings for {displayName}</p>

                    {loading ? (
                        <div className="space-y-4 animate-pulse">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-16 bg-[var(--card-border)] rounded-xl"></div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="bg-[var(--bg-secondary)] p-4 rounded-xl flex justify-between items-center">
                                <span className="text-[var(--text-secondary)] font-medium">Today</span>
                                <span className="text-lg font-bold text-[var(--accent)]">{stats.today.toFixed(2)} MOVE</span>
                            </div>
                            <div className="bg-[var(--bg-secondary)] p-4 rounded-xl flex justify-between items-center">
                                <span className="text-[var(--text-secondary)] font-medium">This Month</span>
                                <span className="text-lg font-bold text-[var(--text-primary)]">{stats.month.toFixed(2)} MOVE</span>
                            </div>
                            <div className="bg-[var(--bg-secondary)] p-4 rounded-xl flex justify-between items-center">
                                <span className="text-[var(--text-secondary)] font-medium">This Year</span>
                                <span className="text-lg font-bold text-[var(--text-primary)]">{stats.year.toFixed(2)} MOVE</span>
                            </div>
                            <div className="bg-[var(--bg-secondary)] p-4 rounded-xl flex justify-between items-center border border-[var(--accent)]/30">
                                <span className="text-[var(--text-secondary)] font-medium">All Time</span>
                                <span className="text-lg font-bold text-[#FFD700]">{stats.allTime.toFixed(2)} MOVE</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
