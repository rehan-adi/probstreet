import { api } from '@/lib/axios';
import { socket } from '@/socket';
import { useAuthStore } from '@/store/auth';
import { useModalStore } from '@/store/modal';
import { useParams } from 'react-router-dom';
import pfpIcon from '@/assets/images/pfp.avif';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import PlaceOrder from '@/components/PlaceOrder';
import MarketNews from '@/components/MarketNews';
import TimelineSection from '@/components/Timeline';
import UserHoldings from '@/components/UserHoldings';
import ShareModal from '@/components/modals/ShareModal';
import PriceAlertModal from '@/components/modals/PriceAlertModal';
import downloadIcon from '@/assets/images/download.avif';
import defaultThumbnail from '@/assets/images/logo.avif';
import { Bookmark, Share2, RefreshCcw, BellRing } from 'lucide-react';
import OrderbookLadder from '@/components/OrderbookLadder';
interface TradeExecutedEvent {
	marketId: string;
	makerId: string;
	takerId: string;
	makerOrderId: string;
	takerOrderId: string;
	stockType: string;
	takerAction: string;
	price: number;
	quantity: number;
	timestamp: string;
	matchType: string;
	takerName?: string;
	makerName?: string;
}

interface Market {
	symbol: string;
	marketId: string;
	title: string;
	thumbnail: string;
	yesPrice: number;
	noPrice: number;
	orderbook: {
		yes: any[];
		no: any[];
	};
	timeline: any[];
	trades: TradeExecutedEvent[];
	volume: number;
	traders: number;
	endTime: string;
	category?: string;
	sourceOfTruth?: string;
	status?: string;
	result?: string;
	overview: {
		SourceOfTruth?: string;
		StartDate?: string;
		EndDate?: string;
		eos?: string;
		Rules?: string;
	};
}

const AVATAR_GRADIENTS = [
	'from-orange-400 to-red-500',
	'from-blue-400 to-indigo-500',
	'from-pink-400 to-rose-500',
	'from-emerald-400 to-teal-500',
	'from-purple-400 to-fuchsia-500',
	'from-indigo-500 to-purple-600',
	'from-yellow-400 to-amber-500',
	'from-cyan-400 to-blue-500',
];

const getAvatarGradient = (str: string) => {
	if (!str) return AVATAR_GRADIENTS[0];
	const num = str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
	return AVATAR_GRADIENTS[num % AVATAR_GRADIENTS.length];
};

export default function EventDetails() {
	const { symbol } = useParams<{ symbol: string }>();

	const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
	const user = useAuthStore((s) => s.user);
	const { openOnboardModal } = useModalStore();

	const [market, setMarket] = useState<Market | null>(null);
	const [loading, setLoading] = useState(true);

	const [activeBoxTab, setActiveBoxTab] = useState<'orderbook' | 'activity'>('orderbook');
	const [innerTab, setInnerTab] = useState<'Yes' | 'No'>('Yes');
	const [isBookmarked, setIsBookmarked] = useState(false);
	const [isMobileOrderOpen, setIsMobileOrderOpen] = useState(false);
	const [isOrderbookLocked, setIsOrderbookLocked] = useState(false);
	const [isShareModalOpen, setIsShareModalOpen] = useState(false);
	const [isPriceAlertModalOpen, setIsPriceAlertModalOpen] = useState(false);
	const [resetScrollToken, setResetScrollToken] = useState(0);

	useEffect(() => {
		if (!symbol) return;

		const onConnect = () => {
			socket.emit('SUBSCRIBE_MARKET', symbol);
		};

		if (socket.connected) {
			onConnect();
		} else {
			socket.connect();
		}

		socket.on('connect', onConnect);

		const handleTicker = (data: any) => {
			if (!data) return;
			setMarket((prev: Market | null) => {
				if (!prev) return prev;
				return {
					...prev,
					yesPrice: typeof data.yesPrice === 'number' ? data.yesPrice : prev.yesPrice,
					noPrice: typeof data.noPrice === 'number' ? data.noPrice : prev.noPrice,
					volume: typeof data.volume === 'number' ? data.volume : prev.volume,
					traders:
						typeof data.numberOfTraders === 'number'
							? data.numberOfTraders
							: (data.traders ?? prev.traders),
				};
			});
		};

		const handleOrderbook = (data: any) => {
			const incomingOrderbook = data?.orderbook || data?.Orderbook;
			if (!incomingOrderbook) return;

			setMarket((prev: Market | null) => {
				if (!prev) return prev;
				try {
					const updatedOrderbook = {
						yes: [...(prev.orderbook?.yes || [])],
						no: [...(prev.orderbook?.no || [])],
					};

					['yes', 'no'].forEach((side) => {
						const sideKey = side as keyof typeof updatedOrderbook;
						const capitalized = side.charAt(0).toUpperCase() + side.slice(1);
						const updates = incomingOrderbook[side] || incomingOrderbook[capitalized];
						if (!Array.isArray(updates)) return;

						updates.forEach((update: any) => {
							const idx = updatedOrderbook[sideKey].findIndex((o: any) => o.price === update.price);

							if (idx > -1) {
								if (update.quantity > 0) {
									updatedOrderbook[sideKey][idx] = update;
								} else {
									updatedOrderbook[sideKey].splice(idx, 1);
								}
							} else {
								if (update.quantity > 0) {
									updatedOrderbook[sideKey].push(update);
								}
							}
						});

						updatedOrderbook[sideKey].sort((a: any, b: any) =>
							side === 'yes' ? b.price - a.price : a.price - b.price,
						);
					});

					return {
						...prev,
						orderbook: updatedOrderbook,
					};
				} catch (err) {
					console.error('Error processing ORDERBOOK socket message:', err);
					return prev;
				}
			});
		};

		const handleActivity = (data: any) => {
			const incomingTrades = data?.trades || (data?.trade ? [data.trade] : null);
			if (!incomingTrades || !Array.isArray(incomingTrades) || incomingTrades.length === 0) return;

			setMarket((prev: Market | null) => {
				if (!prev) return prev;
				try {
					let updatedTrades = [...(prev.trades || [])];
					let newVolume = prev.volume || 0;

					incomingTrades.forEach((newTrade: TradeExecutedEvent) => {
						const exists = updatedTrades.some(
							(trade: TradeExecutedEvent) =>
								trade.makerOrderId === newTrade.makerOrderId &&
								trade.takerOrderId === newTrade.takerOrderId &&
								trade.price === newTrade.price &&
								trade.timestamp === newTrade.timestamp,
						);
						if (!exists) {
							updatedTrades.unshift(newTrade);
							newVolume += (newTrade.price * newTrade.quantity) / 10;
						}
					});

					return {
						...prev,
						trades: updatedTrades.slice(0, 50),
						volume: newVolume,
					};
				} catch (err) {
					console.error('Error processing ACTIVITY socket message:', err);
					return prev;
				}
			});
		};

		const handleGenericMessage = (data: any) => {
			if (!data) return;
			if (data.type === 'TICKER') {
				handleTicker(data);
			} else if (data.type === 'ORDERBOOK') {
				handleOrderbook(data);
			} else if (data.type === 'ACTIVITY') {
				handleActivity(data);
			} else {
				// Legacy / combined payload fallback
				if (
					data.yesPrice !== undefined ||
					data.noPrice !== undefined ||
					data.volume !== undefined ||
					data.numberOfTraders !== undefined
				) {
					handleTicker(data);
				}
				if (data.orderbook || data.Orderbook) {
					handleOrderbook(data);
				}
				if (data.trades) {
					handleActivity(data);
				}
			}
		};

		socket.on('TICKER', handleTicker);
		socket.on('ORDERBOOK', handleOrderbook);
		socket.on('ACTIVITY', handleActivity);
		socket.on('MESSAGE', handleGenericMessage);

		return () => {
			socket.emit('UNSUBSCRIBE_MARKET', symbol);
			socket.off('TICKER', handleTicker);
			socket.off('ORDERBOOK', handleOrderbook);
			socket.off('ACTIVITY', handleActivity);
			socket.off('MESSAGE', handleGenericMessage);
			socket.off('MESSAGE', handleGenericMessage);
			socket.off('connect', onConnect);
		};
	}, [symbol]);

	useEffect(() => {
		if (!symbol) return;
		api
			.get(`/market/${symbol}`)
			.then((res) => {
				setMarket(res.data.data);
				if (isAuthenticated && res.data.data) {
					checkBookmark(res.data.data.marketId);
				}
			})
			.catch((err) => console.error('Error fetching market details:', err))
			.finally(() => setLoading(false));
	}, [symbol, isAuthenticated]);

	const checkBookmark = async (marketId: string) => {
		try {
			const res = await api.get('/profile/watchlist');
			if (res.data?.success) {
				const isSaved = res.data.data.some((m: any) => m.id === marketId);
				setIsBookmarked(isSaved);
			}
		} catch (error) {
			console.error('Failed to fetch watchlist', error);
		}
	};

	const toggleBookmark = async () => {
		if (!isAuthenticated) {
			openOnboardModal();
			return;
		}
		if (!market) return;
		try {
			if (isBookmarked) {
				await api.delete(`/profile/watchlist/${market.marketId}`);
				setIsBookmarked(false);
			} else {
				await api.post('/profile/watchlist', { marketId: market.marketId });
				setIsBookmarked(true);
			}
		} catch (error) {
			console.error('Failed to toggle bookmark', error);
		}
	};

	if (loading) return <p className="p-4 text-foreground">Loading...</p>;
	if (!market) return <p className="p-4 text-foreground">Market not found.</p>;

	const calculateOrderbookDisplay = (outcome: 'Yes' | 'No') => {
		let bids: any[] = [];
		let asks: any[] = [];

		if (outcome === 'Yes') {
			bids = (market.orderbook?.yes || [])
				.filter((o) => o.price > 0 && o.quantity > 0)
				.sort((a, b) => b.price - a.price)
				.slice(0, 15);

			asks = (market.orderbook?.no || [])
				.filter((o) => o.price > 0 && o.quantity > 0 && o.price < 10)
				.map((o) => ({ price: 10 - o.price, quantity: o.quantity }))
				.sort((a, b) => b.price - a.price)
				.slice(0, 15);
		} else {
			bids = (market.orderbook?.no || [])
				.filter((o) => o.price > 0 && o.quantity > 0)
				.sort((a, b) => b.price - a.price)
				.slice(0, 15);

			asks = (market.orderbook?.yes || [])
				.filter((o) => o.price > 0 && o.quantity > 0 && o.price < 10)
				.map((o) => ({ price: 10 - o.price, quantity: o.quantity }))
				.sort((a, b) => b.price - a.price)
				.slice(0, 15);
		}

		return { bids, asks };
	};

	const { bids, asks } = calculateOrderbookDisplay(innerTab);

	return (
		<div className="w-full bg-background min-h-screen flex items-start justify-center text-foreground transition-colors">
			<div className="flex gap-8 max-w-7xl mx-auto w-full px-6 pt-4 md:pt-8 flex-col lg:flex-row relative">
				<div className="w-full lg:w-[65%] pb-20">
					<div className="flex justify-between items-start mb-8 gap-4">
						<div className="flex items-start gap-4">
							<div className="w-16 h-16 md:w-18 md:h-18 shrink-0 rounded-xl overflow-hidden border border-border shadow-sm">
								<img
									src={
										!market.thumbnail ||
										market.thumbnail.includes('34d989f64bf44f84bf3dfd398f6d2b67.png')
											? defaultThumbnail
											: market.thumbnail
									}
									alt={market.title}
									className="w-full h-full object-cover bg-white dark:bg-[#262626]"
								/>
							</div>
							<div>
								<div className="flex items-center gap-2 mb-2">
									<span className="text-xs font-semibold uppercase tracking-wide">
										{market.category || 'Event'}
									</span>
								</div>
								<h1 className="md:text-xl text-lg font-bold leading-tight">{market.title}</h1>
							</div>
						</div>

						<div className="flex gap-2 shrink-0">
							<button
								onClick={toggleBookmark}
								className="p-2 border cursor-pointer border-border rounded-lg bg-card text-foreground hover:bg-muted transition shadow-sm"
							>
								<Bookmark size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
							</button>
							<button
								onClick={() => setIsShareModalOpen(true)}
								className="p-2 border cursor-pointer border-border rounded-lg bg-card text-foreground hover:bg-muted transition shadow-sm"
							>
								<Share2 size={18} />
							</button>
							<button
								onClick={() => setIsPriceAlertModalOpen(true)}
								className="p-2 border cursor-pointer border-border rounded-lg bg-card text-foreground hover:bg-muted transition shadow-sm hover:text-blue-600"
							>
								<BellRing size={18} />
							</button>
						</div>
					</div>

					<div className="mb-6">
						<TimelineSection
							symbol={market.symbol}
							yesPrice={market.yesPrice}
							noPrice={market.noPrice}
							volume={market.volume || 0}
							overview={market.overview as any}
							traders={market.traders || 0}
						/>
					</div>

					<UserHoldings
						marketId={market.marketId}
						yesPrice={market.yesPrice}
						noPrice={market.noPrice}
					/>

					<div className="mb-8 border border-border rounded-xl shadow-sm bg-card overflow-hidden">
						<div className="flex border-b border-border bg-muted/30">
							{['Orderbook', 'Activity'].map((tab) => (
								<button
									key={tab}
									onClick={() => setActiveBoxTab(tab.toLowerCase() as any)}
									className={`flex-1 py-3.5 text-sm font-bold relative transition cursor-pointer ${
										activeBoxTab === tab.toLowerCase()
											? 'text-foreground'
											: 'text-muted-foreground hover:text-foreground'
									}`}
								>
									{tab}
									{activeBoxTab === tab.toLowerCase() && (
										<div className="absolute bottom-0 left-0 w-full h-0.5 bg-foreground"></div>
									)}
								</button>
							))}
						</div>

						<div className="p-5 md:p-6 h-162.5 flex flex-col">
							{activeBoxTab === 'orderbook' && (
								<div className="flex flex-col h-full min-h-0">
									<div className="flex justify-between items-center mb-4 border-b border-border w-full shrink-0">
										<div className="flex gap-6">
											{['Yes', 'No'].map((tab) => (
												<button
													key={tab}
													onClick={() => {
														setInnerTab(tab as any);
														setTimeout(() => setResetScrollToken((prev) => prev + 1), 60);
													}}
													className={`py-2 text-sm cursor-pointer font-bold relative transition-colors ${
														innerTab === tab
															? 'text-foreground'
															: 'text-muted-foreground hover:text-foreground'
													}`}
												>
													Trade {tab.toUpperCase()}
													{innerTab === tab && (
														<div className="absolute bottom-0 left-0 w-full h-0.5 bg-foreground"></div>
													)}
												</button>
											))}
										</div>
										<div className="flex items-center gap-2">
											<button
												onClick={() => setResetScrollToken((prev) => prev + 1)}
												className="flex items-center cursor-pointer justify-center p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50 border border-transparent transition-colors"
												title="Re-centre Spread"
											>
												<RefreshCcw className="w-4 h-4" />
											</button>
											<button
												onClick={() => setIsOrderbookLocked(!isOrderbookLocked)}
												className={`flex items-center cursor-pointer justify-center p-1.5 rounded-md transition-colors border ${isOrderbookLocked ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : 'text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50'}`}
												title={isOrderbookLocked ? 'Unlock Scroll' : 'Lock Scroll (Center Spread)'}
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="16"
													height="16"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="2.5"
													strokeLinecap="round"
													strokeLinejoin="round"
												>
													<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
													<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
												</svg>
											</button>
										</div>
									</div>

									<div className="w-full flex-1 min-h-0">
										<OrderbookLadder
											bids={bids}
											asks={asks}
											onPriceSelect={() => {
												// Select price in order form
											}}
											isLocked={isOrderbookLocked}
											resetScrollToken={resetScrollToken}
										/>
									</div>
								</div>
							)}

							{activeBoxTab === 'activity' && (
								<div className="flex flex-col h-full min-h-0 relative">
									<div className="absolute top-0 left-0 right-0 h-4 bg-linear-to-b from-card to-transparent z-10 pointer-events-none"></div>

									<div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 space-y-1">
										{market.trades && market.trades.length > 0 ? (
											<div className="space-y-4">
												{market.trades.map((trade, idx) => {
													const realName = trade.takerName || trade.makerName;

													let displayName = realName || 'Trader';
													let initial = displayName.charAt(0).toUpperCase();
													let color = getAvatarGradient(
														displayName || trade.takerId || trade.makerId || `${idx}`,
													);

													if (user && (trade.takerId === user.id || trade.makerId === user.id)) {
														displayName = 'You';
														color = 'from-emerald-500 to-teal-500';
														initial = 'Y';
													}

													const actionText = trade.takerAction
														? trade.takerAction.toLowerCase() === 'buy'
															? 'bought'
															: 'sold'
														: 'traded';
													const price = Number(trade.price);
													const total = (trade.quantity * price).toFixed(1);

													return (
														<div
															key={idx}
															className="flex items-start gap-3 py-3 px-3 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors rounded-lg"
														>
															<div
																className={`w-8 h-8 rounded-full bg-linear-to-tr ${color} flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0 mt-0.5`}
															>
																{initial}
															</div>
															<div className="flex flex-col">
																<span className="text-sm text-foreground leading-snug">
																	<span className="font-semibold">{displayName}</span> {actionText}{' '}
																	<span className="font-bold">{trade.quantity}</span>{' '}
																	<span
																		className={`font-semibold ${trade.stockType.toLowerCase() === 'yes' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}
																	>
																		{trade.stockType}
																	</span>{' '}
																	at ₹{price.toFixed(1)}{' '}
																	<span className="text-muted-foreground">(₹{total})</span>
																</span>
																<span className="text-xs text-muted-foreground font-medium mt-1">
																	{(() => {
																		const diff = Math.floor(
																			(new Date().getTime() - new Date(trade.timestamp).getTime()) /
																				1000,
																		);
																		if (diff < 60) return `${diff}s ago`;
																		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
																		return `${Math.floor(diff / 3600)}h ago`;
																	})()}
																</span>
															</div>
														</div>
													);
												})}
											</div>
										) : (
											<div className="flex flex-col items-center justify-center h-full text-center py-12">
												<span className="text-muted-foreground/50 text-4xl mb-3">⚬</span>
												<div className="text-sm font-medium text-muted-foreground">
													No activities yet
												</div>
												<div className="text-xs text-muted-foreground/70 mt-1">
													Trades will appear here in real-time
												</div>
											</div>
										)}
									</div>
									<div className="absolute bottom-0 left-0 right-0 h-4 bg-linear-to-t from-card to-transparent z-10 pointer-events-none"></div>
								</div>
							)}
						</div>
					</div>

					<div className="mb-8 bg-card p-6 border border-border rounded-xl shadow-sm">
						<h2 className="text-lg font-bold mb-5 text-foreground">About the Event</h2>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-sm">
							<div className="flex flex-col gap-1.5 min-w-0">
								<span className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">
									Source of Truth
								</span>
								<a
									href="https://icc-cricket.com"
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-500 font-medium hover:underline flex items-center gap-1 line-clamp-2"
									title="Official ICC announcements and match results from icc-cricket.com"
								>
									Official ICC announcements and match results
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
										className="shrink-0"
									>
										<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
										<polyline points="15 3 21 3 21 9" />
										<line x1="10" y1="14" x2="21" y2="3" />
									</svg>
								</a>
							</div>
							<div className="flex flex-col gap-1.5 min-w-0">
								<span className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">
									Event started
								</span>
								<span className="text-foreground font-medium">
									{market.overview?.StartDate
										? new Date(market.overview.StartDate).toLocaleDateString(undefined, {
												day: '2-digit',
												month: 'short',
												year: 'numeric',
											})
										: '--'}
								</span>
							</div>
							<div className="flex flex-col gap-1.5 min-w-0">
								<span className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">
									Event expires
								</span>
								<span className="text-foreground font-medium">
									{market.overview?.EndDate
										? new Date(market.overview.EndDate).toLocaleDateString(undefined, {
												day: '2-digit',
												month: 'short',
												year: 'numeric',
											})
										: '--'}
								</span>
							</div>
						</div>

						<div className="space-y-6">
							<div>
								<h3 className="text-foreground mb-2 text-sm font-bold">Event Overview</h3>
								<p className="text-sm font-semibold text-black">{market.overview.eos}</p>
							</div>
							<div>
								<h3 className="text-foreground mb-2 text-sm font-bold">Rules</h3>
								<p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
									{market.overview?.Rules}
								</p>
							</div>
						</div>
					</div>

					{/* Comments Section */}
					<div className="mb-12 bg-card p-6 border border-border rounded-xl shadow-sm">
						<h2 className="text-lg font-bold mb-6 text-foreground">Comments</h2>
						<div className="flex gap-4 items-start mb-8">
							<img
								src={pfpIcon}
								alt="You"
								className="w-10 h-10 rounded-full border border-border shrink-0"
							/>
							<div className="flex-1">
								<textarea
									placeholder="Add a comment..."
									className="w-full bg-background border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none text-foreground placeholder:text-muted-foreground"
									rows={2}
								/>
								<div className="flex justify-end mt-3">
									<button className="bg-foreground text-background font-bold text-sm px-6 py-2 rounded-lg hover:opacity-90 transition">
										Post
									</button>
								</div>
							</div>
						</div>

						<div className="space-y-6">
							{/* Mock Comment 1 */}
							<div className="flex gap-4">
								<div className="w-10 h-10 rounded-full bg-linear-to-tr from-purple-500 to-orange-400 shrink-0"></div>
								<div>
									<div className="flex items-center gap-2.5 mb-1.5">
										<span className="font-bold text-sm text-foreground">fmfwd</span>
										<span className="text-[10px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
											17.5K Yes
										</span>
										<span className="text-xs font-semibold text-muted-foreground">11h ago</span>
									</div>
									<p className="text-sm text-foreground">turn gay since I do copytrading!</p>
								</div>
							</div>

							{/* Mock Comment 2 */}
							<div className="flex gap-4">
								<div className="w-10 h-10 rounded-full bg-linear-to-tr from-yellow-600 to-red-400 shrink-0"></div>
								<div>
									<div className="flex items-center gap-2.5 mb-1.5">
										<span className="font-bold text-sm text-foreground">socialwolf3115</span>
										<span className="text-xs font-semibold text-muted-foreground">17h ago</span>
									</div>
									<p className="text-sm text-foreground">copy trading hits while im sleeping</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div className="w-[30%] max-[1160px]:w-[35%] max-[970px]:hidden lg:sticky lg:top-32 self-start max-h-[calc(100vh-130px)] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none pb-10">
					{['CLOSED', 'CLOSE'].includes((market.status || '').toUpperCase()) ? (
						<div className="space-y-6">
							<div className="bg-card border border-border rounded-2xl p-6 shadow-sm overflow-hidden relative">
								<div className="flex items-center justify-between pb-4 border-b border-border">
									<div className="flex items-center gap-2">
										<span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
											Market Concluded
										</span>
									</div>
									<span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
										Resolved
									</span>
								</div>

								<div className="py-6 text-center">
									<p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
										Winning Outcome
									</p>
									<div className="inline-flex items-center justify-center gap-3">
										<span
											className={`text-4xl font-black px-6 py-2 rounded-xl shadow-xs uppercase tracking-tight ${
												(market.result || '').toUpperCase() === 'YES'
													? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
													: (market.result || '').toUpperCase() === 'NO'
														? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
														: 'bg-muted text-foreground'
											}`}
										>
											{market.result || 'Settled'}
										</span>
									</div>
									<p className="text-xs text-muted-foreground mt-4 leading-relaxed max-w-xs mx-auto">
										Trading has concluded for this market. All winning shares have been settled at
										₹10.00 each.
									</p>
								</div>
							</div>
						</div>
					) : isAuthenticated ? (
						<>
							<PlaceOrder
								symbol={market.symbol}
								marketId={market.marketId}
								yPrice={market.yesPrice}
								nPrice={market.noPrice}
								yOrderPrice={market.yesPrice}
								nOrderPrice={market.noPrice}
								title={market.title}
								thumbnail={market.thumbnail}
								onOrderPlaced={() => {
									console.log('Order placed, refresh data if needed');
								}}
							/>
							<MarketNews />
						</>
					) : (
						<>
							<div className="space-y-6">
								<div className="w-full bg-[#EDEDED] dark:bg-gray-800 mt-3 rounded-xl flex p-5 border border-border">
									<div className="flex flex-col w-[65%] justify-center pr-3">
										<div className="inline-flex items-center gap-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-500 text-xs font-bold px-2.5 py-1 rounded-full mb-3 w-max">
											<span>🎁</span> LIMITED TIME OFFER
										</div>
										<h3 className="text-base md:text-lg font-bold leading-tight mb-2 text-foreground">
											UNLOCK UP TO ₹25 WELCOME BONUS!
										</h3>
										<p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3 font-medium">
											Get <span className="font-semibold text-foreground">₹15</span> instantly on
											signin and <span className="font-semibold text-foreground">₹10</span> extra
											with a referral code.
										</p>
										<button
											onClick={openOnboardModal}
											className="bg-black dark:bg-white text-white dark:text-black font-semibold text-xs md:text-sm px-4 py-2 mt-1 rounded-md hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap w-max"
										>
											Claim Reward
										</button>
									</div>
									<div className="w-[35%] flex justify-end items-center">
										<img
											src={downloadIcon}
											alt="Bonus"
											className="w-20 h-20 md:w-24 md:h-24 object-contain"
										/>
									</div>
								</div>
								<div className="flex bg-card p-4 w-full gap-3 rounded-xl border border-border shadow-sm">
									<button
										onClick={openOnboardModal}
										className="text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900 cursor-pointer bg-green-50 dark:bg-green-950/30 text-sm px-3 py-2.5 rounded-lg w-full font-bold transition hover:bg-green-100 dark:hover:bg-green-900/50"
									>
										Yes ₹{market.yesPrice}
									</button>
									<button
										onClick={openOnboardModal}
										className="text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 cursor-pointer bg-red-50 dark:bg-red-950/30 text-sm px-3 py-2.5 rounded-lg w-full font-bold transition hover:bg-red-100 dark:hover:bg-red-900/50"
									>
										No ₹{market.noPrice}
									</button>
								</div>
							</div>
						</>
					)}
				</div>
			</div>

			{/* Mobile Bottom Order Bar (Opens PlaceOrder or Signin) */}
			{['CLOSED', 'CLOSE'].includes((market.status || '').toUpperCase()) ? (
				<div className="hidden max-[970px]:flex items-center justify-between px-6 py-4 bg-card border-t border-border bottom-0 fixed w-full z-50">
					<div className="flex items-center gap-2">
						<span
							className={`w-2.5 h-2.5 rounded-full ${
								(market.result || '').toUpperCase() === 'YES' ? 'bg-emerald-500' : 'bg-red-500'
							}`}
						/>
						<span className="text-xs font-bold uppercase text-muted-foreground">
							Market Resolved
						</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-xs font-medium text-muted-foreground">Winner:</span>
						<span
							className={`text-xs font-black uppercase px-3 py-1 rounded-md ${
								(market.result || '').toUpperCase() === 'YES'
									? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
									: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
							}`}
						>
							{market.result || 'Settled'}
						</span>
					</div>
				</div>
			) : (
				<div className="hidden max-[970px]:flex justify-between items-center px-6 py-4 bg-card border-t border-border bottom-0 fixed w-full z-50 gap-4">
					<button
						onClick={() => {
							if (!isAuthenticated) {
								openOnboardModal();
								return;
							}
							setInnerTab('Yes');
							setIsMobileOrderOpen(true);
						}}
						className="text-green-600 border border-green-200 bg-green-50 dark:bg-green-950/30 text-sm px-3 py-3 rounded-lg w-full font-bold cursor-pointer"
					>
						Yes ₹{market.yesPrice}
					</button>
					<button
						onClick={() => {
							if (!isAuthenticated) {
								openOnboardModal();
								return;
							}
							setInnerTab('No');
							setIsMobileOrderOpen(true);
						}}
						className="text-red-600 border border-red-200 bg-red-50 dark:bg-red-950/30 text-sm px-3 py-3 rounded-lg w-full font-bold cursor-pointer"
					>
						No ₹{market.noPrice}
					</button>
				</div>
			)}

			{/* Mobile Order Popup/Drawer */}
			{isMobileOrderOpen && (
				<div
					className="fixed inset-0 z-60 flex flex-col justify-end bg-black/60 backdrop-blur-sm"
					onClick={() => setIsMobileOrderOpen(false)}
				>
					<motion.div
						initial={{ y: '100%' }}
						animate={{ y: 0 }}
						exit={{ y: '100%' }}
						transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
						className="bg-card w-full rounded-t-2xl p-4"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-4" />
						{isAuthenticated ? (
							<PlaceOrder
								symbol={market.symbol}
								marketId={market.marketId}
								yPrice={market.yesPrice}
								nPrice={market.noPrice}
								yOrderPrice={market.yesPrice}
								nOrderPrice={market.noPrice}
								title={market.title}
								thumbnail={market.thumbnail}
								onOrderPlaced={() => {
									setIsMobileOrderOpen(false);
								}}
							/>
						) : (
							<div className="text-center py-6">
								<h3 className="font-bold text-lg mb-2">Login Required</h3>
								<p className="text-muted-foreground mb-4">Please log in to place an order</p>
								<button
									onClick={() => {
										setIsMobileOrderOpen(false);
										openOnboardModal();
									}}
									className="bg-foreground text-background font-bold text-sm px-5 py-2.5 rounded-lg"
								>
									Sign In
								</button>
							</div>
						)}
					</motion.div>
				</div>
			)}

			<ShareModal
				isOpen={isShareModalOpen}
				onClose={() => setIsShareModalOpen(false)}
				title={market.title}
				url={window.location.href}
			/>

			{market && (
				<PriceAlertModal
					isOpen={isPriceAlertModalOpen}
					onClose={() => setIsPriceAlertModalOpen(false)}
					marketId={market.marketId}
					title={market.title}
					yesPrice={market.yesPrice}
					noPrice={market.noPrice}
				/>
			)}
		</div>
	);
}
