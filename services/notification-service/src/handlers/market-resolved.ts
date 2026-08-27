import { ENV_CONFIG } from '@/config/env';
import { notifyWebSockets } from '@/libs/ws';
import { logger } from '@/libs/logger/logger';
import { sendBrevoEmail } from '@/libs/brevo/client';
import { sendFirebasePush } from '@/libs/firebase/push';
import { marketResolvedEmailHtml } from '@/libs/brevo/templates/market-resolved';

export async function handleMarketResolved(env: ENV_CONFIG, prisma: any, data: any): Promise<void> {
	const { marketId, title, result, winners = [], holders = [] } = data;

	if (!marketId) return;

	const participants = holders.length > 0 ? holders : winners;
	if (!participants || participants.length === 0) return;

	const userIds = participants.map((p: any) => p.userId);

	let users: any[] = [];
	try {
		users = await prisma.user.findMany({
			where: { id: { in: userIds } },
			include: { notificationPrefs: true },
		});
	} catch (error) {
		logger.error(`[market.resolved] Failed to fetch users:`, error);
		return;
	}

	const notificationsToCreate: any[] = [];
	const websocketsToNotify: any[] = [];
	const pushesToSend: any[] = [];
	const emailsToSend: any[] = [];

	const winnerIds = new Set(winners.map((w: any) => w.userId));

	for (const user of users) {
		const isWinner = winnerIds.has(user.id);
		const message = isWinner
			? `"${title}" has been resolved to ${result}. You won your trades!`
			: `Market resolved to ${result}. Your positions have been settled.`;

		const notifTitle = isWinner ? 'Market Resolved 🏆' : 'Market Settled';

		const notificationData = {
			type: 'MARKET_RESOLVED',
			title: notifTitle,
			message,
			link: `/portfolio`,
			metadata: { marketId, result, isWinner },
		};

		const inAppMarketResolved = user.notificationPrefs?.inAppMarketResolved ?? true;
		const emailMarketResolved = user.notificationPrefs?.emailMarketResolved ?? true;

		if (inAppMarketResolved) {
			notificationsToCreate.push({
				userId: user.id,
				...notificationData,
			});

			websocketsToNotify.push({
				userId: user.id,
				data: {
					...notificationData,
					userId: user.id,
					createdAt: new Date(),
					isRead: false,
				},
			});

			if (user.fcmToken) {
				pushesToSend.push({
					token: user.fcmToken,
					title: notifTitle,
					body: isWinner
						? `"${title}" resolved to ${result}. Check your winnings!`
						: `"${title}" resolved to ${result}.`,
					data: { marketId, type: 'MARKET_RESOLVED' },
				});
			}
		}

		if (emailMarketResolved && user.email) {
			emailsToSend.push({
				email: user.email,
				subject: notifTitle,
				html: marketResolvedEmailHtml(title, result, isWinner),
			});
		}
	}

	try {
		if (notificationsToCreate.length > 0) {
			await prisma.notification.createMany({ data: notificationsToCreate });
			logger.info(
				`[market.resolved] In-app notifications saved for ${notificationsToCreate.length} users`,
			);
		}
	} catch (error) {
		logger.error(`[market.resolved] Failed to save in-app notifications:`, error);
	}

	if (websocketsToNotify.length > 0) {
		await Promise.allSettled(
			websocketsToNotify.map((ws) => notifyWebSockets(env, ws.userId, ws.data)),
		);
	}

	if (pushesToSend.length > 0) {
		await Promise.allSettled(
			pushesToSend.map((p) => sendFirebasePush(env, p.token, p.title, p.body, p.data)),
		);
		logger.info(`[market.resolved] Firebase pushes sent to ${pushesToSend.length} users`);
	}

	if (emailsToSend.length > 0) {
		await Promise.allSettled(
			emailsToSend.map((e) => sendBrevoEmail(env, e.email, e.subject, e.html)),
		);
		logger.info(`[market.resolved] Emails sent to ${emailsToSend.length} users`);
	}
}
