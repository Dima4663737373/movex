/**
 * ComposeModal Component
 * 
 * A Twitter-like modal for creating new posts, supporting drafts, media, and polls (UI).
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNetwork } from '@/contexts/NetworkContext';
import { createPostOnChain, OnChainPost } from '@/lib/microThreadsClient';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { Theme, EmojiClickData } from 'emoji-picker-react';
import dynamic from 'next/dynamic';
import GifPicker from './GifPicker';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });
import { sendSocialNotification } from '@/contexts/SocialActivityContext';
import { extractMentions } from '@/utils/textUtils';
import CalendarModal from './CalendarModal';

interface ComposeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPostCreated?: (post?: OnChainPost) => void;
}

interface MediaItem {
    url: string;
    type: 'image' | 'video' | 'audio';
}

interface Draft {
    id: string;
    content: string;
    mediaItems: MediaItem[];
    timestamp: number;
}

export default function ComposeModal({ isOpen, onClose, onPostCreated }: ComposeModalProps) {
    const { t } = useLanguage();
    const { currentNetwork } = useNetwork();
    const { connected, signAndSubmitTransaction, account, network } = useWallet();
    const [content, setContent] = useState('');
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [audience, setAudience] = useState<'everyone' | 'subscribers'>('everyone');
    const [showDrafts, setShowDrafts] = useState(false);
    const [drafts, setDrafts] = useState<Draft[]>([]);
    const [showPollUI, setShowPollUI] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [showDurationPicker, setShowDurationPicker] = useState(false);
    const [showBountyInput, setShowBountyInput] = useState(false);
    const [bountyAmount, setBountyAmount] = useState('');
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
    
    // Poll state (UI only for now)
    const [pollOptions, setPollOptions] = useState(['', '']);
    const [pollDuration, setPollDuration] = useState(1); // days

    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    // Load drafts on mount
    useEffect(() => {
        const savedDrafts = localStorage.getItem('microthreads_drafts');
        if (savedDrafts) {
            try {
                setDrafts(JSON.parse(savedDrafts));
            } catch (e) {
                console.error("Failed to parse drafts", e);
            }
        }
    }, []);

    // Save drafts when content changes (debounced or manual)
    const saveDraft = () => {
        if (!content && mediaItems.length === 0) return;
        
        const newDraft: Draft = {
            id: uuidv4(),
            content,
            mediaItems,
            timestamp: Date.now()
        };
        
        const updatedDrafts = [newDraft, ...drafts].slice(0, 10); // Keep last 10
        setDrafts(updatedDrafts);
        localStorage.setItem('microthreads_drafts', JSON.stringify(updatedDrafts));
        // Show feedback? No, just save.
    };

    const loadDraft = (draft: Draft) => {
        setContent(draft.content);
        setMediaItems(draft.mediaItems);
        setShowDrafts(false);
    };

    const deleteDraft = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updatedDrafts = drafts.filter(d => d.id !== id);
        setDrafts(updatedDrafts);
        localStorage.setItem('microthreads_drafts', JSON.stringify(updatedDrafts));
    };

    // Lock body scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => {
            window.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    // Auto-focus
    useEffect(() => {
        if (isOpen && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isOpen]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [content]);

    // Focus Trap
    useEffect(() => {
        if (!isOpen) return;

        const handleTabKey = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            if (!modalRef.current) return;

            const focusableElements = modalRef.current.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    lastElement.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastElement) {
                    firstElement.focus();
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('keydown', handleTabKey);
        return () => window.removeEventListener('keydown', handleTabKey);
    }, [isOpen]);

    const processFiles = (files: File[]) => {
        if (files.length === 0) return;

        // Limit to 4 items
        if (mediaItems.length + files.length > 4) {
            setError(t.mediaLimitError || "Max 4 media items allowed");
            return;
        }

        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                // Allow larger initial files (up to 10MB) since we'll compress them
                if (file.size > 10 * 1024 * 1024) {
                    setError(t.imageTooLargeError || "Image too large (>10MB)");
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');

                        // Adaptive compression strategy
                        const attempts = [
                            { maxSize: 1600, quality: 0.8 },
                            { maxSize: 1200, quality: 0.7 },
                            { maxSize: 1024, quality: 0.6 },
                            { maxSize: 800, quality: 0.6 },
                            { maxSize: 600, quality: 0.5 },
                        ];

                        let success = false;

                        for (const attempt of attempts) {
                            let width = img.width;
                            let height = img.height;

                            // Resize logic
                            if (width > height) {
                                if (width > attempt.maxSize) {
                                    height *= attempt.maxSize / width;
                                    width = attempt.maxSize;
                                }
                            } else {
                                if (height > attempt.maxSize) {
                                    width *= attempt.maxSize / height;
                                    height = attempt.maxSize;
                                }
                            }

                            canvas.width = width;
                            canvas.height = height;

                            // Draw white background
                            if (ctx) {
                                ctx.fillStyle = '#FFFFFF';
                                ctx.fillRect(0, 0, width, height);
                                ctx.drawImage(img, 0, 0, width, height);
                            }

                            const compressedBase64 = canvas.toDataURL('image/jpeg', attempt.quality);

                            if (compressedBase64.length <= 100000) { // 100KB limit
                                setMediaItems(prev => [...prev, { url: compressedBase64, type: 'image' }]);
                                setError(null);
                                success = true;
                                break;
                            }
                        }
                        if (!success) {
                             const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
                             setMediaItems(prev => [...prev, { url: compressedBase64, type: 'image' }]);
                        }
                    };
                    img.src = event.target?.result as string;
                };
                reader.readAsDataURL(file);
            } else if (file.type.startsWith('video/')) {
                // Video handling
                if (file.size > 5 * 1024 * 1024) {
                    setError(t.videoTooLarge || "Video too large (>5MB)");
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    if (event.target?.result) {
                        setMediaItems(prev => [...prev, { 
                            url: event.target!.result as string, 
                            type: 'video' 
                        }]);
                        setError(null);
                    }
                };
                reader.readAsDataURL(file);
            } else if (file.type.startsWith('audio/')) {
                // Audio handling
                if (file.size > 10 * 1024 * 1024) {
                    setError("Audio too large (>10MB)");
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    if (event.target?.result) {
                        setMediaItems(prev => [...prev, { 
                            url: event.target!.result as string, 
                            type: 'audio' 
                        }]);
                        setError(null);
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    };

    const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        processFiles(files);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeMedia = (index: number) => {
        setMediaItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        setError(null);

        if (!connected) {
            setError(t.pleaseConnectWallet);
            return;
        }

        // Strict Network Check
        const requiredChainId = currentNetwork === 'testnet' ? '250' : '126';
        if (network?.chainId?.toString() !== requiredChainId) {
            setError(`Wrong network! Please switch your wallet to Movement ${currentNetwork === 'testnet' ? 'Testnet' : 'Mainnet'} (Chain ID: ${requiredChainId}). Currently on: ${network?.chainId || 'Unknown'}`);
            return;
        }

        if (!content.trim() && mediaItems.length === 0) {
            setError(t.enterContentOrMedia);
            return;
        }

        if (content.length > 400) {
            setError(t.contentTooLong || "Content too long (max 400 chars)");
            return;
        }

        // Optimistic Update
        const tempId = `pending-modal-${Date.now()}`;
        const tempRef = mediaItems.length > 0 ? uuidv4() : '';
        
        // Prepare content with preview
        let previewContent = content;
        if (bountyAmount && !isNaN(parseFloat(bountyAmount)) && parseFloat(bountyAmount) > 0) {
            previewContent += `\n\n[bounty:${bountyAmount}]`;
        }
        if (scheduledDate) {
            previewContent += `\n\n[schedule:${Math.floor(scheduledDate.getTime() / 1000)}]`;
        }
        if (showPollUI && pollOptions.filter(o => o.trim()).length >= 2) {
             const pollData = {
                question: "Poll",
                options: pollOptions.filter(o => o.trim()),
                duration: pollDuration,
                endsAt: Date.now() + (pollDuration * 24 * 60 * 60 * 1000)
            };
            const base64Data = btoa(unescape(encodeURIComponent(JSON.stringify(pollData))));
            previewContent += `\n\n[poll:${base64Data}]`;
        }
        if (tempRef) {
            previewContent += `\n[ref:${tempRef}]`;
        }

        const optimisticPost = {
            id: tempId,
            global_id: 0,
            creatorAddress: account!.address.toString(),
            creatorHandle: account!.ansName || undefined,
            content: previewContent,
            image_url: mediaItems.length > 0 ? mediaItems[0].url : '',
            style: 0,
            totalTips: 0,
            createdAt: Date.now() / 1000,
            status: 'pending' as const
        };

        // Dispatch pending event
        window.dispatchEvent(new CustomEvent('post_pending', { detail: optimisticPost }));
        
        // Close modal immediately
        onClose();
        
        // Reset local state (though component unmounts usually, if it persists it's good)
        setContent('');
        setMediaItems([]);
        setShowPollUI(false);
        setPollOptions(['', '']);

        // Background Process
        (async () => {
            try {
                setCreating(true);

                let finalContent = content;
                let postRef = tempRef;

                // Append bounty tag if set
                if (bountyAmount && !isNaN(parseFloat(bountyAmount)) && parseFloat(bountyAmount) > 0) {
                    finalContent += `\n\n[bounty:${bountyAmount}]`;
                }
                
                // Append Schedule
                if (scheduledDate) {
                    finalContent += `\n\n[schedule:${Math.floor(scheduledDate.getTime() / 1000)}]`;
                }

                // Append Poll Data
                if (showPollUI && pollOptions.filter(o => o.trim()).length >= 2) {
                    const pollData = {
                        question: "Poll", 
                        options: pollOptions.filter(o => o.trim()),
                        duration: pollDuration,
                        endsAt: Date.now() + (pollDuration * 24 * 60 * 60 * 1000)
                    };
                    const base64Data = btoa(unescape(encodeURIComponent(JSON.stringify(pollData))));
                    finalContent += `\n\n[poll:${base64Data}]`;
                }
                
                // Add ref tag if needed (and reuse tempRef)
                if ((mediaItems.length > 0) && !postRef) {
                    postRef = uuidv4();
                }
                if (postRef) {
                    finalContent += `\n[ref:${postRef}]`;
                }

                let uploadedMediaUrls: string[] = [];
                
                // Handle Media
                if (mediaItems.length > 0) {
                    if (!supabase) {
                        // Fallback logic
                        const largeItem = mediaItems.find(i => i.url.startsWith('data:') && i.url.length > 50000);
                        if (largeItem) throw new Error("Image too large for chain and no storage configured.");
                    } else {
                        const sb = supabase;
                        const processedItems = await Promise.all(mediaItems.map(async (item) => {
                            let mediaUrl = item.url;
                            if (item.url.startsWith('data:')) {
                                try {
                                    const fileName = `${postRef}/${uuidv4()}.${item.type === 'video' ? 'mp4' : 'jpg'}`;
                                    const contentType = item.type === 'video' ? 'video/mp4' : 'image/jpeg';
                                    
                                    const uploadRes = await fetch('/api/upload', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            fileName,
                                            fileData: item.url,
                                            contentType
                                        })
                                    });

                                    if (uploadRes.ok) {
                                        const result = await uploadRes.json();
                                        mediaUrl = result.publicUrl;
                                    }
                                } catch (e) {
                                    console.error("Error processing media for upload", e);
                                }
                            }
                            return {
                                post_ref: postRef,
                                url: mediaUrl,
                                type: item.type
                            };
                        }));
                        
                        uploadedMediaUrls = processedItems.map(i => i.url);
                        await sb.from('post_media').insert(processedItems);
                    }
                }

                // Pass first image as legacy image_url if available
                const legacyImage = uploadedMediaUrls.length > 0 && mediaItems[0].type === 'image' 
                    ? uploadedMediaUrls[0] 
                    : (mediaItems.length > 0 && mediaItems[0].type === 'image' ? mediaItems[0].url : '');

                const postId = await createPostOnChain(finalContent, legacyImage, 0, signAndSubmitTransaction);

                if (postId !== null) {
                    // Success
                    window.dispatchEvent(new CustomEvent('post_success', { 
                        detail: { 
                            tempId, 
                            finalId: postId,
                            post: { ...optimisticPost, id: postId, status: 'success' }
                        } 
                    }));
                    
                    if (onPostCreated) onPostCreated(); // Just in case parent needs it

                    // Mention notifications
                    const mentions = extractMentions(finalContent);
                    mentions.forEach(mention => {
                        if ((mention.startsWith('0x') || mention.length > 20) && mention !== account?.address?.toString()) {
                            sendSocialNotification(mention, {
                                type: 'mention',
                                actorAddress: account!.address.toString(),
                                targetPostId: postId.toString(),
                                targetPostContent: finalContent.substring(0, 100),
                                content: finalContent.substring(0, 100)
                            });
                        }
                    });
                } else {
                    throw new Error("Transaction failed or was rejected");
                }

            } catch (err: any) {
                console.error(err);
                const msg = err.message || t.errorCreatingPost;
                
                // Fail
                window.dispatchEvent(new CustomEvent('post_fail', { 
                    detail: { tempId, error: msg } 
                }));

                // Notify
                // Since modal is closed, we must use a global notification mechanism or Toast.
                // Assuming addNotification or similar is available in the context or we can't call hook here easily if component unmounted.
                // But ComposeModal uses useNotifications? No, it doesn't seem to use it in imports.
                // It uses local setError. But modal is closed.
                // We should assume `window.dispatchEvent` handles the UI feedback in Feed.
                console.error("Post creation failed asynchronously:", msg);
            } finally {
                setCreating(false);
            }
        })();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div ref={modalRef} className="bg-[var(--card-bg)] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)]">
                    <button onClick={onClose} className="p-2 hover:bg-[var(--hover-bg)] rounded-full transition-colors">
                        <svg className="w-5 h-5 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <div className="flex gap-2">
                         <button 
                            onClick={() => setShowDrafts(!showDrafts)}
                            className="text-[var(--accent)] font-medium text-sm hover:underline px-2"
                        >
                            {showDrafts ? 'Hide Drafts' : 'Drafts'}
                        </button>
                    </div>
                </div>

                {/* Drafts View */}
                {showDrafts && (
                    <div className="flex-1 overflow-y-auto p-4 bg-[var(--bg-secondary)]">
                        <h3 className="font-bold mb-4 text-[var(--text-primary)]">Drafts</h3>
                        {drafts.length === 0 ? (
                            <p className="text-[var(--text-secondary)]">No drafts saved.</p>
                        ) : (
                            <div className="space-y-2">
                                {drafts.map(draft => (
                                    <div key={draft.id} onClick={() => loadDraft(draft)} className="p-3 bg-[var(--card-bg)] rounded-lg border border-[var(--card-border)] hover:border-[var(--accent)] cursor-pointer flex justify-between items-center group">
                                        <div className="truncate text-[var(--text-primary)] max-w-[80%]">
                                            {draft.content || "(Media only)"}
                                        </div>
                                        <button onClick={(e) => deleteDraft(draft.id, e)} className="text-red-500 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Compose Area */}
                {!showDrafts && (
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="flex gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent)] to-purple-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                {/* Audience Selector */}
                                <button 
                                    className="flex items-center gap-1 text-[var(--accent)] border border-[var(--card-border)] rounded-full px-3 py-1 text-sm font-medium mb-2 hover:bg-[var(--accent)]/10 transition-colors"
                                    onClick={() => setAudience(audience === 'everyone' ? 'subscribers' : 'everyone')}
                                >
                                    {audience === 'everyone' ? 'Everyone' : 'Subscribers'}
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </button>

                                <textarea
                                    ref={textareaRef}
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    onPaste={(e) => {
                                        const items = e.clipboardData.items;
                                        const files: File[] = [];
                                        for (let i = 0; i < items.length; i++) {
                                            if (items[i].type.indexOf('image') !== -1) {
                                                const blob = items[i].getAsFile();
                                                if (blob) files.push(blob);
                                            }
                                        }
                                        if (files.length > 0) {
                                            e.preventDefault();
                                            processFiles(files);
                                        }
                                    }}
                                    placeholder={t.whatsOnYourMind || "What is happening?!"}
                                    className="w-full bg-transparent text-[var(--text-primary)] text-xl placeholder-[var(--text-secondary)] resize-none outline-none min-h-[100px]"
                                />

                                {/* Media Previews */}
                                {mediaItems.length > 0 && (
                                    <div className="grid grid-cols-2 gap-2 mt-4 mb-4">
                                        {mediaItems.map((item, index) => (
                                            <div key={index} className="relative rounded-xl overflow-hidden border border-[var(--card-border)]">
                                                {item.type === 'image' ? (
                                                    <img src={item.url} alt="preview" className="w-full h-full object-cover max-h-48" />
                                                ) : item.type === 'video' ? (
                                                    <video src={item.url} className="w-full h-full object-cover max-h-48" controls />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-[var(--bg-secondary)] min-h-[100px]">
                                                         <audio src={item.url} controls className="w-full px-2" />
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => removeMedia(index)}
                                                    className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Poll UI */}
                                {showPollUI && (
                                    <div className="mt-4 p-3 border border-[var(--card-border)] rounded-xl">
                                        <div className="space-y-2">
                                            {pollOptions.map((opt, idx) => (
                                                <div key={idx} className="flex gap-2 items-center group">
                                                    <input 
                                                        value={opt}
                                                        onChange={e => {
                                                            const newOpts = [...pollOptions];
                                                            newOpts[idx] = e.target.value;
                                                            setPollOptions(newOpts);
                                                        }}
                                                        placeholder={`Choice ${idx + 1}`}
                                                        className="flex-1 bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded px-3 py-2 text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
                                                    />
                                                    {pollOptions.length > 2 && (
                                                        <button
                                                            onClick={() => {
                                                                const newOpts = pollOptions.filter((_, i) => i !== idx);
                                                                setPollOptions(newOpts);
                                                            }}
                                                            className="p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 rounded-full"
                                                            title="Remove option"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <button 
                                            className="text-[var(--accent)] text-sm mt-2 hover:underline"
                                            onClick={() => setPollOptions([...pollOptions, ''])}
                                        >
                                            + Add another choice
                                        </button>
                                        <div className="mt-3 pt-3 border-t border-[var(--card-border)] flex justify-between items-center relative">
                                            <span className="text-[var(--text-secondary)] text-sm">Poll length</span>
                                            
                                            {/* Custom Dropdown for Poll Duration */}
                                            <div className="relative">
                                                <button 
                                                    onClick={() => setShowDurationPicker(!showDurationPicker)}
                                                    className="text-[var(--accent)] text-sm font-bold hover:underline flex items-center gap-1"
                                                >
                                                    {pollDuration} Day{pollDuration > 1 ? 's' : ''}
                                                    <svg className={`w-4 h-4 transition-transform ${showDurationPicker ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>

                                                {showDurationPicker && (
                                                    <>
                                                        <div className="fixed inset-0 z-30" onClick={() => setShowDurationPicker(false)}></div>
                                                        <div className="absolute right-0 top-full mt-2 w-32 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-xl z-40 overflow-hidden">
                                                            {[1, 3, 7].map(days => (
                                                                <button
                                                                    key={days}
                                                                    onClick={() => { setPollDuration(days); setShowDurationPicker(false); }}
                                                                    className={`w-full text-left px-4 py-2 text-sm transition-colors flex justify-between items-center ${pollDuration === days ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-bold' : 'text-[var(--text-primary)] hover:bg-[var(--hover-bg)]'}`}
                                                                >
                                                                    <span>{days} Day{days > 1 ? 's' : ''}</span>
                                                                    {pollDuration === days && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <button onClick={() => setShowPollUI(false)} className="mt-2 text-red-500 text-sm hover:underline">Remove poll</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Bounty Input UI */}
                {showBountyInput && (
                    <div className="px-4 pb-4 animate-fadeIn">
                        <div className="p-3 border border-yellow-400/50 bg-yellow-400/5 rounded-xl">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-bold text-yellow-400 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
                                    Set Bounty Reward
                                </label>
                                <button onClick={() => setShowBountyInput(false)} className="text-[var(--text-secondary)] hover:text-red-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={bountyAmount}
                                    onChange={(e) => setBountyAmount(e.target.value)}
                                    placeholder="Amount (e.g. 5.0)"
                                    className="flex-1 bg-[var(--bg-secondary)] border border-[var(--card-border)] rounded px-3 py-2 text-[var(--text-primary)] focus:border-yellow-400 outline-none"
                                    min="0.1"
                                    step="0.1"
                                />
                                <span className="font-bold text-yellow-400">MOVE</span>
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] mt-2">
                                This amount will be reserved from your wallet and awarded to the best reply.
                            </p>
                        </div>
                    </div>
                )}

                {/* Footer Actions */}
                <div className="p-4 border-t border-[var(--card-border)] flex items-center justify-between relative">
                    {/* Emoji Picker Popover */}
                    {showEmojiPicker && (
                        <div className="absolute bottom-full left-0 mb-2 z-50">
                            <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)}></div>
                            <div className="relative z-50">
                                <EmojiPicker
                                    theme={Theme.DARK}
                                    onEmojiClick={(emojiData: EmojiClickData) => {
                                        setContent(prev => prev + emojiData.emoji);
                                        setShowEmojiPicker(false);
                                    }}
                                    width={300}
                                    height={400}
                                />
                            </div>
                        </div>
                    )}

                    {/* GIF Picker Popover */}
                    {showGifPicker && (
                        <div className="absolute bottom-full left-10 mb-2 z-50">
                            <div className="fixed inset-0 z-40" onClick={() => setShowGifPicker(false)}></div>
                            <div className="relative z-50">
                                <GifPicker
                                    onSelect={(url) => {
                                        setMediaItems(prev => [...prev, { url, type: 'image' }]);
                                        setShowGifPicker(false);
                                    }}
                                    onClose={() => setShowGifPicker(false)}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex gap-1">
                        <button onClick={() => fileInputRef.current?.click()} className="p-2 text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-full transition-colors" title="Media">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </button>
                        <button onClick={() => setShowGifPicker(!showGifPicker)} className={`p-2 ${showGifPicker ? 'bg-[var(--accent)]/20' : ''} text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-full transition-colors`} title="GIF">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        </button>
                        <button onClick={() => setShowPollUI(!showPollUI)} className={`p-2 ${showPollUI ? 'bg-[var(--accent)]/20' : ''} text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-full transition-colors`} title="Poll">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
                        </button>
                        <button onClick={() => setShowBountyInput(!showBountyInput)} className={`p-2 ${showBountyInput ? 'bg-yellow-400/20' : ''} text-yellow-400 hover:bg-yellow-400/10 rounded-full transition-colors`} title="Attach Bounty">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
                        </button>
                        <button onClick={() => setShowScheduleModal(true)} className={`p-2 ${scheduledDate ? 'bg-blue-500/20' : ''} text-blue-500 hover:bg-blue-500/10 rounded-full transition-colors`} title="Schedule Post">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </button>
                        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`p-2 ${showEmojiPicker ? 'bg-[var(--accent)]/20' : ''} text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-full transition-colors`} title="Emoji">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        {content.length > 0 && (
                            <div className="w-6 h-6 rounded-full border-2 border-[var(--card-border)] flex items-center justify-center">
                                <div 
                                    className={`w-full h-full rounded-full transition-all ${content.length > 900 ? 'bg-red-500' : 'bg-[var(--accent)]'}`}
                                    style={{ clipPath: `circle(${Math.min(100, (content.length / 1000) * 100)}% at 50% 50%)` }}
                                />
                            </div>
                        )}
                        
                        <button 
                            onClick={saveDraft}
                            className="text-[var(--accent)] font-medium text-sm hover:underline hidden sm:block"
                        >
                            Save Draft
                        </button>

                        <button
                            onClick={handleSubmit}
                            disabled={creating || (!content.trim() && mediaItems.length === 0)}
                            className="bg-yellow-400 text-black px-5 py-2 rounded-full font-bold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                        >
                            {creating ? 'Posting...' : 'Post'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-500/10 text-red-500 p-3 text-sm text-center border-t border-red-500/20">
                        {error}
                    </div>
                )}
                
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleMediaSelect}
                    accept="image/*,video/*,audio/*"
                    multiple
                    className="hidden"
                />
            </div>
            
            <CalendarModal 
                isOpen={showScheduleModal} 
                onClose={() => setShowScheduleModal(false)} 
                onSchedule={(date) => {
                    setScheduledDate(date);
                    setShowScheduleModal(false);
                }}
            />
        </div>,
        document.body
    );
}
