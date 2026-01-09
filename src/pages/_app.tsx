/**
 * App Component
 * 
 * This is the root component that wraps all pages.
 * It initializes:
 * - Wallet adapter provider for on-chain transactions (Petra, Razor, etc.)
 */

import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { WalletProvider } from "@/components/WalletProvider";
import { useEffect } from "react";

import { NotificationsProvider, NotificationButton } from "@/components/Notifications";
import { ThemeProvider } from "@/components/ThemeSwitcher";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { NetworkProvider } from "@/contexts/NetworkContext";
import { SocialActivityProvider } from "@/contexts/SocialActivityContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { useTipMonitor } from "@/hooks/useTipMonitor";
import { BackgroundGradient } from "@/components/BackgroundGradient";
import { DailyCheckIn } from "@/components/DailyCheckIn";
import { PageLoader } from "@/components/PageLoader";
import MainLayout from "@/components/MainLayout";

function TipMonitor() {
    useTipMonitor();

    useEffect(() => {
        console.log("🔔 TipMonitor mounted");
    }, []);

    return null;
}

export default function App({ Component, pageProps }: AppProps) {
    const router = useRouter();
    const isLandingPage = router.pathname === "/";

    useEffect(() => {
        console.log("🚀 App Version: 1.0.1 - Fixes Applied (Explore, Supabase)");
        
        // Suppress SDK console warnings about CUSTOM network
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalInfo = console.info;
        
        const suppressSDKWarnings = (...args: any[]) => {
            const message = args[0]?.toString?.() || '';
            if (message.includes('CUSTOM network') || message.includes('lookup ChainId')) {
                return false;
            }
            return true;
        };
        
        console.log = (...args: any[]) => {
            if (suppressSDKWarnings(...args)) {
                originalLog.apply(console, args);
            }
        };
        console.warn = (...args: any[]) => {
            if (suppressSDKWarnings(...args)) {
                originalWarn.apply(console, args);
            }
        };
        console.info = (...args: any[]) => {
            if (suppressSDKWarnings(...args)) {
                originalInfo.apply(console, args);
            }
        };
        
        // Suppress Nightly Wallet extension errors
        const handleError = (event: ErrorEvent) => {
            const errorMessage = event.message?.toString() || '';
            const errorFilename = event.filename?.toString() || '';
            
            // Suppress Nightly Wallet extension errors
            if (
                errorFilename?.includes('fiikommddbeccaoicoejoniammnalkfa') ||
                errorMessage?.includes('Invalid property descriptor') ||
                errorMessage?.includes('Cannot redefine property: ethereum')
            ) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        };

        window.addEventListener('error', handleError);
        
        return () => {
            window.removeEventListener('error', handleError);
            // Restore console functions on unmount
            console.log = originalLog;
            console.warn = originalWarn;
            console.info = originalInfo;
        };
    }, []);

    return (
        <NetworkProvider>
            <PageLoader />
            <LanguageProvider>
                <ThemeProvider>
                    <WalletProvider>
                        <NotificationsProvider>
                            <SocialActivityProvider>
                                <ChatProvider>
                                    <TipMonitor />
                                    <BackgroundGradient />
                                    {isLandingPage ? (
                                        <Component {...pageProps} />
                                    ) : (
                                        <MainLayout>
                                            <Component {...pageProps} />
                                        </MainLayout>
                                    )}
                                    {/* Fixed notification button - hidden on landing page */}
                                    {!isLandingPage && (
                                        <div className="fixed top-7 right-4 z-[9999] flex items-center gap-3">
                                            <NotificationButton />
                                            <DailyCheckIn />
                                        </div>
                                    )}
                                </ChatProvider>
                            </SocialActivityProvider>
                        </NotificationsProvider>
                    </WalletProvider>
                </ThemeProvider>
            </LanguageProvider>
        </NetworkProvider>
    );
}
