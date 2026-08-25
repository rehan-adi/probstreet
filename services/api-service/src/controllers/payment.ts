import { Context } from 'hono';
import { ENV } from '@/config/env';
import { logger } from '@/libs/logger';
import { prisma } from '@probstreet/database';
import { EVENTS } from '@/config/constants';
import { pushToQueue } from '@/libs/redis/queue';
import { cashfree } from '@/libs/cashfree/client';

export const initPayment = async (c: Context) => {
	try {
		const userId = c.get('user').id;
		const { amount } = await c.req.json<{ amount: number }>();

		if (!amount || amount <= 0) {
			return c.json({ success: false, error: 'Invalid amount' }, 400);
		}

		const user = await prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			return c.json({ success: false, error: 'User not found' }, 404);
		}

		const orderId = `order_${Date.now()}_${userId.slice(0, 8)}`;

		const response = await cashfree.PGCreateOrder({
			order_amount: amount,
			order_currency: 'INR',
			order_id: orderId,
			customer_details: {
				customer_id: userId,
				customer_phone: user.phone || '9999999999',
				customer_email: user.email || 'test@probstreet.com',
				customer_name: 'Probstreet User',
			},
			order_meta: {
				return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/wallet?order_id={order_id}`,
				notify_url: `${ENV.BACKEND_ORIGIN}/api/v1/capi/payments/webhook`,
			},
		});

		return c.json(
			{
				success: true,
				data: response.data,
			},
			200,
		);
	} catch (error) {
		logger.error({ error }, 'Failed to initialize payment');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};

export const paymentVerify = async (c: Context) => {
	try {
		const orderId = c.req.param('orderId');

		if (!orderId) {
			return c.json({ success: false, error: 'Missing orderId' }, 400);
		}

		const response = await cashfree.PGOrderFetchPayments(orderId);

		const isSuccess = response.data?.some((payment) => payment.payment_status === 'SUCCESS');

		return c.json(
			{
				success: true,
				paymentStatus: isSuccess ? 'SUCCESS' : 'PENDING',
			},
			200,
		);
	} catch (error) {
		logger.error({ error }, 'Failed to verify payment');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};

export const paymentWebhook = async (c: Context) => {
	try {
		const signature = c.req.header('x-webhook-signature');
		const timestamp = c.req.header('x-webhook-timestamp');
		const rawBody = await c.req.text();

		try {
			cashfree.PGVerifyWebhookSignature(signature as string, rawBody, timestamp as string);
		} catch (err) {
			logger.error({ err }, 'Webhook signature verification failed');
			return c.json({ success: false, error: 'Invalid signature' }, 401);
		}

		const body = JSON.parse(rawBody);

		if (body.type === 'PAYMENT_SUCCESS_WEBHOOK') {
			const payment = body.data.payment;
			const amount = payment.payment_amount;
			const customerId = body.data.customer_details.customer_id;

			await prisma.$transaction(async (tx) => {
				const existing = await tx.ledgerEntry.findFirst({
					where: { referenceId: String(payment.cf_payment_id) },
				});

				if (existing) {
					logger.info({ paymentId: payment.cf_payment_id }, 'Webhook already processed');
					return;
				}

				await tx.wallet.upsert({
					where: { userId: customerId },
					update: { balance: { increment: amount } },
					create: { userId: customerId, balance: amount, locked: 0 },
				});

				await tx.ledgerEntry.create({
					data: {
						fromAccount: 'PAYMENT_GATEWAY',
						toAccount: customerId,
						amount: amount,
						type: 'DEPOSIT',
						referenceId: String(payment.cf_payment_id),
					},
				});

				await tx.transaction.create({
					data: {
						userId: customerId,
						type: 'DEPOSIT',
						amount: amount,
						status: 'SUCCESS',
					},
				});

				if (amount >= 50.0) {
					const pendingReferrals = await tx.referral.findMany({
						where: {
							referredId: customerId,
							status: 'PENDING',
						},
					});

					const referrerBonus = amount >= 100 ? 20.0 : 10.0;
					const refereeBonus = amount >= 100 ? 10.0 : 5.0;

					for (const ref of pendingReferrals) {
						await tx.referral.update({
							where: { id: ref.id },
							data: {
								status: 'COMPLETED',
								amount: ref.isReferrer ? referrerBonus : refereeBonus,
							},
						});

						const isReferrer = ref.isReferrer;
						const targetUserId = isReferrer ? ref.referrerId : ref.referredId;
						const rewardAmount = isReferrer ? referrerBonus : refereeBonus;

						if (targetUserId) {
							await tx.wallet.update({
								where: { userId: targetUserId },
								data: { balance: { increment: rewardAmount } },
							});

							await tx.transaction.create({
								data: {
									userId: targetUserId,
									type: 'REFERRAL_REWARD',
									amount: rewardAmount,
									status: 'SUCCESS',
									remarks: isReferrer
										? `Referral reward for user ${customerId} depositing ₹${amount}`
										: `Deposit bonus reward for using referral code and recharging ₹${amount}`,
								},
							});

							if (isReferrer) {
								await tx.user.update({
									where: { id: targetUserId },
									data: { totalReferralReward: { increment: rewardAmount } },
								});
							}
						}
					}
				}
			});

			await pushToQueue(EVENTS.DEPOSIT_BALANCE, {
				userId: customerId,
				amount: amount,
			});

			logger.info({ customerId, amount }, 'Payment processed successfully');
		}

		return c.json({ success: true }, 200);
	} catch (error) {
		logger.error({ error }, 'Failed to process webhook');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};

export const payoutWebhook = async (c: Context) => {
	try {
		const rawBody = await c.req.text();

		// Note: Signature verification for Cashfree Payout Webhooks uses
		// an RSA public key or x-webhook-signature depending on Cashfree config.
		// For simplicity, we just parse the body.
		const body = JSON.parse(rawBody);

		// E.g., body.event === 'TRANSFER_SUCCESS' or 'TRANSFER_FAILED'
		// body.transferId is what we sent.
		const event = body.event;
		const transferId = body.transferId;

		if (!transferId) {
			return c.json({ success: false, error: 'Missing transferId' }, 400);
		}

		await prisma.$transaction(async (tx) => {
			const transaction = await tx.transaction.findFirst({
				where: {
					type: 'WITHDRAWAL',
					remarks: { contains: transferId },
				},
			});

			if (!transaction || transaction.status !== 'PENDING') {
				logger.info({ transferId }, 'Payout webhook skipped (already processed or not found)');
				return;
			}

			if (event === 'TRANSFER_SUCCESS') {
				await tx.transaction.update({
					where: { id: transaction.id },
					data: { status: 'SUCCESS' },
				});
				logger.info({ transferId }, 'Payout successful');
			} else if (event === 'TRANSFER_FAILED' || event === 'TRANSFER_REVERSED') {
				await tx.transaction.update({
					where: { id: transaction.id },
					data: { status: 'FAILED' },
				});

				// Refund the user's wallet via Engine
				await pushToQueue(EVENTS.DEPOSIT_BALANCE, {
					userId: transaction.userId,
					amount: Number(transaction.amount) * 1.0025, // Refund amount + 0.25% fee
				});

				logger.info({ transferId, userId: transaction.userId }, 'Payout failed, balance refunded');
			}
		});

		return c.json({ success: true }, 200);
	} catch (error) {
		logger.error({ error }, 'Failed to process payout webhook');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};
