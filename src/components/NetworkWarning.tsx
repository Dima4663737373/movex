/**
 * Network Warning Banner
 * 
 * Shows warning if user is on wrong network (specifically Mainnet)
 */

'use client';

import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useState, useEffect } from 'react';
import { useNetwork } from '@/contexts/NetworkContext';

export function NetworkWarning() {
    const { network } = useWallet();
    const { currentNetwork } = useNetwork();
    const [showWarning, setShowWarning] = useState(false);

    useEffect(() => {
        if (!network) {
            setShowWarning(false);
            return;
        }

        const chainId = network.chainId?.toString();
        const requiredChainId = '250'; // Always check for Testnet

        if (chainId !== requiredChainId) {
            setShowWarning(true);
        } else {
            setShowWarning(false);
        }
    }, [network]);

    if (!showWarning) return null;

    const requiredNetwork = 'Movement Bardock Testnet (Chain ID: 250)';
    const currentWalletNetwork = network?.name || `Chain ID: ${network?.chainId}`;

    return (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-2xl w-full mx-4">
            <div className="bg-red-500/10 border-2 border-red-500 rounded-lg p-4 shadow-2xl backdrop-blur-sm">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-red-500 mb-2">⚠️ Wrong Network Detected!</h3>
                        <p className="text-white mb-3">
                            Your wallet is connected to <strong>{currentWalletNetwork}</strong>, but this app is <strong>Movement Testnet</strong> only.
                        </p>
                        <div className="bg-black/30 rounded p-3 mb-3">
                            <p className="text-sm text-white/90 mb-2"><strong>To fix:</strong></p>
                            <ol className="text-sm text-white/80 space-y-1 list-decimal list-inside">
                                <li>Open your Wallet extension</li>
                                <li>Click on the network dropdown</li>
                                <li>Switch to <strong>{requiredNetwork}</strong></li>
                                <li>Refresh this page if needed</li>
                            </ol>
                        </div>
                        <button
                            onClick={() => setShowWarning(false)}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            I understand
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
