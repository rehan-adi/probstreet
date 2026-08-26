import { Context } from 'hono';
import { ENV } from '@/config/env';
import { logger } from '@/libs/logger';
import { prisma } from '@probstreet/database';
import { EVENTS } from '@/config/constants';
import { pushToQueue } from '@/libs/redis/queue';
import { client } from '@/libs/redis/connection';
import { cashfree } from '@/libs/cashfree/client';

export const initPayment = async (c: Context) => {
	try {
		const userId = c.get('user').id;
		const { amount } = await c.req.json<{ amount: number }>();

		if (!amount || amount < 1 || amount > 500000) {
			return c.json(
				{
					success: false,
					error: 'Amount must be greater than ₹0 and less than ₹500,000',
				},
				400,
			);
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
				return_url: `${ENV.FRONTEND_URL}/wallet?order_id={order_id}`,
				notify_url: `${ENV.BACKEND_ORIGIN}/api/v1/capi/payments/webhook`,
			},
		});

		if (response.status === 200 && response.data) {
			return c.json({
				success: true,
				data: response.data,
				payment_session_id: response.data.payment_session_id,
				order_id: orderId,
			});
		}

		return c.json({ success: false, error: 'Failed to create payment session' }, 500);
	} catch (error) {
		logger.error({ error }, 'Payment init failed');
		return c.json({ success: false, error: 'Payment initialization failed' }, 500);
	}
};

export const paymentVerify = async (c: Context) => {
	try {
		const orderId = c.req.param('orderId');

		if (!orderId) {
			return c.json({ success: false, error: 'Order ID is required' }, 400);
		}

		const response = await cashfree.PGOrderFetchPayments(orderId);

		if (response.status === 200 && response.data) {
			const payment = response.data[0];
			const isSuccess = payment?.payment_status === 'SUCCESS';

			return c.json({
				success: true,
				status: isSuccess ? 'SUCCESS' : 'PENDING',
				amount: payment?.payment_amount,
				paymentId: payment?.cf_payment_id,
			});
		}

		return c.json({ success: false, error: 'Failed to verify payment' }, 400);
	} catch (error) {
		logger.error({ error }, 'Payment verification failed');
		return c.json({ success: false, error: 'Verification failed' }, 500);
	}
};

export const paymentWebhook = async (c: Context) => {
	try {
		const signature = c.req.header('x-webhook-signature');
		const timestamp = c.req.header('x-webhook-timestamp');
		const rawBody = await c.req.text();

		if (!signature || !timestamp) {
			logger.warn('Webhook rejected: missing signature or timestamp headers');
			return c.json(
				{
					success: false,
					error: 'Unauthorized',
				},
				401,
			);
		}

		try {
			cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
		} catch (err) {
			logger.warn({ err }, 'Webhook rejected: invalid signature');
			return c.json({ success: false, error: 'Unauthorized' }, 401);
		}

		const body = JSON.parse(rawBody);

		if (body.type === 'PAYMENT_SUCCESS_WEBHOOK') {
			const payment = body.data?.payment;
			const amount = payment?.payment_amount;
			const customerId = body.data?.customer_details?.customer_id;
			const paymentId = String(payment?.cf_payment_id || body.data?.order?.order_id || Date.now());

			const lockKey = `lock:webhook:payment:${paymentId}`;
			const acquired = await client.set(lockKey, '1', 'EX', 60, 'NX');
			if (!acquired) {
				logger.info({ paymentId }, 'Concurrent webhook delivery skipped (lock already acquired)');
				return c.json({ success: true, message: 'Already processing' }, 200);
			}

			let shouldCreditEngine = false;

			await prisma.$transaction(async (tx) => {
				const existing = await tx.ledgerEntry.findFirst({
					where: { referenceId: paymentId },
				});

				if (existing) {
					logger.info({ paymentId }, 'Webhook already processed');
					return;
				}

				shouldCreditEngine = true;

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
						referenceId: paymentId,
					},
				});

				await tx.transaction.create({
					data: {
						userId: customerId,
						type: 'DEPOSIT',
						amount: amount,
						status: 'SUCCESS',
						remarks: `Deposit via Cashfree [Ref: ${paymentId}]`,
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

			if (shouldCreditEngine) {
				await pushToQueue(EVENTS.DEPOSIT_BALANCE, {
					userId: customerId,
					amount: amount,
				});

				logger.info(
					{ customerId, amount, paymentId },
					'Payment processed successfully into engine',
				);
			}
		}

		return c.json({ success: true }, 200);
	} catch (error) {
		logger.error({ error }, 'Failed to process webhook');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};

export const payoutWebhook = async (c: Context, bodyOverride?: any) => {
	try {
		let body = bodyOverride && typeof bodyOverride === 'object' ? bodyOverride : null;

		if (!body) {
			const rawBody = await c.req.text();
			logger.info({ rawBody }, 'Received payout webhook raw body');
			body = JSON.parse(rawBody);
		}

		const event = body.event || body.type;
		const transferId =
			body.transferId || body.data?.transferId || body.data?.transfer_id || body.transfer_id;

		if (!transferId) {
			logger.info(
				{ event, body },
				'Received payout webhook without transferId (e.g. verification or system alert), acknowledging 200',
			);
			return c.json({ success: true, message: 'Acknowledged' }, 200);
		}

		const lockKey = `lock:webhook:payout:${transferId}:${event}`;
		const acquired = await client.set(lockKey, '1', 'EX', 60, 'NX');

		if (!acquired) {
			logger.info({ transferId, event }, 'Concurrent payout webhook skipped');
			return c.json({ success: true, message: 'Already processing' }, 200);
		}

		let refundEngine = false;
		let refundUserId = '';
		let refundAmount = 0;

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
				logger.info({ transferId }, 'Payout marked as SUCCESS');
			} else if (event === 'TRANSFER_FAILED' || event === 'TRANSFER_REVERSED') {
				await tx.transaction.update({
					where: { id: transaction.id },
					data: { status: 'FAILED' },
				});

				refundEngine = true;
				refundUserId = transaction.userId;
				refundAmount = Number(transaction.amount) * 1.0025;

				await tx.wallet.update({
					where: { userId: refundUserId },
					data: { balance: { increment: refundAmount } },
				});

				logger.info({ transferId, userId: refundUserId }, 'Payout failed, balance refunded in DB');
			}
		});

		if (refundEngine && refundUserId && refundAmount > 0) {
			await pushToQueue(EVENTS.DEPOSIT_BALANCE, {
				userId: refundUserId,
				amount: refundAmount,
			});
			logger.info({ transferId, refundUserId, refundAmount }, 'Refund balance credited in engine');
		}

		return c.json({ success: true }, 200);
	} catch (error) {
		logger.error({ error }, 'Failed to process payout webhook');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};
