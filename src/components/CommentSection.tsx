import { useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { OnChainPost, createCommentOnChain } from '@/lib/microThreadsClient';
import { octasToMove } from '@/lib/movement';
import PostCard from './PostCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNetwork } from '@/contexts/NetworkContext';
import { useNotifications } from '@/components/Notifications';

interface CommentSectionProps {
    postId: number;
    comments: OnChainPost[];
    commentCounts?: Record<number, number>;
    onCommentAdded: () => void;
    profiles?: Record<string, { displayName: string; avatar: string }>;
}

export default function CommentSection({ postId, comments, commentCounts = {}, onCommentAdded, profiles = {} }: CommentSectionProps) {
    const { signAndSubmitTransaction, connected, account, network } = useWallet();
    const { t } = useLanguage();
    const { currentNetwork } = useNetwork();
    const { addNotification } = useNotifications();
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!content.trim() || !connected) return;

        // Strict Network Check
        const requiredChainId = '250';
        if (network?.chainId?.toString() !== requiredChainId) {
            addNotification(`Wrong network! Please switch your wallet to Movement Testnet (Chain ID: 250). Currently on: ${network?.chainId || 'Unknown'}`, 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            await createCommentOnChain(postId, content, "", signAndSubmitTransaction);
            setContent('');
            onCommentAdded();
        } catch (error) {
            console.error("Failed to post comment:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mt-4">
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-4 px-4">
                {t.commentsTitle} ({comments.length})
            </h3>

            {/* Comment Form */}
            {connected ? (
                <div className="px-4 mb-6">
                    <form onSubmit={handleSubmit} className="flex gap-3">
                        <div className="flex-grow">
                            <input
                                type="text"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder={t.postReplyPlaceholder}
                                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-full px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                                disabled={isSubmitting}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!content.trim() || isSubmitting}
                            className="bg-[var(--accent)] text-[var(--btn-text-primary)] font-bold px-6 py-2 rounded-full hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                        >
                            {isSubmitting ? t.posting : t.replyButton}
                        </button>
                    </form>
                </div>
            ) : (
                <div className="px-4 mb-6 text-[var(--text-secondary)] text-sm">
                    {t.connectToReply}
                </div>
            )}

            {/* Comments List */}
            <div className="border-t border-[var(--card-border)]">
                {comments.length > 0 ? (
                    comments.map(comment => (
                        <PostCard
                            key={comment.id}
                            post={{
                                id: comment.id.toString(),
                                creatorAddress: comment.creator,
                                creatorHandle: profiles[comment.creator]?.displayName,
                                creatorAvatar: profiles[comment.creator]?.avatar,
                                content: comment.content,
                                image_url: comment.image_url,
                                style: comment.style,
                                totalTips: octasToMove(comment.total_tips),
                                createdAt: comment.timestamp * 1000,
                                updatedAt: comment.updated_at,
                                commentCount: commentCounts[comment.id] || 0
                            }}
                            isOwner={account?.address?.toString() === comment.creator}
                        />
                    ))
                ) : (
                    <div className="p-8 text-center text-[var(--text-secondary)]">
                        {t.noComments}
                    </div>
                )}
            </div>
        </div>
    );
}
