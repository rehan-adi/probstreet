import { useEffect, useState } from 'react';
import { adminApi } from '@/config/axios';
import { toast } from 'sonner';
import {
	Loader2,
	Search,
	ArrowUpRight,
	ArrowDownRight,
	WalletCards,
	CreditCard,
	Banknote,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { formatINR, formatDate } from '@/lib/format';

export default function AdminTransactions() {
	const [transactions, setTransactions] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [globalFilter, setGlobalFilter] = useState('');
	const [typeFilter, setTypeFilter] = useState('ALL');
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);

	const fetchTransactions = async () => {
		try {
			const res = await adminApi.get(`/transactions?page=${page}&limit=20`);
			if (res.data.success) {
				setTransactions(res.data.data);
				setTotalPages(res.data.meta?.totalPages || 1);
			}
		} catch (err) {
			console.error('Failed to fetch transactions', err);
			toast.error('Failed to fetch transactions');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchTransactions();
	}, [page]);

	const filteredTransactions = transactions.filter((t) => {
		if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
		if (!globalFilter) return true;
		const s = globalFilter.toLowerCase();
		return (
			t.id?.toLowerCase().includes(s) ||
			t.user?.username?.toLowerCase().includes(s) ||
			t.user?.email?.toLowerCase().includes(s)
		);
	});

	const getTransactionIcon = (type: string) => {
		switch (type) {
			case 'DEPOSIT':
				return <ArrowDownRight className="w-3.5 h-3.5" />;
			case 'WITHDRAWAL':
				return <ArrowUpRight className="w-3.5 h-3.5" />;
			case 'TRADE':
				return <Banknote className="w-3.5 h-3.5" />;
			case 'FEE':
				return <CreditCard className="w-3.5 h-3.5" />;
			default:
				return <WalletCards className="w-3.5 h-3.5" />;
		}
	};

	if (loading) {
		return (
			<AdminLayout>
				<div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] gap-3">
					<Loader2 className="animate-spin w-6 h-6 text-gray-600 dark:text-gray-400" />
					<p className="text-sm font-medium text-gray-500">Loading transactions...</p>
				</div>
			</AdminLayout>
		);
	}

	const filterOptions = ['ALL', 'DEPOSIT', 'WITHDRAWAL', 'TRADE', 'FEE'];

	return (
		<AdminLayout>
			<div className="space-y-6 max-w-350 mx-auto">
				{/* Header */}
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
					<div>
						<h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
							Transactions
						</h1>
						<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
							View and monitor all financial activity across the platform.
						</p>
					</div>

					<div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
						{/* Custom Filter Tabs */}
						<div className="flex p-1 bg-gray-100 dark:bg-[#090C1A]/50 rounded-lg border border-gray-200 dark:border-white/5 w-full sm:w-auto overflow-x-auto custom-scrollbar">
							{filterOptions.map((opt) => (
								<button
									key={opt}
									onClick={() => setTypeFilter(opt)}
									className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
										typeFilter === opt
											? 'bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-white/10'
											: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-transparent'
									}`}
								>
									{opt === 'ALL' ? 'All' : opt.charAt(0) + opt.slice(1).toLowerCase() + 's'}
								</button>
							))}
						</div>

						{/* Search Bar */}
						<div className="relative w-full sm:w-64 shrink-0">
							<Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
							<input
								type="text"
								placeholder="Search transactions..."
								value={globalFilter}
								onChange={(e) => setGlobalFilter(e.target.value)}
								className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#090C1A] border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition shadow-sm"
							/>
						</div>
					</div>
				</div>

				{/* Table Container */}
				<div className="bg-white dark:bg-[#090C1A] border border-gray-200 dark:border-white/5 rounded-xl shadow-xs overflow-hidden relative">
					<div className="overflow-x-auto">
						<table className="w-full text-left text-sm whitespace-nowrap">
							<thead className="bg-gray-50 dark:bg-[#090C1A]/50 border-b border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400 font-semibold text-xs tracking-wide">
								<tr>
									<th className="py-3.5 px-4 uppercase">Transaction ID</th>
									<th className="py-3.5 px-4 uppercase">User</th>
									<th className="py-3.5 px-4 uppercase">Type</th>
									<th className="py-3.5 px-4 uppercase">Amount</th>
									<th className="py-3.5 px-4 uppercase">Status</th>
									<th className="py-3.5 px-4 uppercase">Date</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100 dark:divide-white/5">
								{filteredTransactions.length ? (
									filteredTransactions.map((tx) => {
										const isPositive = ['DEPOSIT', 'WINNINGS', 'REFUND'].includes(tx.type);
										const isNegative = ['WITHDRAWAL', 'TRADE', 'FEE'].includes(tx.type);
										return (
											<tr
												key={tx.id}
												className="hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors group"
											>
												<td className="py-4 px-4">
													<div className="font-mono text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 px-2 py-1 rounded w-fit border border-gray-100 dark:border-white/5">
														{tx.id.substring(0, 12)}...
													</div>
												</td>
												<td className="py-4 px-4">
													<div className="flex flex-col">
														<span className="font-semibold text-sm text-gray-900 dark:text-white">
															{tx.user?.username || 'System'}
														</span>
														<span className="text-xs text-gray-500 dark:text-gray-400">
															{tx.user?.email || 'N/A'}
														</span>
													</div>
												</td>
												<td className="py-4 px-4">
													<span className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
														{getTransactionIcon(tx.type)}
														{tx.type}
													</span>
												</td>
												<td className="py-4 px-4">
													<div
														className={`font-bold text-sm tracking-tight ${
															isPositive
																? 'text-emerald-600 dark:text-emerald-400'
																: isNegative
																	? 'text-gray-900 dark:text-white'
																	: 'text-gray-500 dark:text-gray-400'
														}`}
													>
														{isPositive ? '+' : isNegative ? '-' : ''}
														{formatINR(Math.abs(Number(tx.amount)))}
													</div>
												</td>
												<td className="py-4 px-4">
													{tx.status === 'COMPLETED' || tx.status === 'SUCCESS' ? (
														<span className="flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
															<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
															Completed
														</span>
													) : tx.status === 'PENDING' ? (
														<span className="flex items-center text-xs font-bold text-gray-600 dark:text-gray-400">
															<span className="w-1.5 h-1.5 rounded-full bg-gray-500 mr-1.5 animate-pulse"></span>
															Pending
														</span>
													) : tx.status === 'FAILED' ? (
														<span className="flex items-center text-xs font-bold text-red-600 dark:text-red-400">
															<span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>
															Failed
														</span>
													) : (
														<span className="text-xs font-bold text-gray-500 uppercase">
															{tx.status}
														</span>
													)}
												</td>
												<td className="py-4 px-4">
													<span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap font-medium">
														{formatDate(tx.createdAt)}
													</span>
												</td>
											</tr>
										);
									})
								) : (
									<tr>
										<td colSpan={6} className="h-48 text-center">
											<div className="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
												<WalletCards className="w-8 h-8 mb-3 opacity-20" />
												<p className="text-sm font-medium">No transactions found.</p>
											</div>
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>

					{/* Pagination Footer */}
					<div className="flex items-center justify-between py-3 px-4 border-t border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-transparent">
						<div className="text-xs font-medium text-gray-500 dark:text-gray-400">
							Showing Page <span className="text-gray-900 dark:text-white">{page}</span> of{' '}
							<span className="text-gray-900 dark:text-white">{totalPages}</span>
						</div>
						<div className="flex items-center gap-2">
							<button
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								disabled={page <= 1}
								className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50 transition cursor-pointer"
							>
								Prev
							</button>
							<button
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								disabled={page >= totalPages}
								className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50 transition cursor-pointer"
							>
								Next
							</button>
						</div>
					</div>
				</div>
			</div>
		</AdminLayout>
	);
}
