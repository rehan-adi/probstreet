import { toast } from 'sonner';
import { useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createOrUpdatePriceAlert } from '@/api/price-alerts';

interface PriceAlertModalProps {
	isOpen: boolean;
	onClose: () => void;
	marketId: string;
	title: string;
	yesPrice: number;
	noPrice: number;
}

export default function PriceAlertModal({
	isOpen,
	onClose,
	marketId,
	title,
	yesPrice,
	noPrice,
}: PriceAlertModalProps) {
	const [stockType, setStockType] = useState<'YES' | 'NO'>('YES');
	const [targetPrice, setTargetPrice] = useState<string>('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	if (!isOpen) return null;

	const currentPrice = stockType === 'YES' ? yesPrice : noPrice;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		const price = parseFloat(targetPrice);
		if (isNaN(price) || price < 0.5 || price > 9.5) {
			toast.error('Please enter a valid price between ₹0.5 and ₹9.5');
			return;
		}

		try {
			setIsSubmitting(true);
			const res = await createOrUpdatePriceAlert({
				marketId,
				stockType,
				targetPrice: price,
			});

			if (res.success) {
				toast.success('Price alert set successfully!');
				onClose();
			} else {
				toast.error(res.error || 'Failed to set price alert');
			}
		} catch (error: any) {
			console.error('Failed to set alert:', error);
			toast.error(error?.response?.data?.error || 'Failed to set price alert');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<AnimatePresence>
			<div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
				<motion.div
					initial={{ opacity: 0, scale: 0.95, y: 10 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.95, y: 10 }}
					className="w-full max-w-md bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-xl border border-gray-200 dark:border-white/10 overflow-hidden"
				>
					<div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-white/5">
						<h3 className="font-bold flex items-center gap-2">Set Price Alert</h3>
						<button
							onClick={onClose}
							className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
						>
							<X size={20} />
						</button>
					</div>

					<div className="p-5">
						<div className="mb-6">
							<p className="text-base font-semibold text-foreground line-clamp-2">{title}</p>
						</div>

						<form onSubmit={handleSubmit} className="space-y-6">
							<div className="space-y-3 mb-8">
								<div className="grid grid-cols-2 gap-3">
									<button
										type="button"
										onClick={() => setStockType('YES')}
										className={`text-green-700 dark:text-green-400 cursor-pointer bg-green-50 dark:bg-green-900/30 text-sm px-3 py-3 rounded-md w-full font-bold ${
											stockType === 'YES' ? 'opacity-100' : 'opacity-50'
										}`}
									>
										Yes ₹{yesPrice.toFixed(1)}
									</button>
									<button
										type="button"
										onClick={() => setStockType('NO')}
										className={`text-red-700 dark:text-red-400 cursor-pointer bg-red-50 dark:bg-red-900/30 text-sm px-3 py-3 rounded-md w-full font-bold ${
											stockType === 'NO' ? 'opacity-100' : 'opacity-50'
										}`}
									>
										No ₹{noPrice.toFixed(1)}
									</button>
								</div>
							</div>

							<div className="space-y-2">
								<div className="flex justify-between items-end mb-2">
									<label className="text-xs font-medium text-gray-500 dark:text-gray-200 uppercase tracking-wider">
										Target Price
									</label>
									<span className="text-xs text-gray-500 dark:text-gray-200 font-medium uppercase">
										Current: ₹{currentPrice.toFixed(1)}
									</span>
								</div>
								<input
									type="number"
									step="0.1"
									min="0.5"
									max="9.5"
									value={targetPrice}
									onChange={(e) => setTargetPrice(e.target.value)}
									placeholder="Enter price in ₹ (e.g. 5.5)"
									className="w-full border border-border rounded-lg py-3 px-3 text-sm font-medium text-foreground focus:outline-none focus:border-foreground"
									required
								/>
							</div>

							<button
								type="submit"
								disabled={isSubmitting || !targetPrice}
								className="w-full py-2.5 bg-black dark:bg-white text-white dark:text-black font-semibold text-sm rounded-lg disabled:opacity-50 flex items-center justify-center cursor-pointer"
							>
								{isSubmitting ? (
									<div className="w-4 h-4 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin" />
								) : (
									'Set Alert'
								)}
							</button>
						</form>
					</div>
				</motion.div>
			</div>
		</AnimatePresence>
	);
}
