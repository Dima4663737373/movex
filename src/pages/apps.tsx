import Head from 'next/head';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import AuthGuard from "@/components/AuthGuard";
import { useState } from "react";

// Mini Apps Directory Page
export default function AppsPage() {
    const { t } = useLanguage();
    const { account } = useWallet();
    const userAddress = account?.address.toString() || "";

    const apps = [
        {
            id: 'launchpad',
            name: 'Token Launchpad',
            description: 'Create and launch your own tokens on Movement Network.',
            icon: '🚀',
            url: '/launchpad',
            color: 'from-yellow-400 to-orange-500'
        },
        {
            id: 'red-pocket',
            name: 'Red Pocket',
            description: 'Send and receive crypto gifts in a fun way!',
            icon: '🧧',
            url: '/miniapps/red-pocket',
            color: 'from-red-500 to-rose-600'
        },
        {
            id: 'leaderboard',
            name: 'Leaderboard',
            description: 'Top content creators and tips leaderboard.',
            icon: '🏆',
            url: '/miniapps/leaderboard',
            color: 'from-purple-500 to-indigo-600'
        },
        {
            id: 'challenges',
            name: 'Challenges',
            description: 'Complete tasks and earn NFT rewards.',
            icon: '🎯',
            url: '/miniapps/challenges',
            color: 'from-green-400 to-emerald-600'
        },
        {
            id: 'badges',
            name: 'Badges',
            description: 'View your earned achievements and collection.',
            icon: '🎖️',
            url: '/miniapps/badges',
            color: 'from-blue-400 to-cyan-600'
        }
    ];

    return (
        <AuthGuard>
            <Head>
                <title>Mini Apps - MoveX</title>
            </Head>

            <div className="grid grid-cols-1 gap-6">
                    
                    {/* CENTER CONTENT */}
                    <div className="min-w-0 lg:px-6 pt-6">
                        {/* Page Title */}
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Mini Apps</h2>
                        </div>

                        <div className="grid gap-4">
                            {apps.map((app) => (
                                <Link 
                                    key={app.id}
                                    href={app.url}
                                    className="block group"
                                >
                                    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5 hover:bg-[var(--hover-bg)] transition-all hover:scale-[1.01] hover:shadow-lg flex items-center gap-5">
                                        <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center text-3xl shadow-lg shrink-0`}>
                                            {app.icon}
                                        </div>
                                        <div className="flex-grow">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-bold text-lg text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                                                    {app.name}
                                                </h3>
                                                <span className="text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Open →
                                                </span>
                                            </div>
                                            <p className="text-[var(--text-secondary)] text-sm mt-1">
                                                {app.description}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                            
                            {/* Placeholder for more apps */}
                            <div className="border border-dashed border-[var(--card-border)] rounded-xl p-6 text-center text-[var(--text-secondary)]">
                                <p className="text-sm">More apps coming soon...</p>
                                <p className="text-xs mt-2 opacity-60">Developers: Use the SDK to build your own.</p>
                            </div>
                        </div>
                    </div>
                </div>
        </AuthGuard>
    );
}
