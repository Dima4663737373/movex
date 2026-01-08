/**
 * Chat Page
 * 
 * Messaging and chat features
 */

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import { getDisplayName, getAvatar, OnChainPost, getGlobalPostsCount, getGlobalPosts } from "@/lib/microThreadsClient";
import { formatMovementAddress } from "@/lib/movement";
import CalendarModal from "@/components/CalendarModal";
import { useNotifications } from "@/components/Notifications";
import { useChat } from "@/contexts/ChatContext";
import ConversationList from "@/components/chat/ConversationList";
import { Message, Conversation, Profile } from "@/types/chat";

export default function ChatPage() {
    const { account, connected, signMessage } = useWallet();
    const router = useRouter();
    const userAddress = account?.address.toString() || "";
    const { addNotification } = useNotifications();
    const { refreshConversations } = useChat();
    
    // Chat State
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeContact, setActiveContact] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState("");
    const [profiles, setProfiles] = useState<Record<string, Profile>>({});
    const [isLoading, setIsLoading] = useState(false);

    // Scheduling State
    const [showCalendar, setShowCalendar] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    
    // Media & Emoji State
    const [mediaFiles, setMediaFiles] = useState<{ file: File; preview: string; type: 'image' | 'video' | 'audio' }[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const EMOJIS = ["😀", "😂", "🥰", "😎", "🤔", "😅", "😭", "😤", "👍", "👎", "🔥", "❤️", "🎉", "👀", "🚀", "💯", "👋", "🙏", "💪", "💀"];

    // New Chat State
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [following, setFollowing] = useState<string[]>([]);
    const [allUsers, setAllUsers] = useState<string[]>([]);
    const [searchResults, setSearchResults] = useState<{
        following: string[];
        global: string[];
    }>({ following: [], global: [] });

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scheduled Messages Polling
    useEffect(() => {
        const checkScheduledMessages = async () => {
            if (!userAddress) return;
            
            try {
                const stored = localStorage.getItem('scheduled_dms');
                if (!stored) return;

                const scheduled: any[] = JSON.parse(stored);
                const now = new Date().getTime();
                const remaining = [];
                let hasSent = false;

                for (const msg of scheduled) {
                    if (msg.scheduledFor <= now && msg.sender === userAddress) {
                        // Time to send!
                        try {
                            const res = await fetch('/api/messages', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    sender: msg.sender,
                                    receiver: msg.receiver,
                                    content: msg.content
                                })
                            });

                            if (res.ok) {
                                hasSent = true;
                                addNotification(`Scheduled message to ${msg.receiver.slice(0, 6)}... sent!`, 'success');
                            } else {
                                // Keep it if failed? Or drop it? 
                                // For now, keep it to retry next time or manual intervention
                                // But to avoid infinite loop on perm fail, maybe we should drop or mark error
                                // Let's keep it in remaining for now but maybe we need retry count
                                remaining.push(msg); 
                            }
                        } catch (e) {
                            console.error("Failed to send scheduled message", e);
                            remaining.push(msg);
                        }
                    } else {
                        remaining.push(msg);
                    }
                }

                if (hasSent) {
                    localStorage.setItem('scheduled_dms', JSON.stringify(remaining));
                    fetchMessages();
                    fetchConversations();
                } else if (remaining.length !== scheduled.length) {
                    // Some were dropped or failed but we updated list
                     localStorage.setItem('scheduled_dms', JSON.stringify(remaining));
                }

            } catch (e) {
                console.error("Error checking scheduled messages", e);
            }
        };

        const interval = setInterval(checkScheduledMessages, 10000); // Check every 10s
        return () => clearInterval(interval);
    }, [userAddress, addNotification]);

    // Handle Scheduling
    const handleSchedule = async (date: Date) => {
        if (!activeContact || !userAddress) return;
        if (!inputText.trim() && mediaFiles.length === 0) return;

        setIsUploading(true);
        try {
            // reuse logic from handleSendMessage for media upload
            // This is a bit duplicative, ideally refactor, but for speed:
            let content = inputText.trim();
            const uploadedMedia: { url: string; type: 'image' | 'video' | 'audio' }[] = [];

             // 1. Upload Media if any
            if (mediaFiles.length > 0) {
                for (const item of mediaFiles) {
                    // ... (same upload logic as handleSendMessage) ...
                    // Since we can't easily extract the exact same code block without refactoring the whole file,
                    // I will assume for this specific task that scheduling is mostly for TEXT or existing media logic needs to be copied.
                    // Copying the upload logic here to be safe.
                    try {
                        const reader = new FileReader();
                        const base64Promise = new Promise<string>((resolve, reject) => {
                            reader.onload = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(item.file);
                        });
                        const base64Data = await base64Promise;
                        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${item.type === 'video' ? 'mp4' : 'jpg'}`;
                        
                        const uploadRes = await fetch('/api/upload', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                fileName,
                                fileData: base64Data,
                                contentType: item.file.type
                            })
                        });

                        if (uploadRes.ok) {
                            const data = await uploadRes.json();
                            uploadedMedia.push({ url: data.publicUrl, type: item.type });
                        }
                    } catch (err) {
                        console.error("Error uploading file for schedule", err);
                    }
                }
            }

            let finalContent = content;
            if (uploadedMedia.length > 0) {
                finalContent = JSON.stringify({
                    text: content,
                    media: uploadedMedia
                });
            }

            const scheduledMsg = {
                id: Date.now().toString(),
                sender: userAddress,
                receiver: activeContact,
                content: finalContent,
                scheduledFor: date.getTime(),
                createdAt: Date.now()
            };

            const stored = localStorage.getItem('scheduled_dms');
            const list = stored ? JSON.parse(stored) : [];
            list.push(scheduledMsg);
            localStorage.setItem('scheduled_dms', JSON.stringify(list));

            addNotification(`Message scheduled for ${date.toLocaleString()}`, 'success');
            setInputText("");
            setMediaFiles([]);
            setShowCalendar(false);

        } catch (error) {
            console.error("Failed to schedule", error);
            addNotification("Failed to schedule message", "error");
        } finally {
            setIsUploading(false);
        }
    };

    // Handle URL query for starting a chat
    useEffect(() => {
        if (router.query.user) {
            setActiveContact(router.query.user as string);
        }
    }, [router.query.user]);

    // Load Conversations
    const fetchConversations = async () => {
        if (!userAddress) return;
        try {
            const res = await fetch(`/api/messages?user=${userAddress}`);
            if (res.ok) {
                const data = await res.json();
                setConversations(data);
                
                // Fetch profiles for contacts
                const contacts = data.map((c: Conversation) => c.contact);
                fetchProfiles(contacts);
            }
        } catch (error) {
            console.error("Failed to fetch conversations", error);
        }
    };

    // Load Messages for Active Contact
    const fetchMessages = async () => {
        if (!userAddress || !activeContact) return;
        try {
            const res = await fetch(`/api/messages?user=${userAddress}&otherUser=${activeContact}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (error) {
            console.error("Failed to fetch messages", error);
        }
    };

    const markConversationAsRead = async (contact: string) => {
        if (!userAddress || !contact) return;
        
        try {
            await fetch('/api/messages', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user: userAddress,
                    otherUser: contact
                })
            });
        } catch (e) {
            console.error("Failed to mark conversation as read", e);
        }
    };

    // Helper to fetch profiles
    const fetchProfiles = async (addresses: string[]) => {
        const toFetch = addresses.filter(addr => !profiles[addr]);
        if (toFetch.length === 0) return;

        const fetched: Record<string, Profile> = {};
        
        await Promise.all(toFetch.map(async (addr) => {
            try {
                const displayName = await getDisplayName(addr);
                const avatar = await getAvatar(addr);
                fetched[addr] = { displayName, avatar };
            } catch (e) {
                console.error(`Failed to fetch profile for ${addr}`, e);
            }
        }));

        if (Object.keys(fetched).length > 0) {
            setProfiles(prev => ({ ...prev, ...fetched }));
        }
    };

    // Polling
    useEffect(() => {
        if (connected && userAddress) {
            fetchConversations();
            const interval = setInterval(fetchConversations, 5000);
            return () => clearInterval(interval);
        }
    }, [connected, userAddress]);

    useEffect(() => {
        if (connected && userAddress && activeContact) {
            fetchMessages();
            fetchProfiles([activeContact]);
            
            // Mark as read when entering chat
            markConversationAsRead(activeContact).then(() => {
                refreshConversations();
            });

            const interval = setInterval(fetchMessages, 3000);
            return () => clearInterval(interval);
        }
    }, [connected, userAddress, activeContact]);

    // Load data for new chat (Following list and All Users)
    useEffect(() => {
        if (isNewChatOpen && userAddress) {
            // Fetch Following
            fetch(`/api/follow?targetAddress=${userAddress}&includeLists=true`)
                .then(res => res.json())
                .then(data => {
                    setFollowing(data.following || []);
                    // Pre-load profiles for following
                    fetchProfiles(data.following || []);
                })
                .catch(err => console.error("Failed to fetch following", err));

            // Fetch All Users (from posts) - optimize by fetching only recent posts
            // getGlobalPosts takes page index. Page 0 = newest posts.
            const LIMIT = 100;
            getGlobalPosts(0, LIMIT)
                .then(posts => {
                    const uniqueCreators = Array.from(new Set(posts.map(p => p.creator)));
                    setAllUsers(uniqueCreators);
                    // Pre-load profiles for some users (first 10 maybe)
                    fetchProfiles(uniqueCreators.slice(0, 10));
                })
                .catch(err => console.error("Failed to fetch all users", err));
        }
    }, [isNewChatOpen, userAddress]);

    // Handle Search Logic
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults({ following: following, global: [] });
            return;
        }

        const lowerQuery = searchQuery.toLowerCase();

        // Filter Following
        const matchedFollowing = following.filter(addr => {
            const profile = profiles[addr];
            const nameMatch = profile?.displayName?.toLowerCase().includes(lowerQuery);
            const addrMatch = addr.toLowerCase().includes(lowerQuery);
            return nameMatch || addrMatch;
        });

        // Filter Global (excluding following)
        const matchedGlobal = allUsers.filter(addr => {
            if (following.includes(addr)) return false; // Already in following
            const profile = profiles[addr];
            const nameMatch = profile?.displayName?.toLowerCase().includes(lowerQuery);
            const addrMatch = addr.toLowerCase().includes(lowerQuery);
            return nameMatch || addrMatch;
        });

        setSearchResults({ following: matchedFollowing, global: matchedGlobal });
        
        // Fetch profiles for matches to ensure names are displayed
        const allMatches = [...matchedFollowing, ...matchedGlobal];
        if (allMatches.length > 0) {
            fetchProfiles(allMatches.slice(0, 20)); // Limit fetching
        }
    }, [searchQuery, following, allUsers, profiles]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, mediaFiles]); // Also scroll when media is added

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            const newMedia = files.map(file => ({
                file,
                preview: URL.createObjectURL(file),
                type: file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image' as 'image' | 'video' | 'audio'
            }));
            // @ts-ignore
            setMediaFiles(prev => [...prev, ...newMedia]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeMedia = (index: number) => {
        setMediaFiles(prev => {
            const newFiles = [...prev];
            URL.revokeObjectURL(newFiles[index].preview);
            newFiles.splice(index, 1);
            return newFiles;
        });
    };

    const addEmoji = (emoji: string) => {
        setInputText(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        const newMedia: { file: File; preview: string; type: 'image' | 'video' | 'audio' }[] = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf("image") !== -1) {
                const blob = item.getAsFile();
                if (blob) {
                    newMedia.push({
                        file: blob,
                        preview: URL.createObjectURL(blob),
                        type: 'image'
                    });
                }
            } else if (item.type.indexOf("audio") !== -1) {
                const blob = item.getAsFile();
                if (blob) {
                    newMedia.push({
                        file: blob,
                        preview: URL.createObjectURL(blob),
                        type: 'audio'
                    });
                }
            }
        }

        if (newMedia.length > 0) {
            setMediaFiles(prev => [...prev, ...newMedia]);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!inputText.trim() && mediaFiles.length === 0) || !activeContact || !userAddress || isUploading) return;

        setIsUploading(true);
        let content = inputText.trim();
        const uploadedMedia: { url: string; type: 'image' | 'video' | 'audio' }[] = [];

        try {
            // 1. Upload Media if any
            if (mediaFiles.length > 0) {
                for (const item of mediaFiles) {
                    try {
                        // Convert to base64 for the upload API
                        const reader = new FileReader();
                        const base64Promise = new Promise<string>((resolve, reject) => {
                            reader.onload = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(item.file);
                        });
                        const base64Data = await base64Promise;

                        let extension = 'jpg';
                        if (item.type === 'video') extension = 'mp4';
                        if (item.type === 'audio') extension = 'mp3';

                        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
                        
                        const uploadRes = await fetch('/api/upload', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                fileName,
                                fileData: base64Data,
                                contentType: item.file.type
                            })
                        });

                        if (uploadRes.ok) {
                            const data = await uploadRes.json();
                            uploadedMedia.push({ url: data.publicUrl, type: item.type });
                        } else {
                            console.error("Upload failed for file", item.file.name);
                        }
                    } catch (err) {
                        console.error("Error processing file", err);
                    }
                }
            }

            // 2. Construct Message Content
            // We'll use a JSON structure if media exists, otherwise plain text
            let finalContent = content;
            if (uploadedMedia.length > 0) {
                finalContent = JSON.stringify({
                    text: content,
                    media: uploadedMedia
                });
            }

            // 3. Send Message
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender: userAddress,
                    receiver: activeContact,
                    content: finalContent
                })
            });

            if (res.ok) {
                setInputText("");
                setMediaFiles([]);
                fetchMessages();
                fetchConversations();
            } else {
                console.error("Failed to send message", await res.text());
            }
        } catch (error) {
            console.error("Failed to send message", error);
        } finally {
            setIsUploading(false);
        }
    };

    const startNewChat = (address: string) => {
        if (address.trim()) {
            handleContactSelect(address.trim());
            setIsNewChatOpen(false);
            setSearchQuery("");
        }
    };

    const handleContactSelect = (contact: string | null) => {
        setActiveContact(contact);
        if (contact) {
            router.push(`/chat?user=${contact}`, undefined, { shallow: true });
        } else {
            const { user, ...rest } = router.query;
            router.push({ pathname: '/chat', query: rest }, undefined, { shallow: true });
        }
    };

    return (
        <AuthGuard>
            <Head>
                <title>Chat - MoveX</title>
            </Head>

            {/* MainLayout is applied in _app.tsx, so we just provide content */}
            <div className="grid grid-cols-1 md:grid-cols-[350px_1fr] h-full md:gap-x-0 md:divide-x md:divide-[var(--card-border)]">
                {/* MIDDLE: Conversations List */}
                <div className={`flex flex-col h-full bg-[var(--bg-primary)] md:px-6 ${activeContact ? 'hidden md:flex' : 'flex'}`}>
                    <ConversationList
                        conversations={conversations}
                        activeContact={activeContact}
                        setActiveContact={handleContactSelect}
                        profiles={profiles}
                        userAddress={userAddress}
                        onNewChat={() => setIsNewChatOpen(true)}
                    />
                </div>

                {/* RIGHT: Chat Window */}
                <div className={`flex flex-col h-full md:px-6 ${!activeContact ? 'hidden md:flex' : 'flex'}`}>
                    {!activeContact ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--text-secondary)]">
                            <div className="w-20 h-20 bg-[var(--card-border)] rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <p className="text-xl font-bold">Select a conversation</p>
                            <p>Choose a contact to start chatting</p>
                        </div>
                    ) : activeContact === 'saved' ? (
                        <SavedMessagesView />
                    ) : (
                        <>
                            {/* Chat Header */}
                                    <div className="flex items-center gap-3 pb-4 border-b border-[var(--card-border)] mb-4">
                                        <button 
                                            onClick={() => handleContactSelect(null)}
                                            className="md:hidden p-2 -ml-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                        >
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                            </svg>
                                        </button>
                                        
                                        <Link href={`/${activeContact}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity group">
                                            <div className="w-10 h-10 rounded-full bg-[var(--card-border)] overflow-hidden">
                                                {profiles[activeContact]?.avatar ? (
                                                    <img src={profiles[activeContact].avatar} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[var(--text-secondary)] font-bold">
                                                        {profiles[activeContact]?.displayName?.[0]?.toUpperCase() || "U"}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                                                    {profiles[activeContact]?.displayName || formatMovementAddress(activeContact)}
                                                </h3>
                                                <p className="text-xs text-[var(--text-secondary)] font-mono">
                                                    {activeContact}
                                                </p>
                                            </div>
                                        </Link>
                                    </div>

                                    {/* Messages Area */}
                                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4">
                                        {messages.map((msg, idx) => {
                                            const isMe = msg.sender === userAddress;
                                            let content = msg.content;
                                            let media: { url: string; type: 'image' | 'video' | 'audio' }[] = [];
                                            
                                            try {
                                                const parsed = JSON.parse(msg.content);
                                                if (typeof parsed === 'object' && (parsed.text || parsed.media)) {
                                                    content = parsed.text || "";
                                                    media = parsed.media || [];
                                                }
                                            } catch (e) {
                                                // Not JSON, plain text
                                            }

                                            return (
                                                <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                                                        isMe 
                                                            ? 'bg-[var(--accent)] text-black rounded-tr-none' 
                                                            : 'bg-[var(--card-border)] text-[var(--text-primary)] rounded-tl-none'
                                                    }`}>
                                                        {media.length > 0 && (
                                                            <div className={`grid gap-2 mb-2 ${media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                                                {media.map((m, i) => (
                                                                    <div key={i} className="relative rounded-lg overflow-hidden">
                                                                        {m.type === 'video' ? (
                                                                            <video src={m.url} controls className="w-full h-auto max-h-60 object-cover" />
                                                                        ) : m.type === 'audio' ? (
                                                                            <div className="w-full p-2 bg-[var(--bg-secondary)] rounded-lg">
                                                                                <audio src={m.url} controls className="w-full" />
                                                                            </div>
                                                                        ) : (
                                                                            <img src={m.url} alt="Shared media" className="w-full h-auto max-h-60 object-cover" />
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {content && <p className="whitespace-pre-wrap">{content}</p>}
                                                        <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-black/60' : 'text-[var(--text-secondary)]'}`}>
                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Input Area */}
                                    <div className="relative">
                                        {/* Media Preview */}
                                        {mediaFiles.length > 0 && (
                                            <div className="flex gap-2 p-2 overflow-x-auto mb-2 bg-[var(--bg-primary)]/50 rounded-xl">
                                                {mediaFiles.map((file, idx) => (
                                                    <div key={idx} className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden group border border-[var(--card-border)] bg-[var(--bg-secondary)] flex items-center justify-center">
                                                        {file.type === 'video' ? (
                                                            <video src={file.preview} className="w-full h-full object-cover" />
                                                        ) : file.type === 'audio' ? (
                                                            <div className="w-full h-full flex items-center justify-center text-[var(--accent)]">
                                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                                                            </div>
                                                        ) : (
                                                            <img src={file.preview} className="w-full h-full object-cover" />
                                                        )}
                                                        <button 
                                                            onClick={() => removeMedia(idx)}
                                                            className="absolute top-0 right-0 bg-black/50 text-white p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <form onSubmit={handleSendMessage} className="relative flex items-center gap-2">
                                            <input 
                                                type="file" 
                                                ref={fileInputRef}
                                                onChange={handleFileSelect}
                                                className="hidden" 
                                                multiple 
                                                accept="image/*,video/*,audio/*" 
                                            />
                                            
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    if (fileInputRef.current) {
                                                        fileInputRef.current.accept = "image/*,video/*";
                                                        fileInputRef.current.click();
                                                    }
                                                }}
                                                className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--hover-bg)] rounded-full transition-colors"
                                                title="Attach media"
                                            >
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                </svg>
                                            </button>

                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    if (fileInputRef.current) {
                                                        fileInputRef.current.accept = "audio/*";
                                                        fileInputRef.current.click();
                                                    }
                                                }}
                                                className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--hover-bg)] rounded-full transition-colors"
                                                title="Attach audio"
                                            >
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                            </button>

                                            <div className="relative">
                                                <button 
                                                    type="button"
                                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                                    className={`p-2 hover:bg-[var(--hover-bg)] rounded-full transition-colors ${showEmojiPicker ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
                                                    title="Add emoji"
                                                >
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </button>
                                                {/* Emoji Picker */}
                                                {showEmojiPicker && (
                                                    <div className="absolute bottom-full mb-2 left-0 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl shadow-xl p-3 w-72 grid grid-cols-6 gap-1 z-10">
                                                        {EMOJIS.map(emoji => (
                                                            <button 
                                                                key={emoji} 
                                                                type="button"
                                                                onClick={() => addEmoji(emoji)} 
                                                                className="text-2xl hover:bg-[var(--hover-bg)] p-1 rounded transition-colors flex items-center justify-center aspect-square"
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    value={inputText}
                                                    onChange={(e) => setInputText(e.target.value)}
                                                    onPaste={handlePaste}
                                                    placeholder={mediaFiles.length > 0 ? "Add a caption..." : "Type a message..."}
                                                    className="w-full bg-[var(--hover-bg)] text-[var(--text-primary)] rounded-full pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                                                />
                                                <button 
                                                    type="submit"
                                                    disabled={(!inputText.trim() && mediaFiles.length === 0) || isUploading}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        if (!inputText.trim() && mediaFiles.length === 0) return;
                                                        setContextMenu({ x: e.clientX, y: e.clientY });
                                                    }}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--card-bg)] rounded-full transition-colors"
                                                    title="Right click to schedule"
                                                >
                                                    {isUploading ? (
                                                        <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

            {/* Context Menu for Schedule */}
            {contextMenu && (
                <>
                        <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} />
                        <div 
                            className="fixed z-50 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-xl py-1 min-w-[160px] animate-fadeIn"
                            style={{ top: contextMenu.y - 50, left: contextMenu.x - 160 }} 
                        >
                            <button
                                onClick={() => {
                                    setShowCalendar(true);
                                    setContextMenu(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[var(--hover-bg)] text-[var(--text-primary)] flex items-center gap-2 font-medium"
                            >
                                <svg className="w-4 h-4 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Schedule Message
                            </button>
                        </div>
                    </>
                )}

                {/* Calendar Modal */}
                <CalendarModal
                    isOpen={showCalendar}
                    onClose={() => setShowCalendar(false)}
                    onSchedule={handleSchedule}
                />

                {/* New Chat Modal */}
                {isNewChatOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 w-full max-w-md shadow-2xl h-[80vh] flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-[var(--text-primary)]">New Message</h3>
                                <button 
                                    onClick={() => setIsNewChatOpen(false)}
                                    className="p-1 hover:bg-[var(--hover-bg)] rounded-full transition-colors"
                                >
                                    <svg className="w-6 h-6 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            
                            <div className="mb-4">
                                <input 
                                    type="text" 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search users..."
                                    className="w-full bg-[var(--bg-primary)] border border-[var(--card-border)] rounded-lg p-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                                    autoFocus
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                                {/* Following Section */}
                                {searchResults.following.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Following</h4>
                                        {searchResults.following.map(addr => (
                                            <button
                                                key={addr}
                                                onClick={() => startNewChat(addr)}
                                                className="w-full flex items-center gap-3 p-3 hover:bg-[var(--hover-bg)] rounded-xl transition-colors text-left"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-[var(--card-border)] flex-shrink-0 overflow-hidden">
                                                    {profiles[addr]?.avatar ? (
                                                        <img src={profiles[addr].avatar} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[var(--text-secondary)] font-bold">
                                                            {profiles[addr]?.displayName?.[0]?.toUpperCase() || "U"}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className="font-bold text-[var(--text-primary)] block truncate">
                                                        {profiles[addr]?.displayName || formatMovementAddress(addr)}
                                                    </span>
                                                    <span className="text-xs text-[var(--text-secondary)] truncate">
                                                        {addr}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Global Section */}
                                {searchResults.global.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Other Users</h4>
                                        {searchResults.global.map(addr => (
                                            <button
                                                key={addr}
                                                onClick={() => startNewChat(addr)}
                                                className="w-full flex items-center gap-3 p-3 hover:bg-[var(--hover-bg)] rounded-xl transition-colors text-left"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-[var(--card-border)] flex-shrink-0 overflow-hidden">
                                                    {profiles[addr]?.avatar ? (
                                                        <img src={profiles[addr].avatar} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[var(--text-secondary)] font-bold">
                                                            {profiles[addr]?.displayName?.[0]?.toUpperCase() || "U"}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className="font-bold text-[var(--text-primary)] block truncate">
                                                        {profiles[addr]?.displayName || formatMovementAddress(addr)}
                                                    </span>
                                                    <span className="text-xs text-[var(--text-secondary)] truncate">
                                                        {addr}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {searchResults.following.length === 0 && searchResults.global.length === 0 && (
                                    <div className="text-center text-[var(--text-secondary)] py-8">
                                        <p>No users found</p>
                                        {searchQuery && searchQuery.startsWith("0x") && searchQuery.length > 10 && (
                                            <button
                                                onClick={() => startNewChat(searchQuery)}
                                                className="mt-2 text-[var(--accent)] hover:underline"
                                            >
                                                Chat with {formatMovementAddress(searchQuery)}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
        </AuthGuard>
    );
}
