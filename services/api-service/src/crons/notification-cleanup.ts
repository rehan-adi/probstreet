import cron from 'node-cron';
import { logger } from '@/libs/logger';
import { prisma } from '@probstreet/database';

export function startNotificationCleanupCron() {
	logger.info('Starting Notification Cleanup Cron (every day at midnight)');

	cron.schedule('0 0 * * *', async () => {
		try {
			logger.info('Running notification cleanup...');

			const now = new Date();
			const thirtySixHoursAgo = new Date(now.getTime() - 36 * 60 * 60 * 1000);

			const readDeleted = await prisma.notification.deleteMany({
				where: {
					isRead: true,
					createdAt: {
						lt: thirtySixHoursAgo,
					},
				},
			});

			if (readDeleted.count > 0) {
				logger.info(`Deleted ${readDeleted.count} read notifications older than 36 hours.`);
			}

			const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

			const unreadDeleted = await prisma.notification.deleteMany({
				where: {
					isRead: false,
					createdAt: {
						lt: fourteenDaysAgo,
					},
				},
			});

			if (unreadDeleted.count > 0) {
				logger.info(`Deleted ${unreadDeleted.count} unread notifications older than 14 days.`);
			}

			logger.info('Notification cleanup finished.');
		} catch (error) {
			logger.error({ error }, 'Error running notification cleanup cron');
		}
	});
}
