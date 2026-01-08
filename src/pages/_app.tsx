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
        
        // Suppress expected 404 errors in console
        const suppressExpected404s = (message: string, url?: string) => {
            const fullText = (message || '') + ' ' + (url || '');
            
            // Check if it's a 404 error for expected resources
            if (fullText.includes('404') || fullText.includes('Not Found')) {
                const isExpected404 = 
                    fullText.includes('::Profile') || 
                    fullText.includes('::CheckInState') ||
                    fullText.includes('::Registry') ||
                    fullText.includes('::TopTipperStats');
                
                if (isExpected404) {
                    return false; // Suppress this error
                }
            }
            
            // Suppress account_not_found errors - these are handled gracefully
            if (fullText.includes('account_not_found') || fullText.includes('Account not found')) {
                return false; // Suppress this error
            }
            
            return true;
        };
        
        console.log = (...args: any[]) => {
            const message = args.map(a => a?.toString?.() || '').join(' ');
            if (suppressSDKWarnings(...args) && suppressExpected404s(message)) {
                originalLog.apply(console, args);
            }
        };
        console.warn = (...args: any[]) => {
            const message = args.map(a => a?.toString?.() || '').join(' ');
            if (suppressSDKWarnings(...args) && suppressExpected404s(message)) {
                originalWarn.apply(console, args);
            }
        };
        console.info = (...args: any[]) => {
            const message = args.map(a => a?.toString?.() || '').join(' ');
            if (suppressSDKWarnings(...args) && suppressExpected404s(message)) {
                originalInfo.apply(console, args);
            }
        };
        
        // Also suppress fetch errors for expected 404s
        const originalError = console.error;
        console.error = (...args: any[]) => {
            const message = args.map(a => a?.toString?.() || '').join(' ');
            if (suppressExpected404s(message)) {
                originalError.apply(console, args);
            }
        };
        
        // Intercept fetch to suppress 404 errors for expected resources
        const originalFetch = window.fetch;
        window.fetch = async (...args: any[]) => {
            const response = await originalFetch(...args);
            
            // If it's a 404 for expected resources, don't let it bubble up as an error
            if (response.status === 404) {
                const url = args[0]?.toString?.() || '';
                if (!suppressExpected404s(url)) {
                    // This is an expected 404, SDK will handle it gracefully
                    // Return response without logging error
                }
            }
            
            return response;
        };
        
        // Suppress unhandled promise rejections for expected 404s
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            const errorMessage = reason?.message?.toString() || '';
            const errorStack = reason?.stack?.toString() || '';
            const url = reason?.url?.toString() || reason?.config?.url?.toString() || '';
            const allText = errorMessage + ' ' + errorStack + ' ' + url;
            
            if (!suppressExpected404s(allText)) {
                event.preventDefault();
            }
        };
        
        // Suppress Nightly Wallet extension errors and expected 404 fetch errors
        const handleError = (event: ErrorEvent) => {
            const errorMessage = event.message?.toString() || '';
            const errorFilename = event.filename?.toString() || '';
            const allText = errorMessage + ' ' + errorFilename;
            
            // Suppress expected 404 errors
            if (!suppressExpected404s(allText)) {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            
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
        window.addEventListener('unhandledrejection', handleUnhandledRejection);
        
        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
            // Restore console functions and fetch on unmount
            console.log = originalLog;
            console.warn = originalWarn;
            console.info = originalInfo;
            console.error = originalError;
            window.fetch = originalFetch;
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
