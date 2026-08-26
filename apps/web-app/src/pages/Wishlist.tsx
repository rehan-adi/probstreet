import { api } from '@/lib/axios';
import { socket } from '@/socket';
import { Bookmark } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { useNavigate } from 'react-router-dom';
import defaultThumbnail from '@/assets/images/logo.avif';
import barChartIcon from '@/assets/images/Bar_Chart.avif';

const formatVolume = (vol: number) => {
	if (!vol) return '0';
	return vol.toLocaleString('en-IN');
};

export default function WishlistPage() {
	const navigate = useNavigate();
	const [events, setEvents] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	const { isAuthenticated } = useAuthStore();

	useEffect(() => {
		if (isAuthenticated) {
			api
				.get('/profile/watchlist')
				.then((res) => {
					if (res.data?.success) {
						setEvents(res.data.data);
					}
				})
				.catch((err) => console.error('Error fetching watchlist', err))
				.finally(() => setLoading(false));
		} else {
			setLoading(false);
		}
	}, [isAuthenticated]);

	useEffect(() => {
		if (events.length === 0) return;

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

	const removeBookmark = async (e: React.MouseEvent, marketId: string) => {
		e.stopPropagation();
		if (!isAuthenticated) return;

		try {
			await api.delete(`/profile/watchlist/${marketId}`);
			setEvents((prev) => prev.filter((event) => event.id !== marketId));
		} catch (error) {
			console.error('Failed to remove bookmark', error);
		}
	};

	return (
		<>
			<div className="w-full bg-gray-50 dark:bg-[#090C1A] min-h-screen px-6">
				<div className="max-w-7xl mx-auto py-6 md:py-8 flex flex-col gap-6">
					<div className="flex gap-16">
						<div className="w-full">
							<h1 className="text-xl font-semibold border-b border-gray-200 dark:border-gray-800 pb-3 mb-4 text-gray-900 dark:text-white">
								My Wishlist
							</h1>

							{loading ? (
								<p className="text-gray-500">Loading wishlist...</p>
							) : events.length > 0 ? (
								<div className={`flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`}>
									{events.map((event, idx) => (
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
												<div className="flex gap-4 w-full">
													<button className="text-green-700 dark:text-green-400 cursor-pointer bg-green-50 dark:bg-green-900/30 text-xs px-3 py-3 rounded-md w-full font-bold transition hover:bg-green-100 dark:hover:bg-green-900/50">
														Yes ₹{event.yesPrice}
													</button>
													<button className="text-red-700 dark:text-red-400 cursor-pointer bg-red-50 dark:bg-red-900/30 text-xs px-3 py-3 rounded-md w-full font-bold transition hover:bg-red-100 dark:hover:bg-red-900/50">
														No ₹{event.noPrice}
													</button>
												</div>

												<div className="flex items-center justify-between md:pt-0 pt-1">
													<p className="text-xs flex items-center justify-start gap-1.5 text-gray-500 dark:text-gray-400 font-medium">
														<span className="font-bold text-gray-900 dark:text-white">
															₹{formatVolume(event.volume || 0)} Vol.
														</span>
													</p>
													<button
														onClick={(e) => removeBookmark(e, event.id)}
														className="p-1 text-black dark:text-white transition-colors"
													>
														<Bookmark
															size={18}
															fill="currentColor"
															className="hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
														/>
													</button>
												</div>
											</div>
										</div>
									))}
								</div>
							) : (
								<p className="text-gray-500">Your wishlist is empty.</p>
							)}
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
