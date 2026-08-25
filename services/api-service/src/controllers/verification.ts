import { Context } from 'hono';
import { logger } from '@/libs/logger';
import { prisma } from '@probstreet/database';
import { kycVerificationSchema, paymentVerificationSchema } from '@/validations/verification';
import { pushToQueue } from '@/libs/redis/queue';
import { EVENTS } from '@/config/constants';

/**
 * This controller is for submit kyc
 * @param c Hono context
 * @returns Json response
 */

export const submitKyc = async (c: Context) => {
	try {
		const userId = c.get('user').id;

		if (!userId) {
			logger.warn(
				{
					context: 'SUBMIT_KYC_UNAUTHORIZED',
				},
				'Unauthorized access attempt to submitKyc',
			);
			return c.json(
				{
					success: false,
					error: 'Unauthorized',
				},
				401,
			);
		}

		const data = await c.req.json();
		const validateData = kycVerificationSchema.safeParse(data);

		if (!validateData.success) {
			logger.warn(
				{
					body: data,
					context: 'SUBMIT_KYC',
					error: validateData.error.issues,
				},
				'KYC validation failed',
			);
			return c.json(
				{
					success: false,
					message: 'validation failed',
					error: validateData.error.issues,
				},
				400,
			);
		}

		const user = await prisma.user.findUnique({
			where: {
				id: userId,
			},
		});

		if (!user) {
			return c.json(
				{
					success: false,
					message: 'User not found',
				},
				404,
			);
		}

		if (user.kycVerificationStatus === 'VERIFIED') {
			logger.warn(
				{
					userId,
					context: 'SUBMIT_KYC',
				},
				'Already verified user tried KYC again',
			);
			return c.json(
				{
					success: false,
					message: 'KYC already verified',
				},
				400,
			);
		}

		const existingKyc = await prisma.kyc.findFirst({
			where: {
				userId,
				panNumber: validateData.data.panNumber,
				status: {
					not: 'REJECTED',
				},
			},
		});

		if (existingKyc) {
			logger.warn(
				{
					userId,
					context: 'SUBMIT_KYC',
				},
				'User tried to submit KYC which is already under review',
			);
			return c.json({
				success: false,
				message: 'KYC already submitted and under review',
			});
		}

		try {
			await prisma.$transaction(async (tx) => {
				await tx.kyc.create({
					data: {
						userId: userId,
						panName: validateData.data.panName,
						panNumber: validateData.data.panNumber,
						dob: validateData.data.DOB,
						status: 'PENDING',
						remarks: null,
						submittedAt: new Date(Date.now()),
					},
				});

				await tx.user.update({
					where: {
						id: userId,
					},
					data: {
						kycVerificationStatus: 'PENDING',
					},
				});
			});
		} catch (error) {
			logger.error(
				{
					alert: true,
					userId,
					context: 'SUBMIT_KYC',
					error,
				},
				'Failed to create kyc details',
			);
			return c.json(
				{
					success: false,
					error: 'Failed to submit KYC details',
				},
				500,
			);
		}

		logger.info({ userId, context: 'SUBMIT_KYC' }, 'KYC submitted successfully');

		return c.json({
			success: true,
			message: 'KYC submitted successfully',
		});
	} catch (error) {
		logger.error(
			{
				alert: true,
				context: 'SUBMIT_KYC_CONTROLLER_FAIL',
				error,
			},
			'Unhandled error in submitKyc controller',
		);
		return c.json(
			{
				success: false,
				error: 'Internal server error',
			},
			500,
		);
	}
};

/**
 * This controller is for submit payment method (BANK or UPI)
 * @param c Hono context
 * @returns Json response
 */

export const submitPaymentMethods = async (c: Context) => {
	try {
		const userId = c.get('user').id;

		if (!userId) {
			logger.warn(
				{
					context: 'SUBMIT_PAYMENT_METHOD_UNAUTHORIZED',
				},
				'Unauthorized access attempt to submitPaymentMethods controller',
			);
			return c.json(
				{
					success: false,
					error: 'Unauthorized',
				},
				401,
			);
		}

		const body = await c.req.json();
		const validateData = paymentVerificationSchema.safeParse(body);

		if (!validateData.success) {
			logger.warn(
				{
					body,
					context: 'SUBMIT_PAYMENT_METHOD',
					error: validateData.error.issues,
				},
				'payment method validation failed',
			);
			return c.json(
				{
					success: false,
					message: 'validation failed',
					error: validateData.error.issues,
				},
				400,
			);
		}

		const { upiId, bankAccountNumber, ifscCode } = validateData.data;

		if (upiId) {
			const existingUpi = await prisma.paymentMethod.findFirst({
				where: {
					userId,
					type: 'UPI',
					status: {
						not: 'REJECTED',
					},
				},
			});

			if (existingUpi) {
				logger.warn(
					{
						userId,
						context: 'SUBMIT_PAYMENT_METHOD',
					},
					'User tried to submit UPI which is already under review',
				);
				return c.json(
					{
						success: false,
						message: 'UPI already submitted and under review',
					},
					400,
				);
			}

			try {
				await prisma.$transaction(async (tx) => {
					await tx.paymentMethod.create({
						data: {
							userId,
							type: 'UPI',
							upiNumber: upiId,
							status: 'PENDING',
							remarks: null,
							submittedAt: new Date(Date.now()),
						},
					});

					await tx.user.update({
						where: { id: userId },
						data: {
							paymentVerificationStatus: 'PENDING',
						},
					});
				});
			} catch (error) {
				logger.error(
					{
						alert: true,
						userId,
						error,
					},
					'Failed to create payment details for UPI',
				);
				return c.json(
					{
						success: false,
						error: 'Failed to submit payment details',
					},
					500,
				);
			}
		} else {
			const existingBank = await prisma.paymentMethod.findFirst({
				where: {
					userId,
					type: 'BANK',
					status: {
						not: 'REJECTED',
					},
				},
			});

			if (existingBank) {
				logger.warn(
					{
						userId,
						context: 'SUBMIT_PAYMENT_METHOD',
					},
					'User tried to submit bank details which is already under review',
				);
				return c.json(
					{
						success: false,
						message: 'Bank details already submitted and under review.',
					},
					400,
				);
			}

			try {
				await prisma.$transaction(async (tx) => {
					await tx.paymentMethod.create({
						data: {
							userId,
							type: 'BANK',
							accountNumber: bankAccountNumber,
							ifscCode: ifscCode,
							status: 'PENDING',
							remarks: null,
							submittedAt: new Date(Date.now()),
						},
					});

					await tx.user.update({
						where: { id: userId },
						data: {
							paymentVerificationStatus: 'PENDING',
						},
					});
				});
			} catch (error) {
				logger.error(
					{
						alert: true,
						userId,
						error,
					},
					'Failed to create payment details for bank',
				);
				return c.json(
					{
						success: false,
						error: 'Failed to submit payment details',
					},
					500,
				);
			}
		}

		logger.info(
			{
				userId,
				context: 'SUBMIT_PAYMENT_METHOD',
			},
			'Payment details submitted successfully',
		);

		return c.json({
			success: true,
			message: 'Payment details submitted successfully',
		});
	} catch (error) {
		logger.error(
			{
				alert: true,
				context: 'SUBMIT_PAYMENT_METHOD_CONTROLLER_FAIL',
				error,
			},
			'Unhandled error in submitPaymentMethods controller',
		);
		return c.json(
			{
				success: false,
				error: 'Internal server error',
			},
			500,
		);
	}
};

/**
 * Get user's KYC and payment verification status
 * @param c Hono context
 * @returns Json response with verification status
 */

export const getVerificationStatus = async (c: Context) => {
	try {
		const userId = c.get('user').id;

		if (!userId) {
			logger.warn(
				{
					context: 'GET_VERIFICATION_STATUS_UNAUTHORIZED',
				},
				'Unauthorized access attempt to getVerificationStatus controller',
			);
			return c.json(
				{
					success: false,
					error: 'Unauthorized',
				},
				401,
			);
		}

		const user = await prisma.user.findUnique({
			where: {
				id: userId,
			},
			select: {
				id: true,
				kycVerificationStatus: true,
				paymentVerificationStatus: true,
				kycs: {
					where: {
						status: 'VERIFIED',
					},
					orderBy: {
						reviewedAt: 'desc',
					},
					take: 1,
					select: {
						reviewedAt: true,
					},
				},
			},
		});

		if (!user) {
			logger.warn(
				{
					userId,
					context: 'GET_VERIFICATION_STATUS',
				},
				'User not found while fetching verification status',
			);
			return c.json(
				{
					success: false,
					message: 'User not found',
				},
				404,
			);
		}

		logger.info(
			{ userId, context: 'GET_VERIFICATION_STATUS' },
			'Fetched verification status successfully',
		);

		return c.json(
			{
				success: true,
				message: 'Verification status fetched successfully',
				data: {
					userId: user.id,
					kycVerificationStatus: user.kycVerificationStatus,
					paymentVerificationStatus: user.paymentVerificationStatus,
					kycVerifiedAt: user.kycs[0]?.reviewedAt ?? null,
				},
			},
			200,
		);
	} catch (error) {
		logger.error(
			{
				alert: true,
				context: 'GET_VERIFICATION_STATUS_CONTROLLER_FAIL',
				error,
			},
			'Unhandled error in getVerificationStatus controller',
		);
		return c.json(
			{
				success: false,
				error: 'Internal server error',
			},
			500,
		);
	}
};

/**
 * Get user's KYC and payment details
 * @param c Hono context
 * @returns Json response with verification details (PAN, BANK or UPI)
 */

export const getVerificationDetails = async (c: Context) => {
	try {
		const userId = c.get('user').id;

		if (!userId) {
			logger.warn(
				{
					context: 'GET_VERIFICATION_DETAILS_UNAUTHORIZED',
				},
				'Unauthorized access attempt to getVerificationDetails controller',
			);
			return c.json(
				{
					success: false,
					error: 'Unauthorized',
				},
				401,
			);
		}

		const [kyc, payment] = await Promise.all([
			prisma.kyc.findFirst({
				where: { userId },
				select: {
					panName: true,
					panNumber: true,
					dob: true,
					status: true,
				},
			}),
			prisma.paymentMethod.findFirst({
				where: { userId },
				select: {
					id: true,
					type: true,
					status: true,
					upiNumber: true,
					accountNumber: true,
					ifscCode: true,
				},
			}),
		]);

		const paymentMethod = payment
			? payment.type === 'UPI'
				? {
						id: payment.id,
						type: 'UPI',
						upiNumber: payment.upiNumber,
						status: payment.status,
					}
				: {
						id: payment.id,
						type: 'BANK',
						accountNumber: payment.accountNumber,
						ifscCode: payment.ifscCode,
						status: payment.status,
					}
			: null;

		logger.info(
			{
				userId,
				context: 'GET_VERIFICATION_DETAILS',
			},
			'Fetched verification details',
		);

		return c.json({
			success: true,
			message: 'Verification details fetched successfully',
			data: {
				kyc,
				paymentMethod,
				fetchedAt: new Date().toISOString(),
			},
		});
	} catch (error) {
		logger.error(
			{
				alert: true,
				context: 'GET_VERIFICATION_DETAILS_CONTROLLER_FAIL',
				error,
			},
			'Unhandled error in getVerificationDetails controller',
		);
		return c.json(
			{
				success: false,
				error: 'Internal server error',
			},
			500,
		);
	}
};

/**
 * Get  kyc and payment details of a user, for admin verification dashboard
 * @param c Hono context
 * @returns Json response with payment and kyc details
 */

export const getUserVerificationDetailsForAdmin = async (c: Context) => {
	try {
		const isAdmin = c.get('user').role === 'ADMIN';

		if (!isAdmin) {
			logger.warn(
				{
					context: 'GET_USER_VERIFICATION_DETAILS_FOR_ADMIN_UNAUTHORIZED',
				},
				'Unauthorized access attempt to getUserVerificationDetailsForAdmin controller',
			);
			return c.json(
				{
					success: false,
					message: 'Unauthorized',
				},
				403,
			);
		}

		const userId = c.req.param('userId');

		if (!userId) {
			logger.warn({
				context: 'GET_USER_VERIFICATION_DETAILS_FOR_ADMIN',
				reason: 'Missing userId in param',
			});

			return c.json(
				{
					success: false,
					message: 'User ID is required',
				},
				400,
			);
		}

		const verificationDetails = await prisma.user.findUnique({
			where: {
				id: userId,
			},
			select: {
				id: true,
				phone: true,
				kycs: {
					orderBy: { submittedAt: 'desc' },
					take: 1,
					select: {
						panName: true,
						panNumber: true,
						dob: true,
						status: true,
						remarks: true,
						submittedAt: true,
						reviewedAt: true,
					},
				},
				paymentMethods: {
					orderBy: { submittedAt: 'desc' },
					take: 1,
					select: {
						type: true,
						status: true,
						upiNumber: true,
						accountNumber: true,
						ifscCode: true,
						remarks: true,
						submittedAt: true,
						reviewedAt: true,
					},
				},
			},
		});

		if (!verificationDetails) {
			logger.warn(
				{
					context: 'GET_USER_VERIFICATION_DETAILS_FOR_ADMIN',
					userId,
				},
				'failed to fetch verification details from db',
			);
			return c.json(
				{
					success: false,
					message: 'Failed to fetch verification details',
				},
				404,
			);
		}

		const kyc = verificationDetails.kycs?.[0] || null;
		const paymentMethod = verificationDetails.paymentMethods?.[0] || null;

		return c.json({
			success: true,
			message: 'Verification details fetched successfully',
			data: {
				id: verificationDetails.id,
				phone: verificationDetails.phone,
				kyc,
				paymentMethod,
			},
		});
	} catch (error) {
		logger.error(
			{
				alert: true,
				context: 'GET_USER_VERIFICATION_DETAILS_FOR_ADMIN_CONTROLLER_FAIL',
				error,
			},
			'Unhandled error in getUserVerificationDetailsForAdmin controller',
		);
		return c.json(
			{
				success: false,
				error: 'Internal server error',
			},
			500,
		);
	}
};

/**
 * This is admin only and send all pending verifications
 * @param c Hono context
 * @returns Json response with all pending verifications
 */

export const getPendingVerifications = async (c: Context) => {
	try {
		const isAdmin = c.get('user').role === 'ADMIN';

		if (!isAdmin) {
			logger.warn(
				{
					context: 'GET_PENDING_VERIFICATIONS_UNAUTHORIZED',
				},
				'Unauthorized access attempt to getPendingVerifications controller',
			);
			return c.json(
				{
					success: false,
					message: 'Unauthorized',
				},
				403,
			);
		}

		const pendingVerifications = await prisma.user.findMany({
			where: {
				OR: [
					{ kycVerificationStatus: { in: ['PENDING', 'REJECTED'] } },
					{ paymentVerificationStatus: { in: ['PENDING', 'REJECTED'] } },
				],
			},
			select: {
				id: true,
				phone: true,
				kycs: {
					orderBy: { submittedAt: 'desc' },
					take: 1,
					where: { status: 'PENDING' },
					select: {
						panName: true,
						panNumber: true,
						dob: true,
						status: true,
						submittedAt: true,
					},
				},
				paymentMethods: {
					orderBy: { submittedAt: 'desc' },
					take: 1,
					where: { status: 'PENDING' },
					select: {
						type: true,
						upiNumber: true,
						accountNumber: true,
						ifscCode: true,
						status: true,
						submittedAt: true,
					},
				},
			},
		});

		return c.json({
			success: true,
			message: 'Pending verificaiton retrive successfully',
			data: pendingVerifications,
		});
	} catch (error) {
		logger.error(
			{
				alert: true,
				context: 'GET_PENDING_VERIFICATIONS_CONTROLLER_FAIL',
				error,
			},
			'Unhandled error in getPendingVerifications controller',
		);
		return c.json(
			{
				success: false,
				error: 'Internal server error',
			},
			500,
		);
	}
};

/**
 * Update kyc and payment verification status and push even to engine (ADMIN)
 * @param c Hono context
 * @returns Json response
 */

type KYCStatus = 'VERIFIED' | 'REJECTED';
type PaymentStatus = 'VERIFIED' | 'REJECTED';

export const updatePendingVerification = async (c: Context) => {
	try {
		const isAdmin = c.get('user').role === 'ADMIN';

		if (!isAdmin) {
			logger.warn(
				{
					context: 'UPDATE_PENDING_VERIFICATIONS_UNAUTHORIZED',
				},
				'Unauthorized access attempt to updatePendingVerification controller',
			);
			return c.json(
				{
					success: false,
					message: 'Unauthorized',
				},
				403,
			);
		}

		const { userId, kycStatus, paymentStatus, kycRemark, paymentRemark } = await c.req.json<{
			userId: string;
			kycStatus?: string;
			paymentStatus?: string;
			kycRemark?: string;
			paymentRemark?: string;
		}>();

		if (!userId) {
			return c.json(
				{
					success: false,
					message: 'User ID is required',
				},
				400,
			);
		}

		let triggerEngine;

		await prisma.$transaction(async (tx) => {
			if (kycStatus) {
				if (!['VERIFIED', 'REJECTED'].includes(kycStatus)) {
					throw new Error('Invalid KYC status');
				}

				const kyc = await tx.kyc.findFirst({
					where: {
						userId,
						status: 'PENDING',
					},
					orderBy: { submittedAt: 'desc' },
				});

				if (kyc) {
					await tx.kyc.update({
						where: { id: kyc.id },
						data: {
							status: kycStatus as KYCStatus,
							remarks: kycRemark,
							reviewedAt: new Date(),
						},
					});

					if (kycStatus === 'VERIFIED') {
						await tx.user.update({
							where: { id: userId },
							data: {
								kycVerificationStatus: 'VERIFIED',
							},
						});
					}

					logger.info({ userId }, 'kyc status update');
				}
			}

			if (paymentStatus) {
				if (!['VERIFIED', 'REJECTED'].includes(paymentStatus)) {
					throw new Error('Invalid Payment status');
				}

				const payment = await tx.paymentMethod.findFirst({
					where: { userId, status: 'PENDING' },
					orderBy: { submittedAt: 'desc' },
				});

				if (payment) {
					await tx.paymentMethod.update({
						where: { id: payment.id },
						data: {
							status: paymentStatus as PaymentStatus,
							remarks: paymentRemark,
							reviewedAt: new Date(),
						},
					});

					if (paymentStatus === 'VERIFIED') {
						await tx.user.update({
							where: { id: userId },
							data: {
								paymentVerificationStatus: 'VERIFIED',
							},
						});
					}

					logger.info({ userId }, 'payment status update');
				}
			}

			// this will check if kyc and payment is verified then set trigger engine true
			const checkuser = await tx.user.findUnique({
				where: {
					id: userId,
				},
				select: {
					kycVerificationStatus: true,
					paymentVerificationStatus: true,
				},
			});

			if (
				checkuser?.kycVerificationStatus === 'VERIFIED' &&
				checkuser?.paymentVerificationStatus === 'VERIFIED'
			)
				triggerEngine = true;
		});

		if (triggerEngine) {
			let response = await pushToQueue(EVENTS.VERIFICATION_STATUS_UPDATE, {
				userId,
				kycStatus: 'VERIFIED',
				paymentStatus: 'VERIFIED',
			});

			if (!response.success && response.retryable) {
				let success = false;

				for (let i = 0; i < 3; i++) {
					logger.warn(
						{
							context: 'UPDATE_VERIFICATION_SYNC_RETRY',
							userId,
							attempt: i + 1,
						},
						`Retrying sync to engine...`,
					);

					await new Promise((resolve) => setTimeout(resolve, 500));

					response = await pushToQueue(EVENTS.VERIFICATION_STATUS_UPDATE, {
						userId,
						kycStatus: 'VERIFIED',
						paymentStatus: 'VERIFIED',
					});

					if (response.success) {
						success = true;
						logger.info(
							{
								context: 'UPDATE_VERIFICATION_SYNC_SUCCESS_RETRY',
								userId,
								attempt: i + 1,
							},
							`Successfully synced to engine after ${i + 1} attempt(s)`,
						);
						break;
					}
				}

				if (!success) {
					logger.error(
						{
							alert: true,
							context: 'KYC_VERIFICATION_QUEUE_PUSH_FAIL',
							userId,
						},
						'Failed to push KYC update event after retries',
					);
				}
			} else if (response.success) {
				logger.info('Engine sync done properly');
			}
		}

		return c.json({
			success: true,
			message: 'Verification status updated successfully',
		});
	} catch (error) {
		logger.error(
			{
				alert: true,
				context: 'UPDATE_PENDING_VERIFICATIONS_CONTROLLER_FAIL',
				error,
			},
			'Unhandled error in updatePendingVerification',
		);

		return c.json(
			{
				success: false,
				message: 'Internal server error',
			},
			500,
		);
	}
};
