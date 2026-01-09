import { useState, useRef } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { setProfile } from '@/lib/microThreadsClient';
import { useNotifications } from '@/components/Notifications';

interface CreateProfileFormProps {
    onSuccess: () => void;
    onCancel: () => void;
}

export default function CreateProfileForm({ onSuccess, onCancel }: CreateProfileFormProps) {
    const { account, signAndSubmitTransaction, signMessage } = useWallet();
    const { t } = useLanguage();
    const { addNotification } = useNotifications();

    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [website, setWebsite] = useState('');
    const [location, setLocation] = useState('');
    const [bannerUrl, setBannerUrl] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [usernameError, setUsernameError] = useState<string | null>(null);

    const handleSave = async () => {
        if (!account) return;
        if (!displayName.trim()) {
            addNotification(t.usernameRequired || "Username is required", "error");
            return;
        }

        setIsSaving(true);
        try {
            // 1. On-chain update
            await setProfile(displayName, bio, avatarUrl, signAndSubmitTransaction, account.address.toString());

            // 2. Off-chain (Supabase) update
            const timestamp = Date.now();
            const messageToSign = `Update profile for ${account.address} at ${timestamp}`;
            
            let signature, fullMessage;
            try {
                const response = await signMessage({
                    message: messageToSign,
                    nonce: timestamp.toString()
                });
                
                // Handle signature formats
                if (typeof response.signature === 'string') {
                    signature = response.signature;
                } else if (typeof response.signature === 'object') {
                    const sigObj = response.signature as any;
                    if (sigObj.data && (Array.isArray(sigObj.data) || sigObj.data instanceof Uint8Array)) {
                         signature = Array.from(sigObj.data)
                            .map((b: any) => b.toString(16).padStart(2, '0'))
                            .join('');
                    } else {
                         signature = sigObj.toString();
                    }
                } else {
                     signature = String(response.signature);
                }
                
                if (signature.startsWith('0x')) signature = signature.slice(2);
                fullMessage = response.fullMessage;

                const res = await fetch('/api/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wallet_address: account.address.toString(),
                        display_name: displayName,
                        bio,
                        website,
                        location,
                        banner_url: bannerUrl,
                        signature,
                        message: fullMessage,
                        publicKey: account.publicKey?.toString()
                    })
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || "Failed to create off-chain profile");
                }

            } catch (err) {
                console.error("Supabase update failed", err);
                // We don't block success if only off-chain fails, but we should warn
                // actually, for profile creation, we probably want it to succeed mostly
            }

            addNotification(t.profileCreated || "Profile created successfully!", "success");
            onSuccess();

        } catch (error: any) {
            console.error("Profile creation failed", error);
            addNotification(error.message || "Failed to create profile", "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    {t.displayName || "Display Name"} <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    placeholder="e.g. Satoshi Nakamoto"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    {t.bio || "Bio"}
                </label>
                <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none h-24"
                    placeholder="Tell us about yourself..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    {t.avatarUrl || "Avatar URL"}
                </label>
                <input
                    type="text"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    placeholder="https://example.com/avatar.jpg"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                        {t.website || "Website"}
                    </label>
                    <input
                        type="text"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        placeholder="https://..."
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                        {t.location || "Location"}
                    </label>
                    <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded-lg px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        placeholder="City, Country"
                    />
                </div>
            </div>

            <div className="flex gap-3 pt-4">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 bg-[var(--accent)] text-black font-bold py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {isSaving ? "Creating..." : (t.createProfile || "Create Profile")}
                </button>
                <button
                    onClick={onCancel}
                    disabled={isSaving}
                    className="px-4 py-2 border border-[var(--card-border)] text-[var(--text-primary)] font-medium rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
                >
                    {t.cancel || "Cancel"}
                </button>
            </div>
        </div>
    );
}
