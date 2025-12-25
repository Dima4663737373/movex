/**
 * Wallet Connect Button
 * 
 * Button to connect/disconnect wallets (Petra, Razor, etc.) for Movement Network transactions
 */

'use client';

import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { formatMovementAddress, MOVEMENT_CHAIN_ID } from '@/lib/movement';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getBalance } from '@/lib/movementClient';
import { useRouter } from 'next/router';
import { useNetwork } from '@/contexts/NetworkContext';

export function WalletConnectButton() {
    const { connected, account, connect, disconnect, wallets, network } = useWallet();
    const { currentNetwork, switchNetwork, networkConfig } = useNetwork();
    const [showModal, setShowModal] = useState(false);
    const [balance, setBalance] = useState<number>(0);
    const [displayBalance, setDisplayBalance] = useState<number>(0);
    const [isHighlighting, setIsHighlighting] = useState(false);
    const prevBalanceRef = useRef<number>(0);
    const isFirstLoad = useRef(true);
    const router = useRouter();

    // Balance Animation Effect
    useEffect(() => {
        // Handle initial load
        if (isFirstLoad.current) {
            if (balance > 0) {
                setDisplayBalance(balance);
                prevBalanceRef.current = balance;
                isFirstLoad.current = false;
            }
            return;
        }

        if (balance !== prevBalanceRef.current) {
            // Only animate/highlight if balance increased (received tip/funds)
            if (balance > prevBalanceRef.current) {
                 setIsHighlighting(true);
                 setTimeout(() => setIsHighlighting(false), 2000); // 2s highlight
            }
            
            // Animate number
            const start = prevBalanceRef.current;
            const end = balance;
            const duration = 1500; // 1.5 second animation
            const startTime = performance.now();

            const animate = (currentTime: number) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Ease out expo
                const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
                
                const current = start + (end - start) * ease;
                setDisplayBalance(current);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            };
            
            requestAnimationFrame(animate);
            prevBalanceRef.current = balance;
        }
    }, [balance]);

    // Helper to check if network is valid
    const isNetworkValid = () => {
        if (!network) return true; // Don't show error if network is not yet detected
        
        // Check by Chain ID
        if (network.chainId) {
            const chainId = network.chainId.toString();
            const expectedChainId = networkConfig.chainId.toString();

            // Strict check against current network config
            if (chainId === expectedChainId) return true;

            // Allow alternates if needed
            if (currentNetwork === 'testnet') {
                // 250: Movement Bardock
                // 177: Movement Porto (sometimes used)
                // 27: Aptos Testnet (sometimes used with custom RPC)
                return chainId === '250' || chainId === '177' || chainId === '27';
            }

            if (currentNetwork === 'mainnet') {
                // 126: Movement Mainnet
                // 3073: Movement Mainnet EVM (future proofing)
                return chainId === '126' || chainId === '3073';
            }

            return false;
        }

        // Check by Name if Chain ID is missing (some wallets)
        if (network.name) {
            const name = network.name.toLowerCase();
            
            if (currentNetwork === 'testnet') {
                // Explicitly exclude Mainnet
                if (name.includes('mainnet')) return false;
                return name.includes('movement') || name.includes('bardock') || name.includes('testnet');
            }

            if (currentNetwork === 'mainnet') {
                if (name.includes('aptos')) return false; // Explicitly exclude Aptos
                return name.includes('movement') || (name.includes('mainnet') && !name.includes('aptos'));
            }
        }

        return true; // Default to true to avoid false positives if we can't determine
    };

    // Fetch balance when connected
    useEffect(() => {
        let isMounted = true;
        let isFetching = false;

        const fetchBalance = async () => {
            if (isFetching) return;
            
            if (connected && account) {
                isFetching = true;
                try {
                    // Pass current network config to ensure correct RPC is used
                    // Although getBalance internally uses getCurrentNetworkConfig which reads from localStorage,
                    // triggering re-render via context ensures consistency.
                    const bal = await getBalance(account.address.toString());
                    if (isMounted) setBalance(bal);
                } catch (error) {
                    console.error('Failed to fetch balance:', error);
                } finally {
                    isFetching = false;
                }
            }
        };

        fetchBalance();

        // Refresh balance every 10 seconds
        const interval = setInterval(fetchBalance, 10000);
        
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [connected, account, currentNetwork]); // Re-fetch when network changes

    const handleConnect = async (walletName: any) => {
        try {
            await connect(walletName);
            setShowModal(false);
        } catch (error) {
            console.error('Failed to connect wallet:', error);
        }
    };

    const handleDisconnect = async () => {
        try {
            // Clear auto-connect data BEFORE disconnecting to prevent race conditions
            localStorage.removeItem('aptos-wallet-name');
            localStorage.removeItem('movement_last_connected_address');
            setBalance(0);

            await disconnect();

            // Redirect to home page
            router.push('/');
        } catch (error) {
            console.error('Failed to disconnect:', error);
        }
    };

    // Filter out unwanted wallets (social logins) and prioritize Nightly
    const filteredWallets = (wallets as any[])
        .filter(wallet => {
            const name = wallet.name.toLowerCase();
            return !name.includes('google') && 
                   !name.includes('facebook') && 
                   !name.includes('twitter') && 
                   !name.includes('discord') && 
                   !name.includes('apple');
        })
        .sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            
            // Prioritize Nightly
            if (nameA.includes('nightly') && !nameB.includes('nightly')) return -1;
            if (!nameA.includes('nightly') && nameB.includes('nightly')) return 1;
            
            // Then Razor
            if (nameA.includes('razor') && !nameB.includes('razor')) return -1;
            if (!nameA.includes('razor') && nameB.includes('razor')) return 1;
            
            return 0;
        });

    // Helper to get install URL
    const getInstallUrl = (name: string) => {
        if (name.toLowerCase().includes('petra')) return 'https://petra.app/';
        if (name.toLowerCase().includes('razor')) return 'https://razorwallet.xyz/';
        if (name.toLowerCase().includes('nightly')) return 'https://nightly.app/';
        return '#';
    };

    if (connected && account) {
        return (
            <div className="flex items-center gap-4">
                {/* Network Label - Static Testnet */}
                <div className="flex bg-[var(--card-bg)] rounded-full p-1 border border-[var(--card-border)]">
                    <div className="px-3 py-1 bg-[var(--accent)] text-black text-xs font-bold rounded-full">
                        Testnet
                    </div>
                </div>

                {/* Network Check */}
                {!isNetworkValid() && (
                    <div className="hidden md:flex flex-col items-end justify-center px-4 py-2 bg-red-500/10 border border-red-500/50 rounded-xl min-w-[120px]">
                        <span className="text-[10px] text-red-400 uppercase tracking-wider font-semibold mb-0.5">Network ({network?.chainId || '?'})</span>
                        <span className="text-sm font-bold text-red-500">
                            Wrong Network
                        </span>
                    </div>
                )}

                {/* Balance Box */}
                <div className={`hidden md:flex flex-col items-end justify-center px-4 py-2 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl min-w-[120px] transition-all duration-500 ${isHighlighting ? 'bg-[var(--accent)]/10 border-[var(--accent)]/50 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : ''}`}>
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold mb-0.5">Balance</span>
                    <span className={`text-sm font-bold text-[var(--accent)] transition-transform duration-300 ${isHighlighting ? 'scale-110' : ''}`}>
                        {displayBalance.toFixed(2)} MOVE
                    </span>
                </div>

                {/* Connected Wallet Box */}
                <div className="hidden md:flex flex-col items-end justify-center px-4 py-2 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl min-w-[140px]">
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold mb-0.5">Connected Wallet</span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                        {formatMovementAddress(account.address.toString())}
                    </span>
                </div>

                {/* Mobile Address (Simple) */}
                <div className="md:hidden flex items-center px-3 py-2 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-full">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                        {formatMovementAddress(account.address.toString())}
                    </span>
                </div>

                {/* Disconnect Button */}
                <button
                    onClick={handleDisconnect}
                    className="px-4 py-2 border border-[var(--card-border)] text-[var(--text-secondary)] hover:text-red-500 hover:border-red-500/50 hover:bg-red-500/10 rounded-xl text-sm font-medium transition-all"
                >
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-4">
            <div className="flex bg-[var(--card-bg)] rounded-full p-1 border border-[var(--card-border)]">
                <div className="px-3 py-1 bg-[var(--accent)] text-black text-xs font-bold rounded-full">
                    Testnet
                </div>
            </div>

            <button
                onClick={() => setShowModal(true)}
                className="bg-[var(--accent)] text-[var(--btn-text-primary)] font-bold px-6 py-2 rounded-full hover:opacity-90 transition-opacity shadow-lg shadow-[var(--accent)]/20"
            >
                Connect Wallet
            </button>

            {/* Modal */}
            {showModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-slideUp">
                        <div className="p-4 border-b border-[var(--card-border)] flex justify-between items-center">
                            <h3 className="text-lg font-bold text-[var(--text-primary)]">Connect Wallet</h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
                            {filteredWallets.length > 0 ? (
                                filteredWallets.map((wallet) => (
                                    <div
                                        key={wallet.name}
                                        className="w-full flex items-center justify-between p-3 bg-[var(--hover-bg)] hover:bg-[var(--card-border)] border border-[var(--card-border)] rounded-lg transition-colors group"
                                    >
                                        <button
                                            onClick={() => handleConnect(wallet.name)}
                                            className="flex items-center gap-3 flex-1 text-left"
                                        >
                                            <img src={wallet.icon} alt={wallet.name} className="w-6 h-6 rounded-lg" />
                                            <span className="font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors flex items-center gap-2">
                                                {wallet.name}
                                                {wallet.name.toLowerCase().includes('nightly') && (
                                                    <span className="text-[10px] bg-[var(--accent)] text-black px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                                                        Best
                                                    </span>
                                                )}
                                            </span>
                                        </button>

                                        {wallet.readyState === 'Installed' ? (
                                            <span className="text-xs text-green-500 font-medium">Detected</span>
                                        ) : (
                                            <a
                                                href={getInstallUrl(wallet.name)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-[var(--accent)] hover:underline"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Install
                                            </a>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-[var(--text-secondary)] text-center py-8 space-y-3">
                                    <div className="w-12 h-12 bg-[var(--hover-bg)] rounded-full flex items-center justify-center mx-auto mb-2">
                                        <svg className="w-6 h-6 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <p className="font-medium">No wallets detected</p>
                                    <p className="text-xs text-[var(--text-secondary)] max-w-[200px] mx-auto">
                                        Install a supported wallet to interact with Movement Network.
                                    </p>
                                    <div className="flex flex-col gap-2 mt-4">
                                        <a href="https://razorwallet.xyz/" target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--accent)] hover:underline py-2">
                                            Install Razor Wallet
                                        </a>
                                        <a href="https://petra.app/" target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--accent)] hover:underline py-2">
                                            Install Petra Wallet
                                        </a>
                                        <a href="https://nightly.app/" target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--accent)] hover:underline py-2">
                                            Install Nightly Wallet
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setShowModal(false)}
                            className="w-full px-4 py-3 bg-[var(--hover-bg)] hover:bg-[var(--card-border)] text-[var(--text-primary)] font-medium transition-colors border-t border-[var(--card-border)]"
                        >
                            Cancel
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
