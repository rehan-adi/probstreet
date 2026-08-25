import { CheckCircle2, Clock, XCircle, ShieldCheck, AlertCircle } from 'lucide-react';

interface VerificationData {
	kyc?: {
		panName?: string;
		panNumber?: string;
		dob?: string;
		status?: 'NOT_VERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
	} | null;
	paymentMethod?: {
		type?: 'UPI' | 'BANK';
		upiNumber?: string;
		accountNumber?: string;
		ifscCode?: string;
		status?: 'NOT_VERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
	} | null;
}

export function VerificationPreview({ data }: { data?: VerificationData }) {
	const kyc = data?.kyc;
	const payment = data?.paymentMethod;

	const isKycVerified = kyc?.status === 'VERIFIED';
	const isPaymentVerified = payment?.status === 'VERIFIED';
	const isAllVerified = isKycVerified && isPaymentVerified;

	const getStatusBadge = (status?: string) => {
		switch (status) {
			case 'VERIFIED':
				return (
					<span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400">
						<CheckCircle2 className="w-3.5 h-3.5" />
						Verified
					</span>
				);
			case 'REJECTED':
				return (
					<span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400">
						<XCircle className="w-3.5 h-3.5" />
						Rejected
					</span>
				);
			default:
				return (
					<span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
						<Clock className="w-3.5 h-3.5" />
						Under Review
					</span>
				);
		}
	};

	return (
		<div className="w-full space-y-6">
			{/* Status Banner */}
			<div
				className={`p-6 rounded-xl border ${
					isAllVerified
						? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-900 dark:text-emerald-200'
						: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-200'
				}`}
			>
				<div className="flex items-start gap-4">
					<div
						className={`p-2.5 rounded-full shrink-0 ${
							isAllVerified
								? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
								: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
						}`}
					>
						{isAllVerified ? <ShieldCheck className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
					</div>
					<div>
						<h2 className="text-lg font-bold">
							{isAllVerified ? 'Verification Complete!' : 'Details Submitted & Under Review'}
						</h2>
						<p className="text-sm mt-1 opacity-90 leading-relaxed">
							{isAllVerified
								? 'Your KYC and Payment details are verified. You can deposit, trade, and withdraw funds seamlessly.'
								: 'Your PAN and Payment details have been successfully submitted. Our team is verifying your information. This usually takes just a few minutes.'}
						</p>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				{/* KYC Details Card */}
				<div className="w-full bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-xl p-6 shadow-sm transition-colors space-y-5">
					<div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-3">
						<h3 className="font-semibold text-base text-gray-900 dark:text-white">PAN Details</h3>
						{getStatusBadge(kyc?.status)}
					</div>

					<div className="space-y-4 text-sm">
						<div>
							<span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
								Name on PAN
							</span>
							<input
								type="text"
								disabled
								value={kyc?.panName || '-'}
								className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-[#090C1A] text-gray-900 dark:text-white cursor-not-allowed"
							/>
						</div>

						<div>
							<span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
								PAN Number
							</span>
							<input
								type="text"
								disabled
								value={kyc?.panNumber || '-'}
								className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-[#090C1A] text-gray-900 dark:text-white cursor-not-allowed uppercase font-mono"
							/>
						</div>

						<div>
							<span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
								Date of Birth
							</span>
							<input
								type="text"
								disabled
								value={kyc?.dob ? new Date(kyc.dob).toLocaleDateString() : '-'}
								className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-[#090C1A] text-gray-900 dark:text-white cursor-not-allowed"
							/>
						</div>
					</div>
				</div>

				{/* Payment Details Card */}
				<div className="w-full bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-xl p-6 shadow-sm transition-colors space-y-5">
					<div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-3">
						<h3 className="font-semibold text-base text-gray-900 dark:text-white">
							Payment Method ({payment?.type || 'BANK'})
						</h3>
						{getStatusBadge(payment?.status)}
					</div>

					<div className="space-y-4 text-sm">
						{payment?.type === 'UPI' ? (
							<div>
								<span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">UPI ID</span>
								<input
									type="text"
									disabled
									value={payment?.upiNumber || '-'}
									className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-[#090C1A] text-gray-900 dark:text-white cursor-not-allowed"
								/>
							</div>
						) : (
							<>
								<div>
									<span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
										Bank Account Number
									</span>
									<input
										type="text"
										disabled
										value={payment?.accountNumber || '-'}
										className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-[#090C1A] text-gray-900 dark:text-white cursor-not-allowed font-mono"
									/>
								</div>

								<div>
									<span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
										IFSC Code
									</span>
									<input
										type="text"
										disabled
										value={payment?.ifscCode || '-'}
										className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-[#090C1A] text-gray-900 dark:text-white cursor-not-allowed uppercase font-mono"
									/>
								</div>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
