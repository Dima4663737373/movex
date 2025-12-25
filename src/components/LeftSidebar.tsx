import Link from 'next/link';
import { useRouter } from 'next/router';
import { useLanguage } from '@/contexts/LanguageContext';
import { useState, useRef, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import ComposeModal from './ComposeModal';
import { useChat } from '@/contexts/ChatContext';
import { useSocialActivity } from '@/contexts/SocialActivityContext';
import { getDisplayName, getAvatar } from '@/lib/microThreadsClient';

import AccountSwitcherModal from './AccountSwitcherModal';

interface LeftSidebarProps {
    activePage?: 'home' | 'explore' | 'chat' | 'saved' | 'bookmarks' | 'profile' | 'settings' | 'apps' | 'movement-ai' | 'launchpad';
    currentUserAddress: string;
    displayName?: string;
    avatar?: string;
    isCollapsed?: boolean;
}

interface KnownAccount {
    address: string;
    displayName: string;
    avatar: string;
    lastActive: number;
}

export default function LeftSidebar({ activePage, currentUserAddress, displayName, avatar, isCollapsed: propsIsCollapsed }: LeftSidebarProps) {
    const router = useRouter();
    const { t } = useLanguage();
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
    const { totalUnreadCount: chatCount } = useChat();
    const { unreadCount: notificationCount } = useSocialActivity();
    const { disconnect, connected } = useWallet();

    // Determine collapse state: prop overrides internal logic
    const isChatPage = router.pathname === '/chat';
    const isCollapsed = propsIsCollapsed !== undefined ? propsIsCollapsed : isChatPage;

    useEffect(() => {
        const saveAccount = async () => {
            if (connected && currentUserAddress && typeof currentUserAddress === 'string') {
                try {
                    const stored = localStorage.getItem('known_accounts');
                    let accounts: KnownAccount[] = stored ? JSON.parse(stored) : [];
                    
                    const existingIndex = accounts.findIndex(a => a.address === currentUserAddress);
                    
                    // Fetch latest profile info if not provided props (or just refresh it)
                    let currentName = displayName;
                    let currentAvatar = avatar;
                    
                    if (!currentName || !currentAvatar) {
                        if (!currentName) currentName = await getDisplayName(currentUserAddress);
                        if (!currentAvatar) currentAvatar = await getAvatar(currentUserAddress);
                    }

                    const accountData: KnownAccount = {
                        address: currentUserAddress,
                        displayName: currentName || `${currentUserAddress.slice(0, 6)}...${currentUserAddress.slice(-4)}`,
                        avatar: currentAvatar || '',
                        lastActive: Date.now()
                    };

                    if (existingIndex >= 0) {
                        accounts[existingIndex] = accountData;
                    } else {
                        accounts.push(accountData);
                    }
                    
                    // Sort by last active
                    accounts.sort((a, b) => b.lastActive - a.lastActive);
                    
                    // Limit to 3 accounts
                    if (accounts.length > 3) {
                        accounts = accounts.slice(0, 3);
                    }
                    
                    localStorage.setItem('known_accounts', JSON.stringify(accounts));
                } catch (e) {
                    console.error("Error saving known account:", e);
                }
            }
        };
        
        saveAccount();
    }, [connected, currentUserAddress, displayName, avatar]);

    // Account Menu State
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                menuRef.current && 
                !menuRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsAccountMenuOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleLogout = async () => {
        try {
            await disconnect();
            setIsAccountMenuOpen(false);
            router.push('/');
        } catch (e) {
            console.error("Logout failed", e);
        }
    };

    // Check if we are on the chat page
    // const isChatPage = router.pathname === '/chat'; // Moved up
    
    // If on chat page, sidebar should be collapsed (icons only)
    // We can control this by passing a class or prop, or just using conditional logic here.
    // The user requested: "left bar collapses... only icons remain... chat window becomes larger"
    
    // const isCollapsed = isChatPage; // Moved up

    const navItems = [
        {
            id: 'home',
            label: t.feed,
            href: '/feed',
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            )
        },
        {
            id: 'explore',
            label: t.explore,
            href: '/explore',
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
            )
        },
        {
            id: 'chat',
            label: t.chat,
            href: '/chat',
            badge: chatCount > 0 ? chatCount : undefined,
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            )
        },
        {
            id: 'notifications',
            label: t.notifications,
            href: '/notifications',
            badge: notificationCount > 0 ? notificationCount : undefined,
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
            )
        },
        {
            id: 'saved',
            label: t.savedMessages,
            href: '/saved',
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
            )
        },
        {
            id: 'bookmarks',
            label: t.bookmarks,
            href: '/bookmarks',
            hasSeparator: true,
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
            )
        },
        {
            id: 'apps',
            label: 'Mini Apps',
            href: '/apps',
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
            )
        },
        {
            id: 'movement-ai',
            label: 'Movement AI',
            href: '/movement-ai',
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
            )
        },
        {
            id: 'settings',
            label: t.settings,
            href: '/settings',
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            )
        }
    ];

    const handlePostClick = () => {
        router.push('/feed');
    };

    return (
        <aside className={`flex flex-col gap-1 ${isCollapsed ? 'items-center' : 'pr-6'}`}>
            {navItems.map((item) => {
                const isActive = activePage === item.id;
                
                return (
                    <div key={item.id}>
                        {/* Separator before item if flagged */}
                        {/* @ts-ignore */}
                        {item.hasSeparator && (
                            <div className={`my-1 border-t border-[var(--card-border)] opacity-50 ${isCollapsed ? 'mx-2' : 'mx-4'}`} />
                        )}
                        
                        <Link 
                            href={item.href}
                            className={`flex items-center gap-2 px-4 py-3 rounded-full text-xl transition-all duration-300 relative ${
                                isActive 
                                    ? 'font-bold text-[var(--text-primary)] bg-[var(--card-border)]' 
                                    : 'font-medium text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'
                            } ${isCollapsed ? 'justify-center w-fit px-3' : ''}`}
                        >
                            <div className={`${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'} transition-colors relative shrink-0`}>
                                {item.icon}
                                {/* @ts-ignore */}
                                {item.badge > 0 && (
                                    <span className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full ring-2 ring-[var(--bg-primary)] animate-pulse z-50 ${!isCollapsed ? 'hidden' : ''}`}>
                                        {/* @ts-ignore */}
                                        {item.badge > 99 ? '99+' : item.badge}
                                    </span>
                                )}
                            </div>
                            <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                                isCollapsed 
                                    ? 'max-w-0 opacity-0' 
                                    : 'max-w-[200px] opacity-100'
                            } flex-1`}>{item.label}</span>
                            {/* @ts-ignore */}
                            {item.badge > 0 && !isCollapsed && (
                                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                                    {/* @ts-ignore */}
                                    {item.badge > 99 ? '99+' : item.badge}
                                </span>
                            )}
                        </Link>
                    </div>
                );
            })}

            {/* Post Button */}
            <button
                onClick={() => setIsComposeOpen(true)}
                className={`mt-4 bg-yellow-400 text-black font-bold text-lg rounded-full py-3 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 hover:bg-yellow-500 transition-all duration-300 flex items-center justify-center gap-2 ${isCollapsed ? 'w-12 h-12 p-0' : 'w-full'}`}
            >
                <span className={`transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                    isCollapsed 
                        ? 'max-w-0 opacity-0' 
                        : 'max-w-[100px] opacity-100'
                }`}>Post</span>
                <svg className={`w-6 h-6 transition-all duration-300 ${isCollapsed ? 'opacity-100' : 'max-w-0 opacity-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>

            {/* Profile Button with Account Menu */}
            <div className="relative mt-4">
                {isAccountMenuOpen && (
                    <div 
                        ref={menuRef}
                        className={`absolute bottom-[110%] left-0 bg-black border border-[var(--card-border)] rounded-2xl shadow-[0_0_15px_rgba(255,255,255,0.1)] overflow-hidden z-50 py-3 ${isCollapsed ? 'w-[260px]' : 'w-[300px]'}`}
                    >
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-[var(--card-border)] mb-2">
                            <p className="font-bold text-[var(--text-primary)] truncate">{displayName || "User"}</p>
                            <p className="text-[var(--text-secondary)] text-sm truncate">
                                @{typeof currentUserAddress === 'string' ? currentUserAddress.slice(0, 6) + '...' + currentUserAddress.slice(-4) : '...'}
                            </p>
                        </div>

                        {/* Menu Items */}
                        <button 
                            onClick={() => router.push(`/${currentUserAddress}`)}
                            className="w-full text-left px-4 py-3 hover:bg-[var(--hover-bg)] font-bold text-[var(--text-primary)] transition-colors"
                        >
                            Profile
                        </button>
                        <button 
                            onClick={() => setIsSwitcherOpen(true)}
                            className="w-full text-left px-4 py-3 hover:bg-[var(--hover-bg)] font-medium text-[var(--text-primary)] transition-colors flex items-center justify-between"
                        >
                            <span>Switch Account</span>
                            <span className="text-xs bg-[var(--accent)] text-black px-1.5 py-0.5 rounded font-bold">PRO</span>
                        </button>
                        <button 
                            onClick={handleLogout}
                            className="w-full text-left px-4 py-3 hover:bg-[var(--hover-bg)] font-medium text-red-500 transition-colors border-t border-[var(--card-border)] mt-1"
                        >
                            Log out @{typeof currentUserAddress === 'string' ? currentUserAddress.slice(0, 4) : '...'}
                        </button>
                    </div>
                )}
                
                <button 
                    ref={buttonRef}
                    onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
                    className={`flex items-center gap-3 w-full p-2 rounded-full hover:bg-[var(--hover-bg)] transition-all duration-300 ${isCollapsed ? 'justify-center' : ''}`}
                >
                    <div className="w-10 h-10 rounded-full bg-[var(--card-border)] flex items-center justify-center text-sm font-bold text-[var(--text-primary)] overflow-hidden shrink-0 border border-[var(--card-border)]">
                        {avatar ? (
                            <img src={avatar} alt={displayName || "User"} className="w-full h-full object-cover" />
                        ) : (
                            <span>{displayName ? displayName[0].toUpperCase() : "U"}</span>
                        )}
                    </div>
                    <div className={`flex flex-col items-start transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap ${
                        isCollapsed 
                            ? 'max-w-0 opacity-0' 
                            : 'max-w-0 xl:max-w-[140px] opacity-0 xl:opacity-100'
                    }`}>
                        <span className="text-base font-bold text-[var(--text-primary)] truncate max-w-[140px]">{displayName || "Profile"}</span>
                        <span className="text-sm text-[var(--text-secondary)]">@{typeof currentUserAddress === 'string' && currentUserAddress ? currentUserAddress.slice(0, 6) : '...'}...</span>
                    </div>
                    
                    {/* Ellipsis icon for menu indication */}
                    <div className={`ml-auto text-[var(--text-secondary)] transition-all duration-300 ease-in-out overflow-hidden ${
                        isCollapsed 
                            ? 'max-w-0 opacity-0' 
                            : 'max-w-0 xl:max-w-[24px] opacity-0 xl:opacity-100'
                    }`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                        </svg>
                    </div>
                </button>
            </div>

            <ComposeModal 
                isOpen={isComposeOpen} 
                onClose={() => setIsComposeOpen(false)}
                onPostCreated={() => {
                    // Dispatch event for feed refresh
                    window.dispatchEvent(new Event('tip_sent'));
                }}
            />

            <AccountSwitcherModal
                isOpen={isSwitcherOpen}
                onClose={() => setIsSwitcherOpen(false)}
                currentUserAddress={currentUserAddress}
            />
        </aside>
    );
}
