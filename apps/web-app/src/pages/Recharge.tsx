import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useInitPaymentMutation } from '@/hooks/mutations/payment';
// @ts-ignore
import { load } from '@cashfreepayments/cashfree-js';

export default function RechargePage() {
	const [amount, setAmount] = useState<number | null>(null);

	const { mutate, isPending } = useInitPaymentMutation();

	const handleQuickSelect = (value: number) => {
		setAmount(value);
	};

	const handleSubmit = async () => {
		if (!amount || amount <= 0) {
			alert('Please enter a valid amount greater than 0');
			return;
		}
		mutate(amount, {
			onSuccess: async (res) => {
				const paymentSessionId =
					res?.data?.payment_session_id ||
					res?.payment_session_id ||
					res?.data?.data?.payment_session_id;

				if (paymentSessionId) {
					try {
						const cashfree = await load({ mode: 'sandbox' });
						cashfree.checkout({
							paymentSessionId,
							redirectTarget: '_self',
						});
					} catch (err) {
						console.error('Failed to load Cashfree SDK', err);
						alert('Failed to initialize payment gateway.');
					}
				} else {
					alert('Failed to initialize payment gateway.');
				}
			},
			onError: (err) => {
				console.error(err);
				alert('Failed to create payment order');
			},
		});
	};

	return (
		<div className="w-full flex justify-center bg-[#f4f4f5] dark:bg-[#090C1A] md:py-24 py-20 min-h-screen transition-colors">
			<div className="max-w-227.5 w-full px-4">
				<h1 className="text-4xl font-semibold md:mb-8 mb-4 text-gray-900 dark:text-white">
					Deposit
				</h1>

				<div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 max-w-137.5 rounded-xl py-6 px-4 space-y-6 transition-colors shadow-sm">
					<div className="space-y-2">
						<div className="text-base font-semibold text-gray-900 dark:text-white">
							Deposit amount
						</div>
						<input
							type="number"
							placeholder="0"
							value={amount ?? ''}
							disabled={isPending}
							onChange={(e) => setAmount(e.target.value ? parseFloat(e.target.value) : null)}
							className="w-full border rounded-md px-4 md:py-2 py-1 focus:outline-none border-blue-600 dark:border-blue-500 bg-white dark:bg-[#090C1A] text-black dark:text-white text-2xl placeholder:text-2xl disabled:opacity-60"
						/>
					</div>

					<div className="flex gap-2">
						{[50, 100, 500, 1000].map((preset) => (
							<button
								key={preset}
								type="button"
								disabled={isPending}
								onClick={() => handleQuickSelect(preset)}
								className="bg-white dark:bg-white/10 text-black dark:text-white border border-gray-400/20 dark:border-white/10 md:px-4 px-3 md:py-2 py-1 text-sm font-semibold rounded-md transition disabled:opacity-60 cursor-pointer"
							>
								+{preset}
							</button>
						))}
					</div>

					<div>
						<button
							onClick={handleSubmit}
							disabled={!amount || amount <= 0 || isPending}
							className={`w-full py-3 rounded-md text-sm font-semibold transition flex items-center justify-center ${
								!amount || amount <= 0 || isPending
									? 'bg-[#ABABAB] dark:bg-white/10 text-white dark:text-gray-500 cursor-not-allowed disabled:opacity-50'
									: 'bg-black text-white hover:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-gray-200 cursor-pointer'
							}`}
						>
							{isPending ? <Loader2 className="animate-spin w-5 h-5" /> : 'Recharge'}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
