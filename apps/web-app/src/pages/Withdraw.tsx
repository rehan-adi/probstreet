import { toast } from 'sonner';
import { useState } from 'react';
import {
	Loader2,
	AlertCircle,
	Clock,
	CheckCircle2,
	XCircle,
	Eye,
	EyeOff,
	ArrowRight,
	Copy,
	Check,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatAmount } from '@/lib/format';
import { useBalanceQuery } from '@/hooks/queries/balance';
import { useWithdrawMutation } from '@/hooks/mutations/balance';
import { useGetVerificationDetails } from '@/hooks/queries/verification';
import { useGetTransactionHistoryQuery } from '@/hooks/queries/transaction';

export default function WithdrawPage() {
	const [amount, setAmount] = useState<number | null>(null);
	const [showSecret, setShowSecret] = useState(false);
	const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

	const { data: balanceData } = useBalanceQuery();
	const { data: verificationData, isLoading: isLoadingVerification } = useGetVerificationDetails();
	const { mutate, isPending } = useWithdrawMutation();
	const { data: transactionData, refetch: refetchTransactions } = useGetTransactionHistoryQuery();

	const currentWalletAmount = Number(balanceData?.data?.data?.amount || 0);
	const paymentMethods = verificationData?.data?.data?.paymentMethods || [];
	const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

	const paymentMethod =
		paymentMethods.find((p: any) => p.id === selectedMethodId) || paymentMethods[0];
	const isMethodVerified = paymentMethod?.status === 'VERIFIED';

	const withdrawalHistory =
		transactionData?.data?.data?.transactions?.filter((tx: any) => tx.type === 'WITHDRAWAL') || [];

	// Fee calculations: 0.25% min 5 max 100
	const requestedAmount = amount || 0;
	const fee = requestedAmount > 0 ? Math.min(Math.max(requestedAmount * 0.0025, 5), 100) : 0;
	const totalDeduction = requestedAmount + fee;
	const isInsufficient = totalDeduction > currentWalletAmount;

	const handlePresetClick = (presetAmount: number) => {
		setAmount(presetAmount);
	};

	const handleMaxClick = () => {
		if (currentWalletAmount <= 5) {
			setAmount(currentWalletAmount);
			return;
		}
		// Calculate maximum withdrawable where amount + fee <= currentWalletAmount
		// fee = amount * 0.0025 with min 5
		const maxAmount = Math.max(0, Math.floor(currentWalletAmount - 5));
		setAmount(maxAmount);
	};

	const handleCopy = (text: string, id: string) => {
		navigator.clipboard.writeText(text);
		setCopiedTxId(id);
		toast.success('Copied to clipboard');
		setTimeout(() => setCopiedTxId(null), 2000);
	};

	const handleSubmit = () => {
		if (!amount || amount <= 0) {
			toast.error('Please enter a valid amount greater than 0');
			return;
		}

		if (amount < 10) {
			toast.error('Minimum withdrawal amount is ₹10');
			return;
		}

		if (!paymentMethod?.id || !isMethodVerified) {
			toast.error('Please add and verify your payment method first');
			return;
		}

		if (isInsufficient) {
			toast.error('Insufficient wallet balance for withdrawal including processing fees');
			return;
		}

		mutate(
			{
				amount: String(amount),
				currentWalletAmount: String(currentWalletAmount),
				paymentMethodId: paymentMethod.id,
			},
			{
				onSuccess: () => {
					toast.success('Withdrawal request initiated successfully!');
					setAmount(null);
					refetchTransactions();
				},
				onError: (error: any) => {
					console.error('Withdrawal error:', error);
					const msg =
						error?.response?.data?.message ||
						error?.response?.data?.error ||
						'Withdrawal failed. Please try again.';
					toast.error(msg);
				},
			},
		);
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case 'SUCCESS':
				return (
					<span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
						<CheckCircle2 className="w-3.5 h-3.5" />
						Completed
					</span>
				);
			case 'PENDING':
				return (
					<span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
						<Clock className="w-3.5 h-3.5 animate-spin" />
						Processing
					</span>
				);
			case 'FAILED':
				return (
					<span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20">
						<XCircle className="w-3.5 h-3.5" />
						Failed (Refunded)
					</span>
				);
			default:
				return null;
		}
	};

	const maskAccountNumber = (acc?: string) => {
		if (!acc) return '•••• •••• ••••';
		if (showSecret) return acc;
		const last4 = acc.slice(-4);
		return `•••• •••• •••• ${last4}`;
	};

	const maskUpi = (upi?: string) => {
		if (!upi) return '••••••@upi';
		if (showSecret) return upi;
		const parts = upi.split('@');
		if (parts.length < 2) return upi;
		const handle = parts[0];
		const masked = handle.length > 3 ? `${handle.slice(0, 2)}•••${handle.slice(-1)}` : '•••';
		return `${masked}@${parts[1]}`;
	};

	return (
		<div className="w-full bg-[#f4f4f5] dark:bg-[#090C1A] flex justify-center px-4 md:py-24 py-20 transition-colors min-h-screen">
			<div className="w-full max-w-227.5 flex flex-col gap-6">
				{/* Top Header */}
				<div>
					<h1 className="text-4xl font-semibold text-gray-900 dark:text-white">Withdraw</h1>
					<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
						Transfer your winnings directly to your verified bank account or UPI
					</p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
					{/* Left Column: Withdrawal Form & Payout Card */}
					<div className="lg:col-span-7 space-y-6">
						{/* Unverified Method Notice */}
						{!isLoadingVerification && (!paymentMethod || !isMethodVerified) && (
							<div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-5 flex items-start gap-3.5 text-amber-900 dark:text-amber-200">
								<div className="space-y-1">
									<h3 className="font-bold text-sm">Verified Payment Method Required</h3>
									<p className="text-xs opacity-90 leading-relaxed">
										To withdraw your funds, you must add and verify a Bank Account or UPI ID.
									</p>
									<Link
										to="/verification"
										className="inline-flex items-center gap-1 text-xs font-bold underline text-amber-800 dark:text-amber-300 hover:opacity-80 pt-1"
									>
										Complete Verification <ArrowRight className="w-3 h-3" />
									</Link>
								</div>
							</div>
						)}

						{/* Beneficiary / Destination Account Card */}
						{paymentMethod && (
							<div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-xl p-5 shadow-xs relative overflow-hidden transition-colors">
								<div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-3 mb-4">
									<div>
										<span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
											Destination Account
										</span>
										<h3 className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
											{paymentMethod.type === 'UPI' ? 'UPI Transfer' : 'Bank IMPS Transfer'}
										</h3>
									</div>

									<div className="flex items-center gap-2">
										{isMethodVerified ? (
											<span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
												<CheckCircle2 className="w-3 h-3" /> Verified
											</span>
										) : (
											<span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
												<Clock className="w-3 h-3" /> {paymentMethod.status}
											</span>
										)}

										<button
											onClick={() => setShowSecret(!showSecret)}
											className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition cursor-pointer"
											title={showSecret ? 'Hide details' : 'Show details'}
										>
											{showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
										</button>
									</div>
								</div>

								{/* Bank Details Display */}
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#f4f4f5] dark:bg-[#121422] p-4 rounded-lg border border-gray-200 dark:border-white/5">
									{paymentMethod.type === 'UPI' ? (
										<div className="col-span-2 space-y-1">
											<span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
												Virtual Payment Address (VPA / UPI ID)
											</span>
											<p className="font-mono text-sm font-bold text-gray-900 dark:text-white">
												{maskUpi(paymentMethod.upiNumber)}
											</p>
										</div>
									) : (
										<>
											<div className="space-y-1">
												<span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
													Account Number
												</span>
												<p className="font-mono text-sm font-bold text-gray-900 dark:text-white">
													{maskAccountNumber(paymentMethod.accountNumber)}
												</p>
											</div>

											<div className="space-y-1">
												<span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
													IFSC Code
												</span>
												<p className="font-mono text-sm font-bold text-gray-900 dark:text-white uppercase">
													{paymentMethod.ifscCode || 'N/A'}
												</p>
											</div>
										</>
									)}
								</div>

								<div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
									<span>Settlement Time: Instant (24x7)</span>
									{paymentMethods.length > 1 && (
										<select
											className="bg-transparent border border-gray-200 dark:border-white/10 rounded px-2 py-1 text-xs"
											value={paymentMethod.id}
											onChange={(e) => setSelectedMethodId(e.target.value)}
										>
											{paymentMethods.map((pm: any) => (
												<option key={pm.id} value={pm.id}>
													{pm.type === 'UPI'
														? maskUpi(pm.upiNumber)
														: maskAccountNumber(pm.accountNumber)}
												</option>
											))}
										</select>
									)}
									<Link
										to="/verification"
										className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
									>
										Manage Accounts
									</Link>
								</div>
							</div>
						)}

						{/* Amount Entry Card */}
						<div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-xl p-6 shadow-xs space-y-6 transition-colors">
							<div>
								<div className="flex items-center justify-between mb-2">
									<label className="text-sm font-semibold text-gray-900 dark:text-white">
										Withdrawal Amount
									</label>
									<span className="text-xs text-gray-500 dark:text-gray-400">
										Available:{' '}
										<strong className="text-gray-900 dark:text-white font-bold">
											₹{formatAmount(currentWalletAmount)}
										</strong>
									</span>
								</div>

								{/* Large Currency Input */}
								<div className="relative flex items-center">
									<span className="absolute left-4 text-2xl font-bold text-gray-400 dark:text-gray-500">
										₹
									</span>
									<input
										type="number"
										min="10"
										max={currentWalletAmount}
										placeholder="0"
										value={amount ?? ''}
										disabled={isPending || !paymentMethod || !isMethodVerified}
										onChange={(e) => {
											const val = parseFloat(e.target.value);
											setAmount(isNaN(val) ? null : val);
										}}
										className="w-full pl-10 pr-4 py-3.5 bg-gray-50 dark:bg-[#090C1A] border border-gray-300 dark:border-white/10 text-gray-900 dark:text-white font-bold text-2xl rounded-xl focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition disabled:opacity-60 disabled:cursor-not-allowed"
									/>
								</div>

								{isInsufficient && amount != null && amount > 0 && (
									<p className="text-xs text-red-600 dark:text-red-400 mt-1.5 flex items-center gap-1 font-medium">
										<AlertCircle className="w-3.5 h-3.5" />
										Amount + fees (₹{totalDeduction.toFixed(2)}) exceeds your available balance.
									</p>
								)}
							</div>

							{/* Quick Preset Buttons */}
							<div className="space-y-2">
								<span className="text-xs font-medium text-gray-500 dark:text-gray-400">
									Quick Select
								</span>
								<div className="grid grid-cols-4 gap-2">
									{[500, 1000, 2500].map((preset) => (
										<button
											key={preset}
											type="button"
											disabled={isPending || !isMethodVerified || preset > currentWalletAmount}
											onClick={() => handlePresetClick(preset)}
											className={`py-2 text-xs font-semibold rounded-lg border transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${amount === preset
												? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
												: 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'
												}`}
										>
											+ ₹{preset}
										</button>
									))}
									<button
										type="button"
										disabled={isPending || !isMethodVerified || currentWalletAmount <= 0}
										onClick={handleMaxClick}
										className={`py-2 text-xs font-semibold rounded-lg border transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${amount === Math.max(0, Math.floor(currentWalletAmount - 5))
											? 'bg-black text-white dark:bg-white dark:text-black border-transparent'
											: 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'
											}`}
									>
										Max (All)
									</button>
								</div>
							</div>

							{/* Confirm & Withdraw Button */}
							<button
								onClick={handleSubmit}
								disabled={
									!amount ||
									amount <= 0 ||
									isInsufficient ||
									isPending ||
									!paymentMethod ||
									!isMethodVerified
								}
								className={`w-full py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${!amount ||
									amount <= 0 ||
									isInsufficient ||
									isPending ||
									!paymentMethod ||
									!isMethodVerified
									? 'bg-gray-300 dark:bg-white/10 text-gray-500 dark:text-gray-400 cursor-not-allowed'
									: 'bg-black text-white hover:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-gray-200 cursor-pointer'
									}`}
							>
								{isPending ? (
									<>
										<Loader2 className="animate-spin w-4 h-4" />
										<span>Processing Bank Payout...</span>
									</>
								) : (
									<span>Confirm & Withdraw {amount ? `₹${amount.toFixed(2)}` : ''}</span>
								)}
							</button>
						</div>
					</div>

					{/* Right Column: Bank Slip Summary & Guidelines */}
					<div className="lg:col-span-5 space-y-6">
						{/* Transfer Summary (Bank Slip Style) */}
						<div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-xl p-5 shadow-xs space-y-4 transition-colors">
							<div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-3">
								<h3 className="text-sm font-bold text-gray-900 dark:text-white">
									Payout Breakdown
								</h3>
								<span className="text-[11px] text-gray-400 font-mono">IMPS / UPI</span>
							</div>

							<div className="space-y-3 text-xs">
								<div className="flex justify-between text-gray-600 dark:text-gray-400">
									<span>Requested Withdrawal</span>
									<span className="font-semibold text-gray-900 dark:text-white font-mono">
										₹{requestedAmount.toFixed(2)}
									</span>
								</div>

								<div className="flex justify-between text-gray-600 dark:text-gray-400">
									<span>Platform Fee (0.25%)</span>
									<span className="font-semibold text-gray-900 dark:text-white font-mono">
										₹{fee.toFixed(2)}
									</span>
								</div>

								<div className="pt-2 border-t border-dashed border-gray-200 dark:border-white/10 flex justify-between items-center text-sm font-bold">
									<span className="text-gray-900 dark:text-white">Total Wallet Deduction</span>
									<span className="text-gray-900 dark:text-white font-mono">
										₹{totalDeduction.toFixed(2)}
									</span>
								</div>

								<div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-3 rounded-lg flex items-center justify-between text-emerald-800 dark:text-emerald-300">
									<span className="font-medium text-xs">Net Bank Credit</span>
									<span className="font-bold text-base font-mono">
										₹{requestedAmount.toFixed(2)}
									</span>
								</div>
							</div>
						</div>

						{/* Security & Withdrawal Guidelines */}
						<div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-xl p-5 shadow-xs space-y-3 text-xs text-gray-600 dark:text-gray-400 transition-colors">
							<h4 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wide">
								Withdrawal Policy & Protection
							</h4>
							<ul className="space-y-2 list-disc list-inside leading-relaxed text-[11px]">
								<li>Transfers are processed instantly 24x7 via IMPS / UPI.</li>
								<li>Payouts are restricted strictly to your verified PAN-linked bank details.</li>
								<li>
									If a bank transfer fails or gets reversed, your full balance and fee are refunded
									automatically.
								</li>
								<li>Minimum withdrawal limit is ₹10.00.</li>
							</ul>
						</div>
					</div>
				</div>

				{/* Withdrawal History (Bank Statement Style) */}
				<div className="mt-4 space-y-3">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-xl font-bold text-gray-900 dark:text-white">
								Withdrawal Statement
							</h2>
							<p className="text-xs text-gray-500 dark:text-gray-400">
								Recent payout transactions and transfer reference tracking
							</p>
						</div>
						<button
							onClick={() => refetchTransactions()}
							className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
						>
							Refresh Statement
						</button>
					</div>

					<div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-xl shadow-xs overflow-hidden transition-colors">
						{withdrawalHistory.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12 text-center px-4">
								<Clock className="w-8 h-8 text-gray-400 dark:text-zinc-600 mb-2 opacity-50" />
								<p className="text-sm font-semibold text-gray-900 dark:text-white">
									No Withdrawals Yet
								</p>
								<p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-0.5">
									Your withdrawal statements and transfer receipts will be listed here.
								</p>
							</div>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-left text-sm whitespace-nowrap">
									<thead className="bg-gray-50 dark:bg-[#2C2C2E]/60 border-b border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 text-xs font-semibold">
										<tr>
											<th className="py-3 px-4">Date & Time</th>
											<th className="py-3 px-4">Reference ID</th>
											<th className="py-3 px-4">Transfer Amount</th>
											<th className="py-3 px-4">Status</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-100 dark:divide-white/5">
										{withdrawalHistory.map((tx: any) => {
											const transferIdMatch = tx.remarks?.match(/Transfer ID: ([a-zA-Z0-9_]+)/);
											const transferId = transferIdMatch ? transferIdMatch[1] : tx.id;

											return (
												<tr
													key={tx.id}
													className="hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors"
												>
													<td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-400">
														{new Date(tx.createdAt).toLocaleDateString()}{' '}
														<span className="opacity-70">
															{new Date(tx.createdAt).toLocaleTimeString([], {
																hour: '2-digit',
																minute: '2-digit',
															})}
														</span>
													</td>

													<td className="py-3.5 px-4">
														<div className="flex items-center gap-1.5">
															<span className="font-mono text-xs text-gray-700 dark:text-gray-300">
																{transferId.slice(0, 14)}...
															</span>
															<button
																onClick={() => handleCopy(transferId, tx.id)}
																className="p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-gray-400 transition cursor-pointer"
																title="Copy Ref ID"
															>
																{copiedTxId === tx.id ? (
																	<Check className="w-3 h-3 text-green-500" />
																) : (
																	<Copy className="w-3 h-3" />
																)}
															</button>
														</div>
													</td>

													<td className="py-3.5 px-4">
														<span className="font-bold text-red-600 dark:text-red-400 font-mono text-sm">
															-₹{formatAmount(tx.amount)}
														</span>
													</td>

													<td className="py-3.5 px-4">{getStatusBadge(tx.status)}</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
