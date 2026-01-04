/**
 * Token Launchpad Page
 * 
 * Interface for users to create and launch their own tokens on Movement.
 * currently UI only, no smart contract integration.
 */

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState, useRef } from "react";
import Head from "next/head";
import AuthGuard from "@/components/AuthGuard";
import { useLanguage } from '@/contexts/LanguageContext';
import { getCurrentNetworkConfig } from "@/lib/movement";
import { useNotifications } from "@/components/Notifications";

export default function LaunchpadPage() {
    const { account, connected, signAndSubmitTransaction } = useWallet();
    const userAddress = account?.address.toString() || "";
    const { t } = useLanguage(); // Assuming context has translation support, fallback to english if missing
    
    // Form State
    const [tokenName, setTokenName] = useState("");
    const [tokenSymbol, setTokenSymbol] = useState("");
    const [tokenDecimals, setTokenDecimals] = useState(8);
    const [tokenSupply, setTokenSupply] = useState("");
    const [description, setDescription] = useState("");
    const [website, setWebsite] = useState("");
    const [logoUrl, setLogoUrl] = useState("");
    
    // Feature Flags (UI only)
    const [isMintable, setIsMintable] = useState(false);
    const [isBurnable, setIsBurnable] = useState(true);
    const [isPausable, setIsPausable] = useState(false);
    const [enableTrading, setEnableTrading] = useState(true);

    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isDeploying, setIsDeploying] = useState(false);
    const { addNotification } = useNotifications();

    const handleDeploy = async () => {
        if (!account || !tokenName || !tokenSymbol || !tokenSupply) return;
        setIsDeploying(true);
        try {
            const config = getCurrentNetworkConfig();
            const minesAddress = config.minesAddress;
            // Handle large numbers safely if needed, but for now standard float
            const supplyRaw = BigInt(Math.floor(parseFloat(tokenSupply) * Math.pow(10, tokenDecimals)));
            
            // Basic validation for icon URI to avoid huge gas with base64
            const iconUri = (previewImage && previewImage.startsWith('http')) 
                ? previewImage 
                : "https://movefeed.xyz/logo.png"; 

            await signAndSubmitTransaction({
                data: {
                    function: `${minesAddress}::launchpad_v12::create_token`,
                    functionArguments: [
                        tokenName,
                        tokenSymbol,
                        tokenDecimals,
                        iconUri,
                        website || "https://movefeed.xyz",
                        supplyRaw.toString(),
                        enableTrading
                    ]
                }
            });
            
            addNotification("Token Deployed Successfully! 🚀", "success");
        } catch (e: any) {
            console.error("Deploy failed:", e);
             
             // Check for specific error types
             if (e.message?.includes("Module not found") || e.status === 404 || JSON.stringify(e).includes("module_not_found")) {
                  addNotification("Contract not found on chain. Please ensure the 'mines' module is deployed.", "error");
             } else if (e.message?.includes("User rejected")) {
                  addNotification("Transaction rejected by user", "info");
             } else {
                  addNotification("Token Deployment Failed: " + (e.message || "Unknown error"), "error");
             }
        } finally {
            setIsDeploying(false);
        }
    };


    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreviewImage(e.target?.result as string);
                setLogoUrl("Uploaded Image"); // Placeholder
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <AuthGuard>
            <Head>
                <title>Token Launchpad - MoveX</title>
            </Head>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_350px] gap-6 xl:divide-x xl:divide-[var(--card-border)]">
                    
                    {/* CENTER: Launch Form */}
                    <div className="lg:px-6 min-w-0">
                            <div className="mb-8">
                                <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Token Launchpad 🚀</h1>
                                <p className="text-[var(--text-secondary)]">Create and deploy your own Fungible Asset on Movement Network.</p>
                            </div>

                            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 md:p-8 space-y-8 shadow-lg">
                                {/* Section 1: Basic Info */}
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-[var(--accent)] text-black flex items-center justify-center text-sm">1</span>
                                        Token Details
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-[var(--text-secondary)]">Token Name</label>
                                            <input 
                                                type="text" 
                                                placeholder="e.g. Movement Coin"
                                                value={tokenName}
                                                onChange={(e) => setTokenName(e.target.value)}
                                                className="w-full bg-[var(--bg-primary)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-[var(--text-secondary)]">Token Symbol (Ticker)</label>
                                            <input 
                                                type="text" 
                                                placeholder="e.g. MOVE"
                                                value={tokenSymbol}
                                                onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                                                className="w-full bg-[var(--bg-primary)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors uppercase"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-[var(--text-secondary)]">Decimals</label>
                                            <input 
                                                type="number" 
                                                value={tokenDecimals}
                                                onChange={(e) => setTokenDecimals(parseInt(e.target.value))}
                                                className="w-full bg-[var(--bg-primary)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                                            />
                                            <p className="text-xs text-[var(--text-secondary)]">Standard is 8 for Movement.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-[var(--text-secondary)]">Total Supply</label>
                                            <input 
                                                type="number" 
                                                placeholder="e.g. 1000000"
                                                value={tokenSupply}
                                                onChange={(e) => setTokenSupply(e.target.value)}
                                                className="w-full bg-[var(--bg-primary)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Branding */}
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-[var(--accent)] text-black flex items-center justify-center text-sm">2</span>
                                        Branding & Metadata
                                    </h3>
                                    <div className="space-y-6">
                                        <div className="flex items-start gap-6">
                                            <div 
                                                className="w-24 h-24 rounded-2xl bg-[var(--bg-primary)] border-2 border-dashed border-[var(--card-border)] flex items-center justify-center cursor-pointer hover:border-[var(--accent)] transition-colors overflow-hidden relative"
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                {previewImage ? (
                                                    <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-center p-2">
                                                        <svg className="w-6 h-6 mx-auto text-[var(--text-secondary)] mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                        <span className="text-xs text-[var(--text-secondary)]">Upload Icon</span>
                                                    </div>
                                                )}
                                                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageSelect} />
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <label className="text-sm font-medium text-[var(--text-secondary)]">Description</label>
                                                <textarea 
                                                    placeholder="Describe your token project..."
                                                    value={description}
                                                    onChange={(e) => setDescription(e.target.value)}
                                                    className="w-full bg-[var(--bg-primary)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors h-24 resize-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-[var(--text-secondary)]">Website / Project URL</label>
                                            <input 
                                                type="url" 
                                                placeholder="https://..."
                                                value={website}
                                                onChange={(e) => setWebsite(e.target.value)}
                                                className="w-full bg-[var(--bg-primary)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Features */}
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-[var(--accent)] text-black flex items-center justify-center text-sm">3</span>
                                        Token Features
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${isBurnable ? 'bg-[var(--accent)]/10 border-[var(--accent)]' : 'bg-[var(--bg-primary)] border-[var(--card-border)]'}`}>
                                            <input type="checkbox" checked={isBurnable} onChange={(e) => setIsBurnable(e.target.checked)} className="hidden" />
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${isBurnable ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--text-secondary)]'}`}>
                                                {isBurnable && <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                            </div>
                                            <div>
                                                <span className="font-bold text-[var(--text-primary)] block">Burnable</span>
                                                <span className="text-xs text-[var(--text-secondary)]">Holders can destroy tokens</span>
                                            </div>
                                        </label>

                                        <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${isMintable ? 'bg-[var(--accent)]/10 border-[var(--accent)]' : 'bg-[var(--bg-primary)] border-[var(--card-border)]'}`}>
                                            <input type="checkbox" checked={isMintable} onChange={(e) => setIsMintable(e.target.checked)} className="hidden" />
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${isMintable ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--text-secondary)]'}`}>
                                                {isMintable && <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                            </div>
                                            <div>
                                                <span className="font-bold text-[var(--text-primary)] block">Mintable</span>
                                                <span className="text-xs text-[var(--text-secondary)]">Owner can mint more</span>
                                            </div>
                                        </label>

                                        <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${isPausable ? 'bg-[var(--accent)]/10 border-[var(--accent)]' : 'bg-[var(--bg-primary)] border-[var(--card-border)]'}`}>
                                            <input type="checkbox" checked={isPausable} onChange={(e) => setIsPausable(e.target.checked)} className="hidden" />
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${isPausable ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--text-secondary)]'}`}>
                                                {isPausable && <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                            </div>
                                            <div>
                                                <span className="font-bold text-[var(--text-primary)] block">Pausable</span>
                                                <span className="text-xs text-[var(--text-secondary)]">Owner can pause transfers</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Section 4: Liquidity & Trading */}
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-[var(--accent)] text-black flex items-center justify-center text-sm">4</span>
                                        Liquidity & Trading
                                    </h3>
                                    <div className="bg-[var(--bg-primary)] border border-[var(--card-border)] rounded-xl p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h4 className="font-bold text-[var(--text-primary)]">Enable Instant Trading</h4>
                                                    <span className="bg-green-500/10 text-green-500 text-xs px-2 py-0.5 rounded-full border border-green-500/20">Recommended</span>
                                                </div>
                                                <p className="text-sm text-[var(--text-secondary)] mb-4">
                                                    Automatically creates a liquidity pool (AMM) for your token using a virtual APT reserve. 
                                                    This allows users to buy and sell your token immediately after launch.
                                                    <br/><br/>
                                                    <span className="text-[var(--accent)]">Fair Launch:</span> 100% of the initial supply will be deposited into the liquidity pool.
                                                </p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" checked={enableTrading} onChange={(e) => setEnableTrading(e.target.checked)} className="sr-only peer" />
                                                <div className="w-11 h-6 bg-[var(--card-border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT SIDEBAR: Preview */}
                        <div className="hidden xl:block xl:pl-6 pt-6 xl:pt-0">
                            <div className="sticky top-24 space-y-6">
                                <h3 className="text-xl font-bold text-[var(--text-primary)]">Preview</h3>
                                
                                {/* Preview Card */}
                                <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-[var(--accent)] to-purple-600 opacity-20"></div>
                                    <div className="relative pt-12 text-center">
                                        <div className="w-24 h-24 mx-auto rounded-full bg-[var(--bg-primary)] border-4 border-[var(--card-bg)] shadow-lg mb-4 flex items-center justify-center overflow-hidden">
                                            {previewImage ? (
                                                <img src={previewImage} alt="Token" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-3xl font-bold text-[var(--text-secondary)]">?</div>
                                            )}
                                        </div>
                                        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
                                            {tokenName || "Token Name"}
                                        </h2>
                                        <div className="inline-block px-3 py-1 rounded-full bg-[var(--bg-primary)] border border-[var(--card-border)] text-sm font-mono text-[var(--accent)] mb-4">
                                            ${tokenSymbol || "SYMBOL"}
                                        </div>
                                        <p className="text-[var(--text-secondary)] text-sm mb-6 line-clamp-3">
                                            {description || "Token description will appear here..."}
                                        </p>
                                        
                                        <div className="grid grid-cols-2 gap-4 text-left bg-[var(--bg-primary)] rounded-lg p-4">
                                            <div>
                                                <div className="text-xs text-[var(--text-secondary)]">Supply</div>
                                                <div className="font-mono font-bold text-[var(--text-primary)]">
                                                    {parseInt(tokenSupply || "0").toLocaleString()}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-[var(--text-secondary)]">Decimals</div>
                                                <div className="font-mono font-bold text-[var(--text-primary)]">{tokenDecimals}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    className="w-full py-4 bg-[var(--accent)] hover:brightness-110 text-black font-bold text-lg rounded-xl shadow-lg shadow-[var(--accent)]/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    disabled={!tokenName || !tokenSymbol || !tokenSupply || isDeploying}
                                    onClick={handleDeploy}
                                >
                                    {isDeploying ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                            Deploying...
                                        </>
                                    ) : (
                                        <>🚀 Deploy Token</>
                                    )}
                                </button>
                                
                                <p className="text-center text-xs text-[var(--text-secondary)]">
                                    Deployment cost: ~0.5 MOVE
                                </p>
                            </div>
                        </div>
                    </div>
        </AuthGuard>
    );
}
