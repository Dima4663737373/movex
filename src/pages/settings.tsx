import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications } from "@/components/Notifications";
import Head from "next/head";
import { Toggle } from "@/components/Toggle";
import AuthGuard from "@/components/AuthGuard";
import { getDisplayName, getAvatar } from "@/lib/microThreadsClient";
import { supabase } from "@/lib/supabaseClient";

export default function SettingsPage() {
    const { connected, account } = useWallet();
    const [userAddress, setUserAddress] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [avatar, setAvatar] = useState("");
    
    // Settings State
    const [notifyTips, setNotifyTips] = useState(true);
    const [notifyErrors, setNotifyErrors] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);
    // Privacy State
    const [dmPrivacy, setDmPrivacy] = useState<'everyone' | 'followers'>('everyone');
    
    const [defaultTipAmount, setDefaultTipAmount] = useState("0.1");
    const [preferredExplorer, setPreferredExplorer] = useState("movement");
    const { language, setLanguage, t } = useLanguage();
    const { addNotification } = useNotifications();
    const [isSaving, setIsSaving] = useState(false);

    // Management Modal State
    const [activeModal, setActiveModal] = useState<'mutes' | 'blocks' | null>(null);
    const [managedUsers, setManagedUsers] = useState<any[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [showAccountInfo, setShowAccountInfo] = useState(false);

    const fetchManagedUsers = async (type: 'mutes' | 'blocks') => {
        if (!account) return;
        setIsLoadingUsers(true);
        setActiveModal(type); // Show modal immediately with loading state
        try {
            const res = await fetch(`/api/interactions?userAddress=${account.address}&type=${type}`);
            if (res.ok) {
                const data = await res.json();
                setManagedUsers(type === 'mutes' ? data.mutes : data.blocks);
            }
        } catch (e) {
            console.error(e);
            addNotification("Failed to load users", "error");
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const handleUnmanage = async (targetAddress: string, type: 'mute' | 'block') => {
        if (!account) return;
        try {
            const res = await fetch('/api/interactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userAddress: account.address.toString(),
                    targetAddress,
                    type,
                    postId: '0' // Not needed for unmute/unblock but required by types sometimes
                })
            });
            
            if (res.ok) {
                // Remove from local state
                setManagedUsers(prev => prev.filter(u => 
                    (type === 'mute' ? u.muted_user : u.blocked_user) !== targetAddress
                ));
                addNotification(type === 'mute' ? "Unmuted" : "Unblocked", "success");
            }
        } catch (e) {
            console.error(e);
            addNotification("Action failed", "error");
        }
    };

    useEffect(() => {
        if (connected && account) {
            setUserAddress(account.address.toString());
            // Fetch profile
            getDisplayName(account.address.toString()).then(setDisplayName);
            getAvatar(account.address.toString()).then(setAvatar);
            
            // Load local settings
            const savedTip = localStorage.getItem('default_tip_amount');
            if (savedTip) setDefaultTipAmount(savedTip);

            const savedExplorer = localStorage.getItem('preferred_explorer');
            if (savedExplorer) setPreferredExplorer(savedExplorer);
            
            const savedSound = localStorage.getItem('sound_enabled');
            if (savedSound) setSoundEnabled(savedSound === 'true');

            const savedNotifyTips = localStorage.getItem('settings_notify_tips');
            if (savedNotifyTips) setNotifyTips(savedNotifyTips === 'true');

            const savedNotifyErrors = localStorage.getItem('settings_notify_errors');
            if (savedNotifyErrors) setNotifyErrors(savedNotifyErrors === 'true');

            const savedDmPrivacy = localStorage.getItem('settings_dm_privacy');
            if (savedDmPrivacy === 'followers') setDmPrivacy('followers');
            
            // Fetch settings from Supabase (Language only mostly)
            if (supabase) {
                supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_address', account.address.toString())
                    .single()
                    .then(({ data, error }) => {
                        if (data) {
                            if (data.language === 'en' || data.language === 'ua') {
                                setLanguage(data.language);
                            }
                        }
                    });
            }
        }
    }, [connected, account]);

    const handleSave = async () => {
        if (!account) return;
        setIsSaving(true);
        try {
            // Save local settings
            localStorage.setItem('default_tip_amount', defaultTipAmount);
            localStorage.setItem('preferred_explorer', preferredExplorer);
            localStorage.setItem('sound_enabled', String(soundEnabled));
            localStorage.setItem('settings_notify_tips', String(notifyTips));
            localStorage.setItem('settings_notify_errors', String(notifyErrors));
            localStorage.setItem('settings_dm_privacy', dmPrivacy);
            
            // Legacy/Compat
            localStorage.setItem('notifications_enabled', String(notifyTips));

            if (supabase) {
                const { error } = await supabase
                    .from('user_settings')
                    .upsert({
                        user_address: account.address.toString(),
                        notifications_enabled: notifyTips, // Map tips to general for now
                        email_notifications: false,
                        privacy_mode: false,
                        language: language,
                        updated_at: new Date().toISOString()
                    });
                
                if (error) throw error;
                
                // Show toast only
                addNotification(t.settingsSaved, 'success', { persist: false });
            } else {
                 addNotification(t.settingsSavedLocally, 'success', { persist: false });
            }
        } catch (e) {
            console.error("Error saving settings", e);
            addNotification(t.settingsSaveError, 'error', { persist: false });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <AuthGuard>
            <Head>
                <title>Settings - MoveX</title>
            </Head>

            {/* Settings Content */}
            <div className="max-w-3xl p-6">
                        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-8">{t.settings}</h1>

                        <div className="space-y-6">
                            {/* Your Account */}
                            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
                                <div className="p-4 border-b border-[var(--card-border)] bg-[var(--bg-secondary)]/30">
                                    <h2 className="text-xl font-bold text-[var(--text-primary)]">Your Account</h2>
                                    <p className="text-sm text-[var(--text-secondary)]">See information about your account, download an archive of your data, or learn about your account deactivation options.</p>
                                </div>
                                <div className="divide-y divide-[var(--card-border)]">
                                    <div 
                                        className="p-4 hover:bg-[var(--hover-bg)] transition-colors cursor-pointer flex items-center justify-between group"
                                        onClick={() => setShowAccountInfo(true)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="text-[var(--text-secondary)] group-hover:text-[var(--accent)]">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                            </div>
                                            <div>
                                                <div className="font-medium text-[var(--text-primary)]">Account Information</div>
                                                <div className="text-sm text-[var(--text-secondary)]">See your account information like your phone number and email address.</div>
                                            </div>
                                        </div>
                                        <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </div>
                                    <div className="p-4 hover:bg-[var(--hover-bg)] transition-colors cursor-pointer flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="text-[var(--text-secondary)] group-hover:text-[var(--accent)]">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                            </div>
                                            <div>
                                                <div className="font-medium text-[var(--text-primary)]">Change your password</div>
                                                <div className="text-sm text-[var(--text-secondary)]">Change your password at any time.</div>
                                            </div>
                                        </div>
                                        <div className="text-xs bg-[var(--card-border)] px-2 py-1 rounded text-[var(--text-secondary)]">Wallet Managed</div>
                                    </div>
                                </div>
                            </div>

                            {/* Privacy and Safety */}
                            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
                                <div className="p-4 border-b border-[var(--card-border)] bg-[var(--bg-secondary)]/30">
                                    <h2 className="text-xl font-bold text-[var(--text-primary)]">{t.privacy}</h2>
                                    <p className="text-sm text-[var(--text-secondary)]">Manage what information you see and share on MoveX.</p>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div>
                                        <label className="block font-medium text-[var(--text-primary)] mb-1">{t.whoCanMessage}</label>
                                        <p className="text-sm text-[var(--text-secondary)] mb-2">{t.whoCanMessageDesc}</p>
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => setDmPrivacy('everyone')}
                                                className={`px-4 py-2 rounded-lg border transition-colors font-medium ${
                                                    dmPrivacy === 'everyone' 
                                                    ? 'bg-[var(--accent)] text-black border-[var(--accent)]' 
                                                    : 'bg-transparent border-[var(--card-border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]'
                                                }`}
                                            >
                                                {t.everyone || "Everyone"}
                                            </button>
                                            <button
                                                onClick={() => setDmPrivacy('followers')}
                                                className={`px-4 py-2 rounded-lg border transition-colors font-medium ${
                                                    dmPrivacy === 'followers' 
                                                    ? 'bg-[var(--accent)] text-black border-[var(--accent)]' 
                                                    : 'bg-transparent border-[var(--card-border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]'
                                                }`}
                                            >
                                                {t.followersOnly || "Followers Only"}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-[var(--card-border)]">
                                        <div 
                                            className="flex items-center justify-between cursor-pointer group"
                                            onClick={() => fetchManagedUsers('mutes')}
                                        >
                                            <div>
                                                <div className="font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">Mute and Block</div>
                                                <div className="text-sm text-[var(--text-secondary)]">Manage the accounts you’ve muted or blocked.</div>
                                            </div>
                                            <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Notifications */}
                            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
                                <div className="p-4 border-b border-[var(--card-border)] bg-[var(--bg-secondary)]/30">
                                    <h2 className="text-xl font-bold text-[var(--text-primary)]">{t.notifications}</h2>
                                    <p className="text-sm text-[var(--text-secondary)]">Select the kinds of notifications you get about your activities, interests, and recommendations.</p>
                                </div>
                                <div className="p-4 space-y-4">
                                    <Toggle 
                                        checked={notifyTips} 
                                        onChange={setNotifyTips}
                                        label={t.notifyTips}
                                        description={t.notifyTipsDesc}
                                    />
                                    <div className="border-t border-[var(--card-border)]"></div>
                                    <Toggle 
                                        checked={notifyErrors} 
                                        onChange={setNotifyErrors}
                                        label={t.notifyErrors}
                                        description={t.notifyErrorsDesc}
                                    />
                                    <div className="border-t border-[var(--card-border)]"></div>
                                    <Toggle 
                                        checked={soundEnabled} 
                                        onChange={setSoundEnabled}
                                        label={t.soundEffects}
                                        description={t.soundDesc}
                                    />
                                </div>
                            </div>

                            {/* Accessibility, Display, and Languages */}
                            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
                                <div className="p-4 border-b border-[var(--card-border)] bg-[var(--bg-secondary)]/30">
                                    <h2 className="text-xl font-bold text-[var(--text-primary)]">Accessibility, Display, and Languages</h2>
                                    <p className="text-sm text-[var(--text-secondary)]">Manage how MoveX content is displayed to you.</p>
                                </div>
                                <div className="p-4 space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                            Language
                                        </label>
                                        <select
                                            value={language}
                                            onChange={(e) => setLanguage(e.target.value as 'en' | 'ua')}
                                            className="w-full bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                                        >
                                            <option value="en">English</option>
                                            <option value="ua">Українська</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block font-medium text-[var(--text-primary)] mb-1">{t.preferredExplorer}</label>
                                        <p className="text-sm text-[var(--text-secondary)] mb-2">{t.preferredExplorerDesc}</p>
                                        <select 
                                            value={preferredExplorer}
                                            onChange={(e) => setPreferredExplorer(e.target.value)}
                                            className="w-full bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                                        >
                                            <option value="movement">Movement Scan (Official)</option>
                                            <option value="aptos">Aptos Scan</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                            {t.defaultTipAmount}
                                        </label>
                                        <p className="text-xs text-[var(--text-secondary)] mb-2">{t.defaultTipDesc}</p>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={defaultTipAmount}
                                                onChange={(e) => setDefaultTipAmount(e.target.value)}
                                                className="w-full bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg pl-4 pr-12 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                                                step="0.01"
                                                min="0.1"
                                            />
                                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                <span className="text-[var(--text-secondary)]">MOVE</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex justify-end pt-4">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-8 py-3 bg-[var(--accent)] text-[var(--btn-text-primary)] font-bold rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg"
                                >
                                    {isSaving ? t.saving : t.save}
                                </button>
                            </div>
                        </div>
                        </div>


            {/* Management Modal */}
            {activeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
                        <div className="p-4 border-b border-[var(--card-border)] flex items-center justify-between">
                            <h3 className="text-xl font-bold text-[var(--text-primary)]">
                                {activeModal === 'mutes' ? 'Muted Accounts' : 'Blocked Accounts'}
                            </h3>
                            <button 
                                onClick={() => setActiveModal(null)}
                                className="p-2 hover:bg-[var(--hover-bg)] rounded-full text-[var(--text-secondary)]"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        
                        {/* Tabs */}
                        <div className="flex border-b border-[var(--card-border)]">
                            <button 
                                className={`flex-1 py-3 font-bold text-sm transition-colors ${activeModal === 'mutes' ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'}`}
                                onClick={() => fetchManagedUsers('mutes')}
                            >
                                Muted
                            </button>
                            <button 
                                className={`flex-1 py-3 font-bold text-sm transition-colors ${activeModal === 'blocks' ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'}`}
                                onClick={() => fetchManagedUsers('blocks')}
                            >
                                Blocked
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-4 space-y-4">
                            {isLoadingUsers ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
                                </div>
                            ) : managedUsers.length === 0 ? (
                                <div className="text-center py-8 text-[var(--text-secondary)]">
                                    No {activeModal === 'mutes' ? 'muted' : 'blocked'} accounts found.
                                </div>
                            ) : (
                                managedUsers.map((item, i) => {
                                    const address = activeModal === 'mutes' ? item.muted_user : item.blocked_user;
                                    return (
                                        <div key={i} className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--card-border)]">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-10 h-10 rounded-full bg-[var(--card-border)] flex items-center justify-center font-bold text-[var(--text-primary)]">
                                                    {address.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-[var(--text-primary)] truncate">
                                                        {address.slice(0, 6)}...{address.slice(-4)}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleUnmanage(address, activeModal === 'mutes' ? 'mute' : 'block')}
                                                className="px-3 py-1.5 text-xs font-bold border border-[var(--card-border)] rounded-full hover:bg-red-500/10 hover:text-red-500 hover:border-red-500 transition-colors"
                                            >
                                                {activeModal === 'mutes' ? 'Unmute' : 'Unblock'}
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
            {showAccountInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAccountInfo(false)}>
                    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl w-full max-w-md p-6 shadow-2xl m-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-[var(--text-primary)]">Account Information</h2>
                            <button onClick={() => setShowAccountInfo(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Wallet Address</label>
                                <div className="bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg px-4 py-3 text-[var(--text-primary)] break-all font-mono text-sm">
                                    {userAddress}
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Username</label>
                                <div className="bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg px-4 py-3 text-[var(--text-primary)]">
                                    @{displayName || "Not set"}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Email</label>
                                <div className="bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg px-4 py-3 text-[var(--text-secondary)] italic">
                                    Not linked
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Phone</label>
                                <div className="bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg px-4 py-3 text-[var(--text-secondary)] italic">
                                    Not linked
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AuthGuard>
    );
}
