import { useRouter } from 'next/router';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useState, useEffect } from 'react';
import { getDisplayName, getAvatar, getGlobalPosts, OnChainPost } from '@/lib/microThreadsClient';
import { getStats } from '@/lib/movementClient';

interface MainLayoutProps {
    children: React.ReactNode;
    activePage?: 'home' | 'explore' | 'chat' | 'saved' | 'bookmarks' | 'profile' | 'settings' | 'apps' | 'movement-ai' | 'launchpad';
}

import MobileNav from './MobileNav';

export default function MainLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { account, connected } = useWallet();
    const currentUserAddress = account?.address.toString() || "";
    
    // Determine active page
    const path = router.pathname;
    let activePage: MainLayoutProps['activePage'] = 'home';
    if (path.includes('/explore')) activePage = 'explore';
    else if (path.includes('/chat')) activePage = 'chat';
    else if (path.includes('/saved')) activePage = 'saved';
    else if (path.includes('/bookmarks')) activePage = 'bookmarks';
    else if (path.includes('/settings')) activePage = 'settings';
    else if (path.includes('/apps')) activePage = 'apps';
    else if (path.includes('/movement-ai')) activePage = 'movement-ai';
    
    // Profile State for Sidebar
    const [displayName, setDisplayName] = useState("");
    const [avatar, setAvatar] = useState("");

    // Right Sidebar State
    const [rsPosts, setRsPosts] = useState<OnChainPost[]>([]);
    const [rsStats, setRsStats] = useState({ totalTips: 0, totalVolume: 0, topTipper: "" });
    const [rsProfiles, setRsProfiles] = useState<Record<string, any>>({});

    const isChatPage = router.pathname === '/chat';
    // Use a slightly wider collapsed state if needed, or 80px. 
    // Standard sidebar is ~240px.
    const sidebarWidthClass = isChatPage ? 'lg:w-[80px]' : 'lg:w-[240px]';

    useEffect(() => {
        const fetchProfile = async () => {
            if (currentUserAddress) {
                try {
                    const name = await getDisplayName(currentUserAddress);
                    const ava = await getAvatar(currentUserAddress);
                    setDisplayName(name);
                    setAvatar(ava);
                } catch (e) {
                    console.error("Error fetching profile for layout", e);
                }
            }
        };
        fetchProfile();
    }, [currentUserAddress]);

    // Fetch Right Sidebar Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Stats
                const statsData = await getStats();
                setRsStats(statsData);

                // Fetch Posts for suggestions
                const posts = await getGlobalPosts(0, 20); // Fetch minimal posts
                setRsPosts(posts);

                // Fetch profiles for suggestions
                const uniqueCreators = new Set<string>();
                posts.forEach(p => {
                    if (p.creator && p.creator !== currentUserAddress && p.creator !== "0x0") {
                        uniqueCreators.add(p.creator);
                    }
                });

                const profilesMap: Record<string, any> = {};
                for (const creator of Array.from(uniqueCreators).slice(0, 5)) {
                    const name = await getDisplayName(creator);
                    const ava = await getAvatar(creator);
                    profilesMap[creator] = { displayName: name, avatar: ava };
                }
                setRsProfiles(profilesMap);

            } catch (e) {
                console.error("Error fetching sidebar data", e);
            }
        };
        fetchData();
    }, [currentUserAddress]);

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans">
             {/* Header - Movement Labs Style */}
             <header className="border-b border-[var(--card-border)] bg-[var(--card-bg)] sticky top-0 z-40 transition-colors duration-300">
                <div className="container-custom py-6">
                    <div className="max-w-[1280px] mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/feed')}>
                            <div className="w-10 h-10 bg-[var(--accent)] rounded-lg flex items-center justify-center shadow-lg">
                                <span className="text-black font-bold text-xl">M</span>
                            </div>
                            <span className="font-bold text-xl tracking-tight text-[var(--text-primary)]">MOVEX</span>
                        </div>

                        <div className="flex items-center gap-4">
                            <WalletConnectButton />
                            <ThemeSwitcher />
                        </div>
                    </div>
                </div>
            </header>

             <main className="container-custom pb-6 md:pb-10">
                <div className="max-w-[1280px] mx-auto flex items-stretch gap-0">
                    {/* Sidebar Container - Persistent & Animated */}
                    <div className={`hidden lg:block pt-6 sticky top-[89px] h-[calc(100vh-89px)] shrink-0 transition-all duration-300 ease-in-out border-r border-[var(--card-border)] ${sidebarWidthClass}`}>
                        <LeftSidebar 
                            activePage={activePage} 
                            currentUserAddress={currentUserAddress} 
                            displayName={displayName} 
                            avatar={avatar}
                            isCollapsed={isChatPage}
                        />
                    </div>

                    {/* Content Container */}
                    <div className="flex-1 min-w-0 border-r border-[var(--card-border)]">
                        {children}
                    </div>

                    {/* Right Sidebar - Persistent */}
                    {!isChatPage && (
                        <div className="hidden lg:block w-[350px] shrink-0 pt-6 pl-6 sticky top-[89px] h-[calc(100vh-89px)] overflow-y-auto hide-scrollbar">
                            <RightSidebar 
                                posts={rsPosts} 
                                stats={rsStats} 
                                currentUserAddress={currentUserAddress}
                                profiles={rsProfiles}
                            />
                        </div>
                    )}
                </div>
             </main>

             {/* Mobile Navigation */}
             <div className="lg:hidden">
                <MobileNav activePage={activePage} currentUserAddress={currentUserAddress} avatar={avatar} />
             </div>
        </div>
    );
}
