import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPriceAlerts, deletePriceAlert } from '@/api/price-alerts';
import {
	BellRing,
	Trash2,
	TrendingUp,
	TrendingDown,
	ShieldCheck,
	SlidersHorizontal,
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
		<div className="w-full bg-[#f8f9fa] dark:bg-[#050505] flex justify-center px-4 md:pt-16 pt-16 pb-16 transition-colors min-h-screen">
			<div className="w-full max-w-5xl flex flex-col gap-8">
				{/* Top Header */}
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-gray-200 dark:border-white/10">
					<div className="flex items-start gap-4">
						<div>
							<h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
								Control Centre
							</h1>
							<p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-lg leading-relaxed">
								Manage active price alerts, configure your risk controls, and customize automated
								system notifications all in one place.
							</p>
						</div>
					</div>

					<Link
						to="/events"
						className="hidden sm:flex items-center justify-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:scale-[1.02] active:scale-95 transition-all shadow-md"
					>
						Explore Markets
					</Link>
				</div>

				{/* Quick Stats Grid */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-5">
					<div className="bg-white dark:bg-[#0a0a0a] p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex items-start justify-between group hover:border-gray-300 dark:hover:border-white/10 transition-colors">
						<div className="space-y-1">
							<p className="text-[13px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
								Active Alerts
							</p>
							<p className="text-3xl font-bold text-gray-900 dark:text-white">
								{loading ? '-' : alerts.length}
							</p>
						</div>
						<div className="p-3.5 rounded-xl bg-black dark:bg-white text-white dark:text-black group-hover:scale-110 transition-transform">
							<BellRing className="w-5 h-5" />
						</div>
					</div>

					<div className="bg-white dark:bg-[#0a0a0a] p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex items-start justify-between group hover:border-gray-300 dark:hover:border-white/10 transition-colors">
						<div className="space-y-1">
							<p className="text-[13px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
								Monitored Events
							</p>
							<p className="text-3xl font-bold text-gray-900 dark:text-white">
								{loading ? '-' : new Set(alerts.map((a) => a.market?.id)).size}
							</p>
						</div>
						<div className="p-3.5 rounded-xl bg-black dark:bg-white text-white dark:text-black group-hover:scale-110 transition-transform">
							<Zap className="w-5 h-5" />
						</div>
					</div>

					<div className="bg-white dark:bg-[#0a0a0a] p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm flex items-start justify-between group hover:border-gray-300 dark:hover:border-white/10 transition-colors">
						<div className="space-y-1">
							<p className="text-[13px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
								System Status
							</p>
							<p className="text-sm font-bold text-gray-900 dark:text-white mt-2 flex items-center gap-1.5">
								<ShieldCheck className="w-5 h-5" /> Protected
							</p>
						</div>
						<div className="p-3.5 rounded-xl bg-black dark:bg-white text-white dark:text-black group-hover:scale-110 transition-transform">
							<SlidersHorizontal className="w-5 h-5" />
						</div>
					</div>
				</div>

				<div className="flex flex-col gap-6">
					{/* Tabs Navigation */}
					<div className="flex gap-2 p-1.5 bg-gray-200/50 dark:bg-[#111111] rounded-xl w-fit">
						<button
							onClick={() => setActiveTab('alerts')}
							className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
								activeTab === 'alerts'
									? 'bg-white dark:bg-[#222222] text-gray-900 dark:text-white shadow-sm'
									: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
							}`}
						>
							<BellRing className="w-4 h-4" />
							Price Alerts ({alerts.length})
						</button>
						<button
							onClick={() => setActiveTab('limits')}
							className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
								activeTab === 'limits'
									? 'bg-white dark:bg-[#222222] text-gray-900 dark:text-white shadow-sm'
									: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
							}`}
						>
							<ShieldCheck className="w-4 h-4" />
							Trading Controls
						</button>
					</div>

					{/* Tab Content */}
					<div className="min-h-100">
						{activeTab === 'alerts' && (
							<div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
								{loading ? (
									<div className="flex flex-col justify-center items-center h-64 bg-white dark:bg-[#0a0a0a] rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
										<div className="animate-spin rounded-full h-8 w-8 border-2 border-black dark:border-white border-t-transparent mb-4"></div>
										<p className="text-sm font-medium text-gray-500 dark:text-gray-400">
											Syncing alerts...
										</p>
									</div>
								) : alerts.length === 0 ? (
									<div className="bg-white dark:bg-[#0a0a0a] rounded-2xl p-12 text-center border border-gray-200 dark:border-white/5 shadow-sm flex flex-col items-center justify-center min-h-100">
										<div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-6 shadow-inner">
											<BellRing className="w-8 h-8" />
										</div>
										<h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
											No Active Price Alerts
										</h3>
										<p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8 leading-relaxed">
											Never miss a trading opportunity. Set target price triggers on any market and
											get instantly notified when the price hits your mark.
										</p>
										<Link
											to="/events"
											className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:scale-[1.02] active:scale-95 transition-all shadow-md"
										>
											Explore Events to Setup Alerts
										</Link>
									</div>
								) : (
									<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
										{alerts.map((alert) => {
											const currentPrice =
												alert.stockType === 'YES' ? alert.market?.yesPrice : alert.market?.noPrice;

											return (
												<div
													key={alert.id}
													className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/5 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-white/10 transition-all flex flex-col justify-between gap-6 group"
												>
													<div className="flex justify-between items-start gap-4">
														<div className="space-y-1.5 flex-1">
															<Link
																to={`/events/${alert.market?.id}`}
																className="text-base font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2 pr-2"
															>
																{alert.market?.title || 'Unknown Market'}
															</Link>
															<div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
																<Clock className="w-3 h-3" />
																<span>Added {new Date(alert.createdAt).toLocaleDateString()}</span>
															</div>
														</div>

														<button
															onClick={() => handleDelete(alert.id)}
															className="text-gray-400 hover:text-red-500 p-2.5 rounded-full hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
															title="Remove Alert"
														>
															<Trash2 className="w-4 h-4" />
														</button>
													</div>

													<div className="grid grid-cols-2 gap-3 bg-gray-50/80 dark:bg-[#111111] p-4 rounded-xl border border-gray-100 dark:border-white/5">
														<div className="flex flex-col gap-1">
															<span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
																Target {alert.stockType}
															</span>
															<div
																className={`text-xl font-bold flex items-center gap-1.5 ${
																	alert.stockType === 'YES'
																		? 'text-green-600 dark:text-green-400'
																		: 'text-red-600 dark:text-red-400'
																}`}
															>
																{alert.stockType === 'YES' ? (
																	<TrendingUp className="w-5 h-5" />
																) : (
																	<TrendingDown className="w-5 h-5" />
																)}
																₹{Number(alert.targetPrice).toFixed(1)}
															</div>
														</div>

														<div className="flex flex-col gap-1 border-l border-gray-200 dark:border-white/5 pl-4">
															<span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
																Current
															</span>
															<div className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
																₹{currentPrice != null ? Number(currentPrice).toFixed(1) : '-'}
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

						{activeTab === 'limits' && (
							<div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-5">
								<div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm overflow-hidden">
									<div className="p-8 border-b border-gray-100 dark:border-white/5">
										<div className="flex items-start gap-4">
											<div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 shadow-inner">
												<ShieldCheck className="w-6 h-6" />
											</div>
											<div>
												<h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">
													Protection Mechanisms
												</h3>
												<p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl">
													ProbStreet actively monitors your account to enforce safety limits,
													execute automated price triggers, and secure your withdrawals.
												</p>
											</div>
										</div>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-white/5 bg-gray-50/50 dark:bg-[#0c0c0c]">
										<div className="p-8 space-y-3">
											<h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
												<Zap className="w-4 h-4 text-amber-500" />
												Price Alert Execution
											</h4>
											<p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
												Our matching engine evaluates your triggers in real-time. When conditions
												are met, notifications are instantly broadcast to your configured devices.
											</p>
										</div>

										<div className="p-8 space-y-3">
											<h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
												<ShieldCheck className="w-4 h-4 text-emerald-500" />
												Secure Withdrawals
											</h4>
											<p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
												Withdrawals are strictly locked to your verified PAN and verified payment
												methods, protecting your funds even if your account is compromised.
											</p>
										</div>
									</div>
								</div>

								<div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
									<div>
										<h4 className="text-sm font-bold text-blue-900 dark:text-blue-300">
											Customize Notification Preferences
										</h4>
										<p className="text-xs text-blue-700/80 dark:text-blue-400/80 mt-1">
											Configure exactly which alerts reach your email or device.
										</p>
									</div>
									<Link
										to="/settings"
										className="shrink-0 px-5 py-2.5 bg-white dark:bg-[#111111] text-blue-700 dark:text-blue-400 text-sm font-semibold rounded-xl border border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors shadow-sm"
									>
										Manage Settings
									</Link>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
