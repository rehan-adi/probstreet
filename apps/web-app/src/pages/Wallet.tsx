import { formatAmount } from '@/lib/format';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Gift } from 'lucide-react';
import kycWalletIcon from '@/assets/images/kyc_v2.avif';
import gaugeWalletIcon from '@/assets/images/gauge_icon_v2.avif';
import depositWalletIcon from '@/assets/images/deposit_wallet_icon.png';
import { useGetVerificationStatus } from '@/hooks/queries/verification';
import transactionWalletIcon from '@/assets/images/transaction_v2.avif';
import winningsWalletIcon from '@/assets/images/winnings_wallet_icon.png';
import { useBalanceQuery, useDepositAmountQuery } from '@/hooks/queries/balance';

export default function WalletPage() {
	const navigate = useNavigate();

	const { data: balance, isLoading } = useBalanceQuery();
	const { data: verificationStatus } = useGetVerificationStatus();
	const { data: depositeAmountData } = useDepositAmountQuery();

	const isKycVerified = verificationStatus?.data?.data?.kycVerificationStatus === 'VERIFIED';

	const goToRecharge = () => {
		navigate('/wallet/recharge');
	};

	const goToWithdraw = () => {
		navigate('/withdraw');
	};

	const goToverification = () => {
		navigate('/verification');
	};

	const goToTransactionHistory = () => {
		navigate('/transaction-history');
	};

	return (
		<div className="w-full bg-[#f4f4f5] dark:bg-[#090C1A] flex justify-center px-4 md:pt-16 pt-16 pb-4 transition-colors min-h-screen">
			<div className="w-full max-w-227.5 flex flex-col gap-8">
				<div>
					<h2 className="text-sm text-[#262626] dark:text-gray-400 font-normal">Total Balance</h2>
					{isLoading ? (
						<p className="text-5xl font-semibold mt-1 text-gray-900 dark:text-white">₹ 0</p>
					) : (
						<p className="text-5xl font-semibold mt-1 text-gray-900 dark:text-white">
							₹ {formatAmount(balance?.data?.data?.amount)}
						</p>
					)}
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
					<div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-xl border border-gray-400/20 dark:border-white/10 flex flex-col justify-between items-center text-center gap-4 transition-colors min-h-55">
						<div className="flex flex-col items-center gap-3">
							<img src={depositWalletIcon} alt="Deposit Icon" className="w-8 h-8 dark:invert" />
							<h3 className="text-sm text-[#545454] dark:text-gray-400">Deposit</h3>
						</div>

						<p className="text-2xl font-semibold text-gray-900 dark:text-white">
							₹{formatAmount(depositeAmountData?.data?.data?.totalDepositAmount)}
						</p>

						<div className="w-full">
							<button
								onClick={goToRecharge}
								className="px-4 cursor-pointer py-2.5 w-full text-xs font-semibold rounded-md bg-black dark:bg-white text-white dark:text-black"
							>
								Recharge
							</button>
						</div>
					</div>

					{/* Winnings */}
					<div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-xl border border-gray-400/20 dark:border-white/10 flex flex-col justify-between items-center text-center gap-4 transition-colors min-h-55">
						<div className="flex flex-col items-center gap-3">
							<img src={winningsWalletIcon} alt="Winnings Icon" className="w-8 h-8 dark:invert" />
							<h3 className="text-sm text-[#545454] dark:text-gray-400">Winnings</h3>
						</div>

						<p
							className={`text-2xl font-semibold ${
								isKycVerified ? 'text-black dark:text-white' : 'text-gray-900 dark:text-white'
							}`}
						>
							₹{isLoading ? '0' : formatAmount(balance?.data?.data?.amount)}
						</p>

						<div className="w-full">
							<button
								onClick={() => {
									if (isKycVerified) {
										goToWithdraw();
									} else {
										goToverification();
									}
								}}
								className="px-4 cursor-pointer py-2.5 w-full text-xs font-semibold rounded-md bg-black dark:bg-white text-white dark:text-black"
							>
								{isKycVerified ? 'Withdraw' : 'Verify KYC'}
							</button>
						</div>
					</div>

					{/* Transaction History */}
					<div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-xl border border-gray-400/20 dark:border-white/10 flex flex-col justify-between items-center text-center gap-4 transition-colors min-h-55">
						<div className="flex flex-col items-center gap-3">
							<img
								src={transactionWalletIcon}
								alt="Transaction History Icon"
								className="w-8 h-8 dark:invert"
							/>
							<h3 className="text-sm text-[#545454] dark:text-gray-400">Transaction History</h3>
						</div>

						<p className="text-xs text-[#757575] dark:text-gray-400 leading-relaxed px-2">
							View debits, credits & payouts
						</p>

						<div className="w-full">
							<button
								onClick={goToTransactionHistory}
								className="px-4 cursor-pointer py-2.5 w-full text-xs font-semibold rounded-md bg-black dark:bg-white text-white dark:text-black"
							>
								View Transactions
							</button>
						</div>
					</div>
				</div>

				<div>
					<h2 className="text-xl font-semibold mt-2 mb-4 text-gray-900 dark:text-white">
						Quick Actions
					</h2>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{/* KYC Verification */}
						<div className="bg-[#f4f4f5] dark:bg-[#1C1C1E] p-4 rounded-xl border border-gray-400/20 dark:border-white/10 flex flex-col gap-1 transition-colors">
							<img src={kycWalletIcon} className="w-8 h-8 dark:invert" alt="KYC Verification" />
							<h3 className="text-base mt-4 text-[#262626] dark:text-gray-200 font-normal">
								KYC verification
							</h3>
							{isKycVerified ? (
								<p className="text-xs text-green-600 dark:text-green-400">
									Verified on{' '}
									{new Date(verificationStatus.data.data.kycVerifiedAt).toLocaleDateString(
										'en-US',
										{
											day: 'numeric',
											month: 'long',
											year: 'numeric',
										},
									)}
								</p>
							) : (
								<p className="text-xs text-[#D29822] dark:text-yellow-500">Tap to verify</p>
							)}
							<button
								onClick={goToverification}
								className="w-16 h-9 cursor-pointer mt-4 flex items-center justify-center rounded-full border border-gray-400/60 dark:border-white/20"
							>
								<ArrowRight className="w-6 h-6 text-black dark:text-white" />
							</button>
						</div>

						{/* Refer & Rewards */}
						<div className="bg-[#f4f4f5] dark:bg-[#1C1C1E] p-4 rounded-xl border border-gray-400/20 dark:border-white/10 flex flex-col gap-1 transition-colors">
							<div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
								<Gift size={20} />
							</div>
							<h3 className="text-base mt-4 text-[#262626] dark:text-gray-200 font-normal">
								Refer & Rewards
							</h3>
							<p className="text-xs text-[#757575] dark:text-gray-400">
								Invite friends & earn ₹20 bonus
							</p>
							<button
								onClick={() => navigate('/referral')}
								className="w-16 h-9 cursor-pointer mt-4 flex items-center justify-center rounded-full border border-gray-400/60 dark:border-white/20"
							>
								<ArrowRight className="w-6 h-6 text-black dark:text-white" />
							</button>
						</div>

						{/* Control Centre */}
						<div className="bg-[#f4f4f5] dark:bg-[#1C1C1E] p-4 rounded-xl border border-gray-400/20 dark:border-white/10 flex flex-col gap-1 transition-colors">
							<img src={gaugeWalletIcon} className="w-8 h-8 dark:invert" alt="Control Centre" />
							<h3 className="text-base mt-4 text-[#262626] dark:text-gray-200 font-normal">
								Control Centre
							</h3>
							<p className="text-xs text-[#757575] dark:text-gray-400">
								{' '}
								Limits for responsible trading
							</p>
							<button className="w-36 h-9 cursor-pointer mt-4 flex items-center justify-center text-sm font-semibold rounded-full text-black dark:text-white border border-gray-400/60 dark:border-white/20">
								Coming soon...
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
