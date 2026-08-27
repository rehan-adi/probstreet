import { toast } from 'sonner';
import { useState } from 'react';
import {
	Gift,
	Copy,
	Check,
	Users,
	Send,
	MessageSquare,
	ArrowRight,
	Loader2,
	Clock,
	CheckCircle2,
	Wallet,
	Target,
	TrendingUp,
} from 'lucide-react';
import { formatAmount } from '@/lib/format';
import { useReferralQuery, useSubmitReferralMutation } from '@/hooks/queries/referral';

export default function ReferralPage() {
	const { data, isLoading } = useReferralQuery();
	const submitReferralMutation = useSubmitReferralMutation();
	const [claimedInput, setClaimedInput] = useState('');
	const [copied, setCopied] = useState(false);

	const info = data?.data;
	const code = info?.referralCode || 'PROB-XXXX';
	const shareLink = info?.referralLink || `${window.location.origin}/events?ref=${code}`;

	const handleCopy = () => {
		navigator.clipboard.writeText(shareLink);
		setCopied(true);
		toast.success('Referral link copied!');
		setTimeout(() => setCopied(false), 2000);
	};

	const handleWhatsAppShare = () => {
		const text = `Join Probstreet using my referral code ${code} and get ₹15 FREE trading bonus + extra rewards on your first recharge! Start here: ${shareLink}`;
		window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
	};

	const handleTelegramShare = () => {
		const text = `Join Probstreet using my referral code ${code} and get ₹15 FREE trading bonus + extra rewards on your first recharge!`;
		window.open(
			`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(text)}`,
			'_blank',
		);
	};

	const handleSubmitCode = (e: React.FormEvent) => {
		e.preventDefault();
		if (!claimedInput.trim()) return;

		submitReferralMutation.mutate(
			{ referralCode: claimedInput.trim() },
			{
				onSuccess: (res: any) => {
					if (res.success) {
						toast.success('Referral code applied successfully!');
						setClaimedInput('');
					} else {
						toast.error(res.error || res.message || 'Failed to apply referral code');
					}
				},
				onError: (err: any) => {
					toast.error(err?.response?.data?.error || 'Invalid referral code');
				},
			},
		);
	};

	const depositTasks = info?.rewardTasks?.filter((t: any) => t.type === 'BONUS') || [];
	const milestoneTasks = info?.rewardTasks?.filter((t: any) => t.type === 'MILESTONE') || [];
	const promoTasks = info?.rewardTasks?.filter((t: any) => t.type === 'PROMOTIONAL') || [];

	return (
		<div className="w-full min-h-screen bg-[#f4f4f5] dark:bg-[#090C1A] flex justify-center md:pt-10 pt-6 pb-24 md:pb-12 transition-colors">
			<div className="w-full max-w-[910px] px-4 md:px-6 flex flex-col gap-6">
				<div>
					<h1 className="text-2xl md:text-3xl font-medium text-gray-900 dark:text-white tracking-tight">
						Refer & Rewards
					</h1>
					<p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">
						Invite friends, complete milestones, and earn real cash rewards.
					</p>
				</div>

				<div className="grid grid-cols-3 gap-3">
					<div className="bg-white/80 dark:bg-white/5 backdrop-blur-xl p-4 rounded-xl border border-gray-200 dark:border-white/10 flex flex-col gap-1 shadow-sm">
						<span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Earned</span>
						<span className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
							₹{formatAmount(info?.totalEarnings || 0)}
						</span>
					</div>
					<div className="bg-white/80 dark:bg-white/5 backdrop-blur-xl p-4 rounded-xl border border-gray-200 dark:border-white/10 flex flex-col gap-1 shadow-sm">
						<span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
							Invited
						</span>
						<span className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
							{info?.totalInvited || 0}
						</span>
					</div>
					<div className="bg-white/80 dark:bg-white/5 backdrop-blur-xl p-4 rounded-xl border border-gray-200 dark:border-white/10 flex flex-col gap-1 shadow-sm">
						<span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
							Claimed
						</span>
						<span className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
							{info?.completedCount || 0}
						</span>
					</div>
				</div>

				{/* Referral Code + Share Card */}
				<div className="bg-white dark:bg-[#090C1A] rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
					<div className="p-5 md:p-6 flex flex-col gap-4">
						<div className="flex items-center justify-between">
							<div>
								<h2 className="text-sm font-semibold text-gray-900 dark:text-white">
									Your Referral Code
								</h2>
								<p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
									Share your code — friends get ₹15 on signup + bonus on recharge
								</p>
							</div>
						</div>

						{/* Code Display */}
						<div className="flex items-center gap-3">
							<div className="flex-1 flex items-center justify-between bg-[#f4f4f5] dark:bg-[#090C1A] px-4 py-3 rounded-lg border border-gray-200 dark:border-white/10">
								<span className="font-mono text-base md:text-lg font-semibold text-gray-900 dark:text-white tracking-wider">
									{code}
								</span>
								<button
									onClick={handleCopy}
									className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
									title="Copy referral link"
								>
									{copied ? (
										<Check size={16} className="text-emerald-600 dark:text-emerald-400" />
									) : (
										<Copy size={16} className="text-gray-500 dark:text-gray-400" />
									)}
								</button>
							</div>
						</div>

						{/* Share URL */}
						<div className="flex items-center gap-2 bg-[#f4f4f5] dark:bg-[#090C1A] px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10">
							<span className="text-[11px] text-gray-500 dark:text-gray-400 truncate flex-1 font-mono">
								{shareLink}
							</span>
							<button
								onClick={handleCopy}
								className="px-3 py-1 text-[11px] font-semibold rounded-md bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
							>
								{copied ? 'Copied!' : 'Copy'}
							</button>
						</div>

						{/* Share Buttons */}
						<div className="flex gap-3">
							<button
								onClick={handleWhatsAppShare}
								className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#25D366] hover:bg-[#20BD5A] text-white text-xs font-semibold transition-colors cursor-pointer"
							>
								<MessageSquare size={15} />
								WhatsApp
							</button>
							<button
								onClick={handleTelegramShare}
								className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-semibold transition-colors cursor-pointer"
							>
								<Send size={15} />
								Telegram
							</button>
						</div>
					</div>
				</div>

				{/* Have a Referral Code? */}
				<div className="bg-white dark:bg-[#090C1A] rounded-xl border border-gray-200 dark:border-white/10 p-5 md:p-6">
					<div className="flex items-center gap-2 mb-1">
						<Gift size={16} className="text-gray-900 dark:text-white" />
						<h3 className="text-sm font-semibold text-gray-900 dark:text-white">
							Have a Friend's Code?
						</h3>
					</div>
					<p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
						Enter their <span className="font-mono font-semibold">PROB-XXXX</span> code to link your
						accounts.
					</p>

					{info?.hasAppliedReferral ? (
						<div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
							<CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
							<span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
								Referral code already applied to your account
							</span>
						</div>
					) : (
						<form onSubmit={handleSubmitCode} className="flex gap-2">
							<input
								type="text"
								placeholder="e.g. PROB-9748"
								value={claimedInput}
								onChange={(e) => setClaimedInput(e.target.value)}
								className="flex-1 px-3.5 py-2.5 rounded-lg bg-[#f4f4f5] dark:bg-[#090C1A] border border-gray-300 dark:border-white/10 text-xs font-mono text-gray-900 dark:text-white focus:outline-none focus:border-gray-900 dark:focus:border-white/30 uppercase transition-colors"
							/>
							<button
								type="submit"
								disabled={submitReferralMutation.isPending}
								className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shrink-0 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm shadow-blue-500/20"
							>
								{submitReferralMutation.isPending ? (
									<Loader2 size={14} className="animate-spin" />
								) : (
									<>
										Apply <ArrowRight size={13} />
									</>
								)}
							</button>
						</form>
					)}
				</div>

				{/* Rewards Section */}
				<div className="flex flex-col gap-4">
					<h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
						Rewards & Milestones
					</h2>

					{/* Welcome Bonus */}
					{promoTasks.map((task: any) => (
						<div
							key={task.id}
							className="bg-white dark:bg-[#090C1A] rounded-xl border border-gray-200 dark:border-white/10 p-4 flex items-center gap-4"
						>
							<div className="w-10 h-10 rounded-full bg-[#f4f4f5] dark:bg-[#090C1A] border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-900 dark:text-white shrink-0">
								<Gift size={18} />
							</div>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<h4 className="text-sm font-semibold text-gray-900 dark:text-white">
										{task.title}
									</h4>
									<span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
										Claimed
									</span>
								</div>
								<p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
									{task.description}
								</p>
							</div>
							<div className="text-sm font-semibold text-gray-900 dark:text-white shrink-0">
								+₹{task.reward}
							</div>
						</div>
					))}

					{/* Deposit Tiers */}
					{depositTasks.length > 0 && (
						<div className="bg-white dark:bg-[#090C1A] rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
							<div className="px-4 py-3 border-b border-gray-100 dark:border-white/5 flex items-center gap-2">
								<Wallet size={15} className="text-gray-900 dark:text-white" />
								<h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
									Recharge Rewards
								</h3>
							</div>
							<div className="divide-y divide-gray-100 dark:divide-white/5">
								{depositTasks.map((task: any) => (
									<div key={task.id} className="px-4 py-3.5 flex items-center gap-3">
										<div className="w-9 h-9 rounded-full bg-[#f4f4f5] dark:bg-[#090C1A] border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-700 dark:text-gray-300 shrink-0">
											<TrendingUp size={16} />
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<h4 className="text-xs font-semibold text-gray-900 dark:text-white">
													{task.title}
												</h4>
												{task.status === 'COMPLETED' && (
													<span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
														Done
													</span>
												)}
											</div>
											<p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
												{task.description}
											</p>
											{/* Progress */}
											<div className="mt-2 w-full bg-gray-100 dark:bg-[#090C1A] rounded-full h-1 overflow-hidden">
												<div
													className="bg-gray-900 dark:bg-white h-full rounded-full transition-all duration-500"
													style={{ width: `${task.progress || 0}%` }}
												/>
											</div>
										</div>
										<div className="text-xs font-semibold text-gray-900 dark:text-white shrink-0">
											+₹{task.reward}
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Trading Milestones */}
					{milestoneTasks.length > 0 && (
						<div className="bg-white dark:bg-[#090C1A] rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
							<div className="px-4 py-3 border-b border-gray-100 dark:border-white/5 flex items-center gap-2">
								<Target size={15} className="text-gray-900 dark:text-white" />
								<h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
									Trading Milestones
								</h3>
							</div>
							<div className="divide-y divide-gray-100 dark:divide-white/5">
								{milestoneTasks.map((task: any) => (
									<div key={task.id} className="px-4 py-3.5 flex items-center gap-3">
										<div className="flex flex-col items-center justify-center shrink-0">
											<div className="relative w-10 h-10">
												{/* Circular progress */}
												<svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
													<circle
														cx="18"
														cy="18"
														r="15.5"
														fill="none"
														stroke="currentColor"
														strokeWidth="2"
														className="text-gray-100 dark:text-white/5"
													/>
													<circle
														cx="18"
														cy="18"
														r="15.5"
														fill="none"
														stroke="currentColor"
														strokeWidth="2"
														strokeDasharray={`${(task.progress || 0) * 0.975} 97.5`}
														strokeLinecap="round"
														className="text-gray-900 dark:text-white transition-all duration-500"
													/>
												</svg>
												<div className="absolute inset-0 flex items-center justify-center">
													<span className="text-[8px] font-semibold text-gray-900 dark:text-white">
														{task.progress || 0}%
													</span>
												</div>
											</div>
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<h4 className="text-xs font-semibold text-gray-900 dark:text-white">
													{task.title}
												</h4>
												{task.status === 'COMPLETED' && (
													<span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
														Done
													</span>
												)}
											</div>
											<p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
												{task.description}
											</p>
											{task.completedCount !== undefined && (
												<p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
													{task.completedCount}/{task.targetCount} trades
												</p>
											)}
										</div>
										<div className="text-xs font-semibold text-gray-900 dark:text-white shrink-0">
											+₹{task.reward}
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				{/* How It Works */}
				<div className="bg-white dark:bg-[#090C1A] rounded-xl border border-gray-200 dark:border-white/10 p-5 md:p-6">
					<h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">How It Works</h3>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="flex items-start gap-3">
							<div className="w-7 h-7 rounded-full bg-[#f4f4f5] dark:bg-[#090C1A] border border-gray-200 dark:border-white/10 flex items-center justify-center shrink-0">
								<span className="text-xs font-semibold text-gray-900 dark:text-white">1</span>
							</div>
							<div>
								<h4 className="text-xs font-semibold text-gray-900 dark:text-white">
									Share Your Code
								</h4>
								<p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
									Send your PROB-XXXX code to friends via WhatsApp or Telegram.
								</p>
							</div>
						</div>
						<div className="flex items-start gap-3">
							<div className="w-7 h-7 rounded-full bg-[#f4f4f5] dark:bg-[#090C1A] border border-gray-200 dark:border-white/10 flex items-center justify-center shrink-0">
								<span className="text-xs font-semibold text-gray-900 dark:text-white">2</span>
							</div>
							<div>
								<h4 className="text-xs font-semibold text-gray-900 dark:text-white">
									Friend Signs Up
								</h4>
								<p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
									They get ₹15 free trading bonus instantly on registration.
								</p>
							</div>
						</div>
						<div className="flex items-start gap-3">
							<div className="w-7 h-7 rounded-full bg-[#f4f4f5] dark:bg-[#090C1A] border border-gray-200 dark:border-white/10 flex items-center justify-center shrink-0">
								<span className="text-xs font-semibold text-gray-900 dark:text-white">3</span>
							</div>
							<div>
								<h4 className="text-xs font-semibold text-gray-900 dark:text-white">
									Both Earn Rewards
								</h4>
								<p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
									When they recharge ₹50+, you earn ₹10 and they earn ₹5 bonus.
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Reward Tiers Table */}
				<div className="bg-white dark:bg-[#090C1A] rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
					<div className="px-4 py-3 border-b border-gray-100 dark:border-white/5">
						<h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
							Reward Tiers
						</h3>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full text-xs">
							<thead>
								<tr className="border-b border-gray-100 dark:border-white/5">
									<th className="px-4 py-2.5 text-left font-semibold text-gray-500 dark:text-gray-400">
										Action
									</th>
									<th className="px-4 py-2.5 text-center font-semibold text-gray-500 dark:text-gray-400">
										You Get
									</th>
									<th className="px-4 py-2.5 text-center font-semibold text-gray-500 dark:text-gray-400">
										Friend Gets
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100 dark:divide-white/5">
								<tr>
									<td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
										Friend Signs Up
									</td>
									<td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">—</td>
									<td className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">
										₹15
									</td>
								</tr>
								<tr>
									<td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
										Recharges ₹50+
									</td>
									<td className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">
										₹10
									</td>
									<td className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">
										₹5
									</td>
								</tr>
								<tr>
									<td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
										Recharges ₹100+
									</td>
									<td className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">
										₹20
									</td>
									<td className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">
										₹10
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>

				<div className="flex flex-col gap-3">
					<div className="flex items-center justify-between">
						<h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
							Invited Friends
						</h2>
						{info?.invitedFriends && info.invitedFriends.length > 0 && (
							<span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
								{info.invitedFriends.length}{' '}
								{info.invitedFriends.length === 1 ? 'friend' : 'friends'}
							</span>
						)}
					</div>

					<div className="bg-white dark:bg-[#090C1A] rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
						{isLoading ? (
							<div className="py-16 flex justify-center">
								<Loader2 className="w-5 h-5 animate-spin text-gray-400" />
							</div>
						) : !info?.invitedFriends || info.invitedFriends.length === 0 ? (
							<div className="py-16 flex flex-col items-center gap-2">
								<Users size={28} className="text-gray-300 dark:text-gray-600" />
								<p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
									No friends invited yet
								</p>
								<p className="text-[10px] text-gray-400 dark:text-gray-500">
									Share your code to start earning
								</p>
							</div>
						) : (
							<div className="divide-y divide-gray-100 dark:divide-white/5">
								{info.invitedFriends.map((friend: any) => (
									<div key={friend.id} className="px-4 py-3.5 flex items-center gap-3">
										<div className="w-8 h-8 rounded-full bg-[#f4f4f5] dark:bg-[#090C1A] border border-gray-200 dark:border-white/10 flex items-center justify-center shrink-0">
											<span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 uppercase">
												{friend.username?.charAt(0) || '?'}
											</span>
										</div>
										<div className="flex-1 min-w-0">
											<h4 className="text-xs font-semibold text-gray-900 dark:text-white truncate">
												{friend.username}
											</h4>
											<p className="text-[10px] text-gray-400 dark:text-gray-500">
												Joined{' '}
												{new Date(friend.joinedAt).toLocaleDateString('en-IN', {
													day: 'numeric',
													month: 'short',
													year: 'numeric',
												})}
											</p>
										</div>
										<div className="shrink-0">
											{friend.status === 'COMPLETED' ? (
												<span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
													<CheckCircle2 size={11} />
													+₹{friend.amount || 10}
												</span>
											) : (
												<span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10">
													<Clock size={11} />
													Pending
												</span>
											)}
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
