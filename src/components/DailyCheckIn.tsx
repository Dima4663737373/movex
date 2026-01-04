import { useState, useEffect, useRef } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { getCurrentNetworkConfig } from "@/lib/movement";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAptosClient } from "@/lib/movementClient";

export function DailyCheckIn() {
    const { account, signAndSubmitTransaction } = useWallet();
    const { t } = useLanguage();
    const [streak, setStreak] = useState(0);
    const [canCheckIn, setCanCheckIn] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [lastCheckInTime, setLastCheckInTime] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const config = getCurrentNetworkConfig();
    const minesAddress = config.minesAddress;
    const moduleName = "daily_check_in_v12";

    // Load initial state from LocalStorage for instant feedback
    useEffect(() => {
        if (!account) return;
        try {
            const storageKeyStreak = `checkin_streak_${account.address}`;
            const storageKeyLast = `checkin_last_time_${account.address}`;
            
            const savedStreak = localStorage.getItem(storageKeyStreak);
            const savedLastTime = localStorage.getItem(storageKeyLast);
            
            if (savedStreak && savedLastTime) {
                const now = Math.floor(Date.now() / 1000);
                const dayNow = Math.floor(now / 86400);
                const dayLast = Math.floor(parseInt(savedLastTime) / 86400);
                
                // Validate if streak is still valid based on local data
                const isStreakBroken = dayNow > dayLast + 1;
                const effectiveStreak = isStreakBroken ? 0 : parseInt(savedStreak);
                
                setStreak(effectiveStreak);
                setLastCheckInTime(parseInt(savedLastTime));
                setCanCheckIn(dayNow > dayLast);
            }
        } catch (e) {
            console.error("Error loading from local storage", e);
        }
    }, [account]);

    const fetchStatus = async () => {
        if (!account) return;
        
        try {
            const client = getAptosClient();
            const resource = await client.getAccountResource({
                accountAddress: account.address,
                resourceType: `${minesAddress}::${moduleName}::CheckInState`
            });
            
            // @ts-ignore
            const data = resource;
            const now = Math.floor(Date.now() / 1000);
            const dayNow = Math.floor(now / 86400);
            const dayLast = Math.floor(Number(data.last_check_in_time) / 86400);
            
            // Visual Reset: If user missed a day, the streak is effectively broken
            // even if the contract hasn't processed it yet.
            const isStreakBroken = dayNow > dayLast + 1;
            const effectiveStreak = isStreakBroken ? 0 : Number(data.current_streak);

            setStreak(effectiveStreak);
            setLastCheckInTime(Number(data.last_check_in_time));
            
            setCanCheckIn(dayNow > dayLast);
            
        } catch (e: any) {
             if (e.message?.includes("Resource not found") || e.message?.includes("resource_not_found") || e.errorCode === "resource_not_found") {
                 // User hasn't checked in yet, this is normal
                 console.log("No check-in history found (first time user).");
             } else {
                 console.error("Error fetching check-in status:", e);
             }
             // Strict Mode: No local fallback
             setStreak(0);
             setCanCheckIn(true); // Allow trying to check in if data fetch fails (might be first time)
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [account]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleCheckIn = async () => {
        if (!account) return;
        setIsLoading(true);
        try {
            // Optimistic update (optional, but good for UX)
            // We wait for tx confirmation though to be safe
            
            await signAndSubmitTransaction({
                data: {
                    function: `${minesAddress}::${moduleName}::check_in`,
                    functionArguments: []
                }
            });
            
            // Update Local State Immediately
            const now = Math.floor(Date.now() / 1000);
            const dayNow = Math.floor(now / 86400);
            const dayLast = Math.floor(lastCheckInTime / 86400);
            
            let newStreak = streak;
            if (dayNow == dayLast + 1) {
                newStreak = streak + 1;
            } else if (dayNow > dayLast + 1) {
                newStreak = 1;
            } else if (streak === 0) {
                newStreak = 1;
            }
            
            // Save to LocalStorage immediately
            const storageKeyStreak = `checkin_streak_${account.address}`;
            const storageKeyLast = `checkin_last_time_${account.address}`;
            localStorage.setItem(storageKeyStreak, newStreak.toString());
            localStorage.setItem(storageKeyLast, now.toString());
            
            // Refresh from chain to confirm
            await fetchStatus();
            setIsOpen(false);
        } catch (e) {
            console.error("Check-in failed:", e);
        } finally {
            setIsLoading(false);
        }
    };

    if (!account) return null;

    const renderStreakCircles = () => {
        const circles = [];
        // Show 7 days window
        // If streak is 0, all gray.
        // If streak is 3, first 3 green.
        // If canCheckIn is true, next one is pulsating or waiting.
        
        for (let i = 1; i <= 7; i++) {
            let status = 'pending'; // gray
            if (i <= streak) status = 'completed'; // green
            else if (i === streak + 1 && canCheckIn) status = 'current'; // waiting

            circles.push(
                <div key={i} className="flex flex-col items-center gap-1">
                    <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                        ${status === 'completed' ? 'bg-[var(--accent)] text-black' : ''}
                        ${status === 'current' ? 'bg-[var(--card-border)] border-2 border-[var(--accent)] text-[var(--accent)] animate-pulse' : ''}
                        ${status === 'pending' ? 'bg-[var(--card-border)] text-[var(--text-secondary)]' : ''}
                    `}>
                        {status === 'completed' ? '✓' : i}
                    </div>
                    <span className="text-[10px] text-[var(--text-secondary)]">Day {i}</span>
                </div>
            );
        }
        return circles;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    relative flex items-center gap-2 px-3 py-2 rounded-xl transition-all
                    ${canCheckIn 
                        ? "bg-[var(--accent)] text-black hover:brightness-110 shadow-lg shadow-[var(--accent)]/20" 
                        : "bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-secondary)] opacity-80"}
                `}
                title={canCheckIn ? "Daily Check-in" : `Next check-in available tomorrow`}
            >
                <div className="flex flex-col items-center leading-none">
                    <span className="text-xs font-bold uppercase tracking-wider">Daily</span>
                    <span className={`text-sm font-black ${canCheckIn ? "text-black" : "text-[var(--text-primary)]"}`}>
                        {streak}🔥
                    </span>
                </div>
                {canCheckIn && (
                    <div className="w-2 h-2 rounded-full bg-red-500 absolute top-2 right-2 animate-ping" />
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-3 w-80 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-[var(--text-primary)]">Daily Check-in</h3>
                        <span className="text-sm text-[var(--text-secondary)]">Streak: <span className="text-[var(--accent)] font-bold">{streak}</span> days</span>
                    </div>

                    {/* Streak Visualizer */}
                    <div className="flex justify-between mb-6 px-1">
                        {renderStreakCircles()}
                    </div>

                    {/* Action Button */}
                    {canCheckIn ? (
                        <button 
                            onClick={handleCheckIn}
                            disabled={isLoading}
                            className="w-full py-3 bg-[var(--accent)] text-black font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? "Signing..." : "Claim Daily Reward"}
                        </button>
                    ) : (
                        <div className="text-center p-3 bg-[var(--bg-primary)] rounded-xl border border-[var(--card-border)]">
                            <p className="text-[var(--text-secondary)] text-sm">
                                Come back tomorrow to keep your streak!
                            </p>
                            <p className="text-xs text-[var(--text-secondary)] mt-1 opacity-60">
                                Next reset in {24 - new Date().getUTCHours()} hours
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
