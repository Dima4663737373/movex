import React, { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import AuthGuard from '@/components/AuthGuard';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { NETWORKS } from '@/lib/movement';
import RightSidebar from '@/components/RightSidebar';


interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: Date;
    image?: string;
}

// ==========================================
// KNOWLEDGE BASE (The Brain)
// ==========================================
// This replaces the simple if/else logic with a structured data source.
// It allows us to match keywords to specific, high-quality answers.

const KNOWLEDGE_BASE = [
    // --- CORE NETWORK & ARCHITECTURE ---
    {
        keywords: ['movement', 'what is', 'architecture', 'm1', 'm2', 'network'],
        answer: "**Movement Network** is a network of Move-based blockchains.\n\n• **M1:** A community-first blockchain designed for high throughput and decentralization.\n• **M2:** The first Move L2 on Ethereum, bringing Move execution to the EVM world.\n• **Fractal Scaling:** Movement allows launching custom Move rollups easily.\n• **Snowman Consensus:** Used for high-speed finality."
    },
    {
        keywords: ['fast', 'finality', 'tps', 'speed', 'throughput'],
        answer: "**Performance:**\n\nMovement aims for **160,000+ TPS** with sub-second finality. It uses the **MoveVM** for parallel execution (Block-STM), allowing transactions that don't overlap to process simultaneously."
    },

    // --- RPC & CONNECTIVITY ---
    {
        keywords: ['rpc', 'endpoint', 'url', 'connection', 'connect', 'node'],
        answer: "Here are the RPC endpoints for Movement:\n\n**Movement Bardock (Testnet):**\n`https://aptos.testnet.bardock.movementlabs.xyz/v1`\n\n**Movement Porto (Testnet):**\n`https://aptos.testnet.porto.movementlabs.xyz/v1`\n\n**Chain ID:** 250 (0xfa)\n\nUse these in your wallet settings or code to connect!"
    },
    {
        keywords: ['chain id', 'chainid', 'network id'],
        answer: "**Movement Chain IDs:**\n\n• **Bardock Testnet:** 250 (0xfa)\n• **Porto Testnet:** 177 (0xb1)\n\nMake sure your wallet is set to the correct ID."
    },
    {
        keywords: ['explorer', 'scan', 'transaction', 'hash', 'view'],
        answer: "You can track transactions on the **Movement Explorer**:\n\n• **Bardock:** https://explorer.testnet.bardock.movementlabs.xyz/\n• **Porto:** https://explorer.testnet.porto.movementlabs.xyz/\n• **Scan:** https://scan.movementlabs.xyz/"
    },

    // --- TOKENS & FAUCET ---
    {
        keywords: ['faucet', 'token', 'funds', 'mint', 'get move', 'money', 'airdrop'],
        answer: "**Need Testnet MOVE?** 🚰\n\n1. Go to: https://faucet.movementlabs.xyz/\n2. Enter your address.\n3. Click 'Get MOVE'.\n\n**Bridge:** You can also bridge assets (ETH/USDC) using https://bridge.testnet.movementlabs.xyz/"
    },
    {
        keywords: ['move token', 'utility', 'gas', 'staking'],
        answer: "**MOVE Token Utility:**\n\n• **Gas Fees:** Used to pay for transactions.\n• **Staking:** Secure the network via PoS.\n• **Governance:** Vote on protocol upgrades.\n• **Liquidity:** Base asset for DeFi on Movement."
    },

    // --- DEVELOPMENT (MOVE LANGUAGE) ---
    {
        keywords: ['code', 'example', 'snippet', 'hello world', 'smart contract', 'move module'],
        answer: "Here is a simple **Hello World** module in Move:\n\n```move\nmodule 0x1::HelloWorld {\n    use std::string;\n    use std::debug;\n\n    struct Message has key, drop {\n        content: string::String\n    }\n\n    public entry fun say_hello() {\n        let msg = string::utf8(b\"Hello Movement!\");\n        debug::print(&msg);\n    }\n}\n```\n\nCompile with `movement move compile` or `aptos move compile`."
    },
    {
        keywords: ['coin', 'transfer', 'send', 'move coin'],
        answer: "**Transferring Coins in Move:**\n\n```move\npublic entry fun transfer_coins(sender: &signer, recipient: address, amount: u64) {\n    use aptos_framework::coin;\n    use aptos_framework::aptos_coin::AptosCoin;\n    \n    coin::transfer<AptosCoin>(sender, recipient, amount);\n}\n```\n\nThis uses the standard `aptos_framework::coin` module."
    },
    {
        keywords: ['resource', 'struct', 'store', 'key', 'capability', 'abilities'],
        answer: "**Move Abilities** define what you can do with a type:\n\n• `key`: Can be stored in global storage (needs a signer).\n• `store`: Can be stored inside other structs.\n• `drop`: Can be discarded/destroyed.\n• `copy`: Can be copied (non-unique data).\n\nExample:\n```move\nstruct Coin has store { val: u64 }\nstruct Wallet has key { balance: Coin }\n```"
    },
    {
        keywords: ['signer', 'authentication', 'permission'],
        answer: "**The `signer` type:**\n\nIn Move, a `&signer` argument represents a verified authority (the user who signed the transaction). You CANNOT fake a signer. \n\n```move\npublic entry fun init_account(account: &signer) {\n    let addr = signer::address_of(account);\n    // Now we can move resources to 'addr'\n}\n```"
    },
    {
        keywords: ['move.toml', 'toml', 'dependency', 'framework', 'config'],
        answer: "**Move.toml Configuration:**\n\n```toml\n[package]\nname = \"MyProject\"\nversion = \"0.0.1\"\n\n[dependencies]\nAptosFramework = { git = \"https://github.com/aptos-labs/aptos-core.git\", subdir = \"aptos-move/framework/aptos-framework\", rev = \"main\" }\n\n[addresses]\nmy_addr = \"0x123\"\n```"
    },
    {
        keywords: ['aptos', 'compatibility', 'difference'],
        answer: "**Aptos Compatibility:**\n\nMovement is **fully compatible** with the Aptos Move framework. You can use:\n• Aptos CLI\n• Aptos Wallets (Petra, Pontem)\n• Aptos Standard Libraries\n\nJust change the RPC endpoint to Movement's URL!"
    },

    // --- CLI & TOOLS ---
    {
        keywords: ['cli', 'command', 'install', 'terminal', 'setup'],
        answer: "**Movement CLI Setup:**\n\nSince Movement is Aptos-compatible, you can use the Aptos CLI:\n\n1. **Install:** `brew install aptos` (Mac) or download binary.\n2. **Init:** `aptos init`\n3. **Select Network:** Choose 'Custom' and enter the Movement RPC.\n\nTo compile: `aptos move compile`\nTo publish: `aptos move publish`"
    },

    // --- ECOSYSTEM & APPS ---
    {
        keywords: ['wallet', 'razor', 'nightly', 'pontem', 'petra', 'martian'],
        answer: "**Recommended Wallets:**\n\n• **Nightly:** Great support for Movement.\n• **Razor:** Optimized for Move chains.\n• **Petra:** Standard Aptos wallet (works if RPC is configured).\n• **Pontem / Martian:** Solid alternatives.\n\n⚠️ **Tip:** Always verify you are on the correct Chain ID (250)."
    },
    {
        keywords: ['bridge', 'galxe', 'quest', 'points', 'guild'],
        answer: "**Movement Community Program:**\n\nParticipate in quests on **Galxe** to earn points! Use the official bridge to bring ETH/USDC to Movement Testnet. Join the 'Guild' to get Discord roles."
    },
    
    // --- APP SPECIFIC (MoveX) ---
    {
        keywords: ['tip', 'donate', 'money', 'support', 'coffee'],
        answer: "**Tipping on MoveX:**\n\n1. Find a post you like.\n2. Click the 'Gift' icon.\n3. Select amount (Coin, Coffee, Heart).\n4. Confirm in wallet.\n\nTips go **directly** to the creator's wallet. No middleman fees!"
    },
    {
        keywords: ['post', 'create', 'write', 'image', 'ipfs'],
        answer: "**Creating Content:**\n\nClick 'Compose' on the left. You can write text, upload images (stored on IPFS/Supabase), and even attach mini-apps. All posts are anchored on-chain."
    },
    {
        keywords: ['mini app', 'miniapp', 'prediction', 'market', 'leaderboard'],
        answer: "**Mini Apps** are embedded Move dApps.\n\n• **Token Drop:** Create a claimable token event.\n• **Prediction Market:** Bet on binary outcomes.\n• **Leaderboard:** See top creators.\n\nGo to the 'Mini Apps' tab to try them!"
    },

    // --- TROUBLESHOOTING ---
    {
        keywords: ['error', 'failed', 'gas', 'sequence', 'rejected'],
        answer: "**Common Errors:**\n\n• **Sequence Number too old:** Your wallet is out of sync. Refresh or reset account in wallet settings.\n• **Out of Gas:** You need more MOVE tokens. Use the faucet.\n• **Simulation Failed:** The smart contract logic reverted. Check your conditions (e.g., sufficient balance)."
    }
];

// ==========================================
// AI LOGIC
// ==========================================

const findBestAnswer = (input: string): string => {
    const lowerInput = input.toLowerCase();
    
    // 1. Exact Greeting Match
    if (lowerInput.match(/^(hi|hello|hey|greetings|yo)/)) {
        return "Hello! I am Movel, your expert guide to the Movement Network. Ask me anything about RPCs, Code, or the Ecosystem! 🧠";
    }

    // 2. Keyword Scoring
    let bestMatch = null;
    let maxScore = 0;

    for (const entry of KNOWLEDGE_BASE) {
        let score = 0;
        let matchedKeywords = 0;
        
        for (const keyword of entry.keywords) {
            if (lowerInput.includes(keyword)) {
                score += 1;
                matchedKeywords++;
            }
        }
        
        // Boost score if multiple keywords match (better specificity)
        if (matchedKeywords > 1) score += 1;

        if (score > maxScore) {
            maxScore = score;
            bestMatch = entry;
        }
    }

    // 3. Return Best Match or Fallback
    if (bestMatch && maxScore > 0) {
        return bestMatch.answer;
    }
    
    // 4. Fallback (The "Internet" Simulation)
    // If we don't know, we provide general helpful links instead of "I don't know".
    return "That's a great question. While I don't have the exact specific answer right here, here are the best resources to find it:\n\n• **Official Docs:** https://docs.movementlabs.xyz/\n• **GitHub:** https://github.com/movementlabsxyz\n• **Discord:** Join the Movement server for dev support.\n\nTry asking about 'RPC', 'Faucet', or 'Code Examples'!";
};


export default function MovementAIPage() {
    const { account } = useWallet();
    const userAddress = account?.address?.toString() || '';
    
    // Mock data for RightSidebar
    const stats = {
        totalTips: 450,
        totalVolume: 15.5,
        topTipper: "None"
    };

    // Chat State
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: "Hello! I'm Movel 🧠\n\nI know everything about Movement Network. Ask me for:\n\n• RPC Endpoints & Chain IDs\n• Code Snippets (Move)\n• Faucets & Bridges\n• How to use this app\n\nWhat do you need?",
            sender: 'ai',
            timestamp: new Date()
        }
    ]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const clearImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((!inputText.trim() && !selectedImage) || isTyping) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: inputText,
            sender: 'user',
            timestamp: new Date(),
            image: imagePreview || undefined
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        clearImage();
        setIsTyping(true);

        // Simulate AI processing
        setTimeout(() => {
            const aiResponse = findBestAnswer(userMessage.text);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                text: aiResponse,
                sender: 'ai',
                timestamp: new Date()
            }]);
            setIsTyping(false);
        }, 600); // Fast response
    };

    return (
        <AuthGuard>
            <Head>
                <title>Movel | Movement AI Expert</title>
                <meta name="description" content="Movel - Your Movement Ecosystem Assistant" />
            </Head>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 xl:divide-x xl:divide-[var(--card-border)]">
                    
                    {/* CENTER CONTENT - CHAT INTERFACE */}
                    <div className="min-w-0 lg:px-6 pt-6 flex flex-col h-[calc(100vh-140px)]">
                            {/* Page Title */}
                            <div className="mb-4 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg animate-pulse">
                                        <span className="text-2xl">🧠</span>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Movel AI</h2>
                                        <p className="text-xs text-[var(--text-secondary)]">Movement Ecosystem Expert</p>
                                    </div>
                                </div>
                            </div>

                            {/* Chat Window */}
                            <div className="flex-1 flex flex-col bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden shadow-sm">
                                
                                {/* Messages Area */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {messages.map((msg) => (
                                        <div 
                                            key={msg.id} 
                                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div 
                                                className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm ${
                                                    msg.sender === 'user' 
                                                        ? 'bg-[var(--accent)] text-black rounded-tr-none' 
                                                        : 'bg-[var(--hover-bg)] text-[var(--text-primary)] rounded-tl-none border border-[var(--card-border)]'
                                                }`}
                                            >
                                                {msg.image && (
                                                    <div className="mb-2 rounded-lg overflow-hidden">
                                                        <img src={msg.image} alt="User attachment" className="max-w-full h-auto max-h-60 object-cover" />
                                                    </div>
                                                )}
                                                {/* Render Markdown-like content simply */}
                                                <div className="whitespace-pre-wrap leading-relaxed text-sm md:text-base font-medium">
                                                    {msg.text.split('```').map((part, index) => {
                                                        if (index % 2 === 1) {
                                                            // Code block
                                                            return (
                                                                <div key={index} className="my-2 bg-black/80 text-green-400 p-3 rounded-lg font-mono text-xs overflow-x-auto border border-white/10">
                                                                    {part.replace(/^move/, '').trim()}
                                                                </div>
                                                            );
                                                        }
                                                        // Regular text
                                                        return <span key={index} dangerouslySetInnerHTML={{ 
                                                            __html: part
                                                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
                                                                .replace(/`([^`]+)`/g, '<code class="bg-black/20 px-1 rounded font-mono text-xs">$1</code>') // Inline code
                                                        }} />;
                                                    })}
                                                </div>
                                                <div className={`text-[10px] mt-2 text-right opacity-60 ${msg.sender === 'user' ? 'text-black' : 'text-[var(--text-secondary)]'}`}>
                                                    {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {isTyping && (
                                        <div className="flex justify-start">
                                            <div className="bg-[var(--hover-bg)] border border-[var(--card-border)] rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1">
                                                <div className="w-2 h-2 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                                <div className="w-2 h-2 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                                <div className="w-2 h-2 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input Area */}
                                <div className="p-4 border-t border-[var(--card-border)] bg-[var(--card-bg)]">
                                    {imagePreview && (
                                        <div className="mb-2 relative inline-block">
                                            <img src={imagePreview} alt="Preview" className="h-20 rounded-lg border border-[var(--card-border)]" />
                                            <button 
                                                onClick={clearImage}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md"
                                            >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                    
                                    <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                                        <input 
                                            type="file" 
                                            ref={fileInputRef}
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleImageSelect}
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="p-3 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--hover-bg)] rounded-full transition-colors"
                                            title="Attach Image"
                                        >
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </button>
                                        
                                        <div className="flex-grow relative">
                                            <textarea
                                                value={inputText}
                                                onChange={(e) => setInputText(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSendMessage();
                                                    }
                                                }}
                                                placeholder="Ask about Movement (RPC, Code, Faucets)..."
                                                className="w-full bg-[var(--hover-bg)] border-none rounded-xl py-3 px-4 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)] resize-none max-h-32 min-h-[48px]"
                                                rows={1}
                                                style={{ height: 'auto' }} 
                                            />
                                        </div>

                                        <button 
                                            type="submit"
                                            disabled={(!inputText.trim() && !selectedImage) || isTyping}
                                            className="p-3 bg-[var(--accent)] text-black rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                        >
                                            <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                            </svg>
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT SIDEBAR */}
                        <div className="hidden xl:block xl:pl-6 pt-6">
                            <RightSidebar
                                posts={[]} 
                                stats={stats}
                                currentUserAddress={userAddress}
                                profiles={{}}
                            />
                        </div>

                    </div>
        </AuthGuard>
    );
}