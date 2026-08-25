import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPriceAlerts, deletePriceAlert } from '@/api/price-alerts';
import { BellRing, Trash2, TrendingUp, TrendingDown, ArrowLeft } from 'lucide-react';

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

const ControlCentrePage = () => {
	const [alerts, setAlerts] = useState<PriceAlert[]>([]);
	const [loading, setLoading] = useState(true);

	const fetchAlerts = async () => {
		try {
			const res = await getPriceAlerts();
			if (res.success) {
				setAlerts(res.data.alerts);
			}
		} catch (error) {
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
		<div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
			<div className="flex items-center gap-4 border-b border-gray-200 dark:border-zinc-800 pb-4">
				<Link
					to="/wallet"
					className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition"
				>
					<ArrowLeft className="w-6 h-6" />
				</Link>
				<div className="bg-blue-500/10 p-3 rounded-2xl">
					<BellRing className="w-6 h-6 text-blue-600 dark:text-blue-400" />
				</div>
				<div>
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white">Control Centre</h1>
					<p className="text-sm text-gray-500 dark:text-zinc-400">
						Manage your active Price Alerts
					</p>
				</div>
			</div>

			{loading ? (
				<div className="flex justify-center items-center h-40">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
				</div>
			) : alerts.length === 0 ? (
				<div className="bg-white dark:bg-zinc-900/50 rounded-3xl p-12 text-center border border-gray-100 dark:border-zinc-800 backdrop-blur-xl">
					<div className="bg-gray-100 dark:bg-zinc-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
						<BellRing className="w-8 h-8 text-gray-400 dark:text-zinc-500" />
					</div>
					<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
						No Active Alerts
					</h3>
					<p className="text-gray-500 dark:text-zinc-400 max-w-sm mx-auto">
						You haven't set up any price alerts yet. Go to a market to create an alert and we'll
						notify you when the price hits your target!
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{alerts.map((alert) => (
						<div
							key={alert.id}
							className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
						>
							<div className="absolute top-0 right-0 w-32 h-32 bg-linear-to-br from-blue-500/10 to-transparent rounded-bl-full -z-10" />

							<div className="flex justify-between items-start mb-4">
								<div className="space-y-1 pr-8">
									<Link
										to={`/events/${alert.market.id}`}
										className="font-semibold text-gray-900 dark:text-white hover:text-blue-500 transition line-clamp-2"
									>
										{alert.market.title}
									</Link>
									<p className="text-xs text-gray-500 dark:text-zinc-500">
										Set on {new Date(alert.createdAt).toLocaleDateString()}
									</p>
								</div>
								<button
									onClick={() => handleDelete(alert.id)}
									className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-500/10"
								>
									<Trash2 className="w-5 h-5" />
								</button>
							</div>

							<div className="flex items-center gap-4 bg-gray-50 dark:bg-zinc-800/50 rounded-2xl p-4">
								<div className="flex-1 flex flex-col items-center">
									<span className="text-xs text-gray-500 dark:text-zinc-400 mb-1">
										Target Stock
									</span>
									<div
										className={`flex items-center gap-1 font-semibold ${alert.stockType === 'YES' ? 'text-green-500' : 'text-red-500'}`}
									>
										{alert.stockType === 'YES' ? (
											<TrendingUp className="w-4 h-4" />
										) : (
											<TrendingDown className="w-4 h-4" />
										)}
										{alert.stockType}
									</div>
								</div>

								<div className="w-px h-10 bg-gray-200 dark:bg-zinc-700" />

								<div className="flex-1 flex flex-col items-center">
									<span className="text-xs text-gray-500 dark:text-zinc-400 mb-1">
										Target Price
									</span>
									<span className="font-bold text-gray-900 dark:text-white text-lg">
										₹{alert.targetPrice.toFixed(1)}
									</span>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default ControlCentrePage;
