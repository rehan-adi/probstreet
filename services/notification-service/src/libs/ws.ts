import { ENV_CONFIG } from '@/config/env';
import { logger } from '@/libs/logger/logger';

export async function notifyWebSockets(env: ENV_CONFIG, userId: string, notification: any) {
	try {
		const url = `${env.STREAM_SERVICE_URL}/api/v1/internal/notify`;
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-worker-secret': env.WORKER_SECRET,
			},
			body: JSON.stringify({ userId, notification }),
		});
		await response.text(); // Consume body to prevent worker hang
	} catch (error) {
		logger.error('[notifyWebSockets] Failed to ping stream service: ' + error);
	}
}
