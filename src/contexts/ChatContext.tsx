import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

interface Message {
    id: string;
    sender: string;
    receiver: string;
    content: string;
    timestamp: number;
    read: boolean;
}

interface Conversation {
    contact: string;
    lastMessage: Message;
    unreadCount: number;
}

interface ChatContextType {
    conversations: Conversation[];
    totalUnreadCount: number;
    refreshConversations: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function useChat() {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
}

export function ChatProvider({ children }: { children: ReactNode }) {
    const { account } = useWallet();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [totalUnreadCount, setTotalUnreadCount] = useState(0);

    const fetchConversations = async () => {
        if (!account?.address) {
            setConversations([]);
            setTotalUnreadCount(0);
            return;
        }

        try {
            const res = await fetch(`/api/messages?user=${account.address}`);
            if (res.ok) {
                const data: Conversation[] = await res.json();
                setConversations(data);
                
                // Calculate total unread (count of conversations with unread messages)
                const total = data.filter(c => (c.unreadCount || 0) > 0).length;
                setTotalUnreadCount(total);
            }
        } catch (error) {
            console.error("Failed to fetch conversations", error);
        }
    };

    // Poll for updates
    useEffect(() => {
        if (account?.address) {
            fetchConversations();
            const interval = setInterval(fetchConversations, 10000); // Check every 10s
            return () => clearInterval(interval);
        } else {
            setConversations([]);
            setTotalUnreadCount(0);
        }
    }, [account?.address]);

    return (
        <ChatContext.Provider value={{ conversations, totalUnreadCount, refreshConversations: fetchConversations }}>
            {children}
        </ChatContext.Provider>
    );
}
