import { CheckCircle2, Clock, XCircle, ShieldCheck, Trash2, Plus } from 'lucide-react';
import { useDeletePaymentMutation } from '@/hooks/mutations/verification';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface VerificationData {
	kyc?: {
		panName?: string;
		panNumber?: string;
		dob?: string;
		status?: 'NOT_VERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
	} | null;
	paymentMethods?:
		| {
				id: string;
				type?: 'UPI' | 'BANK';
				upiNumber?: string;
				accountNumber?: string;
				ifscCode?: string;
				status?: 'NOT_VERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
		  }[]
		| null;
}

export function VerificationPreview({
	data,
	onAddPaymentMethod,
}: {
	data?: VerificationData;
	onAddPaymentMethod?: () => void;
}) {
	const kyc = data?.kyc;
	const paymentMethods = data?.paymentMethods || [];

	const isKycVerified = kyc?.status === 'VERIFIED';
	const hasVerifiedPayment = paymentMethods.some((pm) => pm.status === 'VERIFIED');
	const hasPendingPayment = paymentMethods.some((pm) => pm.status === 'PENDING');
	const isAllVerified = isKycVerified && hasVerifiedPayment;

	const { mutate: deletePaymentMethod, isPending: deleting } = useDeletePaymentMutation();
	const queryClient = useQueryClient();

	const handleDelete = (id: string) => {
		if (window.confirm('Are you sure you want to delete this payment method?')) {
			deletePaymentMethod(id, {
				onSuccess: () => {
					toast.success('Payment method deleted successfully');
					queryClient.invalidateQueries({ queryKey: ['verificationStatus'] });
					queryClient.invalidateQueries({ queryKey: ['verificationDetails'] });
				},
				onError: () => {
					toast.error('Failed to delete payment method');
				},
			});
		}
	};

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
								: 'Your details have been successfully submitted. Our team is verifying your information. This usually takes just a few minutes.'}
						</p>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				{/* KYC Details Card */}
				<div className="w-full bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-xl p-6 shadow-sm transition-colors space-y-5 h-fit">
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

				{/* Payment Details Cards */}
				<div className="space-y-6">
					<div className="flex items-center justify-between">
						<h3 className="font-semibold text-base text-gray-900 dark:text-white">
							Payment Methods
						</h3>
						{onAddPaymentMethod && !hasPendingPayment && (
							<button
								onClick={onAddPaymentMethod}
								className="flex items-center gap-1.5 text-xs font-medium bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
							>
								<Plus className="w-3.5 h-3.5" />
								Add New
							</button>
						)}
					</div>

					{paymentMethods.length === 0 ? (
						<div className="w-full bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-xl p-6 text-center shadow-sm">
							<p className="text-sm text-gray-500 dark:text-gray-400">No payment methods added.</p>
						</div>
					) : (
						paymentMethods.map((payment) => (
							<div
								key={payment.id}
								className="w-full bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-xl p-6 shadow-sm transition-colors space-y-5 relative group"
							>
								<button
									onClick={() => handleDelete(payment.id)}
									disabled={deleting}
									className="absolute top-4 right-4 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50 cursor-pointer"
									title="Delete Payment Method"
								>
									<Trash2 className="w-4 h-4" />
								</button>
								<div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-3 pr-10">
									<h3 className="font-semibold text-base text-gray-900 dark:text-white">
										{payment.type === 'UPI' ? 'UPI ID' : 'Bank Account'}
									</h3>
									{getStatusBadge(payment.status)}
								</div>

								<div className="space-y-4 text-sm">
									{payment.type === 'UPI' ? (
										<div>
											<span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
												UPI ID
											</span>
											<input
												type="text"
												disabled
												value={payment.upiNumber || '-'}
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
													value={payment.accountNumber || '-'}
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
													value={payment.ifscCode || '-'}
													className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-[#090C1A] text-gray-900 dark:text-white cursor-not-allowed uppercase font-mono"
												/>
											</div>
										</>
									)}
								</div>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}
