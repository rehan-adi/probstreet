import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { adminApi } from '@/config/axios';
import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import {
	Loader2,
	CheckCircle,
	XCircle,
	Ban,
	Search,
	Activity,
	CalendarDays,
	Users,
	AlertTriangle,
	X,
} from 'lucide-react';
import { formatINR, formatDate } from '@/lib/format';

function ResolveModal({
	market,
	resolvingId,
	onResolve,
	onClose,
}: {
	market: any;
	resolvingId: string | null;
	onResolve: (id: string, result: 'YES' | 'NO' | 'CANCEL') => void;
	onClose: () => void;
}) {
	const busy = resolvingId === market.id;

	const modal = (
		<div
			onClick={(e) => {
				if (e.target === e.currentTarget && !busy) onClose();
			}}
			className="fixed inset-0 z-99999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
		>
			<div className="bg-white dark:bg-[#090C1A] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-90 shadow-2xl dark:shadow-black/50 overflow-hidden">
				{/* Header */}
				<div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
					<div className="flex-1 min-w-0 pr-3">
						<p className="font-bold text-gray-900 dark:text-white text-base">Resolve Market</p>
						<p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
							{market.title}
						</p>
					</div>
					<button
						type="button"
						disabled={busy}
						onClick={onClose}
						className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-40"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Warning */}
				<div className="mx-5 mt-5 p-3.5 rounded-xl flex gap-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
					<AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-gray-600 dark:text-gray-400" />
					<p className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-relaxed">
						This action is irreversible. Funds will be distributed immediately after resolution.
					</p>
				</div>

				{/* Buttons */}
				<div className="p-5 flex flex-col gap-2.5">
					<button
						type="button"
						disabled={busy}
						onClick={() => onResolve(market.id, 'YES')}
						className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold border transition-all disabled:opacity-50 bg-black hover:bg-gray-800 text-white dark:bg-white dark:hover:bg-gray-100 dark:text-black shadow-sm"
					>
						{busy ? (
							<Loader2 className="w-4 h-4 animate-spin shrink-0" />
						) : (
							<CheckCircle className="w-4 h-4 shrink-0" />
						)}
						Resolve as YES
					</button>

					<button
						type="button"
						disabled={busy}
						onClick={() => onResolve(market.id, 'NO')}
						className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold border transition-all disabled:opacity-50 bg-white hover:bg-gray-50 text-gray-900 border-gray-200 dark:bg-transparent dark:hover:bg-white/5 dark:text-white dark:border-white/20 shadow-sm"
					>
						{busy ? (
							<Loader2 className="w-4 h-4 animate-spin shrink-0" />
						) : (
							<XCircle className="w-4 h-4 shrink-0" />
						)}
						Resolve as NO
					</button>

					<div className="h-px bg-gray-200 dark:bg-white/10 my-2" />

					<button
						type="button"
						disabled={busy}
						onClick={() => onResolve(market.id, 'CANCEL')}
						className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50 bg-gray-50 hover:bg-gray-100 text-gray-500 border-gray-200 dark:bg-transparent dark:hover:bg-white/5 dark:text-gray-400 dark:border-transparent"
					>
						{busy ? (
							<Loader2 className="w-4 h-4 animate-spin shrink-0" />
						) : (
							<Ban className="w-4 h-4 shrink-0" />
						)}
						Cancel Market (Refund All)
					</button>
				</div>
			</div>
		</div>
	);

	return createPortal(modal, document.body);
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
	if (status === 'OPEN') {
		return (
			<span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-900 border border-gray-200 dark:bg-white/10 dark:text-white dark:border-white/20">
				<div className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white animate-pulse" />
				Open
			</span>
		);
	}
	if (status === 'CLOSED') {
		return (
			<span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-50 text-gray-500 border border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10">
				Closed
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-50 text-gray-500 border border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10">
			{status}
		</span>
	);
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminMarkets() {
	const [markets, setMarkets] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [resolvingId, setResolvingId] = useState<string | null>(null);
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState('ALL');
	const [resolveTarget, setResolveTarget] = useState<any>(null);
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);

	const fetchMarkets = useCallback(async () => {
		try {
			const res = await adminApi.get(`/markets?page=${page}&limit=10`);
			if (res.data.success) {
				setMarkets(res.data.data);
				setTotalPages(res.data.meta?.totalPages || 1);
			}
		} catch {
			toast.error('Failed to fetch markets');
		} finally {
			setLoading(false);
		}
	}, [page]);

	useEffect(() => {
		fetchMarkets();
	}, [fetchMarkets]);

	const handleResolve = useCallback(
		async (marketId: string, result: 'YES' | 'NO' | 'CANCEL') => {
			setResolvingId(marketId);
			try {
				const res = await adminApi.post('/markets/resolve', { marketId, resolution: result });
				if (res.data.success) {
					toast.success(`Market resolved as ${result}`);
					setResolveTarget(null);
					fetchMarkets();
				} else {
					toast.error(res.data.error || res.data.message || 'Failed to resolve market');
				}
			} catch (err: any) {
				toast.error(
					err.response?.data?.error ||
						err.response?.data?.message ||
						err.message ||
						'Error resolving market',
				);
			} finally {
				setResolvingId(null);
			}
		},
		[fetchMarkets],
	);

	const filtered = markets.filter((m) => {
		const matchStatus = statusFilter === 'ALL' || m.status === statusFilter;
		const matchSearch =
			!search ||
			m.title?.toLowerCase().includes(search.toLowerCase()) ||
			m.symbol?.toLowerCase().includes(search.toLowerCase());
		return matchStatus && matchSearch;
	});

	// Reset to page 1 when filter/search changes
	useEffect(() => {
		setPage(1);
	}, [search, statusFilter]);

	return (
		<AdminLayout>
			<div className="space-y-6 max-w-350 mx-auto">
				{/* Header */}
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
					<div>
						<h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
							Markets
						</h1>
						<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
							Manage and resolve event markets across the platform.
						</p>
					</div>

					{/* Filters */}
					<div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
						{/* Status tabs */}
						<div className="flex p-1 bg-gray-100 dark:bg-[#090C1A]/50 rounded-lg border border-gray-200 dark:border-white/5 w-full sm:w-auto overflow-x-auto custom-scrollbar">
							{['ALL', 'OPEN', 'CLOSED'].map((s) => (
								<button
									key={s}
									type="button"
									onClick={() => setStatusFilter(s)}
									className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
										statusFilter === s
											? 'bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-white/10'
											: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-transparent'
									}`}
								>
									{s === 'ALL' ? 'All Markets' : s.charAt(0) + s.slice(1).toLowerCase()}
								</button>
							))}
						</div>

						{/* Search */}
						<div className="relative w-full sm:w-64 shrink-0">
							<Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
							<input
								type="text"
								placeholder="Search markets..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#090C1A] border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition shadow-sm"
							/>
						</div>
					</div>
				</div>

				{/* Table */}
				<div className="bg-white dark:bg-[#090C1A] border border-gray-200 dark:border-white/5 rounded-xl shadow-xs overflow-hidden relative">
					{loading ? (
						<div className="flex flex-col items-center justify-center h-48 gap-3">
							<Loader2 className="w-6 h-6 animate-spin text-gray-500" />
							<p className="text-sm font-medium text-gray-500">Loading markets...</p>
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-left text-sm whitespace-nowrap">
								<thead className="bg-gray-50 dark:bg-[#090C1A]/50 border-b border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400 font-semibold text-xs tracking-wide">
									<tr>
										<th className="px-4 py-3.5 uppercase">Market</th>
										<th className="px-4 py-3.5 uppercase">Status</th>
										<th className="px-4 py-3.5 uppercase">Volume</th>
										<th className="px-4 py-3.5 uppercase">Traders</th>
										<th className="px-4 py-3.5 uppercase">Ends At</th>
										<th className="px-4 py-3.5 uppercase text-right">Actions</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-100 dark:divide-white/5">
									{filtered.length === 0 ? (
										<tr>
											<td
												colSpan={6}
												className="text-center py-16 text-gray-500 dark:text-gray-400"
											>
												<Activity className="w-8 h-8 mx-auto mb-3 opacity-20" />
												<p className="text-sm font-medium">No markets found</p>
											</td>
										</tr>
									) : (
										filtered.map((market) => (
											<tr
												key={market.id}
												className="hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors group"
											>
												{/* Title */}
												<td className="px-4 py-4">
													<div className="flex items-center gap-3 max-w-50 sm:max-w-75">
														{market.thumbnail ? (
															<img
																src={market.thumbnail}
																alt=""
																className="w-10 h-10 rounded-lg object-cover border border-gray-200 dark:border-white/10 shrink-0 shadow-sm"
															/>
														) : (
															<div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center shrink-0 border border-gray-200 dark:border-white/10">
																<Activity className="w-4 h-4 text-gray-400" />
															</div>
														)}
														<div className="min-w-0 flex flex-col">
															<p
																className="font-semibold text-sm text-gray-900 dark:text-white truncate"
																title={market.title}
															>
																{market.title}
															</p>
															<p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate mt-0.5">
																{market.symbol || market.id?.substring(0, 8)}
															</p>
														</div>
													</div>
												</td>

												{/* Status */}
												<td className="px-4 py-4">
													<StatusBadge status={market.status} />
												</td>

												{/* Volume */}
												<td className="px-4 py-4 font-bold text-gray-900 dark:text-white">
													{formatINR(Number(market.volume || 0))}
												</td>

												{/* Traders */}
												<td className="px-4 py-4">
													<span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
														<Users className="w-3.5 h-3.5 opacity-50" />
														{market.numberOfTraders || 0}
													</span>
												</td>

												{/* End time */}
												<td className="px-4 py-4">
													<span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium">
														<CalendarDays className="w-3.5 h-3.5 opacity-50" />
														{formatDate(market.endTime)}
													</span>
												</td>

												{/* Actions */}
												<td className="px-4 py-4 text-right">
													<button
														type="button"
														disabled={market.status !== 'OPEN'}
														onClick={() => setResolveTarget(market)}
														className="px-3 py-1.5 text-xs font-bold rounded-md border border-gray-200 dark:border-white/20 text-gray-900 dark:text-white bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
													>
														Resolve
													</button>
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					)}

					{/* Pagination */}
					{!loading && (
						<div className="flex items-center justify-between py-3 px-4 border-t border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-transparent">
							<span className="text-xs font-medium text-gray-500 dark:text-gray-400">
								Showing Page <span className="text-gray-900 dark:text-white">{page}</span> of{' '}
								<span className="text-gray-900 dark:text-white">{totalPages}</span>
							</span>
							<div className="flex items-center gap-2">
								<button
									type="button"
									disabled={page <= 1}
									onClick={() => setPage((p) => p - 1)}
									className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50 transition cursor-pointer"
								>
									Prev
								</button>
								<button
									type="button"
									disabled={page >= totalPages}
									onClick={() => setPage((p) => p + 1)}
									className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50 transition cursor-pointer"
								>
									Next
								</button>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Portal modal */}
			{resolveTarget && (
				<ResolveModal
					market={resolveTarget}
					resolvingId={resolvingId}
					onResolve={handleResolve}
					onClose={() => {
						if (!resolvingId) setResolveTarget(null);
					}}
				/>
			)}
		</AdminLayout>
	);
}
