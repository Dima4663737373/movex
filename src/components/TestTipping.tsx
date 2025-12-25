"use client";

import { useState, useEffect } from "react";
import { useMovementTransaction } from "@/hooks/useMovementTransaction";
import { octasToMove } from "@/lib/movement";
import TransactionStatus from "./TransactionStatus";
import { saveLocalTransaction } from "@/lib/movementClient";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

interface TipSenderProps {
    address: string;
    balance: number;
    minBalance: number;
    onSuccess?: () => void;
}

export default function TipSender({ address, balance, minBalance, onSuccess }: TipSenderProps) {
    const { account } = useWallet();
    const { sendTip, loading } = useMovementTransaction();
    const [txHash, setTxHash] = useState<string | null>(null);
    const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'confirmed' | 'failed'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [recipientAddress, setRecipientAddress] = useState<string>("");
    const [addressError, setAddressError] = useState<string | null>(null);
    const [tipAmount, setTipAmount] = useState("0.1");

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedTip = localStorage.getItem('default_tip_amount');
            if (savedTip) {
                setTipAmount(savedTip);
            }
        }
    }, []);

    const canSendTip = balance >= minBalance && recipientAddress.trim().length > 0;

    // Validate address format (basic validation)
    const validateAddress = (addr: string): boolean => {
        if (!addr || addr.trim().length === 0) {
            setAddressError("Please enter a recipient address");
            return false;
        }
        // Movement/Aptos addresses should start with 0x and be 66 characters (0x + 64 hex chars)
        // But also accept shorter addresses that will be padded
        if (!addr.startsWith("0x")) {
            setAddressError("Address must start with 0x");
            return false;
        }
        if (addr.length < 3) {
            setAddressError("Address is too short");
            return false;
        }
        setAddressError(null);
        return true;
    };

    const handleSendTip = async () => {
        // Validate address before sending
        if (!validateAddress(recipientAddress)) {
            return;
        }

        setTxStatus('pending');
        setError(null);
        setTxHash(null);

        try {
            // Use dummy post ID "0" for direct tips/testing
            // sendTip handles octas conversion internally
            const result = await sendTip(recipientAddress, parseFloat(tipAmount), "0");
            setTxHash(result.hash);
            setTxStatus('confirmed');

            // Save to local history
            if (account) {
                saveLocalTransaction({
                    sender: account.address.toString(),
                    receiver: recipientAddress,
                    amount: parseFloat(tipAmount),
                    timestamp: Date.now() / 1000,
                    hash: result.hash
                });
            }

            // Clear the input on success
            setRecipientAddress("");
            setAddressError(null);

            // Call success callback to refresh balance
            if (onSuccess) {
                setTimeout(onSuccess, 1000);
            }
        } catch (err) {
            console.error("Failed to send tip:", err);
            setError(err instanceof Error ? err.message : "Failed to send tip");
            setTxStatus('failed');
        }
    };

    return (
        <div className="card h-full flex flex-col">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-yellow-400/10 rounded-lg flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-base font-semibold">Send a Tip</h3>
                    <p className="text-neutral-400 text-[10px]">Support creators</p>
                </div>
            </div>

            <div className="flex flex-col justify-center space-y-3">
                {/* Recipient Address Input */}
                <div>
                    <label className="block text-neutral-400 text-xs mb-2">Recipient Address</label>
                    <input
                        type="text"
                        value={recipientAddress}
                        onChange={(e) => {
                            setRecipientAddress(e.target.value);
                            setAddressError(null);
                        }}
                        placeholder="0x..."
                        className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/50 transition-all"
                    />
                    {addressError && (
                        <p className="text-red-400 text-xs mt-1">{addressError}</p>
                    )}
                </div>

                {/* Amount Display */}
                <div className="bg-neutral-900/50 rounded-lg p-3 border border-neutral-800">
                    <div className="flex justify-between items-baseline mb-1">
                        <span className="text-neutral-400 text-xs">Amount</span>
                        <span className="text-xl font-bold text-white">{tipAmount} <span className="text-xs font-normal text-yellow-400">MOVE</span></span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                        <span className="text-neutral-500">Fee</span>
                        <span className="text-neutral-500">~0.0001</span>
                    </div>
                </div>

                <TransactionStatus hash={txHash} status={txStatus} error={error} />
            </div>

            <button
                onClick={handleSendTip}
                disabled={!canSendTip || loading || txStatus === 'pending'}
                className="btn-primary w-full mt-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
            >
                {loading || txStatus === 'pending' ? (
                    <span className="flex items-center justify-center gap-2">
                        <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                    </span>
                ) : (
                    <span className="flex items-center justify-center gap-2">
                        Send {tipAmount} MOVE
                        <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </span>
                )}
            </button>
        </div>
    );
}
