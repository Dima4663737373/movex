/**
 * Aptos Wallet Provider for Movement Network
 * 
 * Configured to support both Petra (legacy plugin) and standard wallets (Razor, etc.)
 * Auto-connects to previously connected wallet on page reload
 */

'use client';

import { ReactNode, useEffect } from 'react';
import { AptosWalletAdapterProvider, useWallet } from '@aptos-labs/wallet-adapter-react';

interface WalletProviderProps {
    children: ReactNode;
}

// Auto-reconnect wrapper component
function AutoReconnect({ children }: { children: ReactNode }) {
    const { connect, connected, wallet, account } = useWallet();

    useEffect(() => {
        const lastWallet = localStorage.getItem('aptos-wallet-name');

        // Auto-connect on mount if we have a saved wallet
        if (lastWallet && !connected) {
            try {
                connect(lastWallet);
            } catch (err) {
                console.log('Auto-reconnect failed:', err);
                localStorage.removeItem('aptos-wallet-name');
            }
        }
    }, [connect, connected]);

    useEffect(() => {
        // Save wallet name and address when connected
        if (connected && (wallet as any)?.name && account?.address) {
            localStorage.setItem('aptos-wallet-name', (wallet as any).name);
            localStorage.setItem('movement_last_connected_address', account.address.toString());
        }
    }, [connected, wallet, account]);

    return <>{children}</>;
}

export function WalletProvider({ children }: WalletProviderProps) {
    return (
        <AptosWalletAdapterProvider
            autoConnect={true}
            onError={(error) => {
                // Only log non-user-initiated errors (don't spam console with user rejections)
                if (error.name !== 'UserRejectedRequestError' && !error.message?.includes('User has rejected')) {
                    // Suppress account_not_found errors - these are handled gracefully
                const errorStr = error?.toString() || '';
                const errorMsg = error?.message || '';
                if (
                    error.error_code === 'account_not_found' || 
                    errorMsg.includes('Account not found') || 
                    errorMsg.includes('account_not_found') ||
                    errorStr.includes('Account not found') ||
                    errorStr.includes('account_not_found')
                ) {
                    // Silently handle account_not_found - it's expected for new accounts
                    return;
                }
                console.error('Wallet adapter error:', error);
                } else {
                    // Silently handle user rejections
                    console.log('User rejected wallet request');
                }
            }}
        >
            <AutoReconnect>
                {children}
            </AutoReconnect>
        </AptosWalletAdapterProvider>
    );
}
