import { useState, useEffect, useRef } from 'react';
import { getMarketLiveStatus, getMarketProxyKlines } from '@/api/market';
import {
	createChart,
	ColorType,
	AreaSeries,
	LineStyle,
	LastPriceAnimationMode,
	type IChartApi,
	type ISeriesApi,
} from 'lightweight-charts';
import { Bookmark, Share2, BellRing, TrendingUp, TrendingDown } from 'lucide-react';

interface LiveMarketTrackerProps {
	symbol: string;
	yesPrice?: number;
	noPrice?: number;
	category?: string;
	endTime?: string;
	title?: string;
	volume?: number | string;
	thumbnail?: string;
	marketStatus?: string;
	startPrice?: number;
	cryptoMarketType?: 'TOUCH' | 'DIRECTION';
	isBookmarked?: boolean;
	onToggleBookmark?: () => void;
	onShare?: () => void;
	onPriceAlert?: () => void;
	onCryptoDetected?: () => void;
	onMarketResolved?: () => void;
}

interface CryptoData {
	coin: string;
	name: string;
	symbol: string;
	price: number;
	change24h: number;
	high24h: number;
	low24h: number;
	targetValue?: number;
	targetCondition?: string;
	logoUrl?: string;
}

interface LiveMarketResponse {
	type: 'CRYPTO' | 'SPORTS' | 'GENERAL';
	isLive: boolean;
	status: string;
	title?: string;
	category?: string;
	crypto?: CryptoData;
	match?: any;
	odds?: {
		yes: number;
		no: number;
		yesProbability: number;
		noProbability: number;
	};
}

type Timeframe = '10m' | '1h' | '1d' | '1w' | '1m' | 'All';

interface TimeframeCfg {
	interval: string;
	limit: number;
}

const TIMEFRAME_MAP: Record<Timeframe, TimeframeCfg> = {
	'10m': { interval: '1m', limit: 10 },
	'1h': { interval: '1m', limit: 60 },
	'1d': { interval: '15m', limit: 96 },
	'1w': { interval: '1h', limit: 168 },
	'1m': { interval: '4h', limit: 180 },
	All: { interval: '1d', limit: 365 },
};

const COIN_LOGOS: Record<string, string> = {
	BTC: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
	SOL: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
	ETH: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
	DOGE: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
	ADA: 'https://assets.coingecko.com/coins/images/975/large/cardano.png',
	DOT: 'https://assets.coingecko.com/coins/images/12171/large/polkadot.png',
	BNB: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
	XRP: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
	LINK: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png',
	AVAX: 'https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png',
};

function formatCountdown(endTime?: string): string | null {
	if (!endTime) return null;
	const diff = new Date(endTime).getTime() - Date.now();
	if (diff <= 0) return 'Ended';
	const s = Math.floor((diff / 1000) % 60);
	const m = Math.floor((diff / 60000) % 60);
	const h = Math.floor((diff / 3600000) % 24);
	const d = Math.floor(diff / 86400000);
	if (d > 0) return `${d}d : ${h}h : ${m}m`;
	if (h > 0)
		return `${String(h).padStart(2, '0')}h : ${String(m).padStart(2, '0')}m : ${String(s).padStart(2, '0')}s`;
	return `${String(m).padStart(2, '0')}m : ${String(s).padStart(2, '0')}s`;
}

function detectCoinFromTitle(title: string, symbol: string): string | null {
	const text = `${title} ${symbol}`.toUpperCase();
	const entries: [string, string][] = [
		['BITCOIN', 'BTC'],
		['BTC', 'BTC'],
		['ETHEREUM', 'ETH'],
		['ETH', 'ETH'],
		['SOLANA', 'SOL'],
		['SOL', 'SOL'],
		['RIPPLE', 'XRP'],
		['XRP', 'XRP'],
		['DOGECOIN', 'DOGE'],
		['DOGE', 'DOGE'],
		['CARDANO', 'ADA'],
		['ADA', 'ADA'],
		['BINANCE', 'BNB'],
		['BNB', 'BNB'],
		['AVALANCHE', 'AVAX'],
		['AVAX', 'AVAX'],
		['CHAINLINK', 'LINK'],
		['LINK', 'LINK'],
		['POLKADOT', 'DOT'],
		['DOT', 'DOT'],
	];
	for (const [keyword, coin] of entries) {
		if (text.includes(keyword)) return coin;
	}
	return null;
}

export default function LiveMarketTracker({
	symbol,
	endTime,
	title: fallbackTitle = '',
	volume = 0,
	thumbnail,
	marketStatus,
	startPrice,
	cryptoMarketType,
	isBookmarked = false,
	onToggleBookmark,
	onShare,
	onPriceAlert,
	onCryptoDetected,
	onMarketResolved,
}: LiveMarketTrackerProps) {
	const [liveData, setLiveData] = useState<LiveMarketResponse | null>(null);
	const [_loading, setLoading] = useState(false);
	const [countdown, setCountdown] = useState<string | null>(() => formatCountdown(endTime));
	const [timeframe, setTimeframe] = useState<Timeframe>('1h');
	const [currentPrice, setCurrentPrice] = useState<number | null>(null);
	const [currentChange, setCurrentChange] = useState<number | null>(null);
	const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

	const chartContainerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
	const targetPriceLineRef = useRef<any>(null);

	const isResolved = ['RESOLVED', 'CLOSED', 'CLOSE'].includes((marketStatus || '').toUpperCase());

	useEffect(() => {
		if (isResolved) {
			setCountdown('Ended');
			return;
		}
		const t = setInterval(() => {
			const fmt = formatCountdown(endTime);
			setCountdown(fmt);
		}, 1000);
		return () => clearInterval(t);
	}, [endTime, isResolved]);

	useEffect(() => {
		const observer = new MutationObserver(() => {
			setIsDark(document.documentElement.classList.contains('dark'));
		});
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		return () => observer.disconnect();
	}, []);

	const fetchLivePrice = async () => {
		if (isResolved) return;
		try {
			setLoading(true);
			const res = await getMarketLiveStatus(symbol);
			if (res.data?.success && res.data.data) {
				const data: LiveMarketResponse = res.data.data;
				setLiveData(data);
				if (data.type === 'CRYPTO') onCryptoDetected?.();
				if (
					!isResolved &&
					['CLOSED', 'RESOLVED', 'CLOSE'].includes(data.status?.toUpperCase() || '')
				) {
					onMarketResolved?.();
				}

				if (data.crypto) {
					const price = data.crypto.price;
					setCurrentPrice(price);
					setCurrentChange(data.crypto.change24h);
					const nowSec = Math.floor(Date.now() / 1000) as any;
					if (seriesRef.current) {
						seriesRef.current.update({
							time: nowSec,
							value: price,
						});
					}
				}
			}
		} catch (e) {
			console.debug('live poll error', e);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (isResolved) return;
		fetchLivePrice();
		const id = setInterval(fetchLivePrice, 5000);
		return () => clearInterval(id);
	}, [symbol, isResolved]);

	const isCrypto = liveData?.type === 'CRYPTO';

	useEffect(() => {
		if (!isCrypto || !chartContainerRef.current) return;

		if (chartRef.current) {
			chartRef.current.remove();
			chartRef.current = null;
			seriesRef.current = null;
			targetPriceLineRef.current = null;
		}

		const chartColors = isDark
			? {
					background: '#0C0F1D',
					gridLines: '#1F2937',
					textColor: '#9CA3AF',
					lineColor: '#FFFFFF',
					topColor: 'rgba(255,255,255,0.2)',
					bottomColor: 'rgba(255,255,255,0.0)',
				}
			: {
					background: '#FFFFFF',
					gridLines: '#E5E7EB',
					textColor: '#374151',
					lineColor: '#111827',
					topColor: 'rgba(17,24,39,0.15)',
					bottomColor: 'rgba(17,24,39,0.0)',
				};

		const chart = createChart(chartContainerRef.current, {
			localization: {
				timeFormatter: (timestamp: number) => {
					return new Date(timestamp * 1000).toLocaleString('en-IN', {
						timeZone: 'Asia/Kolkata',
						hour: '2-digit',
						minute: '2-digit',
					});
				},
			},
			layout: {
				background: { type: ColorType.Solid, color: chartColors.background },
				textColor: chartColors.textColor,
				fontFamily: 'Inter, system-ui, sans-serif',
				fontSize: 11,
			},
			grid: {
				vertLines: { visible: false },
				horzLines: { visible: false },
			},
			rightPriceScale: {
				borderColor: 'transparent',
				scaleMargins: { top: 0.15, bottom: 0.15 },
			},
			timeScale: {
				borderColor: 'transparent',
				timeVisible: true,
				secondsVisible: false,
				tickMarkFormatter: (time: number) => {
					return new Date(time * 1000).toLocaleString('en-IN', {
						timeZone: 'Asia/Kolkata',
						hour: '2-digit',
						minute: '2-digit',
					});
				},
				fixLeftEdge: true,
				fixRightEdge: true,
			},
			crosshair: {
				vertLine: { color: chartColors.textColor, labelBackgroundColor: '#374151' },
				horzLine: { color: chartColors.textColor, labelBackgroundColor: '#374151' },
			},
			handleScroll: false,
			handleScale: false,
		});
		chartRef.current = chart;

		const series = chart.addSeries(AreaSeries, {
			lineColor: chartColors.lineColor,
			topColor: chartColors.topColor,
			bottomColor: chartColors.bottomColor,
			lineWidth: 2,
			priceLineVisible: true,
			lastValueVisible: true,
			priceLineColor: chartColors.lineColor,
			priceLineStyle: LineStyle.Dotted,
			crosshairMarkerVisible: true,
			crosshairMarkerRadius: 3,
			lastPriceAnimation: LastPriceAnimationMode.Continuous,
		});
		seriesRef.current = series;

		// Responsive resize
		const ro = new ResizeObserver(() => {
			if (chartContainerRef.current) {
				chart.applyOptions({ width: chartContainerRef.current.clientWidth });
			}
		});
		ro.observe(chartContainerRef.current);

		return () => {
			ro.disconnect();
			chart.remove();
			chartRef.current = null;
			seriesRef.current = null;
			targetPriceLineRef.current = null;
		};
	}, [isDark, isCrypto]);

	useEffect(() => {
		if (!isCrypto || !seriesRef.current) return;
		const coin = detectCoinFromTitle(fallbackTitle, symbol);
		if (!coin) return;

		const { interval, limit } = TIMEFRAME_MAP[timeframe];
		getMarketProxyKlines(symbol, interval, limit)
			.then((res) => {
				if (res.data?.success && Array.isArray(res.data.data)) {
					const points = res.data.data.map((k: any) => ({
						time: Math.floor(k.time / 1000) as any,
						value: k.close,
					}));
					// Set data
					seriesRef.current?.setData(points);

					// Remove previous target line before adding a new one to prevent duplicates
					if (targetPriceLineRef.current && seriesRef.current) {
						seriesRef.current.removePriceLine(targetPriceLineRef.current);
						targetPriceLineRef.current = null;
					}

					const linePrice =
						cryptoMarketType === 'DIRECTION' ? startPrice : liveData?.crypto?.targetValue;
					if (linePrice !== undefined && linePrice !== null && !isNaN(Number(linePrice))) {
						if (!targetPriceLineRef.current && seriesRef.current) {
							targetPriceLineRef.current = seriesRef.current.createPriceLine({
								price: Number(linePrice),
								color: (currentChange ?? 0) >= 0 ? '#10B981' : '#EF4444',
								lineWidth: 2,
								lineStyle: LineStyle.Dotted,
								axisLabelVisible: true,
								title: cryptoMarketType === 'DIRECTION' ? 'Open Price' : 'Target',
							});
						} else if (targetPriceLineRef.current) {
							targetPriceLineRef.current.applyOptions({
								price: Number(linePrice),
								color: (currentChange ?? 0) >= 0 ? '#10B981' : '#EF4444',
								title: cryptoMarketType === 'DIRECTION' ? 'Open Price' : 'Target',
							});
						}
					}
					chartRef.current?.timeScale().fitContent();

					// Set initial current price from last candle
					if (points.length > 0 && currentPrice === null) {
						setCurrentPrice(points[points.length - 1].value);
					}
				}
			})
			.catch((e) => console.debug('klines fetch error', e));
	}, [timeframe, isDark, isCrypto]);

	if (!liveData) return null;

	if (liveData.type === 'SPORTS') {
		const m = liveData.match;
		if (!m) return null;

		return (
			<div className="mb-6 w-full overflow-hidden bg-card rounded-xl border border-border shadow-sm">
				<div className="flex items-center justify-between px-4 pt-4">
					<div className="flex items-center gap-1.5 text-sm font-medium">
						<span className="text-muted-foreground">Sports</span>
						<span className="opacity-50">•</span>
						<span className="font-semibold text-foreground">{m.league}</span>
					</div>
					<div className="flex items-center gap-1">
						<button
							onClick={onToggleBookmark}
							className="p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
						>
							<Bookmark size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
						</button>
						<button
							onClick={onShare}
							className="p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
						>
							<Share2 size={18} />
						</button>
					</div>
				</div>

				<div className="flex flex-col sm:flex-row items-center justify-center p-6 sm:p-10 gap-6 sm:gap-12 relative">
					{/* Home Team */}
					<div className="flex flex-col items-center gap-3 z-10 w-24 sm:w-32 text-center relative">
						{liveData.targetOutcome === 'home_win' && (
							<div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full -z-10" />
						)}
						<div
							className={cn(
								'w-16 h-16 sm:w-20 sm:h-20 bg-background rounded-full flex items-center justify-center p-2 shadow-sm border',
								liveData.targetOutcome === 'home_win'
									? 'border-emerald-500 shadow-emerald-500/30'
									: 'border-border',
							)}
						>
							<img
								src={m.homeTeam.crest}
								alt={m.homeTeam.name}
								className="w-full h-full object-contain"
							/>
						</div>
						<span className="font-bold text-foreground text-sm sm:text-base leading-tight">
							{m.homeTeam.shortName || m.homeTeam.name}
						</span>
						{liveData.targetOutcome === 'home_win' && (
							<span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
								Target
							</span>
						)}
					</div>

					{/* Score & Status */}
					<div className="flex flex-col items-center gap-2 z-10">
						<div
							className={cn(
								'px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider',
								liveData.isLive
									? 'bg-red-500/10 text-red-500 border border-red-500/20'
									: 'bg-muted text-muted-foreground',
							)}
						>
							{liveData.isLive && <span className="animate-pulse mr-1.5">●</span>}
							{liveData.status === 'LIVE' ? (m.minute ? m.minute + "'" : 'LIVE') : liveData.status}
						</div>
						<div className="text-4xl sm:text-5xl font-black tracking-tight text-foreground flex items-center gap-3 sm:gap-4">
							<span>{m.homeTeam.score}</span>
							<span className="text-muted-foreground/30 text-2xl sm:text-3xl">-</span>
							<span>{m.awayTeam.score}</span>
						</div>
					</div>

					{/* Away Team */}
					<div className="flex flex-col items-center gap-3 z-10 w-24 sm:w-32 text-center relative">
						{liveData.targetOutcome === 'away_win' && (
							<div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full -z-10" />
						)}
						<div
							className={cn(
								'w-16 h-16 sm:w-20 sm:h-20 bg-background rounded-full flex items-center justify-center p-2 shadow-sm border',
								liveData.targetOutcome === 'away_win'
									? 'border-emerald-500 shadow-emerald-500/30'
									: 'border-border',
							)}
						>
							<img
								src={m.awayTeam.crest}
								alt={m.awayTeam.name}
								className="w-full h-full object-contain"
							/>
						</div>
						<span className="font-bold text-foreground text-sm sm:text-base leading-tight">
							{m.awayTeam.shortName || m.awayTeam.name}
						</span>
						{liveData.targetOutcome === 'away_win' && (
							<span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
								Target
							</span>
						)}
					</div>
				</div>
			</div>
		);
	}

	if (liveData.type !== 'CRYPTO') return null;

	const c = liveData.crypto!;
	const coin = detectCoinFromTitle(fallbackTitle, symbol) || c.coin;
	const logoUrl =
		thumbnail && !thumbnail.includes('34d989f64bf44f84bf3dfd398f6d2b67.png')
			? thumbnail
			: c.logoUrl || COIN_LOGOS[coin];
	const displayPrice = currentPrice ?? c.price;
	const displayChange = currentChange ?? c.change24h;
	const isPositive = displayChange >= 0;

	return (
		<div className="mb-6 w-full overflow-hidden bg-card rounded-xl">
			<div className="flex items-center justify-between px-4 pt-4">
				<div className="flex items-center gap-1.5 text-sm font-medium">
					<span>Crypto</span>
					<span className="opacity-50">•</span>
					<span className="font-semibold">{coin}</span>
				</div>
				<div className="flex items-center gap-1">
					<button
						onClick={onToggleBookmark}
						className="p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
						title="Bookmark"
					>
						<Bookmark size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
					</button>
					<button
						onClick={onShare}
						className="p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
						title="Share"
					>
						<Share2 size={18} />
					</button>
					<button
						onClick={onPriceAlert}
						className="p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
						title="Price Alert"
					>
						<BellRing size={18} />
					</button>
				</div>
			</div>

			<div className="flex items-start justify-between gap-4 px-4 pt-3 pb-4">
				<div className="flex items-center gap-4 min-w-0">
					<div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full shrink-0 overflow-hidden bg-muted flex items-center justify-center">
						{logoUrl ? (
							<img
								src={logoUrl}
								alt={coin}
								className="w-full h-full object-cover"
								onError={(e) => {
									(e.currentTarget as HTMLImageElement).src = COIN_LOGOS[coin] || '';
								}}
							/>
						) : (
							<span className="text-xl font-black text-foreground">{coin[0]}</span>
						)}
					</div>
					<div className="min-w-0">
						<h1 className="text-lg sm:text-2xl font-semibold text-foreground line-clamp-2">
							{fallbackTitle || c.name}
						</h1>
						<div className="flex items-center gap-2 mt-1.5">
							<span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-500 dark:text-red-400">
								<span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
								{isResolved ? 'Ended' : 'Live'}
							</span>
						</div>
					</div>
				</div>

				{countdown && (
					<div className="flex flex-col items-end shrink-0">
						<span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
							Time Left
						</span>
						<span className="text-lg sm:text-xl font-black text-foreground font-mono tracking-tighter tabular-nums">
							{countdown}
						</span>
					</div>
				)}
			</div>

			<div className="px-4 pb-5 space-y-4">
				<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
					<div className="flex flex-wrap items-end gap-x-8 gap-y-2">
						{(c.targetValue !== undefined || startPrice !== undefined) && (
							<div>
								<p className="text-xs font-medium text-muted-foreground mb-0.5">
									{cryptoMarketType === 'DIRECTION' ? 'Open Price' : 'Target Price'}
								</p>
								<p className="text-xl sm:text-2xl font-black text-foreground font-mono tracking-tight">
									$
									{(cryptoMarketType === 'DIRECTION'
										? Number(startPrice)
										: Number(c.targetValue)
									).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
								</p>
							</div>
						)}

						<div>
							<div className="flex items-center gap-2 mb-0.5">
								<p className="text-xs font-medium text-muted-foreground">Current Price</p>
								<span
									className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
										isPositive
											? 'text-emerald-500 dark:text-emerald-400'
											: 'text-red-500 dark:text-red-400'
									}`}
								>
									{isPositive ? (
										<TrendingUp className="w-3 h-3" />
									) : (
										<TrendingDown className="w-3 h-3" />
									)}
									{isPositive ? '+' : ''}
									{displayChange.toFixed(2)}%
								</span>
							</div>
							<p
								className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
									isPositive
										? 'text-emerald-500 dark:text-emerald-400'
										: 'text-red-500 dark:text-red-400'
								}`}
							>
								$
								{displayPrice.toLocaleString('en-US', {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2,
								})}
							</p>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-8">
						<span className="text-sm text-muted-foreground font-medium">
							Vol.{' '}
							<strong className="text-foreground">
								{typeof volume === 'number' ? volume.toLocaleString() : volume}
							</strong>
						</span>

						<div className="flex items-center gap-0.5 bg-muted/60 border border-border rounded-xl p-1">
							{(Object.keys(TIMEFRAME_MAP) as Timeframe[]).map((tf) => (
								<button
									key={tf}
									onClick={() => setTimeframe(tf)}
									className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
										timeframe === tf
											? 'bg-foreground text-background shadow-sm'
											: 'text-muted-foreground hover:text-foreground'
									}`}
								>
									{tf}
								</button>
							))}
						</div>
					</div>
				</div>

				<div
					ref={chartContainerRef}
					className="w-full h-52 sm:h-64 rounded-2xl overflow-hidden border border-border"
				/>
			</div>
		</div>
	);
}
