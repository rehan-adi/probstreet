import { api } from '@/lib/axios';
import { socket } from '@/socket';
import { Bookmark, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useEffect, useState } from 'react';
import { useModalStore } from '@/store/modal';
import downloadIcon from '@/assets/images/download.avif';
import defaultThumbnail from '@/assets/images/logo.avif';
import barChartIcon from '@/assets/images/Bar_Chart.avif';
import { useNavigate, useSearchParams } from 'react-router-dom';

const formatVolume = (vol: number) => {
	if (!vol) return '0';
	return vol.toLocaleString('en-IN');
};

export default function EventsPage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const [events, setEvents] = useState<any[]>([]);
	const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

	const { user, isAuthenticated } = useAuthStore();
	const { openOnboardModal } = useModalStore();

	const selectedCategoryName = searchParams.get('category') || 'All Events';

	useEffect(() => {
		const fetchEvents = async () => {
			try {
				let url = '/market';
				if (selectedCategoryName !== 'All Events') {
					url = `/market/category/${selectedCategoryName}`;
				}
				const response = await api.get(url);
				setEvents(response.data.data);
			} catch (err) {
				console.error('Error fetching events:', err);
			}
		};

		fetchEvents();
	}, [selectedCategoryName]);

	useEffect(() => {
		if (isAuthenticated) {
			api
				.get('/profile/watchlist')
				.then((res) => {
					if (res.data?.success) {
						const ids = new Set<string>(res.data.data.map((m: any) => m.id));
						setBookmarkedIds(ids);
					}
				})
				.catch((err) => console.error('Error fetching watchlist', err));
		}
	}, [isAuthenticated]);

	useEffect(() => {
		if (events.length === 0) return;

		if (!socket.connected) {
			socket.connect();
		}

		const symbols = events.map((event) => event.symbol).filter(Boolean);
		const onConnect = () => {
			if (symbols.length > 0) {
				socket.emit('SUBSCRIBE_TICKERS', symbols);
			}
		};

		if (socket.connected) {
			onConnect();
		} else {
			socket.connect();
		}

		socket.on('connect', onConnect);

		const handleTicker = (data: any) => {
			if (data.type && data.type !== 'TICKER') return;
			setEvents((prev) =>
				prev.map((event) => {
					if (event.symbol === data.symbol || event.symbol === data.Symbol) {
						return {
							...event,
							yesPrice: data.yesPrice ?? event.yesPrice,
							noPrice: data.noPrice ?? event.noPrice,
							volume: data.volume ?? event.volume,
							numberOfTraders: data.numberOfTraders ?? data.traders ?? event.numberOfTraders,
						};
					}
					return event;
				}),
			);
		};

		socket.on('TICKER', handleTicker);
		socket.on('MESSAGE', handleTicker);

		return () => {
			if (symbols.length > 0) {
				socket.emit('UNSUBSCRIBE_TICKERS', symbols);
			}
			socket.off('TICKER', handleTicker);
			socket.off('MESSAGE', handleTicker);
			socket.off('connect', onConnect);
		};
	}, [events.length]);

	const toggleBookmark = async (e: React.MouseEvent, marketId: string) => {
		e.stopPropagation();
		if (!isAuthenticated) {
			openOnboardModal();
			return;
		}

		try {
			if (bookmarkedIds.has(marketId)) {
				await api.delete(`/profile/watchlist/${marketId}`);
				setBookmarkedIds((prev) => {
					const next = new Set(prev);
					next.delete(marketId);
					return next;
				});
			} else {
				await api.post('/profile/watchlist', { marketId });
				setBookmarkedIds((prev) => {
					const next = new Set(prev);
					next.add(marketId);
					return next;
				});
			}
		} catch (error) {
			console.error('Failed to toggle bookmark', error);
		}
	};

	return (
		<div className="w-full bg-gray-50 dark:bg-[#090C1A] min-h-screen px-6">
			<div className="max-w-7xl mx-auto py-6 md:py-8 flex flex-col gap-6">
				<div className="flex gap-16">
					<div className="w-full">
						<h1 className="text-xl font-semibold border-b border-gray-200 dark:border-gray-800 pb-3 mb-4 text-gray-900 dark:text-white">
							{selectedCategoryName}
						</h1>
						<div
							className={`flex-1 grid grid-cols-1 md:grid-cols-2 ${!user ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-4`}
						>
							{events.length > 0 ? (
								events.map((event, idx) => (
									<div
										key={idx}
										onClick={() => navigate(`/events/${event.symbol}`)}
										className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 cursor-pointer rounded-xl p-4 flex flex-col justify-between gap-0 h-57.5 transition-colors"
									>
										<div className="">
											<div className="flex items-center text-gray-600 dark:text-gray-400">
												<img src={barChartIcon} className="w-4 h-4 mr-1" />
												<p className="text-xs">{event.numberOfTraders || 0} traders</p>
											</div>

											<div className="flex gap-3 mt-4">
												<img
													src={event.thumbnail || defaultThumbnail}
													alt={event.title}
													className="w-14 h-14 object-cover rounded-lg border border-gray-100 dark:border-gray-800 shrink-0"
												/>
												<h2 className="md:text-base text-sm font-medium line-clamp-3 leading-snug overflow-hidden text-gray-900 dark:text-white">
													{event.title}
												</h2>
											</div>
										</div>

										<div className="flex flex-col gap-3">
											{['CLOSED', 'CLOSE'].includes((event.status || '').toUpperCase()) ? (
												<div className="flex items-center justify-start py-2.5 text-sm font-medium text-foreground gap-2">
													<CheckCircle2 size={16} />
													Market is resolved and the outcome is {event.result || 'Settled'}
												</div>
											) : (
												<div className="flex gap-4 w-full">
													<button className="text-green-700 dark:text-green-400 cursor-pointer bg-green-50 dark:bg-green-900/30 text-xs px-3 py-3 rounded-md w-full font-bold transition hover:bg-green-100 dark:hover:bg-green-900/50">
														Yes ₹{event.yesPrice}
													</button>
													<button className="text-red-700 dark:text-red-400 cursor-pointer bg-red-50 dark:bg-red-900/30 text-xs px-3 py-3 rounded-md w-full font-bold transition hover:bg-red-100 dark:hover:bg-red-900/50">
														No ₹{event.noPrice}
													</button>
												</div>
											)}

											<div className="flex items-center justify-between md:pt-0 pt-1">
												<p className="text-xs flex items-center justify-start gap-1.5 text-gray-500 dark:text-gray-400 font-medium">
													<span className="font-bold text-gray-900 dark:text-white">
														₹{formatVolume(event.volume || 0)} Vol.
													</span>
												</p>
												<button
													onClick={(e) => toggleBookmark(e, event.id)}
													className="p-1 text-black dark:text-white transition-colors"
												>
													<Bookmark
														size={18}
														fill={bookmarkedIds.has(event.id) ? 'currentColor' : 'transparent'}
														className="hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
													/>
												</button>
											</div>
										</div>
									</div>
								))
							) : (
								<p className="text-gray-500">No events found.</p>
							)}
						</div>
					</div>
					{!user && (
						<div className="w-157.5 rounded-xl lg:flex hide-1200 hidden items-start">
							<div className="w-full bg-[#EDEDED] dark:bg-gray-800 rounded-xl flex p-5">
								<div className="flex flex-col w-[65%] justify-center pr-4">
									<div className="inline-flex items-center gap-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-500 text-xs font-bold px-2.5 py-1 rounded-full mb-3 w-max">
										<span>🎁</span> LIMITED TIME OFFER
									</div>
									<h3 className="text-xl font-bold leading-tight mb-2 dark:text-white">
										UNLOCK UP TO ₹25 WELCOME BONUS!
									</h3>
									<p className="text-sm text-gray-600 dark:text-gray-400 mb-4 font-medium">
										Get <span className="font-semibold text-black dark:text-white">₹15</span>{' '}
										instantly on signin and{' '}
										<span className="font-semibold text-black dark:text-white">₹10</span> extra with
										a referral code.
									</p>
									<button
										onClick={openOnboardModal}
										className="bg-black dark:bg-white text-white dark:text-black font-medium text-sm px-4 py-1.5 mt-2 rounded-md hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap w-max"
									>
										Claim Reward
									</button>
								</div>
								<div className="w-[35%] flex justify-end items-center">
									<img
										src={downloadIcon}
										alt="Bonus"
										className="w-24 h-24 lg:w-28 lg:h-28 object-contain"
									/>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
