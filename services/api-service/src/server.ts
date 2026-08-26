import app from '@/app';
import { ENV } from '@/config/env';
import { logger } from '@/libs/logger';
import { startPriceAlertCron } from '@/crons/price-alert';
import { startNotificationCleanupCron } from '@/crons/notification-cleanup';

Bun.serve({
	fetch: app.fetch,
	port: ENV.PORT,
});

logger.info(`API service is running at http://localhost:${ENV.PORT}`);

startPriceAlertCron();
startNotificationCleanupCron();
