import cron from 'node-cron';
import { logger } from '@/libs/logger';
import { prisma } from '@probstreet/database';
import { sendNotification } from '@/libs/notification/dispatcher';

export function startPriceAlertCron() {
	logger.info('Starting Price Alert Cron (every 50s)');

	cron.schedule('*/50 * * * * *', async () => {
		try {
			logger.info('Checking for active price alerts...');

			const activeAlerts = await prisma.priceAlert.findMany({
				where: { isActive: true },
				include: {
					market: true,
					user: {
						include: {
							notificationPrefs: true,
						},
					},
				},
			});

			for (const alert of activeAlerts) {
				const currentPrice =
					alert.stockType === 'YES' ? Number(alert.market.yesPrice) : Number(alert.market.noPrice);
				const targetPrice = Number(alert.targetPrice);

				let isTriggered = false;
				if (alert.stockType === 'YES' && currentPrice >= targetPrice) {
					isTriggered = true;
				} else if (alert.stockType === 'NO' && currentPrice <= targetPrice) {
					isTriggered = true;
				}

				if (isTriggered) {
					// Check if user has holdings (quantity > 0) in this market
					const userPosition = await prisma.position.findFirst({
						where: {
							userId: alert.userId,
							marketId: alert.marketId,
							...(alert.stockType === 'YES'
								? { yesQuantity: { gt: 0 } }
								: { noQuantity: { gt: 0 } }),
						},
					});

					if (userPosition) {
						// 1. Dispatch notification
						await sendNotification({
							type: 'price.alert',
							data: {
								userId: alert.userId,
								marketId: alert.marketId,
								marketTitle: alert.market.title,
								currentPrice,
								stockType: alert.stockType,
								fcmToken: alert.user.fcmToken,
								email: alert.user.notificationPrefs?.emailNewMarket ? alert.user.email : null,
							},
						});
					}

					// 2. Mark as inactive (one-shot)
					await prisma.priceAlert.update({
						where: { id: alert.id },
						data: { isActive: false },
					});

					logger.info(
						{ alertId: alert.id, userId: alert.userId, sent: !!userPosition },
						'Price alert processed and deactivated',
					);
				}
			}
		} catch (error) {
			logger.error({ error }, 'Error running price alert cron');
		}
	});
}
