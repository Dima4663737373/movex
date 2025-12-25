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
        // Suppress Nightly Wallet extension errors causing Next.js overlay crash
        const handleError = (event: ErrorEvent) => {
            if (
                event.filename?.includes('fiikommddbeccaoicoejoniammnalkfa') ||
                event.message?.includes('Invalid property descriptor') ||
                event.message?.includes('Cannot redefine property: ethereum')
            ) {
                // Prevent the error from bubbling up to Next.js error overlay
                event.preventDefault();
                event.stopImmediatePropagation();
                console.warn("Suppressed Nightly Wallet extension error");
            }
        };

        window.addEventListener('error', handleError);
        return () => window.removeEventListener('error', handleError);
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
