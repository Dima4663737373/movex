import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState, useEffect } from "react";
import Head from "next/head";
import AuthGuard from "@/components/AuthGuard";
import { useNotifications } from "@/components/Notifications";
import { Aptos, AptosConfig, Network, AccountAddress } from "@aptos-labs/ts-sdk";
import { getCurrentNetworkConfig, MOVEMENT_TESTNET_RPC } from "@/lib/movement";
import { moveToOctas, octasToMove } from "@/lib/movement";

// Module Constants
const MODULE_NAME = "red_packet_v10";
const RESOURCE_ACCOUNT_SEED = new Uint8Array([7]); // x"07"

interface RedPocket {
    id: string; // The code
    creator: string;
    totalAmount: number;
    remainingAmount: number;
    totalGifts: number;
    remainingGifts: number;
    type: 'random' | 'equal';
    message: string;
    claims: { claimer: string; amount: number; timestamp: number }[]; // timestamp might be missing in on-chain data if not stored
    timestamp: number;
}

// On-Chain Data Structures
interface OnChainPacket {
    creator: string;
    total_amount: string;
    remaining_amount: string;
    total_count: string;
    remaining_count: string;
    is_random: boolean;
    claimers: string[];
    message: string;
    timestamp: string;
}

interface PacketStore {
    packets: OnChainPacket[];
    packet_codes: string[];
}

export default function RedPocketPage() {
    const { account, signAndSubmitTransaction, network } = useWallet();
    const userAddress = account?.address.toString() || "";
    const { addNotification } = useNotifications();

    const [activeTab, setActiveTab] = useState<'send' | 'receive'>('send');
    
    // Send Form State
    const [amount, setAmount] = useState("");
    const [numGifts, setNumGifts] = useState("");
    const [message, setMessage] = useState("Best Wishes 🧧");
    const [pocketType, setPocketType] = useState<'random' | 'equal'>('random');
    const [createdCode, setCreatedCode] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Receive Form State
    const [claimCode, setClaimCode] = useState("");
    const [claimResult, setClaimResult] = useState<{ amount: number; sender: string } | null>(null);
    const [isClaiming, setIsClaiming] = useState(false);

    // History
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isInitialized, setIsInitialized] = useState(true);
    const [isInitializing, setIsInitializing] = useState(false);

    // Initialize Aptos Client
    const config = new AptosConfig({ 
        network: Network.CUSTOM, 
        fullnode: MOVEMENT_TESTNET_RPC
    });
    const client = new Aptos(config);

    // Get Module Address from config
    const networkConfig = getCurrentNetworkConfig();
    const MODULE_ADDRESS = networkConfig.minesAddress || networkConfig.moduleAddress;

    useEffect(() => {
        if (userAddress) {
            loadHistory();
        }
    }, [userAddress]);

    const handleInitialize = async () => {
        setIsInitializing(true);
        try {
            const transaction = {
                data: {
                    function: `${MODULE_ADDRESS}::${MODULE_NAME}::initialize`,
                    functionArguments: [],
                    typeArguments: []
                }
            };
            const response = await signAndSubmitTransaction(transaction as any);
            await client.waitForTransaction({ transactionHash: response.hash });
            addNotification("Contract initialized successfully!", "success");
            setIsInitialized(true);
            loadHistory();
        } catch (error) {
            console.error("Error initializing contract:", error);
            addNotification("Failed to initialize contract", "error");
        } finally {
            setIsInitializing(false);
        }
    };

    const loadHistory = async () => {
        if (!MODULE_ADDRESS) return;
        setIsLoadingHistory(true);
        try {
            // Fetch PacketStore Resource
            // Note: The PacketStore resource is stored on the publisher's account (MODULE_ADDRESS),
            // while the funds are held in the Resource Account.
            const resource = await client.getAccountResource({
                accountAddress: MODULE_ADDRESS,
                resourceType: `${MODULE_ADDRESS}::${MODULE_NAME}::PacketStore`
            }) as unknown as PacketStore;

            setIsInitialized(true);

            if (!resource) {
                // setHistory([]);
                return;
            }
            
            // Log to prevent unused variable error
            console.log("Red Pocket Resource:", resource);

            // Map to RedPocket interface
            /*
            const pockets: RedPocket[] = resource.packets.map((p, index) => {
                const code = resource.packet_codes[index];
                return {
                    id: code,
                    creator: p.creator,
                    totalAmount: octasToMove(parseInt(p.total_amount)),
                    remainingAmount: octasToMove(parseInt(p.remaining_amount)),
                    totalGifts: parseInt(p.total_count),
                    remainingGifts: parseInt(p.remaining_count),
                    type: p.is_random ? 'random' : 'equal',
                    message: p.message,
                    claims: p.claimers.map(c => ({ claimer: c, amount: 0, timestamp: 0 })), // Amount/Time not stored in simple vector<address>
                    timestamp: parseInt(p.timestamp) * 1000 // Convert seconds to ms
                };
            });

            // Filter relevant pockets
            const userPockets = pockets.filter(p => 
                p.creator === userAddress || p.claims.some(c => c.claimer === userAddress)
            ).sort((a, b) => b.timestamp - a.timestamp);

            setHistory(userPockets);
            */
        } catch (e: any) {
            // Handle resource not found (contract not initialized)
            const isResourceNotFound = 
                e?.data?.error_code === "resource_not_found" || 
                e?.message?.includes("resource_not_found") ||
                e?.message?.includes("Resource not found");

            if (isResourceNotFound) {
                setIsInitialized(false);
                // setHistory([]);
            } else {
                console.error("Failed to load red pockets", e);
            }
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const generateCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    const handleCreate = async () => {
        if (!amount || !numGifts || !account) return;

        // Check Network
        if (network && network.chainId && network.chainId.toString() !== '250') {
             addNotification("Please switch your wallet to Movement Bardock Testnet", "error");
             return;
        }

        setIsCreating(true);

        try {
            const code = generateCode();
            const amountOctas = moveToOctas(parseFloat(amount));
            
            // Check Balance
            try {
                const balanceResource = await client.getAccountResource({
                    accountAddress: userAddress,
                    resourceType: "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
                }) as any;
                
                const balance = parseInt(balanceResource.coin.value);
                if (balance < amountOctas) {
                    addNotification(`Insufficient balance. You have ${octasToMove(balance)} MVT, but tried to send ${amount}.`, "error");
                    setIsCreating(false);
                    return;
                }
            } catch (e) {
                console.error("Failed to fetch balance", e);
                // If CoinStore doesn't exist, balance is effectively 0
                addNotification("Insufficient balance or account not initialized.", "error");
                setIsCreating(false);
                return;
            }

            const transaction = {
                data: {
                    function: `${MODULE_ADDRESS}::${MODULE_NAME}::create_packet`,
                    functionArguments: [
                        code,
                        amountOctas,
                        parseInt(numGifts),
                        pocketType === 'random',
                        message || "Best Wishes 🧧"
                    ]
                }
            };

            const response = await signAndSubmitTransaction(transaction as any);
            await client.waitForTransaction({ transactionHash: response.hash });

            setCreatedCode(code);
            addNotification("Red Pocket created successfully!", "success");
            loadHistory();
        } catch (e: any) {
            console.error(e);
            addNotification("Failed to create Red Pocket: " + (e.message || "Unknown error"), "error");
        } finally {
            setIsCreating(false);
        }
    };

    const handleClaim = async () => {
        if (!claimCode || !account) return;

        // Check Network
        if (network && network.chainId && network.chainId.toString() !== '250') {
             addNotification("Please switch your wallet to Movement Bardock Testnet", "error");
             return;
        }

        setIsClaiming(true);
        setClaimResult(null);

        try {
            const transaction = {
                data: {
                    function: `${MODULE_ADDRESS}::${MODULE_NAME}::claim_packet`,
                    functionArguments: [
                        claimCode
                    ]
                }
            };

            const response = await signAndSubmitTransaction(transaction as any);
            const committedTxn = await client.waitForTransaction({ transactionHash: response.hash });

            // Parse events to find the received amount
            // Look for 0x1::coin::DepositEvent where the account is the user
            let claimedAmount = 0;
            if ((committedTxn as any).events) {
                const depositEvent = (committedTxn as any).events.find((e: any) => {
                    return e.type === "0x1::coin::DepositEvent" && 
                           (e.guid?.account_address === userAddress || e.data?.store === userAddress);
                });
                
                if (depositEvent && depositEvent.data && depositEvent.data.amount) {
                    claimedAmount = octasToMove(parseInt(depositEvent.data.amount));
                }
            }
            
            addNotification("Red Pocket claimed successfully!", "success");
            loadHistory();
            
            setClaimResult({ amount: claimedAmount, sender: "Red Pocket" });
            
        } catch (e: any) {
            console.error(e);
            addNotification("Failed to claim Red Pocket: " + (e.message || "Unknown error"), "error");
        } finally {
            setIsClaiming(false);
        }
    };

    return (
        <AuthGuard>
            <Head>
                <title>Red Pocket - MoveX</title>
            </Head>

            <div className="max-w-[1280px] mx-auto min-h-screen lg:px-6 pt-6">
                {/* Initialize Button for Owner */}
                {!isInitialized && userAddress?.toLowerCase() === MODULE_ADDRESS?.toLowerCase() && (
                    <div className="mb-8 p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                        <h3 className="text-lg font-bold text-yellow-500 mb-2">Contract Not Initialized</h3>
                        <p className="text-[var(--text-secondary)] mb-4">
                            The Red Packet contract needs to be initialized before it can be used.
                        </p>
                        <button
                            onClick={handleInitialize}
                            className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-lg transition-colors"
                        >
                            Initialize Contract
                        </button>
                    </div>
                )}

                <div className="mb-8 flex items-center gap-3">
                    <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center text-2xl shadow-lg shadow-red-500/20">
                        🧧
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-[var(--text-primary)]">Red Pocket</h1>
                        <p className="text-[var(--text-secondary)]">Send and receive crypto gifts (On-Chain).</p>
                    </div>
                </div>

                <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-xl">
                    {/* Tabs */}
                    <div className="flex border-b border-[var(--card-border)]">
                        <button
                            onClick={() => setActiveTab('send')}
                            className={`flex-1 py-4 font-bold text-lg transition-colors ${
                                activeTab === 'send' 
                                    ? 'bg-red-500/10 text-red-500 border-b-2 border-red-500' 
                                    : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                            }`}
                        >
                            Send
                        </button>
                        <button
                            onClick={() => setActiveTab('receive')}
                            className={`flex-1 py-4 font-bold text-lg transition-colors ${
                                activeTab === 'receive' 
                                    ? 'bg-red-500/10 text-red-500 border-b-2 border-red-500' 
                                    : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                            }`}
                        >
                            Receive
                        </button>
                    </div>

                    <div className="p-6 md:p-8 min-h-[400px]">
                        {activeTab === 'send' ? (
                            !createdCode ? (
                                <div className="space-y-6 max-w-md mx-auto">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-[var(--text-secondary)]">Total Amount (MVT)</label>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:border-red-500 focus:outline-none transition-colors"
                                            placeholder="0.00"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-[var(--text-secondary)]">Number of Gifts</label>
                                        <input
                                            type="number"
                                            value={numGifts}
                                            onChange={(e) => setNumGifts(e.target.value)}
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:border-red-500 focus:outline-none transition-colors"
                                            placeholder="e.g. 10"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div 
                                            onClick={() => setPocketType('random')}
                                            className={`cursor-pointer border rounded-xl p-4 text-center transition-all ${
                                                pocketType === 'random' 
                                                    ? 'border-red-500 bg-red-500/5 text-red-500' 
                                                    : 'border-[var(--card-border)] text-[var(--text-secondary)] hover:border-red-500/50'
                                            }`}
                                        >
                                            <div className="text-2xl mb-1">🎲</div>
                                            <div className="font-bold">Random</div>
                                            <div className="text-xs opacity-70">Lucky Draw</div>
                                        </div>
                                        <div 
                                            onClick={() => setPocketType('equal')}
                                            className={`cursor-pointer border rounded-xl p-4 text-center transition-all ${
                                                pocketType === 'equal' 
                                                    ? 'border-red-500 bg-red-500/5 text-red-500' 
                                                    : 'border-[var(--card-border)] text-[var(--text-secondary)] hover:border-red-500/50'
                                            }`}
                                        >
                                            <div className="text-2xl mb-1">⚖️</div>
                                            <div className="font-bold">Equal</div>
                                            <div className="text-xs opacity-70">Split Evenly</div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-[var(--text-secondary)]">Best Wishes</label>
                                        <textarea
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:border-red-500 focus:outline-none transition-colors resize-none"
                                            rows={2}
                                            maxLength={50}
                                        />
                                    </div>

                                    <button
                                        onClick={handleCreate}
                                        disabled={isCreating || !amount || !numGifts}
                                        className="w-full py-4 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                    >
                                        {isCreating ? 'Creating (On-Chain)...' : 'Create Red Pocket'}
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-10 animate-fade-in">
                                    <div className="w-24 h-24 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Red Pocket Created!</h2>
                                    <p className="text-[var(--text-secondary)] mb-8">Share this code with your friends to claim.</p>
                                    
                                    <div className="bg-[var(--bg-primary)] border border-[var(--card-border)] rounded-xl p-6 max-w-sm mx-auto mb-8">
                                        <p className="text-sm text-[var(--text-secondary)] mb-2">Code</p>
                                        <div className="text-3xl font-mono font-bold tracking-widest text-[var(--accent)] select-all">
                                            {createdCode}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setCreatedCode(null);
                                            setAmount("");
                                            setNumGifts("");
                                            setMessage("Best Wishes 🧧");
                                        }}
                                        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
                                    >
                                        Create Another
                                    </button>
                                </div>
                            )
                        ) : (
                            <div className="max-w-md mx-auto py-10">
                                {!claimResult ? (
                                    <div className="space-y-6">
                                        <div className="text-center mb-8">
                                            <div className="text-6xl mb-4 animate-bounce-slow">🧧</div>
                                            <h3 className="text-xl font-bold text-[var(--text-primary)]">Open a Red Pocket</h3>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-[var(--text-secondary)]">Enter Code</label>
                                            <input
                                                type="text"
                                                value={claimCode}
                                                onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                                                className="w-full bg-[var(--bg-primary)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-center text-xl font-mono tracking-wider focus:border-red-500 focus:outline-none transition-colors"
                                                placeholder="XXXXXXXX"
                                                maxLength={8}
                                            />
                                        </div>

                                        <button
                                            onClick={handleClaim}
                                            disabled={isClaiming || claimCode.length !== 8}
                                            className="w-full py-4 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                        >
                                            {isClaiming ? 'Claiming...' : 'Open Packet'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center animate-fade-in">
                                        <div className="text-6xl mb-4">🎉</div>
                                        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Congratulations!</h2>
                                        <p className="text-[var(--text-secondary)] mb-6">You received a gift.</p>
                                        
                                        <div className="text-4xl font-bold text-[var(--accent)] mb-8">
                                            {claimResult.amount} <span className="text-xl text-[var(--text-secondary)]">MVT</span>
                                        </div>

                                        <button
                                            onClick={() => {
                                                setClaimResult(null);
                                                setClaimCode("");
                                            }}
                                            className="px-8 py-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl font-bold hover:bg-[var(--hover-bg)] transition-colors"
                                        >
                                            Open Another
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <style jsx>{`
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 2s infinite ease-in-out;
                }
            `}</style>
        </AuthGuard>
    );
}
