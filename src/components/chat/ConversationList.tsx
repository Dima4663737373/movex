import { formatMovementAddress } from "@/lib/movement";
import { Conversation, Profile } from "@/types/chat";

interface ConversationListProps {
    conversations: Conversation[];
    activeContact: string | null;
    setActiveContact: (contact: string | null) => void;
    profiles: Record<string, Profile>;
    userAddress: string;
    onNewChat: () => void;
}

export default function ConversationList({
    conversations,
    activeContact,
    setActiveContact,
    profiles,
    userAddress,
    onNewChat
}: ConversationListProps) {
    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Messages</h2>
                <button 
                    onClick={onNewChat}
                    className="p-2 bg-[var(--accent)] text-black rounded-full hover:opacity-90 transition-opacity"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {conversations.length === 0 ? (
                    <div className="text-center py-10 text-[var(--text-secondary)]">
                        <p>No conversations yet</p>
                        <button 
                            onClick={onNewChat}
                            className="mt-4 text-[var(--accent)] hover:underline"
                        >
                            Start a new chat
                        </button>
                    </div>
                ) : (
                    conversations.map(conv => {
                        const profile = profiles[conv.contact];
                        const isSelected = activeContact === conv.contact;
                        
                        // Parse content for preview
                        let previewContent = conv.lastMessage.content;
                        let hasMedia = false;
                        try {
                            const parsed = JSON.parse(conv.lastMessage.content);
                            if (typeof parsed === 'object' && (parsed.text || parsed.media)) {
                                previewContent = parsed.text || "";
                                if (!previewContent && parsed.media?.length) {
                                    previewContent = "Sent a file";
                                }
                                hasMedia = parsed.media && parsed.media.length > 0;
                            }
                        } catch (e) {
                            // Not JSON
                        }

                        return (
                            <button
                                key={conv.contact}
                                onClick={() => setActiveContact(conv.contact)}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                                    isSelected ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20' : 'hover:bg-[var(--hover-bg)]'
                                }`}
                            >
                                <div className="w-12 h-12 rounded-full bg-[var(--card-border)] flex-shrink-0 overflow-hidden">
                                    {profile?.avatar ? (
                                        <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[var(--text-secondary)] font-bold">
                                            {profile?.displayName?.[0]?.toUpperCase() || "U"}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline">
                                        <span className={`font-bold truncate ${isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                                            {profile?.displayName || formatMovementAddress(conv.contact)}
                                        </span>
                                        <span className="text-xs text-[var(--text-secondary)]">
                                            {new Date(conv.lastMessage.timestamp).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className={`text-sm truncate flex items-center gap-1 ${conv.lastMessage.read || conv.lastMessage.sender === userAddress ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)] font-bold'}`}>
                                        {conv.lastMessage.sender === userAddress ? 'You: ' : ''}
                                        {hasMedia && (
                                            <span className="inline-flex items-center justify-center bg-[var(--accent)]/20 text-[var(--accent)] text-[10px] px-1 rounded h-4">
                                                📷 Photo
                                            </span>
                                        )}
                                        <span>{previewContent}</span>
                                    </p>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </>
    );
}
