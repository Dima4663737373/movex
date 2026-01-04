import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState } from "react";
import Head from "next/head";
import AuthGuard from "@/components/AuthGuard";
import { useMovementTransaction } from "@/hooks/useMovementTransaction";
import { useNotifications } from "@/components/Notifications";

export default function SendTipPage() {
    const { account } = useWallet();
    const { addNotification } = useNotifications();
    const { sendTip } = useMovementTransaction();
    
    const [recipientAddress, setRecipientAddress] = useState("");
    const [amount, setAmount] = useState("");
    const [isLoading, setIsLoading] = useState(false);


    const handleSendTip = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipientAddress || !amount) return;
        
        setIsLoading(true);
        try {
            // Check if valid address
            if (!recipientAddress.startsWith('0x') || recipientAddress.length < 60) {
                 addNotification("Invalid recipient address", "error");
                 setIsLoading(false);
                 return;
            }

            const result = await sendTip(recipientAddress, parseFloat(amount), "direct_tip");
            if (result.success) {
                addNotification(`Successfully sent ${amount} MOVE to ${recipientAddress.slice(0, 6)}...`, "success");
                setAmount("");
                setRecipientAddress("");
            } else {
                addNotification("Failed to send tip", "error");
            }
        } catch (error) {
            console.error("Tip error:", error);
            addNotification("An error occurred while sending tip", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthGuard>
            <Head>
                <title>Send Tip - MoveX</title>
            </Head>

            <div className="max-w-[600px] w-full mx-auto min-h-[calc(100vh-100px)] pb-20 md:pb-0">
                <div className="p-6">
                    <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)] p-6 shadow-lg">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-[var(--accent)]/10 rounded-full flex items-center justify-center text-2xl">
                                💸
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Send MOVE</h2>
                                <p className="text-[var(--text-secondary)] text-sm">Support your favorite creators directly</p>
                            </div>
                        </div>

                        <form onSubmit={handleSendTip} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                    Recipient Address
                                </label>
                                <input
                                    type="text"
                                    value={recipientAddress}
                                    onChange={(e) => setRecipientAddress(e.target.value)}
                                    placeholder="0x..."
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--card-border)] rounded-lg px-4 py-3 focus:outline-none focus:border-[var(--accent)] transition-colors"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                    Amount (MOVE)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.0"
                                        step="0.1"
                                        min="0.1"
                                        className="w-full bg-[var(--bg-primary)] border border-[var(--card-border)] rounded-lg px-4 py-3 focus:outline-none focus:border-[var(--accent)] transition-colors pr-16"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] font-medium">
                                        MOVE
                                    </span>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || !recipientAddress || !amount}
                                className="w-full bg-[var(--accent)] text-black font-bold py-3 rounded-lg hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>Send Tip 🚀</>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
}
