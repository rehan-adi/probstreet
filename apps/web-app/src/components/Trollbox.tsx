import { socket } from '@/socket';
import { api } from '@/lib/axios';
import { useAuthStore } from '@/store/auth';
import { useModalStore } from '@/store/modal';
import pfpIcon from '@/assets/images/pfp.avif';
import { useEffect, useState, useCallback } from 'react';

interface ChatMessage {
	id: string;
	message: string;
	createdAt: string;
	user: {
		id: string;
		username: string;
		avatarUrl: string | null;
	};
}

interface TrollboxProps {
	symbol: string;
}

const formatTime = (iso: string) => {
	const d = new Date(iso);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	if (diffMin < 1) return 'just now';
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffH = Math.floor(diffMin / 60);
	if (diffH < 24) return `${diffH}h ago`;
	return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function Trollbox({ symbol }: TrollboxProps) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState('');
	const [sending, setSending] = useState(false);
	const [loading, setLoading] = useState(true);

	const { user, isAuthenticated } = useAuthStore();
	const { openOnboardModal } = useModalStore();

	// Fetch initial message history
	useEffect(() => {
		const fetchHistory = async () => {
			try {
				const res = await api.get(`/market/${symbol}/comments`);
				if (res.data?.success) {
					setMessages(res.data.data);
				}
			} catch {
				// silent — chat is non-critical
			} finally {
				setLoading(false);
			}
		};
		fetchHistory();
	}, [symbol]);

	// Subscribe to real-time chat events
	useEffect(() => {
		const handleChatMessage = (msg: ChatMessage) => {
			setMessages((prev) => {
				// Deduplicate by id
				if (prev.some((m) => m.id === msg.id)) return prev;
				// Prepend to top (newest first)
				return [msg, ...prev];
			});
		};

		socket.on('CHAT_MESSAGE', handleChatMessage);
		return () => {
			socket.off('CHAT_MESSAGE', handleChatMessage);
		};
	}, []);

	const handleSend = useCallback(async () => {
		const trimmed = input.trim();
		if (!trimmed || sending) return;

		if (!isAuthenticated) {
			openOnboardModal();
			return;
		}

		setSending(true);
		try {
			const res = await api.post(`/market/${symbol}/comments`, { message: trimmed });
			setInput('');
			if (res.data?.success) {
				// Immediately add it to UI for snappy feel
				setMessages((prev) => {
					if (prev.some((m) => m.id === res.data.data.id)) return prev;
					return [res.data.data, ...prev];
				});
			}
		} catch (err: any) {
			console.error(err?.response?.data?.message || 'Failed to send');
		} finally {
			setSending(false);
		}
	}, [input, sending, isAuthenticated, symbol, openOnboardModal]);

	const handleDelete = async (msgId: string) => {
		try {
			await api.delete(`/market/${symbol}/comments/${msgId}`);
			setMessages((prev) => prev.filter((m) => m.id !== msgId));
		} catch (err) {
			console.error('Failed to delete message');
		}
	};

	return (
		<div className="mb-12 bg-card p-6 border border-border rounded-xl shadow-sm">
			<h2 className="text-lg font-bold mb-6 text-foreground">Comments</h2>
			<div className="flex gap-4 items-start mb-8">
				<img
					src={user?.avatarUrl || pfpIcon}
					alt="You"
					className="w-10 h-10 rounded-full border border-border shrink-0 object-cover"
				/>
				<div className="flex-1">
					<textarea
						value={input}
						onChange={(e) => setInput(e.target.value.slice(0, 280))}
						placeholder={isAuthenticated ? 'Add a comment...' : 'Sign in to add a comment...'}
						disabled={sending}
						className="w-full bg-background border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none text-foreground placeholder:text-muted-foreground disabled:opacity-50"
						rows={2}
					/>
					<div className="flex justify-between items-center mt-3">
						<span className="text-xs text-muted-foreground">{input.length}/280</span>
						<button
							onClick={isAuthenticated ? handleSend : openOnboardModal}
							disabled={sending || (isAuthenticated && !input.trim())}
							className="bg-foreground text-background font-bold text-sm px-6 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
						>
							{sending ? 'Posting...' : 'Post'}
						</button>
					</div>
				</div>
			</div>

			<div className="space-y-6">
				{loading && (
					<div className="flex justify-center py-4">
						<div className="w-5 h-5 border-2 border-border border-t-foreground rounded-full animate-spin" />
					</div>
				)}

				{!loading && messages.length === 0 && (
					<div className="text-center py-8 text-muted-foreground text-sm">
						No comments yet. Be the first to share your thoughts!
					</div>
				)}

				{messages.map((msg) => {
					const isMe = user?.id === msg.user.id;

					return (
						<div key={msg.id} className="flex gap-4 group">
							<div className="w-10 h-10 rounded-full shrink-0 overflow-hidden border border-border">
								{msg.user.avatarUrl ? (
									<img
										src={msg.user.avatarUrl}
										alt={msg.user.username}
										className="w-full h-full object-cover"
									/>
								) : (
									<div className="w-full h-full bg-linear-to-tr from-purple-500 to-orange-400"></div>
								)}
							</div>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2.5 mb-1.5">
									<span className="font-bold text-sm text-foreground">
										{msg.user.username || 'Anonymous'}
									</span>
									<span className="text-xs font-semibold text-muted-foreground">
										{formatTime(msg.createdAt)}
									</span>
									{isMe && (
										<button
											onClick={() => handleDelete(msg.id)}
											className="text-[11px] font-semibold text-red-500/70 hover:text-red-500 hover:underline transition-all ml-auto"
										>
											Delete
										</button>
									)}
								</div>
								<p className="text-sm text-foreground wrap-break-word">{msg.message}</p>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
