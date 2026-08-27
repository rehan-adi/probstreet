import { ENV_CONFIG } from '@/config/env';
import { notifyWebSockets } from '@/libs/ws';
import { logger } from '@/libs/logger/logger';
import { sendBrevoEmail } from '@/libs/brevo/client';
import { sendFirebasePush } from '@/libs/firebase/push';
import { newMarketEmailHtml } from '@/libs/brevo/templates/market-created';

export async function handleMarketCreated(env: ENV_CONFIG, prisma: any, data: any): Promise<void> {
	const { marketId, title, slug } = data;

	if (!marketId || !title) throw new Error('Missing marketId or title');

	const settings = await prisma.notificationSettings.findMany({
		where: {
			OR: [{ emailNewMarket: true }, { inAppNewMarket: true }],
		},
		include: { user: true },
	});

	const emailUsers = settings.filter((s: any) => s.emailNewMarket && s.user.email);
	const inAppUsers = settings.filter((s: any) => s.inAppNewMarket);

	if (emailUsers.length > 0) {
		const results = await Promise.allSettled(
			emailUsers.map((s: any) =>
				sendBrevoEmail(
					env,
					s.user.email,
					`New Market: ${title}`,
					newMarketEmailHtml(title, slug || marketId),
				),
			),
		);
		logger.info(
			`[market.created] Sent emails. Results:`,
			results.map((r) => (r.status === 'rejected' ? r.reason?.message || r.reason : 'fulfilled')),
		);
	}

	if (inAppUsers.length > 0) {
		const notificationData = {
			type: 'NEW_MARKET',
			title: 'New brand new market is live',
			message: `"${title}" is now live`,
			link: `/events/${slug || marketId}`,
			metadata: { marketId },
		};

		await prisma.notification.createMany({
			data: inAppUsers.map((s: any) => ({
				userId: s.userId,
				...notificationData,
			})),
		});

		const pushUsers = inAppUsers.filter((s: any) => s.user.fcmToken);

		await Promise.allSettled(
			pushUsers.map((s: any) =>
				sendFirebasePush(env, s.user.fcmToken, 'New Market Available', `"${title}" is now live!`, {
					marketId,
					type: 'NEW_MARKET',
				}),
			),
		);

		await Promise.allSettled(
			inAppUsers.map((s: any) =>
				notifyWebSockets(env, s.userId, {
					...notificationData,
					userId: s.userId,
					createdAt: new Date(),
					isRead: false,
				}),
			),
		);

		logger.info(`[market.created] In-app notifications saved for ${inAppUsers.length} users`);
	}
}
