import { api } from '@/lib/axios';
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { createChart, ColorType, AreaSeries } from 'lightweight-charts';
import { ArrowRightLeft, Clock, Users, TrendingUp, Settings2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface TimelineProps {
	symbol: string;
	yesPrice: number;
	noPrice: number;
	volume?: number;
	traders?: number;
	overview?: { EndDate: string };
}

type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export default function TimelineChart({
	symbol,
	yesPrice,
	noPrice,
	volume = 0,
	traders = 0,
	overview,
}: TimelineProps) {
	const chartContainerRef = useRef<HTMLDivElement>(null);
	const [view, setView] = useState<'yes' | 'no'>('yes');
	const [timeframe, setTimeframe] = useState<Timeframe>('1m');

	const [showGridX, setShowGridX] = useState(true);
	const [showGridY, setShowGridY] = useState(true);
	const [showCrosshair, setShowCrosshair] = useState(true);
	const [isLogScale, setIsLogScale] = useState(false);
	const [isDarkTheme, setIsDarkTheme] = useState(() =>
		document.documentElement.classList.contains('dark'),
	);
	const [fillArea, setFillArea] = useState(true);
	const [isDarkChart, setIsDarkChart] = useState(false);

	const chartRef = useRef<IChartApi | null>(null);
	const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
	const [loading, setLoading] = useState(true);

	const fetchKlines = async (tf: string) => {
		try {
			setLoading(true);
			const res = await api.get(`/market/${symbol}/klines?resolution=${tf}`);
			if (res.data?.success) {
				const rawData = res.data.data || [];

				const data = rawData
					.map((d: any) => ({
						time: (Math.floor(new Date(d.time).getTime() / 1000) -
							new Date().getTimezoneOffset() * 60) as Time,
						value: view === 'yes' ? Number(d.close) : 10 - Number(d.close),
					}))
					.sort((a: any, b: any) => (a.time as number) - (b.time as number));

				// If there's only 1 data point, an AreaSeries won't render properly. We duplicate it slightly in the past.
				if (data.length === 1) {
					data.unshift({
						time: ((data[0].time as number) - 60) as Time,
						value: data[0].value,
					});
				}

				if (seriesRef.current) {
					seriesRef.current.setData(data);

					// Important: Fit content so it scales properly to view
					chartRef.current?.timeScale().fitContent();
				}
			}
		} catch (error) {
			console.error('Failed to fetch klines', error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!chartContainerRef.current) return;

		const handleResize = () => {
			chartRef.current?.applyOptions({
				width: chartContainerRef.current?.clientWidth,
			});
		};

		// Check if dark mode is active to dynamically adapt colors
		const isDark = document.documentElement.classList.contains('dark');
		const textColor = isDark ? '#a1a1aa' : '#71717a';
		const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

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
				background: { type: ColorType.Solid, color: 'transparent' },
				textColor: textColor,
			},
			grid: {
				vertLines: { visible: showGridX, color: gridColor },
				horzLines: { visible: showGridY, color: gridColor },
			},
			rightPriceScale: {
				borderVisible: false,
				mode: isLogScale ? 1 : 0,
			},
			timeScale: {
				borderVisible: false,
				timeVisible: true,
			},
			crosshair: {
				vertLine: {
					visible: showCrosshair,
					width: 1,
					color: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
				},
				horzLine: {
					visible: showCrosshair,
					width: 1,
					color: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
				},
			},
			width: chartContainerRef.current.clientWidth,
			height: 288,
		});

		chartRef.current = chart;

		const series = chart.addSeries(AreaSeries, {
			lineColor: isDarkChart
				? isDarkTheme
					? '#ffffff'
					: '#000000'
				: view === 'yes'
					? '#22c55e'
					: '#ef4444',
			topColor: isDarkChart
				? isDarkTheme
					? 'rgba(255, 255, 255, 0.4)'
					: 'rgba(0, 0, 0, 0.4)'
				: view === 'yes'
					? 'rgba(34, 197, 94, 0.4)'
					: 'rgba(239, 68, 68, 0.4)',
			bottomColor: 'rgba(0, 0, 0, 0)',
			lineWidth: 2,
			priceFormat: {
				type: 'price',
				precision: 1,
				minMove: 0.1,
			},
			lastPriceAnimation: 1,
		});
		seriesRef.current = series;

		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			chart.remove();
		};
	}, [view]);

	useEffect(() => {
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.attributeName === 'class') {
					setIsDarkTheme(document.documentElement.classList.contains('dark'));
				}
			}
		});

		observer.observe(document.documentElement, { attributes: true });

		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (chartRef.current) {
			const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
			chartRef.current.applyOptions({
				layout: { textColor: isDarkTheme ? '#a1a1aa' : '#71717a' },
				grid: {
					vertLines: { visible: showGridX, color: gridColor },
					horzLines: { visible: showGridY, color: gridColor },
				},
				crosshair: {
					vertLine: {
						visible: showCrosshair,
						color: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
					},
					horzLine: {
						visible: showCrosshair,
						color: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
					},
				},
				rightPriceScale: {
					mode: isLogScale ? 1 : 0, // 1 for Logarithmic, 0 for Normal
				},
			});
		}
	}, [showGridX, showGridY, showCrosshair, isLogScale, isDarkTheme]);

	useEffect(() => {
		if (seriesRef.current) {
			const lineColor = isDarkChart
				? isDarkTheme
					? '#ffffff'
					: '#000000'
				: view === 'yes'
					? '#22c55e'
					: '#ef4444';

			const topColor = isDarkChart
				? isDarkTheme
					? 'rgba(255, 255, 255, 0.4)'
					: 'rgba(0, 0, 0, 0.4)'
				: view === 'yes'
					? 'rgba(34, 197, 94, 0.4)'
					: 'rgba(239, 68, 68, 0.4)';

			seriesRef.current.applyOptions({
				lineColor: lineColor,
				topColor: fillArea ? topColor : 'rgba(0, 0, 0, 0)',
			});
		}
	}, [fillArea, view, isDarkChart, isDarkTheme]);

	useEffect(() => {
		fetchKlines(timeframe);
	}, [symbol, timeframe, view]);

	useEffect(() => {
		// Real-time update
		if (seriesRef.current) {
			const value = view === 'yes' ? yesPrice : noPrice;
			const currentTime = (Math.floor(Date.now() / 1000) -
				new Date().getTimezoneOffset() * 60) as Time;

			// We try to update, if lightweight charts throws an error because of time being older, we catch it
			try {
				seriesRef.current.update({
					time: currentTime,
					value: value,
				});
			} catch (e) {
				console.log('Skipping real-time update due to time constraint');
			}
		}
	}, [yesPrice, noPrice, view]);

	const yesProb = yesPrice * 10;
	const noProb = noPrice * 10;

	const getRemainingTime = (endDateStr?: string) => {
		if (!endDateStr) return '--';
		const end = new Date(endDateStr).getTime();
		const now = Date.now();
		const diff = end - now;
		if (diff <= 0) return 'Ended';

		const hours = Math.floor(diff / (1000 * 60 * 60));
		if (hours > 0) return `${hours}h`;
		const minutes = Math.floor(diff / (1000 * 60));
		return `${minutes}m`;
	};

	return (
		<Card className="bg-white dark:bg-[#090C1A] rounded-2xl border shadow-none relative overflow-hidden group">
			<div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-border to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

			<div className="flex items-center justify-between py-1 px-4">
				<div className="flex items-center gap-3">
					<button
						onClick={() => setView(view === 'yes' ? 'no' : 'yes')}
						className={`p-2.5 rounded-xl cursor-pointer transition-all duration-300 shadow-sm ${view === 'yes' ? 'bg-green-500/10 hover:bg-green-500/20' : 'bg-red-500/10 hover:bg-red-500/20'}`}
					>
						<ArrowRightLeft
							className={`h-4 w-4 ${view === 'yes' ? 'text-green-500' : 'text-red-500'}`}
						/>
					</button>

					<div className="flex flex-col items-start font-semibold text-xs text-muted-foreground tracking-wide">
						{view.toUpperCase()} PROBABILITY
						<span
							className={`text-lg font-bold tracking-tight ${view === 'yes' ? 'text-green-500' : 'text-red-500'}`}
						>
							{view === 'yes' ? Math.round(yesProb) : Math.round(noProb)}%
						</span>
					</div>
				</div>
			</div>

			<CardContent className="grid gap-2 relative">
				<div className="relative h-72 w-full flex rounded-lg overflow-hidden">
					{loading && (
						<div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10 transition-all duration-300">
							<div className="flex flex-col items-center gap-2">
								<div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
								<span className="text-muted-foreground text-xs font-medium">
									Loading historical data...
								</span>
							</div>
						</div>
					)}
					<div className="flex-1" ref={chartContainerRef} />
				</div>

				<div className="flex flex-col md:flex-row items-center justify-between mt-2 pt-4 border-t border-border/40 gap-4">
					<div className="flex items-center gap-5 text-xs font-medium w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
						<div className="flex items-center gap-1.5 whitespace-nowrap px-1">
							<TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
							<span className="text-foreground">₹{(volume || 0).toLocaleString()}</span>
						</div>
						<div className="flex items-center gap-1.5 whitespace-nowrap px-1">
							<Clock className="w-3.5 h-3.5 text-muted-foreground" />
							<span className="text-muted-foreground">
								Expires in {getRemainingTime(overview?.EndDate)}
							</span>
						</div>
						<div className="flex items-center gap-1.5 whitespace-nowrap px-1">
							<Users className="w-3.5 h-3.5 text-muted-foreground" />
							<span className="text-muted-foreground">{traders || 0}</span>
						</div>
					</div>

					<div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
						<div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border/50">
							{(['1m', '5m', '15m', '1h', '4h', '1d'] as Timeframe[]).map((tf) => (
								<button
									key={tf}
									onClick={() => setTimeframe(tf)}
									className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all duration-200 cursor-pointer ${timeframe === tf ? 'bg-background text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
								>
									{tf.toUpperCase()}
								</button>
							))}
							<Popover>
								<PopoverTrigger asChild>
									<button className="px-2 py-1.5 ml-1 cursor-pointer text-muted-foreground hover:text-foreground transition-colors border-l border-border/50 pl-3">
										<Settings2 className="w-4 h-4" />
									</button>
								</PopoverTrigger>
								<PopoverContent className="w-56 p-3" align="end">
									<div className="space-y-3">
										<h4 className="font-medium text-sm leading-none mb-3">Chart Settings</h4>

										<div className="space-y-2">
											<div className="flex items-center justify-between">
												<label
													htmlFor="dark-chart"
													className="text-xs text-muted-foreground font-medium cursor-pointer"
												>
													Premium Charts
												</label>
												<input
													id="dark-chart"
													type="checkbox"
													checked={isDarkChart}
													onChange={(e) => setIsDarkChart(e.target.checked)}
													className="accent-primary w-3.5 h-3.5 rounded-sm"
												/>
											</div>
											<div className="flex items-center justify-between">
												<label
													htmlFor="fill-area"
													className="text-xs text-muted-foreground font-medium"
												>
													Fill Area
												</label>
												<input
													id="fill-area"
													type="checkbox"
													checked={fillArea}
													onChange={(e) => setFillArea(e.target.checked)}
													className="accent-primary w-3.5 h-3.5 rounded-sm"
												/>
											</div>
											<div className="flex items-center justify-between">
												<label
													htmlFor="crosshair"
													className="text-xs text-muted-foreground font-medium"
												>
													Crosshair
												</label>
												<input
													id="crosshair"
													type="checkbox"
													checked={showCrosshair}
													onChange={(e) => setShowCrosshair(e.target.checked)}
													className="accent-primary w-3.5 h-3.5 rounded-sm"
												/>
											</div>
											<div className="flex items-center justify-between">
												<label
													htmlFor="log-scale"
													className="text-xs text-muted-foreground font-medium"
												>
													Logarithmic Scale
												</label>
												<input
													id="log-scale"
													type="checkbox"
													checked={isLogScale}
													onChange={(e) => setIsLogScale(e.target.checked)}
													className="accent-primary w-3.5 h-3.5 rounded-sm"
												/>
											</div>
											<div className="h-px bg-border/50 w-full my-2"></div>
											<div className="flex items-center justify-between">
												<label
													htmlFor="grid-x"
													className="text-xs text-muted-foreground font-medium"
												>
													Vertical Grid
												</label>
												<input
													id="grid-x"
													type="checkbox"
													checked={showGridX}
													onChange={(e) => setShowGridX(e.target.checked)}
													className="accent-primary w-3.5 h-3.5 rounded-sm"
												/>
											</div>
											<div className="flex items-center justify-between">
												<label
													htmlFor="grid-y"
													className="text-xs text-muted-foreground font-medium"
												>
													Horizontal Grid
												</label>
												<input
													id="grid-y"
													type="checkbox"
													checked={showGridY}
													onChange={(e) => setShowGridY(e.target.checked)}
													className="accent-primary w-3.5 h-3.5 rounded-sm"
												/>
											</div>
										</div>
									</div>
								</PopoverContent>
							</Popover>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
