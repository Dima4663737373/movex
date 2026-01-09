/**
 * Create Post Form Component
 * 
 * Form for creating new posts on-chain with image support
 */

'use client';

import React, { useState, useRef } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications } from '@/components/Notifications';
import { createPostOnChain, createCommentOnChain, OnChainPost } from '@/lib/microThreadsClient';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { sendSocialNotification } from '@/contexts/SocialActivityContext';
import { extractMentions } from '@/utils/textUtils';
import CalendarModal from './CalendarModal';
import GifPicker from './GifPicker';

interface CreatePostFormProps {
    onPostCreated?: (post?: OnChainPost) => void;
    parentId?: number;
    repostOf?: OnChainPost;
    parentAuthorAddress?: string;
}

interface MediaItem {
    url: string;
    type: 'image' | 'video' | 'audio';
}

export function CreatePostForm({ onPostCreated, parentId, repostOf, parentAuthorAddress }: CreatePostFormProps) {
    const { t } = useLanguage();
    const { addNotification } = useNotifications();
    const { connected, signAndSubmitTransaction, account } = useWallet();
    const [content, setContent] = useState('');
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const processFiles = (files: File[]) => {
        if (files.length === 0) return;

        // Limit to 4 items
        if (mediaItems.length + files.length > 4) {
            setError(t.mediaLimitError);
            return;
        }

        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                // Allow larger initial files (up to 10MB) since we'll compress them
                if (file.size > 10 * 1024 * 1024) {
                    setError(t.imageTooLargeError);
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
                    setError(t.videoTooLarge);
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

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        const files: File[] = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                const file = items[i].getAsFile();
                if (file) files.push(file);
            }
        }
        if (files.length > 0) {
            e.preventDefault();
            processFiles(files);
        }
    };

    const removeMedia = (index: number) => {
        setMediaItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveDraft = () => {
        if (!content.trim() && mediaItems.length === 0) return;
        
        if (!account?.address) {
             addNotification(t.pleaseConnectWallet, "error", { persist: false });
             return;
        }

        const userAddress = account.address.toString();
        const localKey = `saved_messages_${userAddress}`;
        
        try {
            const existingData = localStorage.getItem(localKey);
            const messages = existingData ? JSON.parse(existingData) : [];
            
            // Construct message object compatible with SavedMessagesView
            const newMessage = {
                id: uuidv4(),
                type: mediaItems.length > 0 ? mediaItems[0].type : 'text',
                content: mediaItems.length > 0 ? mediaItems[0].url : content, // Simplified for now, complex media draft might need more work but this fits current schema
                // Actually, if it's text + media, SavedMessagesView splits them. 
                // Let's just save the text for now if there is text, or media if media.
                // Better: if text exists, save text. If media exists, save media as separate items?
                // For simplicity and user expectation: Save text as one draft.
                timestamp: Date.now()
            };

            // If we have both, we might want to save the text. 
            // The user asked for "text... annulled", implying text is the main concern.
            // Let's save text first.
            if (content.trim()) {
                messages.push({
                    id: uuidv4(),
                    type: 'text',
                    content: content,
                    timestamp: Date.now()
                });
            }
            
            // Then save media if any
            mediaItems.forEach(item => {
                messages.push({
                    id: uuidv4(),
                    type: item.type,
                    content: item.url,
                    timestamp: Date.now()
                });
            });

            localStorage.setItem(localKey, JSON.stringify(messages));
            
            // Notify other components
            window.dispatchEvent(new CustomEvent('draft_saved'));
            
            addNotification("Draft saved to Saved Messages!", "success", { persist: false });
            // Don't clear form so user can continue editing if they want
            // setContent('');
            // setMediaItems([]);
            // if (fileInputRef.current) fileInputRef.current.value = '';
            
        } catch (e) {
            console.error("Failed to save draft", e);
            addNotification("Failed to save draft", "error");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (!connected || !account || !signAndSubmitTransaction) {
            setError(t.pleaseConnectWallet || "Please connect your wallet first");
            addNotification("Please connect your wallet to create a post", "error", { persist: false });
            return;
        }

        if (!content.trim() && mediaItems.length === 0 && !repostOf) {
            setError(t.enterContentOrMedia);
            return;
        }

        if (content.length > 1000) {
            setError(t.contentTooLong);
            return;
        }

        // Optimistic Update
        const tempId = `pending-${Date.now()}`;
        // Create a temporary ref for the preview if needed
        const tempRef = mediaItems.length > 0 || repostOf ? uuidv4() : '';
        let previewContent = content;
        if (scheduledDate) {
            previewContent += `\n\n[schedule:${Math.floor(scheduledDate.getTime() / 1000)}]`;
        }
        previewContent += (tempRef ? `\n[ref:${tempRef}]` : '');
        
        const optimisticPost = {
            id: tempId, // Use string for temp ID
            global_id: 0,
            creator: account!.address.toString(), // We checked connected above
            creatorAddress: account!.address.toString(),
            creatorHandle: account!.ansName || undefined, // Add handle for display
            content: previewContent,
            image_url: mediaItems.length > 0 ? mediaItems[0].url : '',
            style: 0,
            totalTips: 0, // Match PostCard expected props
            total_tips: 0, // Match OnChainPost
            createdAt: Math.floor(Date.now() / 1000), // Match PostCard
            timestamp: Math.floor(Date.now() / 1000), // Match OnChainPost
            is_deleted: false,
            updated_at: Math.floor(Date.now() / 1000),
            last_tip_timestamp: 0,
            parent_id: parentId || 0,
            is_comment: !!parentId,
            status: 'pending' as const
        };

        // Dispatch pending event immediately - REMOVED per user request to wait for transaction
        // window.dispatchEvent(new CustomEvent('post_pending', { detail: optimisticPost }));
        
        // Don't clear form immediately - wait for success
        // setContent('');
        // setMediaItems([]);
        // if (fileInputRef.current) fileInputRef.current.value = '';
        // setSuccess(true);
        
        if (onPostCreated) {
            // We pass the optimistic post so the parent can close/update if it wants
            // But we don't want to block.
             onPostCreated(optimisticPost as any);
        }

        // Start Background Process
        (async () => {
            try {
                setCreating(true); // Internal state
                
                let finalContent = content;

                // Append schedule if set
                if (scheduledDate) {
                    finalContent += `\n\n[schedule:${Math.floor(scheduledDate.getTime() / 1000)}]`;
                }
                let postRef = tempRef; // Reuse the ref we generated for consistency? Or generate new? 
                // Better reuse if we want the preview to match, but we need to ensure we use this ref in the upload.
                // The previous code generated ref inside try block. Let's use the one we generated.
                
                if (postRef && !content.includes(`[ref:${postRef}]`)) {
                     // Reconstruct the content exactly as we previewed
                     finalContent += `\n[ref:${postRef}]`;
                } else if (!postRef && (mediaItems.length > 0 || repostOf)) {
                     // Should have been generated above
                     postRef = uuidv4();
                     finalContent += `\n[ref:${postRef}]`;
                }

                // ... Media Upload Logic ...
                let uploadedMediaUrls: string[] = [];
                
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
                                    let extension = 'jpg';
                                    if (item.type === 'video') extension = 'mp4';
                                    else if (item.type === 'audio') extension = 'mp3';
                                    
                                    const fileName = `${postRef}/${uuidv4()}.${extension}`;
                                    const contentType = item.type === 'video' ? 'video/mp4' : item.type === 'audio' ? 'audio/mpeg' : 'image/jpeg';
                                    
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
                                    console.error("Upload failed", e);
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

                // ... Repost Metadata ...
                if (repostOf && postRef && supabase) {
                    await supabase.from('post_metadata').insert({
                        post_ref: postRef,
                        repost_of: repostOf.global_id !== undefined ? repostOf.global_id.toString() : repostOf.id.toString(),
                        metadata: {} 
                    });
                }

                const legacyImage = uploadedMediaUrls.length > 0 && mediaItems[0].type === 'image' 
                    ? uploadedMediaUrls[0] 
                    : (mediaItems.length > 0 && mediaItems[0].type === 'image' ? mediaItems[0].url : '');

                if (legacyImage.length > 200000) {
                     throw new Error("Image too large for on-chain storage.");
                }

                // Chain Transaction
                if (parentId) {
                    // Double-check wallet connection before creating comment
                    if (!connected || !account || !signAndSubmitTransaction) {
                        throw new Error("Wallet disconnected. Please reconnect your wallet.");
                    }
                    
                    await createCommentOnChain(
                        parentId,
                        finalContent,
                        legacyImage,
                        signAndSubmitTransaction
                    );

                    // Notify parent post author about comment
                    if (parentAuthorAddress && parentAuthorAddress !== account?.address?.toString()) {
                        sendSocialNotification(parentAuthorAddress, {
                            type: 'comment',
                            actorAddress: account!.address.toString(),
                            targetPostId: parentId.toString(),
                            targetPostContent: finalContent.substring(0, 100),
                            content: finalContent.substring(0, 100)
                        });
                    }

                    // Notify mentioned users in comment
                    const mentions = extractMentions(finalContent);
                    mentions.forEach(mention => {
                        // Check if mention looks like an address (basic check)
                        if ((mention.startsWith('0x') || mention.length > 20) && mention !== account?.address?.toString()) {
                            sendSocialNotification(mention, {
                                type: 'mention',
                                actorAddress: account!.address.toString(),
                                targetPostId: parentId.toString(),
                                targetPostContent: finalContent.substring(0, 100),
                                content: finalContent.substring(0, 100)
                            });
                        }
                    });
                } else {
                    // Double-check wallet connection before creating post
                    if (!connected || !account || !signAndSubmitTransaction) {
                        throw new Error("Wallet disconnected. Please reconnect your wallet.");
                    }
                    
                    const newPostId = await createPostOnChain(
                        finalContent,
                        legacyImage,
                        0,
                        signAndSubmitTransaction,
                        account?.address?.toString() // Pass user address for account check
                    );

                    // Notify original author about quote/repost
                    if (repostOf && repostOf.creator !== account?.address?.toString()) {
                         sendSocialNotification(repostOf.creator, {
                            type: 'quote',
                            actorAddress: account!.address.toString(),
                            targetPostId: repostOf.id.toString(),
                            targetPostContent: repostOf.content.substring(0, 100),
                            content: finalContent.substring(0, 100)
                        });
                    }
                    
                    // Notify mentioned users in new post
                    const mentions = extractMentions(finalContent);
                    mentions.forEach(mention => {
                        if ((mention.startsWith('0x') || mention.length > 20) && mention !== account?.address?.toString()) {
                            sendSocialNotification(mention, {
                                type: 'mention',
                                actorAddress: account!.address.toString(),
                                targetPostId: newPostId ? newPostId.toString() : '0',
                                targetPostContent: finalContent.substring(0, 100),
                                content: finalContent.substring(0, 100)
                            });
                        }
                    });
                    
                    // Success!
                    // Dispatch success event to update the pending post with real ID
                     window.dispatchEvent(new CustomEvent('post_success', { 
                        detail: { 
                            tempId, 
                            finalId: newPostId,
                            post: { ...optimisticPost, id: newPostId, status: 'success' }
                        } 
                    }));

                    // Clear form
                    setContent('');
                    setMediaItems([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    setSuccess(true);
                }

                addNotification(t.postCreatedSuccess, "success", { persist: false });
                
            } catch (error: any) {
                console.error('Failed to create post:', error);
                let msg = error?.message || t.postCreationError;
                
                // Handle specific wallet errors
                if (error?.name === 'WalletNotConnectedError' || error?.message?.includes('WalletNotConnected') || error?.message?.includes('not connected')) {
                    msg = "Wallet is not connected. Please connect your wallet and try again.";
                    addNotification(msg, "error", { persist: true });
                } else if (error?.message?.includes('disconnected')) {
                    msg = "Wallet disconnected. Please reconnect your wallet.";
                    addNotification(msg, "error", { persist: true });
                } else if (error?.error_code === 'account_not_found' || error?.message?.includes('Account not found')) {
                    msg = "Account not found on blockchain. Your account needs to be initialized. Please try receiving a small amount of MOVE tokens first.";
                    addNotification(msg, "error", { persist: true });
                } else {
                    addNotification("Post failed: " + msg, "error", { persist: true });
                }
                
                // Dispatch fail event
                window.dispatchEvent(new CustomEvent('post_fail', { 
                    detail: { tempId, error: msg } 
                }));
                
                // Optional: Restore draft? 
                // Since form is cleared, maybe we can save it to localStorage drafts?
                // For now, let's just notify.
            } finally {
                setCreating(false);
            }
        })();
    };

    // Calculate progress circle props
    const maxLength = 1000;
    const progress = Math.min(content.length / maxLength, 1);
    const radius = 10;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - progress * circumference;
    
    // Color logic
    let strokeColor = 'text-[var(--accent)]';
    if (content.length > maxLength) strokeColor = 'text-red-500';
    else if (content.length > maxLength * 0.9) strokeColor = 'text-yellow-500';

    return (
        <form onSubmit={handleSubmit} className="relative bg-[var(--card-bg)] border-b border-[var(--card-border)] p-4">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">
                {parentId ? t.leaveComment : repostOf ? t.quoteRepost : t.createPostTitle}
            </h2>

            {/* Repost Preview */}
            {repostOf && (
                <div className="mb-4 p-3 border border-[var(--card-border)] rounded-xl bg-[var(--hover-bg)] opacity-80">
                    <div className="flex items-center gap-2 mb-2 text-sm text-[var(--text-secondary)]">
                        <span className="font-bold">Reposting @{repostOf.creator.slice(0, 6)}...</span>
                    </div>
                    <div className="text-sm text-[var(--text-primary)] line-clamp-3">
                        {repostOf.content.replace(/\[ref:[a-f0-9\-]+\]/g, '')}
                    </div>
                </div>
            )}

            {/* Loading Overlay */}
            {creating && (
                <div className="absolute inset-0 bg-black/50 z-50 rounded-xl flex flex-col items-center justify-center">
                    <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mb-2" />
                    <span className="text-white font-medium">
                        {mediaItems.length > 0 ? "Uploading media & preparing..." : "Waiting for wallet..."}
                    </span>
                </div>
            )}

            {/* Success message */}
            {success && (
                <div className="mb-4 p-3 bg-green-400/10 border border-green-400/30 rounded-lg text-green-400 text-sm">
                    ✓ {t.postCreatedSuccess}
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="mb-4 p-3 bg-red-400/10 border border-red-400/30 rounded-lg text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Content */}
            <div className="mb-4">
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onPaste={handlePaste}
                    placeholder={parentId ? t.writeReply : t.whatsHappeningPlaceholder}
                    className="w-full px-4 py-3 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl text-[var(--text-primary)] placeholder-neutral-500 focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                    rows={3}
                    maxLength={1000}
                    disabled={creating}
                />

                {/* Media Preview */}
            {mediaItems.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                    {mediaItems.map((item, index) => (
                        <div key={index} className="relative group aspect-video">
                            {item.type === 'video' ? (
                                <video src={item.url} className="h-32 w-full rounded-xl border border-[var(--card-border)] object-cover" />
                            ) : item.type === 'audio' ? (
                                <div className="h-32 w-full rounded-xl border border-[var(--card-border)] bg-[var(--bg-secondary)] flex items-center justify-center p-2">
                                     <audio src={item.url} controls className="w-full" />
                                </div>
                            ) : (
                                <img src={item.url} alt={`Preview ${index}`} className="h-32 w-full rounded-xl border border-[var(--card-border)] object-cover" />
                            )}
                            <button
                                type="button"
                                onClick={() => removeMedia(index)}
                                className="absolute -top-2 -right-2 bg-red-500 text-[var(--text-primary)] rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                            {item.type === 'video' && (
                                <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
                                    Video
                                </div>
                            )}
                            {item.type === 'audio' && (
                                <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
                                    Audio
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-3 flex items-center justify-between flex-wrap gap-2 relative">
                {showGifPicker && (
                    <div className="absolute bottom-full left-0 mb-2 z-50">
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
                <div className="flex items-center gap-4 flex-wrap">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleMediaSelect}
                        accept="image/*,video/*,audio/*"
                        multiple
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => {
                            if (fileInputRef.current) {
                                fileInputRef.current.accept = "image/*";
                                fileInputRef.current.click();
                            }
                        }}
                        className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                            creating || mediaItems.length >= 4
                                ? 'text-neutral-600 cursor-not-allowed opacity-50'
                                : 'text-neutral-400 hover:text-[var(--accent)]'
                        }`}
                        disabled={creating || mediaItems.length >= 4}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="hidden sm:inline">{t.photo}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (fileInputRef.current) {
                                fileInputRef.current.accept = "video/*";
                                fileInputRef.current.click();
                            }
                        }}
                        className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                            creating || mediaItems.length >= 4
                                ? 'text-neutral-600 cursor-not-allowed opacity-50'
                                : 'text-neutral-400 hover:text-[var(--accent)]'
                        }`}
                        disabled={creating || mediaItems.length >= 4}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="hidden sm:inline">{t.video}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (fileInputRef.current) {
                                fileInputRef.current.accept = "audio/*";
                                fileInputRef.current.click();
                            }
                        }}
                        className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                            creating || mediaItems.length >= 4
                                ? 'text-neutral-600 cursor-not-allowed opacity-50'
                                : 'text-neutral-400 hover:text-[var(--accent)]'
                        }`}
                        disabled={creating || mediaItems.length >= 4}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        <span className="hidden sm:inline">Audio</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowGifPicker(!showGifPicker)}
                        className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                            creating || mediaItems.length >= 4
                                ? 'text-neutral-600 cursor-not-allowed opacity-50'
                                : 'text-neutral-400 hover:text-[var(--accent)]'
                        }`}
                        disabled={creating || mediaItems.length >= 4}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        <span className="hidden sm:inline">GIF</span>
                    </button>
                    <span className="text-xs text-neutral-500 ml-auto">
                        {mediaItems.length}/4
                    </span>
                </div>
                
                {/* Character Limit Circle */}
                <div className="flex items-center gap-2">
                    <div className="relative w-6 h-6 flex items-center justify-center">
                         <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="12"
                                cy="12"
                                r={radius}
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                                className="text-[var(--card-border)]"
                            />
                            <circle
                                cx="12"
                                cy="12"
                                r={radius}
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                className={`${strokeColor} transition-all duration-300`}
                            />
                        </svg>
                        {content.length > maxLength && (
                            <span className="absolute text-[10px] font-bold text-red-500">
                                !
                            </span>
                        )}
                    </div>
                </div>
            </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end items-center gap-2">
                {!repostOf && !parentId && (
                    <>
                        <button
                            type="button"
                            onClick={handleSaveDraft}
                            disabled={creating || (!content.trim() && mediaItems.length === 0)}
                            className={`p-2 rounded-full transition-colors ${
                                creating || (!content.trim() && mediaItems.length === 0)
                                    ? 'text-neutral-600 cursor-not-allowed opacity-50'
                                    : 'hover:bg-[var(--bg-secondary)] text-neutral-400 hover:text-[var(--accent)]'
                            }`}
                            title={(!content.trim() && mediaItems.length === 0) ? "Write something to save draft" : (t.drafts || "Save Draft")}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowScheduleModal(true)}
                            disabled={creating}
                            className={`p-2 rounded-full transition-colors ${
                                creating
                                    ? 'text-neutral-600 cursor-not-allowed opacity-50'
                                    : `hover:bg-[var(--bg-secondary)] ${scheduledDate ? 'text-blue-500 bg-blue-500/10' : 'text-neutral-400'}`
                            }`}
                            title="Schedule"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </button>
                    </>
                )}
                <button
                    type="submit"
                    disabled={!connected || creating || (!content.trim() && mediaItems.length === 0 && !repostOf)}
                    className={`px-6 py-2 font-bold rounded-full transition-all text-sm shadow-md 
                        ${(!connected || creating || (!content.trim() && mediaItems.length === 0 && !repostOf)) 
                            ? 'bg-neutral-700 text-neutral-400 cursor-not-allowed shadow-none opacity-50' 
                            : 'bg-[var(--accent)] hover:brightness-110 text-[var(--btn-text-primary)] hover:shadow-lg transform hover:-translate-y-0.5 cursor-pointer'
                        }`}
                >
                    {creating ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {t.posting}
                        </span>
                    ) : (
                        parentId ? t.replyButton : repostOf ? t.repostButton : t.postButton
                    )}
                </button>
            </div>
            
            <CalendarModal 
                isOpen={showScheduleModal} 
                onClose={() => setShowScheduleModal(false)} 
                onSchedule={(date) => {
                    setScheduledDate(date);
                    setShowScheduleModal(false);
                }}
            />
        </form>
    );
}

