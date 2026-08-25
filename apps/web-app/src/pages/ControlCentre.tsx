import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPriceAlerts, deletePriceAlert } from '@/api/price-alerts';
import {
	BellRing,
	Trash2,
	TrendingUp,
	TrendingDown,
	ArrowLeft,
	ShieldCheck,
	SlidersHorizontal,
	ExternalLink,
	Sparkles,
	Clock,
	Zap,
} from 'lucide-react';

interface PriceAlert {
	id: string;
	stockType: 'YES' | 'NO';
	targetPrice: number;
	createdAt: string;
	market: {
		id: string;
		title: string;
		yesPrice: number;
		noPrice: number;
	};
}

export default function ControlCentrePage() {
	const navigate = useNavigate();
	const [alerts, setAlerts] = useState<PriceAlert[]>([]);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState<'alerts' | 'limits'>('alerts');

	const fetchAlerts = async () => {
		try {
			const res = await getPriceAlerts();
			if (res.success && res.data?.alerts) {
				setAlerts(res.data.alerts);
			}
		} catch (error) {
			console.error('Failed to load price alerts:', error);
			toast.error('Failed to load price alerts');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchAlerts();
	}, []);

	const handleDelete = async (id: string) => {
		try {
			const res = await deletePriceAlert(id);
			if (res.success) {
				toast.success('Price alert removed');
				setAlerts((prev) => prev.filter((a) => a.id !== id));
			}
		} catch (error) {
			toast.error('Failed to remove price alert');
		}
	};

	return (
		<div className="w-full bg-[#f4f4f5] dark:bg-[#090C1A] flex justify-center px-4 md:pt-16 pt-16 pb-16 transition-colors min-h-screen">
			<div className="w-full max-w-227.5 flex flex-col gap-6">
				{/* Top Header */}
				<div className="flex items-center justify-between gap-4 pb-2 border-b border-gray-400/20 dark:border-white/10">
					<div className="flex items-center gap-3">
						<button
							onClick={() => navigate('/wallet')}
							className="p-2 -ml-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
							aria-label="Back to Wallet"
						>
							<ArrowLeft className="w-5 h-5" />
						</button>
						<div>
							<h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
								Control Centre
							</h1>
							<p className="text-xs text-gray-500 dark:text-gray-400">
								Manage active price alerts, risk controls, and automated notifications
							</p>
						</div>
					</div>

					<Link
						to="/events"
						className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition"
					>
						<Sparkles className="w-3.5 h-3.5" />
						Explore Markets
					</Link>
				</div>

				{/* Quick Stats Grid */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<div className="bg-white dark:bg-[#1C1C1E] p-4 rounded-xl border border-gray-400/20 dark:border-white/10 flex items-center justify-between">
						<div>
							<p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
								Active Price Alerts
							</p>
							<p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
								{loading ? '-' : alerts.length}
							</p>
						</div>
						<div className="p-3 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
							<BellRing className="w-5 h-5" />
						</div>
					</div>

					<div className="bg-white dark:bg-[#1C1C1E] p-4 rounded-xl border border-gray-400/20 dark:border-white/10 flex items-center justify-between">
						<div>
							<p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
								Monitored Events
							</p>
							<p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
								{loading ? '-' : new Set(alerts.map((a) => a.market?.id)).size}
							</p>
						</div>
						<div className="p-3 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
							<Zap className="w-5 h-5" />
						</div>
					</div>

					<div className="bg-white dark:bg-[#1C1C1E] p-4 rounded-xl border border-gray-400/20 dark:border-white/10 flex items-center justify-between">
						<div>
							<p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
								Responsible Trading
							</p>
							<p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1">
								<ShieldCheck className="w-4 h-4" /> Active & Guarded
							</p>
						</div>
						<div className="p-3 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
							<SlidersHorizontal className="w-5 h-5" />
						</div>
					</div>
				</div>

				{/* Tabs Navigation */}
				<div className="flex gap-2 border-b border-gray-400/20 dark:border-white/10 pb-2">
					<button
						onClick={() => setActiveTab('alerts')}
						className={`px-4 py-2 text-sm font-semibold rounded-lg transition cursor-pointer flex items-center gap-2 ${
							activeTab === 'alerts'
								? 'bg-black text-white dark:bg-white dark:text-black'
								: 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/5'
						}`}
					>
						<BellRing className="w-4 h-4" />
						Price Alerts ({alerts.length})
					</button>
					<button
						onClick={() => setActiveTab('limits')}
						className={`px-4 py-2 text-sm font-semibold rounded-lg transition cursor-pointer flex items-center gap-2 ${
							activeTab === 'limits'
								? 'bg-black text-white dark:bg-white dark:text-black'
								: 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/5'
						}`}
					>
						<ShieldCheck className="w-4 h-4" />
						Trading Controls & Preferences
					</button>
				</div>

				{/* Tab Content */}
				{activeTab === 'alerts' && (
					<div className="space-y-4">
						{loading ? (
							<div className="flex flex-col justify-center items-center h-48 bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-400/20 dark:border-white/10">
								<div className="animate-spin rounded-full h-7 w-7 border-2 border-black dark:border-white border-t-transparent mb-2"></div>
								<p className="text-xs text-gray-500 dark:text-gray-400">Loading your alerts...</p>
							</div>
						) : alerts.length === 0 ? (
							<div className="bg-white dark:bg-[#1C1C1E] rounded-xl p-10 text-center border border-gray-400/20 dark:border-white/10">
								<div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
									<BellRing className="w-7 h-7" />
								</div>
								<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
									No Active Price Alerts
								</h3>
								<p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1 mb-5">
									Set target price triggers on any event market. When the price crosses your target,
									you'll be instantly alerted via In-App notifications!
								</p>
								<Link
									to="/events"
									className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-md bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition"
								>
									Explore Events
								</Link>
							</div>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{alerts.map((alert) => {
									const currentPrice =
										alert.stockType === 'YES' ? alert.market?.yesPrice : alert.market?.noPrice;

									return (
										<div
											key={alert.id}
											className="bg-white dark:bg-[#1C1C1E] border border-gray-400/20 dark:border-white/10 rounded-xl p-5 shadow-xs hover:border-blue-500/50 transition-all flex flex-col justify-between gap-4"
										>
											<div className="flex justify-between items-start gap-2">
												<div className="space-y-1">
													<Link
														to={`/events/${alert.market?.id}`}
														className="text-sm font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition line-clamp-2 flex items-center gap-1 group"
													>
														<span>{alert.market?.title || 'Unknown Market'}</span>
														<ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
													</Link>
													<div className="flex items-center gap-2 text-xs text-gray-400">
														<Clock className="w-3 h-3" />
														<span>Set {new Date(alert.createdAt).toLocaleDateString()}</span>
													</div>
												</div>

												<button
													onClick={() => handleDelete(alert.id)}
													className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer shrink-0"
													title="Delete Alert"
												>
													<Trash2 className="w-4 h-4" />
												</button>
											</div>

											{/* Price Information */}
											<div className="grid grid-cols-2 gap-2 bg-[#f4f4f5] dark:bg-[#121422] p-3 rounded-lg border border-gray-200 dark:border-white/5">
												<div>
													<span className="text-[11px] text-gray-500 dark:text-gray-400 block mb-0.5">
														Target {alert.stockType}
													</span>
													<div
														className={`text-base font-bold flex items-center gap-1 ${
															alert.stockType === 'YES'
																? 'text-green-600 dark:text-green-400'
																: 'text-red-600 dark:text-red-400'
														}`}
													>
														{alert.stockType === 'YES' ? (
															<TrendingUp className="w-4 h-4" />
														) : (
															<TrendingDown className="w-4 h-4" />
														)}
														₹{alert.targetPrice.toFixed(1)}
													</div>
												</div>

												<div className="border-l border-gray-300 dark:border-white/10 pl-3">
													<span className="text-[11px] text-gray-500 dark:text-gray-400 block mb-0.5">
														Current Price
													</span>
													<div className="text-base font-bold text-gray-900 dark:text-white">
														₹{currentPrice != null ? currentPrice.toFixed(1) : '-'}
													</div>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				)}

				{/* Tab: Limits & Preferences */}
				{activeTab === 'limits' && (
					<div className="space-y-4">
						<div className="bg-white dark:bg-[#1C1C1E] p-6 rounded-xl border border-gray-400/20 dark:border-white/10 space-y-4">
							<div className="flex items-center gap-3">
								<div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
									<ShieldCheck className="w-5 h-5" />
								</div>
								<div>
									<h3 className="text-base font-semibold text-gray-900 dark:text-white">
										Responsible Trading & Protection
									</h3>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										ProbStreet enforces safety limits and alert triggers to promote responsible
										opinion trading.
									</p>
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
								<div className="border border-gray-200 dark:border-white/10 rounded-lg p-4 bg-[#f4f4f5]/60 dark:bg-[#121422]">
									<p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
										Automatic Price Alert Triggers
									</p>
									<p className="text-xs text-gray-800 dark:text-gray-200 mt-1">
										Triggers are evaluated continuously as orders match. Once hit, notifications are
										broadcasted to your device.
									</p>
								</div>

								<div className="border border-gray-200 dark:border-white/10 rounded-lg p-4 bg-[#f4f4f5]/60 dark:bg-[#121422]">
									<p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
										Withdrawal & Balance Protection
									</p>
									<p className="text-xs text-gray-800 dark:text-gray-200 mt-1">
										All withdrawals are verified against your approved payment methods with
										real-time transfer tracking.
									</p>
								</div>
							</div>

							<div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-white/10">
								<span className="text-xs text-gray-500 dark:text-gray-400">
									Need to adjust your email & in-app notification toggles?
								</span>
								<Link
									to="/settings"
									className="text-xs font-semibold underline text-black dark:text-white hover:opacity-80 transition"
								>
									Open Settings
								</Link>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
