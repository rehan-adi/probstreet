import { Context } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/libs/logger';
import { EVENTS } from '@/config/constants';
import { prisma } from '@probstreet/database';
import { pushToQueue } from '@/libs/redis/queue';
import { balanceSchema } from '@/validations/balance';
import { triggerCashfreePayout } from '@/libs/cashfree/payouts';

/**
 * Get user's balance from engine
 * @param c Hono context
 * @returns Json response with user balance
 */

export const getBalance = async (c: Context) => {
	try {
		const userId = c.get('user').id;

		if (!userId) {
			logger.warn(
				{
					context: 'GET_BALANCE_UNAUTHORIZED',
				},
				'Unauthorized access attempt to getBalance controller',
			);
			return c.json(
				{
					success: false,
					error: 'Unauthorized',
				},
				401,
			);
		}

		let response = await pushToQueue(EVENTS.GET_BALANCE, { userId });

		if (!response.success && response.message.includes('User not found')) {
			logger.warn({ userId }, 'User not found in engine, attempting to sync from DB');
			const dbUser = await prisma.user.findUnique({
				where: { id: userId },
				include: { wallet: true },
			});

			if (dbUser) {
				// Sync user to engine
				await pushToQueue(EVENTS.CREATE_USER, {
					id: dbUser.id,
					name: dbUser.username || '',
					phone: dbUser.phone,
					kycVerificationStatus: dbUser.kycVerificationStatus,
					paymentVerificationStatus: dbUser.paymentVerificationStatus,
				});

				// Sync balance to engine
				await pushToQueue(EVENTS.INIT_BALANCE, {
					userId: dbUser.id,
					amount: Number(dbUser.wallet?.balance || 0),
					locked: Number(dbUser.wallet?.locked || 0),
				});

				// Retry fetching balance
				response = await pushToQueue(EVENTS.GET_BALANCE, { userId });
			}
		}

		if (!response.success) {
			logger.error(
				{
					alert: true,
					userId,
					context: 'GET_BALANCE_ENGINE_FAIL',
				},
				'Failed to fetch balance from engine',
			);
			return c.json(
				{
					success: false,
					message: response.message,
				},
				500,
			);
		}

		logger.info({ userId, response }, 'Balance get from engine ');

		return c.json(
			{
				success: true,
				message: response.message,
				data: response.data,
			},
			200,
		);
	} catch (error) {
		logger.error(
			{
				alert: true,
				context: 'GET_BALANCE_CONTROLLER_FAIL',
				error,
			},
			'Unhandled error in getBalance controller',
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
 * Deposite or Onramp balance to user wallet
 * @param c Hono context
 * @returns Json response
 */

export const deposit = async (c: Context) => {
	try {
		const userId = c.get('user').id;

		if (!userId) {
			logger.warn(
				{
					context: 'DEPOSIT_UNAUTHORIZED',
				},
				'Unauthorized access attempt to deposit',
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
		});

		if (!user) {
			logger.warn(
				{
					context: 'DEPOSIT_USER_NOT_FOUND',
					userId,
				},
				'User not found in database',
			);
			return c.json(
				{
					success: false,
					message: 'User not found',
				},
				404,
			);
		}

		const data = await c.req.json<{ amount: string }>();

		const validateData = balanceSchema.safeParse(data);

		if (!validateData.success) {
			logger.warn(
				{
					context: 'DEPOSIT_VALIDATION_FAILED',
					error: validateData.error.issues,
				},
				'Invalid amount input during deposit',
			);
			return c.json(
				{
					success: false,
					message: 'Validation failed',
					error: validateData.error.issues,
				},
				400,
			);
		}

		try {
			await prisma.$transaction(async (tx) => {
				await tx.wallet.update({
					where: { userId },
					data: {
						balance: {
							increment: validateData.data.amount,
						},
					},
				});

				await tx.transaction.create({
					data: {
						userId: userId,
						type: 'DEPOSIT',
						status: 'SUCCESS',
						amount: validateData.data.amount,
						remarks: 'Wallet recharge successful',
					},
				});
			});

			logger.info({ userId }, 'Deposit DB transaction succeeded');
		} catch (error) {
			logger.error(
				{
					alert: true,
					context: 'DEPOSIT_TX_FAIL',
					error,
					userId,
				},
				'Database transaction failed',
			);
			return c.json(
				{
					success: false,
					message: 'Failed to process deposit',
				},
				500,
			);
		}

		let response = await pushToQueue(EVENTS.DEPOSIT_BALANCE, {
			userId: userId,
			amount: validateData.data.amount,
		});

		if (!response.success && response.retryable) {
			for (let i = 0; i < 3; i++) {
				response = await pushToQueue(EVENTS.DEPOSIT_BALANCE, {
					userId: userId,
					amount: validateData.data.amount,
				});
				if (response.success) {
					logger.info({ attempt: i + 1, userId }, 'Engine sync succeeded on retry');
					break;
				}
			}
		}

		if (response.success) {
			logger.info({ userId }, 'Engine sync done');
		} else {
			logger.warn({ userId, alert: true }, 'Engine sync failed after retries');
		}

		return c.json(
			{
				success: true,
				message: response.message,
				data: response.data,
			},
			200,
		);
	} catch (error) {
		logger.error(
			{
				alert: true,
				context: 'DEPOSIT_CONTROLLER_FAIL',
				error,
			},
			'Unhandled error in deposit controller',
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
 * Get Deposit amount for a user
 * @param c Hono context
 * @returns Json response
 */

export const getDepositAmount = async (c: Context) => {
	try {
		const userId = c.get('user').id;

		if (!userId) {
			logger.warn(
				{
					context: 'GET_DEPOSIT_AMOUNT_UNAUTHORIZED',
				},
				'Unauthorized access attempt to getDepositAmount',
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
		});

		if (!user) {
			logger.warn(
				{
					context: 'GET_DEPOSIT_AMOUNT_USER_NOT_FOUND',
					userId,
				},
				'User not found in database',
			);
			return c.json(
				{
					success: false,
					message: 'User not found',
				},
				404,
			);
		}

		const { _sum } = await prisma.transaction.aggregate({
			_sum: {
				amount: true,
			},
			where: {
				userId,
				type: 'DEPOSIT',
				status: 'SUCCESS',
			},
		});

		const total = _sum.amount || 0;

		return c.json(
			{
				success: true,
				data: {
					totalDepositAmount: total,
				},
			},
			200,
		);
	} catch (error) {
		logger.error(
			{
				alert: true,
				context: 'GET_DEPOSIT_AMOUNT_CONTROLLER_FAIL',
				error,
			},
			'Unhandled error in getDepositAmount controller',
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
 * Withdraw money for user
 * @param c Hono context
 * @returns Json response
 */

export const withdraw = async (c: Context) => {
	try {
		const userId = c.get('user').id;

		if (!userId) {
			logger.warn(
				{
					context: 'WITHDRAW_UNAUTHORIZED',
				},
				'Unauthorized access attempt to withdraw',
			);
			return c.json(
				{
					success: false,
					error: 'Unauthorized',
				},
				401,
			);
		}

		const reqBody = await c.req.json<{
			amount: string;
			currentWalletAmount: string;
			paymentMethodId: string;
		}>();

		if (!reqBody.paymentMethodId) {
			return c.json({ success: false, message: 'Payment method is required' }, 400);
		}

		const amount = Number(reqBody.amount);
		const currentWalletAmount = Number(reqBody.currentWalletAmount);

		const calculatedFee = amount * 0.0025;
		const fee = Math.min(Math.max(calculatedFee, 5), 100);
		const totalDeduction = amount + fee;

		if (totalDeduction > currentWalletAmount) {
			return c.json(
				{
					success: false,
					message: 'Insufficient balance for withdrawal including fees',
				},
				400,
			);
		}

		const paymentMethod = await prisma.paymentMethod.findUnique({
			where: { id: reqBody.paymentMethodId, userId },
		});

		if (!paymentMethod || paymentMethod.status !== 'VERIFIED') {
			return c.json({ success: false, message: 'Invalid or unverified payment method' }, 400);
		}

		const transferId = `w_${uuidv4().replace(/-/g, '')}`;

		try {
			await triggerCashfreePayout({
				transferId,
				amount: amount,
				paymentMethod: {
					type: paymentMethod.type === 'UPI' ? 'UPI' : 'BANK',
					upiNumber: paymentMethod.upiNumber,
					accountNumber: paymentMethod.accountNumber,
					ifscCode: paymentMethod.ifscCode,
				},
			});
		} catch (error: any) {
			logger.error({ error, transferId }, 'Payout gateway failed in withdrawal');
			return c.json(
				{
					success: false,
					message:
						error.message || 'Payment gateway rejected the transfer. Please try again later.',
				},
				400,
			);
		}

		const response = await pushToQueue(EVENTS.WITHDRAW_BALANCE, {
			userId: userId,
			amount: totalDeduction,
		});

		if (!response.success) {
			return c.json(
				{
					success: false,
					message: response.message || 'Failed to deduct withdrawal from wallet',
					data: response.data,
				},
				400,
			);
		}

		if (response.success) {
			try {
				await prisma.$transaction(async (tx) => {
					await tx.wallet.update({
						where: { userId },
						data: { balance: { decrement: totalDeduction } },
					});

					await tx.transaction.create({
						data: {
							userId,
							amount,
							type: 'WITHDRAWAL',
							status: 'PENDING',
							remarks: `Payout transfer initiated [Transfer ID: ${transferId}]`,
						},
					});

					await tx.platformRevenue.create({
						data: {
							userId,
							amount: fee,
							type: 'WITHDRAWAL_FEE',
							remarks: `0.25% Withdrawal Fee (min 5, max 100) on ${amount}`,
						},
					});
				});
			} catch (error) {
				logger.error(
					{
						alert: true,
						error,
						userId,
						amount: totalDeduction,
					},
					'Failed to update DB after withdrawal',
				);
				return c.json(
					{
						success: false,
						message: 'Withdrawal processed but failed to update DB, please contact support',
					},
					500,
				);
			}
		}

		return c.json(
			{
				success: true,
				message: response.message,
				data: response.data,
			},
			200,
		);
	} catch (error) {
		logger.error(
			{
				alert: true,
				context: 'WITHDRAW_CONTROLLER_FAIL',
				error,
			},
			'Unhandled error in withdraw controller',
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
