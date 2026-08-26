import api from '@/config/axios';
import { socket } from '@/socket';
import { useAuthStore } from '@/store/auth';
import { useEffect, useState } from 'react';
import logo from '@/assets/images/logo.avif';
import darkLogo from '@/assets/images/dark-logo.avif';
import { useBalanceQuery } from '@/hooks/queries/balance';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Loader2, Eye, EyeOff, Search, Download } from 'lucide-react';
import { placeOrder, cancelOrder } from '@/api/order';
import { toast } from 'sonner';

interface PortfolioData {
	positions: any[];
	activeOrders: any[];
	recentActivity: any[];
}

const generateMockChartData = () => {
	const data = [];
	let base = 5000;
	for (let i = 0; i < 30; i++) {
		base = base + (Math.random() * 100 - 50);
		data.push({ name: `Day ${i + 1}`, value: Math.max(base, 0) });
	}
	return data;
};

export default function Portfolio() {
	const [data, setData] = useState<PortfolioData | null>(null);
	const [loading, setLoading] = useState(true);
	const [chartData] = useState(() => generateMockChartData());
	const user = useAuthStore((state) => state.user);
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
	const { data: balanceData, refetch: refetchBalance } = useBalanceQuery();

	const [showBalance, setShowBalance] = useState(true);
	const [activeTab, setActiveTab] = useState('positions');
	const [searchQuery, setSearchQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState('All');
	const [processing, setProcessing] = useState<string | null>(null);

	const handleSell = async (row: any) => {
		try {
			setProcessing(`sell-${row.uniqueId}`);
			// Default to limit order at current price to match the current engine implementation
			// Or we could use market order if engine supports it. We'll use MARKET to dump positions quickly
			await placeOrder(
				row.side,
				row.market.symbol,
				'SELL',
				row.currentPrice,
				'LIMIT', // Engine handles LIMIT by default usually
				row.qty,
				row.marketId,
			);
			toast.success(`Sell order placed for ${row.qty} ${row.side} shares!`);
		} catch (err: any) {
			toast.error(err.response?.data?.error || 'Failed to place sell order');
		} finally {
			setProcessing(null);
		}
	};

	const handleCancel = async (order: any) => {
		try {
			setProcessing(`cancel-${order.id}`);
			await cancelOrder(order.id, order.marketId);
			toast.success('Order cancelled successfully!');
		} catch (err: any) {
			toast.error(err.response?.data?.error || 'Failed to cancel order');
		} finally {
			setProcessing(null);
		}
	};

	const walletBalance = balanceData?.data?.data?.amount || 0;

	const totalInvested =
		data?.positions?.reduce((acc, pos) => {
			return acc + Number(pos.yesInvested || 0) + Number(pos.noInvested || 0);
		}, 0) || 0;

	const totalCurrentValue =
		data?.positions?.reduce((acc, pos) => {
			const yesValue =
				(Number(pos.yesQuantity || 0) + Number(pos.yesLocked || 0)) *
				Number(pos.market?.yesPrice || 0);
			const noValue =
				(Number(pos.noQuantity || 0) + Number(pos.noLocked || 0)) *
				Number(pos.market?.noPrice || 0);
			return acc + yesValue + noValue;
		}, 0) || 0;

	const portfolioValue = walletBalance + totalCurrentValue;
	const totalPnL = totalCurrentValue - totalInvested;
	const pnlPercentage = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

	useEffect(() => {
		const fetchPortfolio = async () => {
			try {
				const res = await api.get(`/portfolio`);
				if (res.data.success) {
					setData(res.data.data);
				}
			} catch (err) {
				console.error('Failed to fetch portfolio', err);
			} finally {
				setLoading(false);
			}
		};

		if (isAuthenticated) fetchPortfolio();

		if (isAuthenticated && user?.id) {
			const onConnect = () => {
				socket.emit('SUBSCRIBE_USER', user.id);
			};

			if (socket.connected) {
				onConnect();
			} else {
				socket.connect();
			}

			socket.on('connect', onConnect);

			const handlePortfolioUpdate = () => {
				fetchPortfolio();
				refetchBalance();
			};

			const handleMessage = (msgData: any) => {
				if (msgData?.type === 'PORTFOLIO_UPDATE') {
					handlePortfolioUpdate();
				}
			};

			socket.on('PORTFOLIO_UPDATE', handlePortfolioUpdate);
			socket.on('MESSAGE', handleMessage);

			return () => {
				socket.emit('UNSUBSCRIBE_USER', user.id);
				socket.off('PORTFOLIO_UPDATE', handlePortfolioUpdate);
				socket.off('MESSAGE', handleMessage);
				socket.off('connect', onConnect);
			};
		}
	}, [isAuthenticated, user?.id, refetchBalance]);

	if (loading) {
		return (
			<div className="flex justify-center items-center min-h-[60vh]">
				<Loader2 className="animate-spin w-8 h-8 text-black dark:text-white" />
			</div>
		);
	}

	return (
		<div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-6 font-sans w-full">
			{/* Top Cards Section */}
			<div className="grid md:grid-cols-2 gap-4 md:gap-6">
				{/* Left Card: Portfolio Balance */}
				<div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 flex flex-col justify-between min-h-55">
					<div className="flex justify-between items-start">
						<div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 font-medium">
							Portfolio
							<button
								onClick={() => setShowBalance(!showBalance)}
								className="hover:text-gray-900 dark:hover:text-white transition-colors"
							>
								{showBalance ? <Eye size={16} /> : <EyeOff size={16} />}
							</button>
						</div>
						<div className="text-right">
							<div className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">
								Available to trade
							</div>
							<div className="text-xl font-bold text-gray-900 dark:text-white">
								{showBalance ? `₹${walletBalance.toFixed(2)}` : '****'}
							</div>
						</div>
					</div>

					<div className="mt-8">
						<div className="text-3xl md:text-[40px] font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3 flex-wrap break-all">
							{showBalance ? `₹${portfolioValue.toFixed(2)}` : '****'}
							{!showBalance && (
								<EyeOff
									size={24}
									className="text-gray-300 dark:text-gray-600 shrink-0 cursor-pointer"
								/>
							)}
						</div>
						<div className="text-gray-500 dark:text-gray-400 font-medium mt-1 flex items-center gap-2">
							<span
								className={`font-bold ${totalPnL >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}`}
							>
								{totalPnL >= 0 ? '+' : ''}₹{Math.abs(totalPnL).toFixed(2)} (
								{pnlPercentage.toFixed(2)}%)
							</span>
							<span>overall</span>
						</div>
					</div>
				</div>

				{/* Right Card: Profit/Loss Chart */}
				<div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 relative flex flex-col justify-between min-h-55">
					<div className="flex justify-between items-start">
						<div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
							<div className="w-2 h-2 rounded-full bg-gray-400"></div>
							Profit/Loss
						</div>
						<div className="flex flex-wrap justify-end gap-1 overflow-hidden">
							{['1D', '1W', '1M', '1Y', 'YTD', 'ALL'].map((tf) => (
								<button
									key={tf}
									className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
										tf === '1D'
											? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
											: 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
									}`}
								>
									{tf}
								</button>
							))}
						</div>
					</div>

					<div className="flex justify-between items-end mt-6 relative z-10 gap-4">
						<div className="min-w-0">
							<div className="text-2xl md:text-[32px] font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2 truncate">
								<span
									className={
										totalPnL >= 0
											? 'text-emerald-600 dark:text-emerald-500'
											: 'text-red-600 dark:text-red-500'
									}
								>
									{totalPnL >= 0 ? '+' : ''}₹{Math.abs(totalPnL).toFixed(2)}
								</span>
							</div>
							<div className="text-gray-500 dark:text-gray-400 text-sm font-medium">
								Unrealized P&L
							</div>
						</div>
						<div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 font-bold text-xl opacity-50">
							<img src={logo} alt="Probstreet" className="h-10 grayscale opacity-75 dark:hidden" />
							<img
								src={darkLogo}
								alt="Probstreet"
								className="h-10 grayscale opacity-75 hidden dark:block"
							/>
						</div>
					</div>

					{/* Background Chart */}
					<div className="absolute bottom-0 left-0 right-0 h-24 overflow-hidden rounded-b-xl opacity-30 pointer-events-none">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={chartData}>
								<defs>
									<linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
										<stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
									</linearGradient>
								</defs>
								<Area
									type="monotone"
									dataKey="value"
									stroke="none"
									fillOpacity={1}
									fill="url(#colorPv)"
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</div>
			</div>

			{/* Bottom Section: Positions Table */}
			<div className="pt-6">
				{/* Filter Bar */}
				<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6 mt-2">
					{/* Custom Tabs */}
					<div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-lg shrink-0 w-full sm:w-auto overflow-x-auto">
						{['positions', 'open', 'history'].map((tab) => (
							<button
								key={tab}
								onClick={() => setActiveTab(tab as typeof activeTab)}
								className={`px-4 sm:px-6 py-1.5 rounded-md text-sm font-semibold capitalize whitespace-nowrap transition-all duration-200 flex-1 sm:flex-none ${
									activeTab === tab
										? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
										: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer'
								}`}
							>
								{tab}{' '}
								{tab === 'positions' && data?.positions
									? `(${data.positions.length})`
									: tab === 'open' && data?.activeOrders
										? `(${data.activeOrders.length})`
										: ''}
							</button>
						))}
					</div>

					{/* Flexible Search Bar */}
					<div className="relative flex-1 min-w-50">
						<Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
						<input
							type="text"
							placeholder="Search markets..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
						/>
					</div>

					{/* Filters and Actions */}
					<div className="flex items-center gap-2 shrink-0 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
						{activeTab === 'history' && (
							<select
								className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer flex-1 sm:flex-none"
								value={statusFilter}
								onChange={(e) => setStatusFilter(e.target.value)}
							>
								<option value="All">All Types</option>
								<option value="BUY">Buy</option>
								<option value="SELL">Sell</option>
							</select>
						)}
						{activeTab === 'positions' && (
							<select
								value={statusFilter}
								onChange={(e) => setStatusFilter(e.target.value)}
								className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer flex-1 sm:flex-none"
							>
								<option value="All">All Status</option>
								<option value="Active">Active</option>
								<option value="Closed">Closed</option>
							</select>
						)}
						{activeTab === 'open' && (
							<select className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer flex-1 sm:flex-none">
								<option>Order Date</option>
								<option>Amount</option>
							</select>
						)}
						{activeTab === 'history' && (
							<button className="flex items-center justify-center gap-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-1.5 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer shrink-0 shadow-sm">
								<Download size={16} /> Export
							</button>
						)}
					</div>
				</div>

				<div className="w-full overflow-x-auto pb-4">
					<div className="min-w-250">
						{/* Dynamic Table Headers */}
						{activeTab === 'positions' && (
							<div className="grid grid-cols-[2.5fr_1fr_1fr_1fr_1fr_1.5fr_0.8fr] gap-4 px-6 py-4 border-b border-gray-400/25">
								<div className="text-xs font-semibold text-gray-500 uppercase">MARKET</div>
								<div className="text-xs font-semibold text-gray-500 uppercase">AVG</div>
								<div className="text-xs font-semibold text-gray-500 uppercase">NOW</div>
								<div className="text-xs font-semibold text-gray-500 uppercase">TRADED</div>
								<div className="text-xs font-semibold text-gray-500 uppercase">TO WIN</div>
								<div className="text-xs font-semibold text-gray-500 uppercase">VALUE</div>
								<div className="text-xs font-semibold text-gray-500 uppercase text-right">
									ACTION
								</div>
							</div>
						)}
						{activeTab === 'open' && (
							<div className="grid grid-cols-[3fr_1.5fr_1.5fr_1.5fr_1fr] gap-4 px-6 py-4 border-b border-gray-400/25">
								<div className="text-xs font-semibold text-gray-500 uppercase">MARKET</div>
								<div className="text-xs font-semibold text-gray-500 uppercase">FILLED</div>
								<div className="text-xs font-semibold text-gray-500 uppercase">TOTAL</div>
								<div className="text-xs font-semibold text-gray-500 uppercase">EXPIRATION</div>
								<div className="text-xs font-semibold text-gray-500 uppercase text-right">
									ACTION
								</div>
							</div>
						)}
						{activeTab === 'history' && (
							<div className="grid grid-cols-[1.5fr_3fr_1.5fr_1.5fr] gap-4 px-6 py-4 border-b border-gray-400/25">
								<div className="text-xs font-semibold text-gray-500 uppercase">ACTIVITY</div>
								<div className="text-xs font-semibold text-gray-500 uppercase">MARKET</div>
								<div className="text-xs font-semibold text-gray-500 uppercase">VALUE</div>
								<div className="text-xs font-semibold text-gray-500 uppercase text-right">TIME</div>
							</div>
						)}

						{/* Table Content */}
						{activeTab === 'positions' &&
							(!data?.positions || data.positions.length === 0 ? (
								<div className="py-24 text-center">
									<p className="text-gray-400 dark:text-gray-500 font-medium">
										No positions found.
									</p>
								</div>
							) : (
								<div className="divide-y divide-gray-100 dark:divide-gray-800">
									{data.positions
										.flatMap((pos) => {
											const rows = [];
											if ((pos.yesQuantity || 0) > 0 || (pos.yesLocked || 0) > 0) {
												const qty = Number(pos.yesQuantity || 0) + Number(pos.yesLocked || 0);
												const invested = Number(pos.yesInvested || 0);
												const avg = qty > 0 ? (invested / qty).toFixed(2) : '0.00';
												const currentPrice = Number(pos.market?.yesPrice || 0);
												const currentValue = qty * currentPrice;
												const pnl = currentValue - invested;
												rows.push({
													...pos,
													uniqueId: `${pos.id}-yes`,
													side: 'Yes',
													qty,
													invested,
													avgPrice: avg,
													currentPrice,
													currentValue,
													pnl,
												});
											}
											if ((pos.noQuantity || 0) > 0 || (pos.noLocked || 0) > 0) {
												const qty = Number(pos.noQuantity || 0) + Number(pos.noLocked || 0);
												const invested = Number(pos.noInvested || 0);
												const avg = qty > 0 ? (invested / qty).toFixed(2) : '0.00';
												const currentPrice = Number(pos.market?.noPrice || 0);
												const currentValue = qty * currentPrice;
												const pnl = currentValue - invested;
												rows.push({
													...pos,
													uniqueId: `${pos.id}-no`,
													side: 'No',
													qty,
													invested,
													avgPrice: avg,
													currentPrice,
													currentValue,
													pnl,
												});
											}
											return rows;
										})
										.filter((row) => {
											const matchesSearch = (row.market?.title || '')
												.toLowerCase()
												.includes(searchQuery.toLowerCase());
											if (!matchesSearch) return false;
											if (statusFilter === 'Active') return row.market?.status === 'OPEN';
											if (statusFilter === 'Closed') return row.market?.status === 'CLOSED';
											return true;
										})
										.map((row) => (
											<div
												key={row.uniqueId}
												className="grid grid-cols-[2.5fr_1fr_1fr_1fr_1fr_1.5fr_0.8fr] gap-4 px-6 py-5 items-center border-b border-gray-400/25 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
											>
												<div className="flex items-center gap-3">
													{row.market?.thumbnail && (
														<img
															src={row.market.thumbnail}
															alt=""
															className="w-8 h-8 rounded-md object-cover shrink-0"
														/>
													)}
													<div className="flex flex-col">
														<h3
															className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-1"
															title={row.market?.title}
														>
															{row.market?.title || 'Unknown Market'}
														</h3>
														<span
															className={`text-[10px] font-bold mt-0.5 ${row.side === 'Yes' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
														>
															{row.side}
														</span>
													</div>
												</div>

												<div className="text-sm text-gray-900 dark:text-white font-medium">
													₹{row.avgPrice}
												</div>
												<div className="text-sm text-gray-900 dark:text-white font-medium">
													₹{row.currentPrice.toFixed(2)}
												</div>
												<div className="text-sm text-gray-900 dark:text-white font-medium">
													{row.qty}
												</div>
												<div className="text-sm text-gray-900 dark:text-white font-medium">
													₹{(row.qty * 10).toFixed(2)}
												</div>
												<div className="text-sm font-medium flex flex-col justify-center">
													<span className="font-bold text-gray-900 dark:text-white">
														₹{row.currentValue.toFixed(2)}
													</span>
													<span
														className={`text-xs font-bold ${row.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}`}
													>
														{row.pnl >= 0 ? '+' : ''}₹{row.pnl.toFixed(2)} (
														{row.invested > 0
															? ((row.pnl / row.invested) * 100).toFixed(2)
															: '0.00'}
														%)
													</span>
												</div>
												<div className="flex justify-end">
													{row.market?.status === 'CLOSED' ? (
														<span
															className={`text-[11px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
																(row.market?.result || '').toUpperCase() === row.side.toUpperCase()
																	? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
																	: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
															}`}
														>
															{(row.market?.result || '').toUpperCase() === row.side.toUpperCase()
																? 'Won'
																: 'Lost'}
														</span>
													) : (
														<button
															onClick={() => handleSell(row)}
															disabled={processing === `sell-${row.uniqueId}`}
															className="text-xs bg-gray-900 text-white dark:bg-white dark:text-black rounded-md px-4 py-1.5 font-bold hover:opacity-80 transition-opacity cursor-pointer shadow-sm disabled:opacity-50"
														>
															{processing === `sell-${row.uniqueId}` ? 'Selling...' : 'Sell'}
														</button>
													)}
												</div>
											</div>
										))}
								</div>
							))}

						{activeTab === 'open' &&
							(!data?.activeOrders || data.activeOrders.length === 0 ? (
								<div className="py-24 text-center">
									<p className="text-gray-400 dark:text-gray-500 font-medium">No open orders.</p>
								</div>
							) : (
								<div className="divide-y divide-gray-100 dark:divide-gray-800">
									{data.activeOrders
										.filter((order) =>
											order.market?.title?.toLowerCase().includes(searchQuery.toLowerCase()),
										)
										.map((order) => (
											<div
												key={order.id}
												className="grid grid-cols-[3fr_1.5fr_1.5fr_1.5fr_1fr] gap-4 px-6 py-5 items-center border-b border-gray-400/25 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
											>
												<div className="flex items-center gap-3">
													{order.market?.thumbnail && (
														<img
															src={order.market.thumbnail}
															alt=""
															className="w-8 h-8 rounded-md object-cover shrink-0"
														/>
													)}
													<div className="flex flex-col">
														<h3
															className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-1"
															title={order.market?.title}
														>
															{order.market?.title || 'Unknown Market'}
														</h3>
														<span
															className={`text-[10px] font-bold mt-0.5 ${order.stockType === 'YES' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
														>
															{order.stockType}
														</span>
													</div>
												</div>

												<div className="text-sm text-gray-900 dark:text-white font-medium">
													{order.filledQuantity} / {order.quantity}
												</div>
												<div className="text-sm text-gray-900 dark:text-white font-medium">
													₹{Number(order.totalPrice).toFixed(2)}
												</div>
												<div className="text-sm text-gray-500 dark:text-gray-400">
													Until Cancelled
												</div>
												<div className="flex justify-end">
													<button
														onClick={() => handleCancel(order)}
														disabled={processing === `cancel-${order.id}`}
														className="text-xs font-semibold text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
													>
														{processing === `cancel-${order.id}` ? 'Cancelling...' : 'Cancel'}
													</button>
												</div>
											</div>
										))}
								</div>
							))}

						{activeTab === 'history' &&
							(!data?.recentActivity || data.recentActivity.length === 0 ? (
								<div className="py-24 text-center">
									<p className="text-gray-400 dark:text-gray-500 font-medium">
										No recent activity.
									</p>
								</div>
							) : (
								<div className="divide-y divide-gray-100 dark:divide-gray-800">
									{data.recentActivity
										.filter((act) =>
											act.market?.title?.toLowerCase().includes(searchQuery.toLowerCase()),
										)
										.filter((act) => statusFilter === 'All' || act.orderType === statusFilter)
										.map((activity) => (
											<div
												key={activity.id}
												className="grid grid-cols-[1.5fr_3fr_1.5fr_1.5fr] gap-4 px-6 py-5 items-center border-b border-gray-400/25 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
											>
												<div className="flex items-center">
													<span
														className={`text-xs font-bold flex items-center gap-1 ${activity.orderType === 'BUY' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
													>
														{activity.orderType === 'BUY' ? '+' : '-'} {activity.orderType}
													</span>
												</div>

												<div className="flex items-center gap-3">
													{activity.market.thumbnail && (
														<img
															src={activity.market.thumbnail}
															alt=""
															className="w-8 h-8 rounded-md object-cover shrink-0"
														/>
													)}
													<div className="flex flex-col">
														<h3
															className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-1"
															title={activity.market.title}
														>
															{activity.market.title}
														</h3>
														<span className="text-[11px] text-gray-500 mt-0.5">
															{activity.quantity} shares • {activity.stockType}
														</span>
													</div>
												</div>

												<div className="text-sm text-gray-900 dark:text-white font-medium">
													₹{(activity.quantity * Number(activity.price)).toFixed(2)}
												</div>
												<div className="text-sm text-gray-500 flex justify-end">
													{new Date(activity.createdAt).toLocaleTimeString([], {
														hour: '2-digit',
														minute: '2-digit',
													})}
												</div>
											</div>
										))}
								</div>
							))}
					</div>
				</div>
			</div>
		</div>
	);
}
