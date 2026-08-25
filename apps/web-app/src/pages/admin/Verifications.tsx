import { useEffect, useState } from 'react';
import { toast } from 'sonner';
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
	CheckSquare,
	AlertCircle,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { getAllPendingVerifications, verify } from '@/api/verification';
import { formatDate } from '@/lib/format';

interface PendingVerification {
	id: string;
	phone?: string;
	pendingType: 'KYC' | 'PAYMENT' | 'UNKNOWN';
	submittedAt: string;
	kycs?: Array<{
		panName: string;
		panNumber: string;
		dob: string;
		status: string;
		submittedAt: string;
	}>;
	paymentMethods?: Array<{
		type: 'UPI' | 'BANK';
		upiNumber?: string;
		accountNumber?: string;
		ifscCode?: string;
		status: string;
		submittedAt: string;
	}>;
}

export default function AdminVerifications() {
	const [verifications, setVerifications] = useState<PendingVerification[]>([]);
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
				const normalized: PendingVerification[] = res.data.data.map((v: any) => ({
					...v,
					pendingType:
						v.kycs?.[0]?.status === 'PENDING'
							? 'KYC'
							: v.paymentMethods?.[0]?.status === 'PENDING'
								? 'PAYMENT'
								: 'UNKNOWN',
					submittedAt:
						v.kycs?.[0]?.submittedAt ||
						v.paymentMethods?.[0]?.submittedAt ||
						new Date().toISOString(),
				}));
				setVerifications(normalized);
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

	const handleVerify = async (
		userId: string,
		type: 'KYC' | 'PAYMENT' | 'UNKNOWN',
		action: 'APPROVE' | 'REJECT',
	) => {
		setProcessingId(userId);
		try {
			const status = action === 'APPROVE' ? 'VERIFIED' : 'REJECTED';
			const remark = action === 'APPROVE' ? 'Approved by admin' : 'Rejected by admin';

			const res = await verify(
				userId,
				type === 'KYC' ? status : undefined,
				type === 'PAYMENT' ? status : undefined,
				type === 'KYC' ? remark : undefined,
				type === 'PAYMENT' ? remark : undefined,
			);

			if (res.data?.success) {
				toast.success(`${type} verification ${action.toLowerCase()}d successfully`);
				// Optimistically remove from list immediately
				setVerifications((prev) => prev.filter((v) => v.id !== userId));
				// Background refresh
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

	const filteredVerifications = verifications.filter((v) => {
		const matchesType = typeFilter === 'ALL' || v.pendingType === typeFilter;
		const query = searchQuery.toLowerCase().trim();
		if (!query) return matchesType;

		const matchesPhone = v.phone?.toLowerCase().includes(query);
		const matchesId = v.id.toLowerCase().includes(query);
		const matchesPanName = v.kycs?.[0]?.panName?.toLowerCase().includes(query);
		const matchesPanNumber = v.kycs?.[0]?.panNumber?.toLowerCase().includes(query);
		const matchesUpi = v.paymentMethods?.[0]?.upiNumber?.toLowerCase().includes(query);
		const matchesAcc = v.paymentMethods?.[0]?.accountNumber?.toLowerCase().includes(query);

		return (
			matchesType &&
			(matchesPhone || matchesId || matchesPanName || matchesPanNumber || matchesUpi || matchesAcc)
		);
	});

	const kycCount = verifications.filter((v) => v.pendingType === 'KYC').length;
	const paymentCount = verifications.filter((v) => v.pendingType === 'PAYMENT').length;

	return (
		<AdminLayout>
			<div className="space-y-6">
				{/* Top Header */}
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
						className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#1C1C1E] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition cursor-pointer self-start md:self-auto"
					>
						<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
						Refresh
					</button>
				</div>

				{/* Metric Badges */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<div className="bg-white dark:bg-[#1C1C1E] p-4 rounded-xl border border-gray-200 dark:border-white/10 flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Pending</p>
							<p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
								{verifications.length}
							</p>
						</div>
						<div className="p-3 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
							<Clock className="w-5 h-5" />
						</div>
					</div>

					<div className="bg-white dark:bg-[#1C1C1E] p-4 rounded-xl border border-gray-200 dark:border-white/10 flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-gray-500 dark:text-gray-400">Pending KYC</p>
							<p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{kycCount}</p>
						</div>
						<div className="p-3 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
							<User className="w-5 h-5" />
						</div>
					</div>

					<div className="bg-white dark:bg-[#1C1C1E] p-4 rounded-xl border border-gray-200 dark:border-white/10 flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-gray-500 dark:text-gray-400">
								Pending Payments
							</p>
							<p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
								{paymentCount}
							</p>
						</div>
						<div className="p-3 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
							<CreditCard className="w-5 h-5" />
						</div>
					</div>
				</div>

				{/* Controls Bar: Filters & Search */}
				<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
					<div className="flex gap-1.5 p-1 bg-gray-200 dark:bg-[#2C2C2E] rounded-lg w-full sm:w-auto">
						<button
							onClick={() => setTypeFilter('ALL')}
							className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
								typeFilter === 'ALL'
									? 'bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white shadow-xs'
									: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
							}`}
						>
							All Pending ({verifications.length})
						</button>
						<button
							onClick={() => setTypeFilter('KYC')}
							className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
								typeFilter === 'KYC'
									? 'bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white shadow-xs'
									: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
							}`}
						>
							KYC ({kycCount})
						</button>
						<button
							onClick={() => setTypeFilter('PAYMENT')}
							className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
								typeFilter === 'PAYMENT'
									? 'bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white shadow-xs'
									: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
							}`}
						>
							Payment ({paymentCount})
						</button>
					</div>

					<div className="relative w-full sm:w-80">
						<Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
						<input
							type="text"
							placeholder="Search by phone, name, PAN, account..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#1C1C1E] border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition"
						/>
					</div>
				</div>

				{/* Table Container */}
				<div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-xl shadow-xs overflow-hidden">
					{loading ? (
						<div className="flex flex-col items-center justify-center py-20 gap-3">
							<Loader2 className="w-8 h-8 animate-spin text-gray-600 dark:text-gray-400" />
							<p className="text-sm text-gray-500 dark:text-gray-400">Loading verifications...</p>
						</div>
					) : filteredVerifications.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-16 text-center px-4">
							<div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
								<CheckSquare className="w-6 h-6" />
							</div>
							<h3 className="text-base font-semibold text-gray-900 dark:text-white">
								All Caught Up!
							</h3>
							<p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1">
								{searchQuery
									? 'No verifications match your search query.'
									: 'There are currently no pending KYC or Payment method submissions awaiting review.'}
							</p>
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-left text-sm whitespace-nowrap">
								<thead className="bg-gray-50 dark:bg-[#2C2C2E]/60 border-b border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 font-medium text-xs">
									<tr>
										<th className="py-3.5 px-4">User</th>
										<th className="py-3.5 px-4">Type</th>
										<th className="py-3.5 px-4">Submitted Details</th>
										<th className="py-3.5 px-4">Submitted At</th>
										<th className="py-3.5 px-4 text-right">Action</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-100 dark:divide-white/5">
									{filteredVerifications.map((item) => {
										const isProcessing = processingId === item.id;
										const isKyc = item.pendingType === 'KYC';
										const kycData = item.kycs?.[0];
										const pmData = item.paymentMethods?.[0];

										return (
											<tr
												key={item.id}
												className="hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors"
											>
												{/* User Column */}
												<td className="py-4 px-4">
													<div className="flex items-center gap-3">
														<div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-800 dark:text-gray-200 font-bold text-xs">
															{item.phone ? item.phone.slice(-4) : 'USR'}
														</div>
														<div>
															<p className="font-semibold text-gray-900 dark:text-white text-sm">
																{item.phone || 'No phone'}
															</p>
															<p className="text-[11px] text-gray-400 font-mono">
																ID: {item.id.slice(0, 10)}...
															</p>
														</div>
													</div>
												</td>

												{/* Type Badge */}
												<td className="py-4 px-4">
													{isKyc ? (
														<span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
															<User className="w-3 h-3" /> PAN KYC
														</span>
													) : (
														<span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
															<CreditCard className="w-3 h-3" /> PAYMENT ({pmData?.type || 'BANK'})
														</span>
													)}
												</td>

												{/* Details */}
												<td className="py-4 px-4">
													{isKyc && kycData ? (
														<div className="space-y-0.5">
															<p className="font-semibold text-gray-900 dark:text-white">
																{kycData.panName}
															</p>
															<p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
																PAN:{' '}
																<span className="text-black dark:text-white font-bold">
																	{kycData.panNumber}
																</span>
																{kycData.dob &&
																	` • DOB: ${new Date(kycData.dob).toLocaleDateString()}`}
															</p>
														</div>
													) : !isKyc && pmData ? (
														<div className="space-y-0.5">
															<p className="font-semibold text-gray-900 dark:text-white">
																{pmData.type === 'UPI' ? 'UPI Method' : 'Bank Transfer'}
															</p>
															<p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
																{pmData.type === 'UPI' ? (
																	<span>
																		VPA:{' '}
																		<strong className="text-black dark:text-white">
																			{pmData.upiNumber}
																		</strong>
																	</span>
																) : (
																	<span>
																		A/C:{' '}
																		<strong className="text-black dark:text-white">
																			{pmData.accountNumber}
																		</strong>{' '}
																		• IFSC:{' '}
																		<strong className="text-black dark:text-white">
																			{pmData.ifscCode}
																		</strong>
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
												<td className="py-4 px-4 text-xs text-gray-500 dark:text-gray-400">
													<div className="flex items-center gap-1.5">
														<Clock className="w-3.5 h-3.5 opacity-60" />
														<span>{formatDate(item.submittedAt)}</span>
													</div>
												</td>

												{/* Action Buttons */}
												<td className="py-4 px-4 text-right">
													<div className="inline-flex items-center gap-2">
														<button
															onClick={() => handleVerify(item.id, item.pendingType, 'APPROVE')}
															disabled={isProcessing}
															className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50 cursor-pointer shadow-xs"
														>
															{isProcessing ? (
																<Loader2 className="w-3.5 h-3.5 animate-spin" />
															) : (
																<CheckCircle className="w-3.5 h-3.5" />
															)}
															Approve
														</button>

														<button
															onClick={() => handleVerify(item.id, item.pendingType, 'REJECT')}
															disabled={isProcessing}
															className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/20 transition disabled:opacity-50 cursor-pointer"
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
