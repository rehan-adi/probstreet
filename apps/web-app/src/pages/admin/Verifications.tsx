import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import {
	Loader2,
	CheckCircle,
	XCircle,
	Search,
	User,
	CreditCard,
	Clock,
	RefreshCw,
	ShieldCheck,
} from 'lucide-react';
import { formatDate } from '@/lib/format';
import AdminLayout from '@/components/admin/AdminLayout';
import { getAllPendingVerifications, verify } from '@/api/verification';

interface VerificationTask {
	taskId: string;
	userId: string;
	phone?: string;
	type: 'KYC' | 'PAYMENT';
	submittedAt: string;
	kycData?: {
		panName: string;
		panNumber: string;
		dob: string;
		status: string;
		submittedAt: string;
	};
	pmData?: {
		id: string;
		type: 'UPI' | 'BANK';
		upiNumber?: string;
		accountNumber?: string;
		ifscCode?: string;
		status: string;
		submittedAt: string;
	};
}

export default function AdminVerifications() {
	const [tasks, setTasks] = useState<VerificationTask[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [processingId, setProcessingId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [typeFilter, setTypeFilter] = useState<'ALL' | 'KYC' | 'PAYMENT'>('ALL');

	const fetchVerifications = async (showToast = false) => {
		try {
			if (showToast) setRefreshing(true);
			const res = await getAllPendingVerifications();
			if (res.data?.success && Array.isArray(res.data?.data)) {
				const flatTasks: VerificationTask[] = [];

				res.data.data.forEach((user: any) => {
					// Add KYC tasks
					if (Array.isArray(user.kycs)) {
						user.kycs.forEach((kyc: any) => {
							if (kyc.status === 'PENDING') {
								flatTasks.push({
									taskId: `kyc-${user.id}-${kyc.submittedAt}`,
									userId: user.id,
									phone: user.phone,
									type: 'KYC',
									submittedAt: kyc.submittedAt,
									kycData: kyc,
								});
							}
						});
					}

					// Add Payment tasks
					if (Array.isArray(user.paymentMethods)) {
						user.paymentMethods.forEach((pm: any) => {
							if (pm.status === 'PENDING') {
								flatTasks.push({
									taskId: `pm-${pm.id}`,
									userId: user.id,
									phone: user.phone,
									type: 'PAYMENT',
									submittedAt: pm.submittedAt,
									pmData: pm,
								});
							}
						});
					}
				});

				// Sort by oldest first so admins process FIFO
				flatTasks.sort(
					(a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
				);

				setTasks(flatTasks);
				if (showToast) toast.success('Verifications refreshed');
			}
		} catch (err) {
			console.error('Failed to fetch verifications', err);
			toast.error('Failed to load pending verifications');
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	useEffect(() => {
		fetchVerifications();
	}, []);

	const handleVerify = async (task: VerificationTask, action: 'APPROVE' | 'REJECT') => {
		setProcessingId(task.taskId);
		try {
			const status = action === 'APPROVE' ? 'VERIFIED' : 'REJECTED';
			const remark = action === 'APPROVE' ? 'Approved by admin' : 'Rejected by admin';

			const res = await verify(
				task.userId,
				task.type === 'KYC' ? status : undefined,
				task.type === 'PAYMENT' ? status : undefined,
				task.type === 'KYC' ? remark : undefined,
				task.type === 'PAYMENT' ? remark : undefined,
				task.type === 'PAYMENT' ? task.pmData?.id : undefined,
			);

			if (res.data?.success) {
				toast.success(`${task.type} verification ${action.toLowerCase()}d successfully`);
				setTasks((prev) => prev.filter((t) => t.taskId !== task.taskId));
				fetchVerifications();
			} else {
				toast.error(res.data?.error || res.data?.message || 'Failed to update status');
			}
		} catch (err: any) {
			console.error('Verification error:', err);
			toast.error(
				err.response?.data?.error ||
					err.response?.data?.message ||
					err.message ||
					'Error processing request',
			);
		} finally {
			setProcessingId(null);
		}
	};

	const filteredTasks = tasks.filter((t) => {
		const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
		const query = searchQuery.toLowerCase().trim();
		if (!query) return matchesType;

		const matchesPhone = t.phone?.toLowerCase().includes(query);
		const matchesId = t.userId.toLowerCase().includes(query);
		const matchesPanName = t.kycData?.panName?.toLowerCase().includes(query);
		const matchesPanNumber = t.kycData?.panNumber?.toLowerCase().includes(query);
		const matchesUpi = t.pmData?.upiNumber?.toLowerCase().includes(query);
		const matchesAcc = t.pmData?.accountNumber?.toLowerCase().includes(query);

		return (
			matchesType &&
			(matchesPhone || matchesId || matchesPanName || matchesPanNumber || matchesUpi || matchesAcc)
		);
	});

	const kycCount = tasks.filter((t) => t.type === 'KYC').length;
	const paymentCount = tasks.filter((t) => t.type === 'PAYMENT').length;

	return (
		<AdminLayout>
			<div className="space-y-6 max-w-350 mx-auto">
				{/* Top Header */}
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
					<div>
						<h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
							User Verifications
						</h1>
						<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
							Review and approve pending PAN card KYC and Bank/UPI payment details.
						</p>
					</div>

					<button
						onClick={() => fetchVerifications(true)}
						disabled={refreshing}
						className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#121214] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition shadow-sm cursor-pointer focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white shrink-0"
					>
						<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
						Refresh
					</button>
				</div>

				{/* Metric Badges */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-gray-200 dark:border-white/5 flex items-center justify-between shadow-sm">
						<div>
							<p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
								Total Pending
							</p>
							<p className="text-3xl font-black text-gray-900 dark:text-white mt-1">
								{tasks.length}
							</p>
						</div>
						<div className="p-3 rounded-full bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white border border-gray-100 dark:border-white/5">
							<Clock className="w-5 h-5" />
						</div>
					</div>

					<div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-gray-200 dark:border-white/5 flex items-center justify-between shadow-sm">
						<div>
							<p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
								Pending KYC
							</p>
							<p className="text-3xl font-black text-gray-900 dark:text-white mt-1">{kycCount}</p>
						</div>
						<div className="p-3 rounded-full bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white border border-gray-100 dark:border-white/5">
							<User className="w-5 h-5" />
						</div>
					</div>

					<div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-gray-200 dark:border-white/5 flex items-center justify-between shadow-sm">
						<div>
							<p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
								Pending Payments
							</p>
							<p className="text-3xl font-black text-gray-900 dark:text-white mt-1">
								{paymentCount}
							</p>
						</div>
						<div className="p-3 rounded-full bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white border border-gray-100 dark:border-white/5">
							<CreditCard className="w-5 h-5" />
						</div>
					</div>
				</div>

				{/* Controls Bar: Filters & Search */}
				<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
					<div className="flex p-1 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/5 w-full sm:w-auto overflow-x-auto custom-scrollbar">
						<button
							onClick={() => setTypeFilter('ALL')}
							className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
								typeFilter === 'ALL'
									? 'bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-white/10'
									: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-transparent'
							}`}
						>
							All Pending ({tasks.length})
						</button>
						<button
							onClick={() => setTypeFilter('KYC')}
							className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
								typeFilter === 'KYC'
									? 'bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-white/10'
									: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-transparent'
							}`}
						>
							KYC ({kycCount})
						</button>
						<button
							onClick={() => setTypeFilter('PAYMENT')}
							className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
								typeFilter === 'PAYMENT'
									? 'bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-white/10'
									: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-transparent'
							}`}
						>
							Payment ({paymentCount})
						</button>
					</div>

					<div className="relative w-full sm:w-80 shrink-0">
						<Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
						<input
							type="text"
							placeholder="Search by phone, name, PAN..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#121214] border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition shadow-sm"
						/>
					</div>
				</div>

				{/* Table Container */}
				<div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-xl shadow-xs overflow-hidden relative">
					{loading ? (
						<div className="flex flex-col items-center justify-center py-24 gap-4">
							<Loader2 className="w-8 h-8 animate-spin text-gray-400" />
							<p className="text-sm font-semibold text-gray-500">Loading verifications...</p>
						</div>
					) : filteredTasks.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-24 text-center px-4">
							<div className="w-14 h-14 rounded-full bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white flex items-center justify-center mb-4 border border-gray-200 dark:border-white/10">
								<ShieldCheck className="w-6 h-6" />
							</div>
							<h3 className="text-lg font-bold text-gray-900 dark:text-white">All Caught Up!</h3>
							<p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mt-2">
								{searchQuery
									? 'No verifications match your search query.'
									: 'There are currently no pending KYC or Payment method submissions awaiting review.'}
							</p>
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-left text-sm whitespace-nowrap">
								<thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400 font-semibold text-xs tracking-wide">
									<tr>
										<th className="py-3.5 px-5 uppercase">User</th>
										<th className="py-3.5 px-5 uppercase">Type</th>
										<th className="py-3.5 px-5 uppercase">Submitted Details</th>
										<th className="py-3.5 px-5 uppercase">Submitted At</th>
										<th className="py-3.5 px-5 uppercase text-right">Action</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-100 dark:divide-white/5">
									{filteredTasks.map((task) => {
										const isProcessing = processingId === task.taskId;
										const isKyc = task.type === 'KYC';
										const kycData = task.kycData;
										const pmData = task.pmData;

										return (
											<tr
												key={task.taskId}
												className="hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors group"
											>
												{/* User Column */}
												<td className="py-4 px-5">
													<div className="flex items-center gap-3">
														<div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-900 dark:text-white font-bold text-xs border border-gray-200 dark:border-white/10 shrink-0 shadow-sm">
															{task.phone ? task.phone.slice(-4) : 'USR'}
														</div>
														<div className="min-w-0">
															<p className="font-bold text-gray-900 dark:text-white text-sm truncate">
																{task.phone || 'No phone'}
															</p>
															<p className="text-[11px] text-gray-500 font-mono truncate mt-0.5">
																ID: {task.userId.slice(0, 8)}
															</p>
														</div>
													</div>
												</td>

												{/* Type Badge */}
												<td className="py-4 px-5">
													{isKyc ? (
														<span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white border border-gray-200 dark:border-white/20">
															<User className="w-3 h-3" /> PAN KYC
														</span>
													) : (
														<span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white border border-gray-200 dark:border-white/20">
															<CreditCard className="w-3 h-3" /> PAYMENT ({pmData?.type || 'BANK'})
														</span>
													)}
												</td>

												{/* Details */}
												<td className="py-4 px-5">
													{isKyc && kycData ? (
														<div className="space-y-1">
															<p className="font-semibold text-gray-900 dark:text-white text-sm">
																{kycData.panName}
															</p>
															<p className="text-xs text-gray-500 dark:text-gray-400 font-mono flex gap-2">
																<span>
																	PAN:{' '}
																	<span className="text-gray-900 dark:text-white font-bold">
																		{kycData.panNumber}
																	</span>
																</span>
																{kycData.dob && (
																	<span>
																		• DOB:{' '}
																		<span className="text-gray-900 dark:text-white font-semibold">
																			{new Date(kycData.dob).toLocaleDateString()}
																		</span>
																	</span>
																)}
															</p>
														</div>
													) : !isKyc && pmData ? (
														<div className="space-y-1">
															<p className="font-semibold text-gray-900 dark:text-white text-sm">
																{pmData.type === 'UPI' ? 'UPI Address' : 'Bank Account'}
															</p>
															<p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
																{pmData.type === 'UPI' ? (
																	<span>
																		VPA:{' '}
																		<span className="text-gray-900 dark:text-white font-bold">
																			{pmData.upiNumber}
																		</span>
																	</span>
																) : (
																	<span className="flex gap-2">
																		<span>
																			A/C:{' '}
																			<span className="text-gray-900 dark:text-white font-bold">
																				{pmData.accountNumber}
																			</span>
																		</span>
																		<span>
																			• IFSC:{' '}
																			<span className="text-gray-900 dark:text-white font-bold">
																				{pmData.ifscCode}
																			</span>
																		</span>
																	</span>
																)}
															</p>
														</div>
													) : (
														<span className="text-gray-400 text-xs italic">
															No details provided
														</span>
													)}
												</td>

												{/* Submitted Date */}
												<td className="py-4 px-5">
													<div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
														<Clock className="w-3.5 h-3.5 opacity-50" />
														<span>{formatDate(task.submittedAt)}</span>
													</div>
												</td>

												{/* Action Buttons */}
												<td className="py-4 px-5 text-right">
													<div className="inline-flex items-center gap-2">
														<button
															onClick={() => handleVerify(task, 'APPROVE')}
															disabled={isProcessing}
															className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-gray-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-gray-100 transition shadow-sm disabled:opacity-50 min-w-22.5"
														>
															{isProcessing ? (
																<Loader2 className="w-3.5 h-3.5 animate-spin" />
															) : (
																<CheckCircle className="w-3.5 h-3.5" />
															)}
															Approve
														</button>

														<button
															onClick={() => handleVerify(task, 'REJECT')}
															disabled={isProcessing}
															className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 dark:bg-transparent dark:text-gray-300 dark:border-white/20 dark:hover:bg-white/5 transition disabled:opacity-50 min-w-22.5"
														>
															{isProcessing ? (
																<Loader2 className="w-3.5 h-3.5 animate-spin" />
															) : (
																<XCircle className="w-3.5 h-3.5" />
															)}
															Reject
														</button>
													</div>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>
		</AdminLayout>
	);
}
