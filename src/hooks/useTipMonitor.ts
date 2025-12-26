import { useEffect, useRef } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { getTipHistory } from '@/lib/movementClient';
import { useNotifications } from '@/components/Notifications';

export function useTipMonitor() {
    const { account } = useWallet();
    const { addNotification } = useNotifications();
    const lastTipTimestampRef = useRef<number>(0);
    const isFirstLoadRef = useRef(true);

    useEffect(() => {
        if (!account?.address) return;

        const checkTips = async () => {
            try {
                // Fetch tips where current user is the recipient
                // console.log(`🔍 Checking tips for ${account.address}...`);
                const history = await getTipHistory(account.address.toString());
                // console.log(`📊 Found ${history.length} total tips`);

                // Debug: Log first few tips to check structure
                if (history.length > 0) {
                    // console.log("First tip structure:", JSON.stringify(history[0], null, 2));
                }

                // Filter for received tips only (case insensitive)
                const userAddress = account.address.toString().toLowerCase();
                const receivedTips = history.filter((tip: any) => {
                    // Check receiver field (normalized)
                    // TipHistory now returns 'receiver' from event 'creator'
                    const receiver = tip.receiver?.toString().toLowerCase();

                    // Normalize both addresses for comparison (remove 0x to be safe)
                    const normalizedReceiver = receiver?.replace(/^0x/, '');
                    const normalizedUser = userAddress.replace(/^0x/, '');

                    return normalizedReceiver === normalizedUser && tip.type === 'received';
                });
                // console.log(`📥 Received tips: ${receivedTips.length}`);

                if (receivedTips.length === 0) return;

                // Sort by timestamp descending
                const latestTip = receivedTips[0];
                const latestTimestamp = latestTip.timestamp;
                // console.log(`⏱️ Latest tip timestamp: ${latestTimestamp}, Last checked: ${lastTipTimestampRef.current}`);

                // On first load, just set the baseline
                if (isFirstLoadRef.current) {
                    // console.log("🏁 First load, setting baseline.");
                    lastTipTimestampRef.current = latestTimestamp;
                    isFirstLoadRef.current = false;
                    return;
                }

                // Check for new tips
                if (latestTimestamp > lastTipTimestampRef.current) {
                    // console.log("🎉 NEW TIP DETECTED!");
                    
                    // Check if notifications are enabled
                    const notifyTips = localStorage.getItem('settings_notify_tips');
                    const soundEnabled = localStorage.getItem('sound_enabled');
                    
                    // Default to true if not set (legacy behavior)
                    if (notifyTips !== 'false') {
                        // We have a new tip!
                        const amount = latestTip.amount;
                        // Use sender address, formatted
                        const senderAddr = latestTip.sender || "Unknown";
                        const senderDisplay = `${senderAddr.substring(0, 6)}...${senderAddr.substring(senderAddr.length - 4)}`;

                        addNotification(`You received ${amount} MOVE from ${senderDisplay}!`, 'success', { persist: true });
                        
                        // Play sound if enabled
                        if (soundEnabled === 'true') {
                            // Placeholder for sound effect
                            // const audio = new Audio('/sounds/coin.mp3');
                            // audio.play().catch(e => console.error("Error playing sound", e));
                        }
                    }
                    
                    lastTipTimestampRef.current = latestTimestamp;
                }
            } catch (error) {
                console.error("Error monitoring tips:", error);
            }
        };

        // Check immediately
        checkTips();

        // Removed automatic polling interval as requested by user
        // const interval = setInterval(checkTips, 5000);
        // return () => clearInterval(interval);
    }, [account?.address, addNotification]);
}
