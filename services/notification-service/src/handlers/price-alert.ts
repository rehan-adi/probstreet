import { ENV_CONFIG } from '@/config/env';
import { notifyWebSockets } from '@/libs/ws';
import { logger } from '@/libs/logger/logger';
import { sendBrevoEmail } from '@/libs/brevo/client';
import { sendFirebasePush } from '@/libs/firebase/push';
import { priceAlertEmailHtml } from '@/libs/brevo/templates/price-alert';

export async function handlePriceAlert(env: ENV_CONFIG, prisma: any, data: any): Promise<void> {
	const { userId, marketId, marketTitle, currentPrice, stockType, fcmToken, email } = data;

	if (!userId || !marketId) return;

	const notificationData = {
		type: 'PRICE_ALERT',
		title: 'Price Alert',
		message: `${marketTitle}: ${stockType} price is now ₹${currentPrice}`,
		link: `/market/${marketId}`,
		metadata: { marketId, currentPrice, stockType },
	};

	await prisma.notification.create({
		data: {
			userId,
			...notificationData,
		},
	});

	await notifyWebSockets(env, userId, {
		...notificationData,
		userId,
		createdAt: new Date(),
		isRead: false,
	});

	if (fcmToken) {
		await sendFirebasePush(
			env,
			fcmToken,
			'Price Alert',
			`${marketTitle}: ${stockType} → ₹${currentPrice}`,
			{ marketId, type: 'PRICE_ALERT' },
		).catch((err) => logger.error(`[price.alert] Failed to send push to ${fcmToken}:`, err));
	}

	if (email) {
		await sendBrevoEmail(
			env,
			email,
			`Price Alert: ${marketTitle}`,
			priceAlertEmailHtml(marketTitle, stockType, currentPrice),
		).catch((err) => logger.error(`[price.alert] Failed to send email to ${email}:`, err));
	}

	logger.info(`[price.alert] Notification sent to user ${userId}`);
}
