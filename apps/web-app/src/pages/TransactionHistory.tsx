import { useState } from 'react';
import {
	ChevronRight,
	Loader2,
	ArrowUpRight,
	ArrowDownLeft,
	Clock,
	CheckCircle2,
	XCircle,
} from 'lucide-react';
import { useGetTransactionHistoryQuery } from '@/hooks/queries/transaction';
import { formatAmount } from '@/lib/format';

const tabs = ['All', 'Deposit', 'Withdraw'];

export default function TransactionHistoryPage() {
	const [selectedTab, setSelectedTab] = useState('All');

	const { data, isLoading, isError } = useGetTransactionHistoryQuery();

	const transactions = data?.data.data || [];

	const isDebit = (type: string) => {
		return ['WITHDRAWAL', 'TRADE_LOSS', 'FEE', 'BUY'].includes(type);
	};

	const filteredTransactions = transactions.filter((t: any) => {
		if (selectedTab === 'All') return true;
		const debit = isDebit(t.type);
		return selectedTab === 'Deposit' ? !debit : debit;
	});

	const getStatusDisplay = (status: string) => {
		switch (status) {
			case 'SUCCESS':
				return (
					<span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
						<CheckCircle2 className="w-3 h-3" />
						SUCCESS
					</span>
				);
			case 'PENDING':
				return (
					<span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
						<Clock className="w-3 h-3 animate-spin" />
						PENDING
					</span>
				);
			case 'FAILED':
				return (
					<span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400">
						<XCircle className="w-3 h-3" />
						FAILED
					</span>
				);
			default:
				return (
					<span className="text-xs font-medium text-gray-600 dark:text-gray-400">{status}</span>
				);
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen flex bg-[#f4f4f5] dark:bg-[#090C1A] items-center justify-center transition-colors">
				<p className="text-gray-600 dark:text-gray-400">
					<Loader2 className="animate-spin w-6 h-6" />
				</p>
			</div>
		);
	}

	if (isError) {
		return (
			<div className="min-h-screen flex bg-[#f4f4f5] dark:bg-[#090C1A] items-center justify-center transition-colors">
				<p className="text-red-600 dark:text-red-400">Failed to load transaction history.</p>
			</div>
		);
	}

	return (
		<div className="w-full min-h-screen bg-[#f4f4f5] dark:bg-[#090C1A] py-20 flex justify-center text-gray-900 dark:text-white transition-colors">
			<div className="w-full max-w-4xl px-4">
				{/* Breadcrumb */}
				<nav className="text-base mt-4 mb-8">
					<ol className="list-reset flex items-center text-gray-500 dark:text-gray-400 space-x-0.5">
						<li>
							<a href="/" className="hover:underline">
								Home
							</a>
						</li>
						<ChevronRight size={20} />
						<li>
							<a href="/wallet" className="hover:underline">
								Wallet
							</a>
						</li>
						<ChevronRight size={20} />
						<li className="text-gray-900 dark:text-white font-medium">Transaction History</li>
					</ol>
				</nav>

				<h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
					Transaction History
				</h2>

				<div className="flex items-center border-b border-t border-gray-400/25 dark:border-white/10 py-3 justify-between flex-wrap">
					<div className="flex items-center space-x-2 mt-4 md:mt-0">
						{tabs.map((tab) => (
							<button
								key={tab}
								onClick={() => setSelectedTab(tab)}
								className={`px-4 py-1.5 rounded-md text-sm transition-colors cursor-pointer ${
									selectedTab === tab
										? 'bg-[#262626] dark:bg-white text-white dark:text-black font-semibold shadow-xs'
										: 'bg-white dark:bg-[#1C1C1E] border border-gray-400/20 dark:border-white/10 text-gray-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
								}`}
							>
								{tab}
							</button>
						))}
					</div>
				</div>

				{/* Transactions Section */}
				<div className="space-y-4">
					{/* Header */}
					<div className="flex justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 py-4 border-b border-gray-400/25 dark:border-white/10 uppercase tracking-wide">
						<p className="md:w-[50%] w-[40%]">Transaction Details</p>
						<div className="md:w-[50%] w-[60%] flex justify-between items-center">
							<p className="w-1/3 text-center">Ref ID</p>
							<p className="w-1/3 text-center">Status</p>
							<p className="w-1/3 text-right">Amount</p>
						</div>
					</div>

					{filteredTransactions.map((txn: any) => {
						const debit = isDebit(txn.type);
						return (
							<div
								key={txn.id}
								className="py-4 border-b border-gray-400/25 dark:border-white/10 hover:bg-black/2 dark:hover:bg-white/2 transition-colors rounded-lg px-2"
							>
								<div className="flex justify-between items-center">
									{/* Transaction Type & Details */}
									<div className="md:w-[50%] w-[40%] flex items-start gap-3">
										<div
											className={`p-2 rounded-full mt-0.5 ${
												debit
													? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
													: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
											}`}
										>
											{debit ? (
												<ArrowUpRight className="w-4 h-4" />
											) : (
												<ArrowDownLeft className="w-4 h-4" />
											)}
										</div>
										<div className="flex flex-col gap-0.5 overflow-hidden">
											<p className="text-sm font-bold text-gray-900 dark:text-white">{txn.type}</p>
											<p className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-xs md:max-w-md">
												{txn.remarks || (debit ? 'Funds withdrawn' : 'Funds added to wallet')}
											</p>
											<p className="text-[11px] text-gray-400 dark:text-gray-500">
												{txn.createdAt
													? new Date(txn.createdAt).toLocaleString('en-US', {
															month: 'short',
															day: 'numeric',
															year: 'numeric',
															hour: 'numeric',
															minute: 'numeric',
															hour12: true,
														})
													: 'N/A'}
											</p>
										</div>
									</div>

									{/* Order ID, Status, Amount */}
									<div className="md:w-[50%] w-[60%] flex justify-between items-center">
										<p className="w-1/3 text-center text-xs text-gray-600 dark:text-gray-400 font-mono">
											{txn.id.slice(0, 8).toUpperCase()}
										</p>

										<div className="w-1/3 flex justify-center">{getStatusDisplay(txn.status)}</div>

										<p
											className={`w-1/3 text-right font-mono font-bold text-sm md:text-base ${
												debit
													? 'text-red-600 dark:text-red-400'
													: 'text-emerald-600 dark:text-emerald-400'
											}`}
										>
											{debit ? `-₹${formatAmount(txn.amount)}` : `+₹${formatAmount(txn.amount)}`}
										</p>
									</div>
								</div>
							</div>
						);
					})}

					{filteredTransactions.length === 0 && (
						<p className="text-center text-gray-500 dark:text-gray-400 text-sm py-12">
							No transactions found.
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
