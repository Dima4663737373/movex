import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState, useEffect, useRef } from "react";
import { getDisplayName, getAvatar } from "@/lib/microThreadsClient";
import { v4 as uuidv4 } from 'uuid';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import CreateTodoListModal from "@/components/CreateTodoListModal";
import CalendarModal from "@/components/CalendarModal";
import { useLanguage } from "@/contexts/LanguageContext";

interface SavedMessage {
    id: string;
    type: 'text' | 'todo' | 'todo_list' | 'image' | 'video';
    content: any; // string for text/todo, url for media, object for todo_list
    timestamp: number;
    completed?: boolean; // for single todo (legacy)
    metadata?: any; // e.g. scheduled time
}

export default function SavedMessagesView() {
    const { account, connected } = useWallet();
    const { t } = useLanguage();
    const userAddress = account?.address.toString() || "";
    
    // Data State
    const [messages, setMessages] = useState<SavedMessage[]>([]);
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [showTodoModal, setShowTodoModal] = useState(false);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [contextMenuPos, setContextMenuPos] = useState<{x: number, y: number} | null>(null);

    // Input State
    const [inputText, setInputText] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const sendButtonRef = useRef<HTMLButtonElement>(null);

    // Load Data (Local Messages Only)
    useEffect(() => {
        const loadData = async () => {
            if (!connected || !userAddress) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                
                // 1. Load Local Messages
                const localKey = `saved_messages_${userAddress}`;
                const localData = localStorage.getItem(localKey);
                const localMessages: SavedMessage[] = localData ? JSON.parse(localData) : [];

                // Sort by timestamp
                setMessages(localMessages.sort((a, b) => a.timestamp - b.timestamp));

            } catch (error) {
                console.error("Error loading saved messages:", error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [connected, userAddress]);
    
    // Close context menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenuPos(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    // Save Local Message
    const saveMessage = (newMessage: SavedMessage) => {
        const updatedMessages = [...messages, newMessage].sort((a, b) => a.timestamp - b.timestamp);
        setMessages(updatedMessages);
        
        // Persist to LocalStorage
        const localKey = `saved_messages_${userAddress}`;
        localStorage.setItem(localKey, JSON.stringify(updatedMessages));
    };

    const handleSendMessage = (scheduledFor?: number) => {
        if (!inputText.trim()) return;

        const newMessage: SavedMessage = {
            id: uuidv4(),
            type: 'text',
            content: inputText,
            timestamp: Date.now(),
            metadata: scheduledFor ? { scheduledFor } : undefined
        };

        saveMessage(newMessage);
        setInputText("");
        setShowEmojiPicker(false);
    };

    const handleCreateTodoList = (title: string, items: { id: string, text: string, completed: boolean }[]) => {
        const newMessage: SavedMessage = {
            id: uuidv4(),
            type: 'todo_list',
            content: { title, items },
            timestamp: Date.now()
        };
        saveMessage(newMessage);
    };

    const handleScheduleMessage = (date: Date) => {
        if (inputText.trim()) {
            handleSendMessage(date.getTime());
        }
    };

    const handleSendRightClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent closing immediately
        if (!inputText.trim()) return; // Only allow scheduling if there is text
        
        // Position relative to button or cursor
        const rect = sendButtonRef.current?.getBoundingClientRect();
        if (rect) {
            setContextMenuPos({ x: rect.left, y: rect.top - 50 }); // Above button
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                const type = file.type.startsWith('video/') ? 'video' : 'image';
                const newMessage: SavedMessage = {
                    id: uuidv4(),
                    type,
                    content: event.target.result as string,
                    timestamp: Date.now()
                };
                saveMessage(newMessage);
            }
        };
        reader.readAsDataURL(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const toggleTodo = (id: string) => {
        // Handle legacy single todos
        const updatedMessages = messages.map(m => {
            if (m.id === id && m.type === 'todo') {
                return { ...m, completed: !m.completed };
            }
            return m;
        });
        setMessages(updatedMessages);
        
        const localKey = `saved_messages_${userAddress}`;
        localStorage.setItem(localKey, JSON.stringify(updatedMessages));
    };

    const toggleTodoListData = (messageId: string, itemId: string) => {
        const updatedMessages = messages.map(m => {
            if (m.id === messageId && m.type === 'todo_list') {
                const newItems = m.content.items.map((item: any) => 
                    item.id === itemId ? { ...item, completed: !item.completed } : item
                );
                return { ...m, content: { ...m.content, items: newItems } };
            }
            return m;
        });
        setMessages(updatedMessages);

        const localKey = `saved_messages_${userAddress}`;
        localStorage.setItem(localKey, JSON.stringify(updatedMessages));
    };

    const deleteMessage = (id: string) => {
         const updatedMessages = messages.filter(m => m.id !== id);
         setMessages(updatedMessages);

         const localKey = `saved_messages_${userAddress}`;
         localStorage.setItem(localKey, JSON.stringify(updatedMessages));
    };

    return (
        <div className="flex flex-col h-full md:px-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 px-4 md:px-0 border-b border-[var(--card-border)] pb-4 flex-shrink-0">
                <div className="w-10 h-10 bg-[var(--accent)]/20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                </div>
                <div>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">{t.savedMessages}</h2>
                    <p className="text-sm text-[var(--text-secondary)]">Store messages and media</p>
                </div>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-4 min-h-0">
                {loading ? (
                    <div className="flex justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-20 opacity-50">
                        <p className="text-xl font-bold">No saved messages yet</p>
                        <p>Send a message to yourself or bookmark a post.</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className="flex justify-end group">
                            <div className="max-w-[85%] relative">
                                {/* Delete Button (visible on hover) */}
                                <button 
                                    onClick={() => deleteMessage(msg.id)}
                                    className="absolute -left-8 top-0 text-red-500 opacity-0 group-hover:opacity-100 p-1"
                                >
                                    ✕
                                </button>

                                <div className="rounded-2xl p-3 bg-[var(--card-bg)] border border-[var(--card-border)]">
                                    
                                    {/* Text Content */}
                                    {msg.type === 'text' && (
                                        <div className="whitespace-pre-wrap text-[var(--text-primary)]">
                                            {msg.content}
                                            {/* Simple Link Detection */}
                                            {msg.content.match(/https?:\/\/[^\s]+/) && (
                                                <div className="mt-2 p-2 bg-[var(--bg-primary)] rounded text-xs truncate text-[var(--accent)]">
                                                    🔗 <a href={msg.content.match(/https?:\/\/[^\s]+/)[0]} target="_blank" rel="noreferrer" className="hover:underline">
                                                        {msg.content.match(/https?:\/\/[^\s]+/)[0]}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Todo List Content */}
                                    {msg.type === 'todo_list' && (
                                        <div className="w-full min-w-[200px]">
                                            {msg.content.title && (
                                                <div className="font-bold text-[var(--accent)] mb-2 px-1">
                                                    {msg.content.title}
                                                </div>
                                            )}
                                            <div className="space-y-1">
                                                {msg.content.items.map((item: any) => (
                                                    <div 
                                                        key={item.id} 
                                                        className="flex items-center gap-3 p-1 hover:bg-[var(--hover-bg)] rounded cursor-pointer group/item"
                                                        onClick={() => toggleTodoListData(msg.id, item.id)}
                                                    >
                                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors flex-shrink-0 ${
                                                            item.completed ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--text-secondary)] group-hover/item:border-[var(--accent)]'
                                                        }`}>
                                                            {item.completed && <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                        </div>
                                                        <span className={`${item.completed ? 'line-through opacity-50' : ''} text-[var(--text-primary)] break-words w-full`}>
                                                            {item.text}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Todo Content (Legacy) */}
                                    {msg.type === 'todo' && (
                                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleTodo(msg.id)}>
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                                msg.completed ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--text-secondary)]'
                                            }`}>
                                                {msg.completed && <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                            </div>
                                            <span className={`${msg.completed ? 'line-through opacity-50' : ''} text-[var(--text-primary)]`}>
                                                {msg.content}
                                            </span>
                                        </div>
                                    )}

                                    {/* Media Content */}
                                    {(msg.type === 'image' || msg.type === 'video') && (
                                        <div className="max-w-sm rounded-lg overflow-hidden">
                                            {msg.type === 'image' ? (
                                                <img src={msg.content} alt="Saved" className="w-full h-auto" />
                                            ) : (
                                                <video src={msg.content} controls className="w-full h-auto" />
                                            )}
                                        </div>
                                    )}

                                    {/* Metadata */}
                                    <div className="flex items-center justify-end gap-2 mt-1">
                                        {msg.metadata?.scheduledFor && (
                                            <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1 rounded">
                                                📅 {new Date(msg.metadata.scheduledFor).toLocaleDateString()}
                                            </span>
                                        )}
                                        <span className="text-[10px] text-[var(--text-secondary)]">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="mt-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-2 relative">
                {showEmojiPicker && (
                    <div className="absolute bottom-full right-0 mb-2 z-50">
                        <EmojiPicker 
                            theme={Theme.DARK} 
                            onEmojiClick={(e) => setInputText(prev => prev + e.emoji)}
                        />
                    </div>
                )}
                
                {/* Tools Bar */}
                <div className="flex items-center gap-2 px-2 pb-2 border-b border-[var(--card-border)] mb-2">
                    <button 
                        onClick={() => setShowTodoModal(true)}
                        className="p-1.5 rounded hover:bg-[var(--hover-bg)] text-[var(--text-secondary)] transition-colors"
                        title="New Task List"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 rounded hover:bg-[var(--hover-bg)] text-[var(--text-secondary)] transition-colors"
                        title="Upload Media"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
                        accept="image/*,video/*" 
                    />
                </div>

                <div className="flex gap-2">
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        placeholder="Write a note..."
                        className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-secondary)] resize-none focus:outline-none max-h-32 px-2"
                        rows={1}
                        style={{ minHeight: '40px' }}
                    />
                    
                    <button 
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>

                    <button 
                        ref={sendButtonRef}
                        onClick={() => handleSendMessage()}
                        onContextMenu={handleSendRightClick}
                        disabled={!inputText.trim()}
                        className="p-2 bg-[var(--accent)] text-black rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </div>

            <CreateTodoListModal 
                isOpen={showTodoModal} 
                onClose={() => setShowTodoModal(false)} 
                onCreate={handleCreateTodoList} 
            />

            <CalendarModal 
                isOpen={showCalendarModal}
                onClose={() => setShowCalendarModal(false)}
                onSchedule={handleScheduleMessage}
            />

            {/* Custom Context Menu */}
            {contextMenuPos && (
                <div 
                    style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
                    className="fixed z-50 bg-[#1c1c1e] border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]"
                >
                    <button 
                        onClick={() => {
                            setContextMenuPos(null);
                            setShowCalendarModal(true);
                        }}
                        className="w-full px-4 py-2 text-left text-white hover:bg-white/10 flex items-center gap-2"
                    >
                        <svg className="w-4 h-4 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Schedule Message
                    </button>
                </div>
            )}
        </div>
    );
}
