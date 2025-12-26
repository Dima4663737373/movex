import Link from 'next/link';
import { OnChainPost } from '@/lib/microThreadsClient';
import { formatMovementAddress } from '@/lib/movement';
import UserSuggestion from './UserSuggestion';
import { useMemo } from 'react';
import { extractHashtags } from '@/utils/textUtils';
import { useLanguage } from '@/contexts/LanguageContext';

interface RightSidebarProps {
    posts: OnChainPost[];
    stats: {
        totalTips: number;
        totalVolume: number;
        topTipper: string;
    };
    currentUserAddress: string;
    profiles: Record<string, { displayName?: string; avatar?: string }>;
}

export default function RightSidebar({ posts, stats, currentUserAddress, profiles }: RightSidebarProps) {
    const { t } = useLanguage();

    // Logic to find "Who to Follow"
    // Get unique creators excluding current user
    const uniqueCreators = useMemo(() => {
        const creators = new Set<string>();
        posts.forEach(p => {
            if (p.creator && p.creator !== currentUserAddress && p.creator !== "0x0") {
                creators.add(p.creator);
            }
        });
        return Array.from(creators).slice(0, 3);
    }, [posts, currentUserAddress]);

    // Trending Hashtags Logic
    const trendingHashtags = useMemo(() => {
        const counts: Record<string, number> = {};
        posts.forEach(post => {
            const tags = extractHashtags(post.content);
            tags.forEach(tag => {
                const normalizedTag = tag.toLowerCase();
                counts[normalizedTag] = (counts[normalizedTag] || 0) + 1;
            });
        });

        return Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([tag, count]) => ({ tag, count }));
    }, [posts]);

    return (
        <div className="space-y-4 w-full">
            {/* Network Stats Card */}            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-4">{t.networkStats}</h3>
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-[var(--text-secondary)]">{t.totalVolume}</span>
                        <span className="font-mono font-bold text-[var(--text-primary)]">{(stats?.totalVolume || 0).toFixed(2)} MOVE</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[var(--text-secondary)]">{t.totalTips}</span>
                        <span className="font-mono font-bold text-[var(--text-primary)]">{stats?.totalTips || 0}</span>
                    </div>
                    {stats?.topTipper && stats.topTipper !== "None" && (
                        <div className="pt-3 border-t border-[var(--card-border)]">
                            <span className="text-[var(--text-secondary)] text-sm block mb-1">{t.topTipper}</span>
                            <Link href={`/${stats.topTipper}`} className="font-mono font-bold text-[var(--accent)] hover:underline truncate block">
                                {formatMovementAddress(stats.topTipper)}
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Who to Follow */}
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-4">{t.whoToFollow}</h3>
                <div className="space-y-3">
                    {uniqueCreators.length > 0 ? (
                        uniqueCreators.map((creator, index) => {
                            const profile = profiles[creator] || {};
                            return (
                                <UserSuggestion
                                    key={`${creator}-${index}`}
                                    creator={creator}
                                    currentUserAddress={currentUserAddress}
                                    profile={profile}
                                />
                            );
                        })
                    ) : (
                        <div className="text-[var(--text-secondary)] text-sm">{t.noSuggestions}</div>
                    )}
                </div>
            </div>

            {/* Trending */}
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-4">{t.trending}</h3>
                <div className="space-y-3">
                    {trendingHashtags.length > 0 ? (
                        trendingHashtags.map(({ tag, count }) => (
                            <Link href={`/hashtag/${tag}`} key={tag}>
                                <div className="flex justify-between items-center group cursor-pointer hover:bg-[var(--hover-bg)] -mx-2 px-2 py-1 rounded-lg transition-colors">
                                    <span className="text-[var(--text-primary)] font-medium">#{tag}</span>
                                    <span className="text-xs text-[var(--text-secondary)]">{count} {t.postsCount}</span>
                                </div>
                            </Link>
                        ))
                    ) : (
                        <div className="text-[var(--text-secondary)] text-sm">{t.noTrending}</div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="text-xs text-[var(--text-secondary)] px-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
                    <a href="#" className="hover:underline">{t.terms}</a>
                    <a href="#" className="hover:underline">{t.privacy}</a>
                    <a href="#" className="hover:underline">{t.docs}</a>
                </div>
                <div>© 2025 MoveX. {t.builtOnMovement}.</div>
            </div>
        </div>
    );
}
