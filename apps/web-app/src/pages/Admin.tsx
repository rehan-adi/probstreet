import { useEffect, useState } from 'react';
import { adminApi } from '@/config/axios';
import { toast } from 'sonner';
import {
	Loader2,
	Users,
	Activity,
	IndianRupee,
	TrendingUp,
	Calendar,
	ShieldCheck,
	ArrowRight,
	ArrowUpRight,
	ArrowDownRight,
	Banknote,
	CreditCard,
	ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
	AreaChart,
	Area,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
	Legend,
} from 'recharts';
import AdminLayout from '@/components/admin/AdminLayout';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { formatINR, formatNumber, formatDate } from '@/lib/format';

export default function Admin() {
	const [metrics, setMetrics] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [period, setPeriod] = useState('7d');

	const fetchData = async (selectedPeriod: string = period) => {
		try {
			setLoading(true);
			const metricsRes = await adminApi.get(`/analytics/dashboard?period=${selectedPeriod}`);
			if (metricsRes.data.success) {
				setMetrics(metricsRes.data.data);
			}
		} catch (err) {
			console.error('Failed to fetch admin data', err);
			toast.error('Failed to fetch dashboard data');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchData(period);
	}, [period]);

	const CustomTooltip = ({ active, payload, label }: any) => {
		if (active && payload && payload.length) {
			return (
				<div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 p-3 rounded-xl shadow-xl">
					<p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{formatDate(label)}</p>
					{payload.map((entry: any, index: number) => (
						<p
							key={index}
							className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-2"
						>
							<span
								className="w-2 h-2 rounded-full"
								style={{ backgroundColor: entry.color || entry.fill || '#fff' }}
							/>
							<span>{entry.name}:</span>
							<span>{formatINR(entry.value)}</span>
						</p>
					))}
				</div>
			);
		}
		return null;
	};

	const PIE_COLORS = ['#3b82f6', '#71717a'];

	const getTxIcon = (type: string) => {
		switch (type) {
			case 'DEPOSIT':
				return <ArrowDownRight className="w-3.5 h-3.5" />;
			case 'WITHDRAWAL':
				return <ArrowUpRight className="w-3.5 h-3.5" />;
			case 'TRADE':
				return <Banknote className="w-3.5 h-3.5" />;
			default:
				return <CreditCard className="w-3.5 h-3.5" />;
		}
	};

	return (
		<AdminLayout>
			<div className="space-y-6">
				{/* Top Header Controls */}
				<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
					<div>
						<h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
							Overview
						</h1>
						<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
							Live performance metrics, market liquidity, and system activity.
						</p>
					</div>

					<div className="flex items-center gap-3">
						<Select value={period} onValueChange={setPeriod}>
							<SelectTrigger className="w-[160px] bg-white dark:bg-[#121214] border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold shadow-xs">
								<Calendar className="w-3.5 h-3.5 mr-2 text-gray-400" />
								<SelectValue placeholder="Select Period" />
							</SelectTrigger>
							<SelectContent className="bg-white dark:bg-[#1C1C1E] border-gray-200 dark:border-white/10 rounded-xl">
								<SelectItem value="7d" className="text-xs font-medium cursor-pointer">Last 7 Days</SelectItem>
								<SelectItem value="30d" className="text-xs font-medium cursor-pointer">Last 30 Days</SelectItem>
								<SelectItem value="90d" className="text-xs font-medium cursor-pointer">Last 90 Days</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				{/* Pending Tasks Alert Banner */}
				{metrics?.totalPendingVerifications > 0 && (
					<div className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/10 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 shrink-0">
								<ShieldCheck className="w-5 h-5" />
							</div>
							<div>
								<h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
									<span>{metrics.totalPendingVerifications} Verifications Pending</span>
									<span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
								</h3>
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
									{metrics.pendingKycCount || 0} PAN Documents • {metrics.pendingPaymentCount || 0} Bank / UPI Accounts waiting for approval.
								</p>
							</div>
						</div>
						<Link
							to="/dashboard/verifications"
							className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition shadow-xs cursor-pointer shrink-0"
						>
							Review Tasks <ArrowRight className="w-3.5 h-3.5" />
						</Link>
					</div>
				)}

				{/* Metric Stats Cards */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					<div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-xs flex flex-col justify-between group hover:border-gray-300 dark:hover:border-white/10 transition-colors">
						<div className="flex items-center justify-between">
							<span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
								Platform Revenue
							</span>
							<div className="p-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white border border-gray-200 dark:border-white/5">
								<IndianRupee className="w-4 h-4" />
							</div>
						</div>
						<div className="mt-4">
							<p className="text-2xl font-black text-gray-900 dark:text-white">
								{loading ? '-' : formatINR(metrics?.totalRevenue)}
							</p>
							<p className="text-[11px] font-medium text-gray-400 mt-1">Platform commissions & fees</p>
						</div>
					</div>

					<div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-xs flex flex-col justify-between group hover:border-gray-300 dark:hover:border-white/10 transition-colors">
						<div className="flex items-center justify-between">
							<span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
								Total Volume
							</span>
							<div className="p-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white border border-gray-200 dark:border-white/5">
								<TrendingUp className="w-4 h-4" />
							</div>
						</div>
						<div className="mt-4">
							<p className="text-2xl font-black text-gray-900 dark:text-white">
								{loading ? '-' : formatINR(metrics?.totalVolume)}
							</p>
							<p className="text-[11px] font-medium text-gray-400 mt-1">Matched trading turnover</p>
						</div>
					</div>

					<div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-xs flex flex-col justify-between group hover:border-gray-300 dark:hover:border-white/10 transition-colors">
						<div className="flex items-center justify-between">
							<span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
								Active Markets
							</span>
							<div className="p-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white border border-gray-200 dark:border-white/5">
								<Activity className="w-4 h-4" />
							</div>
						</div>
						<div className="mt-4">
							<p className="text-2xl font-black text-gray-900 dark:text-white">
								{loading ? '-' : formatNumber(metrics?.totalMarkets)}
							</p>
							<p className="text-[11px] font-medium text-gray-400 mt-1">Open orderbook books</p>
						</div>
					</div>

					<div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-xs flex flex-col justify-between group hover:border-gray-300 dark:hover:border-white/10 transition-colors">
						<div className="flex items-center justify-between">
							<span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
								Total Users
							</span>
							<div className="p-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white border border-gray-200 dark:border-white/5">
								<Users className="w-4 h-4" />
							</div>
						</div>
						<div className="mt-4">
							<p className="text-2xl font-black text-gray-900 dark:text-white">
								{loading ? '-' : formatNumber(metrics?.totalUsers)}
							</p>
							<p className="text-[11px] font-medium text-gray-400 mt-1">Registered trader profiles</p>
						</div>
					</div>
				</div>

				{/* Charts Grid */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Trading Volume & Revenue Chart */}
					<div className="lg:col-span-2 bg-white dark:bg-[#121214] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-xs flex flex-col justify-between">
						<div>
							<div className="flex items-center justify-between">
								<div>
									<h3 className="text-base font-bold text-gray-900 dark:text-white">
										Volume & Revenue Activity
									</h3>
									<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
										Aggregated platform trading volume and revenue across the selected period.
									</p>
								</div>
							</div>
						</div>

						<div className="h-[280px] w-full mt-6">
							{loading ? (
								<div className="flex h-full items-center justify-center">
									<Loader2 className="w-6 h-6 animate-spin text-gray-400" />
								</div>
							) : metrics?.revenueChart && metrics.revenueChart.length > 0 ? (
								<ResponsiveContainer width="100%" height="100%">
									<AreaChart
										data={metrics.revenueChart}
										margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
									>
										<defs>
											<linearGradient id="colorAdminVolume" x1="0" y1="0" x2="0" y2="1">
												<stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
												<stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
											</linearGradient>
										</defs>
										<CartesianGrid
											strokeDasharray="3 3"
											vertical={false}
											stroke="currentColor"
											className="text-gray-200 dark:text-white/5"
										/>
										<XAxis
											dataKey="date"
											fontSize={11}
											tickLine={false}
											axisLine={false}
											stroke="currentColor"
											className="text-gray-400 dark:text-gray-500"
											dy={10}
											tickFormatter={(value) => {
												const date = new Date(value);
												return date.toLocaleDateString('en-US', {
													month: 'short',
													day: 'numeric',
												});
											}}
										/>
										<YAxis
											fontSize={11}
											tickLine={false}
											axisLine={false}
											stroke="currentColor"
											className="text-gray-400 dark:text-gray-500"
											tickFormatter={(value) => `₹${value}`}
											dx={-5}
										/>
										<Tooltip content={<CustomTooltip />} />
										<Area
											type="monotone"
											dataKey="volume"
											name="Volume"
											stroke="#3b82f6"
											strokeWidth={2}
											fillOpacity={1}
											fill="url(#colorAdminVolume)"
											activeDot={{ r: 5, strokeWidth: 0, fill: '#3b82f6' }}
										/>
									</AreaChart>
								</ResponsiveContainer>
							) : (
								<div className="flex h-full flex-col items-center justify-center text-gray-400 text-xs">
									<Activity className="w-8 h-8 mb-2 opacity-50" />
									<p>No activity data available for this range</p>
								</div>
							)}
						</div>
					</div>

					{/* Market Distribution Pie Chart */}
					<div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-xs flex flex-col justify-between">
						<div>
							<h3 className="text-base font-bold text-gray-900 dark:text-white">
								Market Breakdown
							</h3>
							<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
								Ratio of Open vs Closed markets.
							</p>
						</div>

						<div className="h-[280px] w-full flex items-center justify-center mt-2">
							{loading ? (
								<Loader2 className="w-6 h-6 animate-spin text-gray-400" />
							) : metrics?.marketDistribution &&
							  metrics.marketDistribution.some((m: any) => m.value > 0) ? (
								<ResponsiveContainer width="100%" height="100%">
									<PieChart>
										<Pie
											data={metrics.marketDistribution}
											cx="50%"
											cy="50%"
											innerRadius={60}
											outerRadius={85}
											paddingAngle={4}
											dataKey="value"
											stroke="none"
										>
											{metrics.marketDistribution.map((_: any, index: number) => (
												<Cell
													key={`cell-${index}`}
													fill={PIE_COLORS[index % PIE_COLORS.length]}
												/>
											))}
										</Pie>
										<Tooltip
											contentStyle={{
												borderRadius: '12px',
												border: '1px solid rgba(255,255,255,0.1)',
												backgroundColor: '#1C1C1E',
												color: '#fff',
												fontSize: '12px',
												fontWeight: 600,
											}}
										/>
										<Legend
											verticalAlign="bottom"
											height={36}
											iconType="circle"
											iconSize={8}
											formatter={(value) => (
												<span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
													{value}
												</span>
											)}
										/>
									</PieChart>
								</ResponsiveContainer>
							) : (
								<div className="flex flex-col items-center justify-center text-gray-400 text-xs">
									<Activity className="w-8 h-8 mb-2 opacity-50" />
									<p>No markets created yet</p>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Recent Activity Table */}
				{metrics?.recentTransactions && metrics.recentTransactions.length > 0 && (
					<div className="bg-white dark:bg-[#121214] border border-gray-200 dark:border-white/5 rounded-2xl shadow-xs overflow-hidden">
						<div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
							<div>
								<h3 className="text-base font-bold text-gray-900 dark:text-white">
									Recent Ledger Activity
								</h3>
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
									Latest user deposits, withdrawals, and fee settlements.
								</p>
							</div>
							<Link
								to="/dashboard/transactions"
								className="text-xs font-bold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center gap-1 transition-colors"
							>
								View All <ChevronRight className="w-3.5 h-3.5" />
							</Link>
						</div>

						<div className="overflow-x-auto">
							<table className="w-full text-left border-collapse">
								<thead className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 text-gray-400 dark:text-gray-500 font-semibold text-[11px] uppercase tracking-wider">
									<tr>
										<th className="px-6 py-3">Type</th>
										<th className="px-6 py-3">User</th>
										<th className="px-6 py-3">Amount</th>
										<th className="px-6 py-3">Status</th>
										<th className="px-6 py-3 text-right">Timestamp</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
									{metrics.recentTransactions.map((tx: any) => (
										<tr
											key={tx.id}
											className="hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors"
										>
											<td className="px-6 py-3.5">
												<div className="flex items-center gap-2 font-bold text-xs">
													<div className="p-1.5 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white">
														{getTxIcon(tx.type)}
													</div>
													<span className="text-gray-900 dark:text-white">{tx.type}</span>
												</div>
											</td>
											<td className="px-6 py-3.5 font-medium text-xs text-gray-700 dark:text-gray-300">
												{tx.user?.username || tx.user?.email || 'User'}
											</td>
											<td className="px-6 py-3.5 font-bold text-xs text-gray-900 dark:text-white">
												{formatINR(tx.amount)}
											</td>
											<td className="px-6 py-3.5">
												<span
													className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
														tx.status === 'SUCCESS'
															? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
															: tx.status === 'PENDING'
																? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
																: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20'
													}`}
												>
													{tx.status}
												</span>
											</td>
											<td className="px-6 py-3.5 text-xs text-gray-400 text-right font-mono">
												{new Date(tx.createdAt).toLocaleTimeString([], {
													hour: '2-digit',
													minute: '2-digit',
												})}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}
			</div>
		</AdminLayout>
	);
}
