import { toast } from 'sonner';
import { adminApi } from '@/config/axios';
import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Loader2, CheckCircle, XCircle, Ban, AlertTriangle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

export default function OracleReview() {
	const [markets, setMarkets] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [resolvingId, setResolvingId] = useState<string | null>(null);

	const fetchPending = async () => {
		try {
			const res = await adminApi.get('/oracle/pending');
			if (res.data.success) {
				setMarkets(res.data.data);
			}
		} catch (error) {
			toast.error('Failed to fetch pending oracle markets');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchPending();
	}, []);

	const handleConfirm = async (
		marketId: string,
		resolution: 'YES' | 'NO' | 'CANCEL',
		override = false,
	) => {
		setResolvingId(marketId);
		try {
			const res = await adminApi.post('/oracle/confirm', { marketId, resolution, override });
			if (res.data.success) {
				toast.success(`Market resolved as ${resolution}`);
				fetchPending();
			} else {
				toast.error(res.data.message || 'Failed to resolve market');
			}
		} catch (err: any) {
			toast.error(err.response?.data?.message || 'Error resolving market');
		} finally {
			setResolvingId(null);
		}
	};

	return (
		<AdminLayout>
			<div className="space-y-8 max-w-5xl mx-auto py-6">
				<div>
					<h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
						Oracle Review
					</h2>
					<p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
						Markets flagged by the AI Oracle requiring admin confirmation.
					</p>
				</div>

				{loading ? (
					<div className="flex justify-center py-12">
						<Loader2 className="w-8 h-8 animate-spin text-gray-400" />
					</div>
				) : markets.length === 0 ? (
					<div className="text-center py-12 bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-white/10">
						<CheckCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
						<h3 className="text-lg font-bold text-gray-900 dark:text-white">All Caught Up!</h3>
						<p className="text-gray-500 dark:text-gray-400 mt-1">
							No markets currently require admin review.
						</p>
					</div>
				) : (
					<div className="grid gap-6">
						{markets.map((market) => {
							const log = market.oracleLogs?.[0]; // Latest log has the AI reasoning
							const busy = resolvingId === market.id;

							return (
								<div
									key={market.id}
									className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden"
								>
									<div className="p-5 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex justify-between items-start">
										<div>
											<h3 className="font-bold text-lg text-gray-900 dark:text-white">
												{market.title}
											</h3>
											<p className="text-xs text-gray-500 mt-1">
												Ended: {format(new Date(market.endTime), 'PPp')}
											</p>
										</div>
										<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
											<AlertTriangle className="w-3 h-3" />
											Low Confidence
										</span>
									</div>

									<div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
										{/* AI Evaluation Side */}
										<div className="space-y-6">
											<div>
												<h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
													AI Evaluation
												</h4>
												<div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
													<div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-white/10">
														<span className="text-sm text-gray-600 dark:text-gray-400">
															Proposed Verdict
														</span>
														<span
															className={`font-bold ${log?.verdict === 'YES' ? 'text-green-600' : log?.verdict === 'NO' ? 'text-red-600' : 'text-gray-500'}`}
														>
															{log?.verdict || 'INCONCLUSIVE'}
														</span>
													</div>
													<div className="flex justify-between items-center">
														<span className="text-sm text-gray-600 dark:text-gray-400">
															Confidence Score
														</span>
														<span
															className={`font-bold ${log?.rubricScore >= 80 ? 'text-green-600' : log?.rubricScore >= 50 ? 'text-amber-500' : 'text-red-500'}`}
														>
															{log?.rubricScore ?? 0} / 100
														</span>
													</div>
												</div>
											</div>

											<div>
												<h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
													Reasoning
												</h4>
												<p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
													{log?.reasoning || 'No reasoning provided.'}
												</p>
											</div>

											{market.sourceOfTruth && (
												<div>
													<a
														href={market.sourceOfTruth}
														target="_blank"
														rel="noreferrer"
														className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
													>
														View Source of Truth <ExternalLink className="w-4 h-4" />
													</a>
												</div>
											)}
										</div>

										{/* Admin Action Side */}
										<div className="space-y-4 flex flex-col justify-center">
											<h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
												Admin Resolution
											</h4>
											<button
												type="button"
												disabled={busy}
												onClick={() => handleConfirm(market.id, 'YES', log?.verdict !== 'YES')}
												className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold border transition-all disabled:opacity-50 bg-black hover:bg-gray-800 text-white dark:bg-white dark:hover:bg-gray-100 dark:text-black shadow-sm"
											>
												{busy ? (
													<Loader2 className="w-4 h-4 animate-spin" />
												) : (
													<CheckCircle className="w-4 h-4" />
												)}
												Confirm as YES {log?.verdict !== 'YES' && '(Override)'}
											</button>

											<button
												type="button"
												disabled={busy}
												onClick={() => handleConfirm(market.id, 'NO', log?.verdict !== 'NO')}
												className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold border transition-all disabled:opacity-50 bg-white hover:bg-gray-50 text-gray-900 border-gray-200 dark:bg-transparent dark:hover:bg-white/5 dark:text-white dark:border-white/20 shadow-sm"
											>
												{busy ? (
													<Loader2 className="w-4 h-4 animate-spin" />
												) : (
													<XCircle className="w-4 h-4" />
												)}
												Confirm as NO {log?.verdict !== 'NO' && '(Override)'}
											</button>

											<button
												type="button"
												disabled={busy}
												onClick={() => handleConfirm(market.id, 'CANCEL', true)}
												className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50 bg-gray-50 hover:bg-gray-100 text-gray-500 border-gray-200 dark:bg-transparent dark:hover:bg-white/5 dark:text-gray-400 dark:border-transparent mt-4"
											>
												{busy ? (
													<Loader2 className="w-4 h-4 animate-spin" />
												) : (
													<Ban className="w-4 h-4" />
												)}
												Cancel Market (Refund All)
											</button>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</AdminLayout>
	);
}
