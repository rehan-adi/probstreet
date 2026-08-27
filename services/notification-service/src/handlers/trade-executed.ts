import { logger } from '@/libs/logger/logger';
import { ENV_CONFIG } from '@/config/env';
import { notifyWebSockets } from '@/libs/ws';
import { sendBrevoEmail } from '@/libs/brevo/client';
import { sendFirebasePush } from '@/libs/firebase/push';
import { tradeExecutedEmailHtml } from '@/libs/brevo/templates/trade-executed';

export async function handleTradeExecuted(env: ENV_CONFIG, prisma: any, data: any): Promise<void> {
	const { makerId, takerId, marketId, marketTitle, stockType, price, quantity } = data;

	if (!makerId || !takerId) return;

	const totalValue = price * quantity;

	const users = await prisma.user.findMany({
		where: { id: { in: [makerId, takerId] } },
		include: { notificationPrefs: true },
	});

	for (const user of users) {
		const emailTradeExecuted = user.notificationPrefs?.emailTradeExecuted ?? false;
		const inAppTradeExecuted = user.notificationPrefs?.inAppTradeExecuted ?? true;

		if (emailTradeExecuted && user.email) {
			await sendBrevoEmail(
				env,
				user.email,
				`Trade Executed on "${marketTitle}"`,
				tradeExecutedEmailHtml(marketTitle, stockType, price, quantity, totalValue),
			).catch((err) => logger.error(`Failed to send email to ${user.email}:`, err));
		}

		if (inAppTradeExecuted) {
			const notificationData = {
				type: 'TRADE_EXECUTED',
				title: 'Trade Executed',
				message: `${quantity} ${stockType} shares at ₹${price} on "${marketTitle}"`,
				link: `/market/${marketId}`,
				metadata: { marketId, stockType, price, quantity },
			};

			await prisma.notification.create({
				data: {
					userId: user.id,
					...notificationData,
				},
			});

			await notifyWebSockets(env, user.id, {
				...notificationData,
				userId: user.id,
				createdAt: new Date(),
				isRead: false,
			});

			if (user.fcmToken) {
				await sendFirebasePush(
					env,
					user.fcmToken,
					'Trade Executed',
					`${quantity} ${stockType} @ ₹${price}`,
					{ marketId, type: 'TRADE_EXECUTED' },
				).catch((err) => logger.error(`Failed to send push to ${user.fcmToken}:`, err));
			}
		}
	}

	logger.info(`[trade.executed] Notifications sent for trade on market ${marketId}`);
}
