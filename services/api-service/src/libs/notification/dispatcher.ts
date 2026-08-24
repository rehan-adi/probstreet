import { ENV } from '@/config/env';
import { logger } from '@/libs/logger';

type NotificationEventType = 'otp.send' | 'market.created' | 'trade.executed' | 'price.alert';

interface NotificationEvent {
	type: NotificationEventType;
	data: Record<string, any>;
}

export const sendNotification = async (event: NotificationEvent): Promise<void> => {
	const workerUrl = ENV.NOTIFICATION_WORKER_URL;
	const workerSecret = ENV.WORKER_SECRET;

	if (!workerUrl) {
		logger.warn({ event: event.type }, 'NOTIFICATION_WORKER_URL not set, skipping notification');
		return;
	}

	try {
		const response = await fetch(workerUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-worker-secret': workerSecret,
			},
			body: JSON.stringify(event),
			signal: AbortSignal.timeout(3000),
		});

		if (!response.ok) {
			const text = await response.text();
			logger.warn(
				{
					status: response.status,
					body: text,
					event: event.type,
				},
				'Notification worker returned non-OK response',
			);
		} else {
			logger.info(
				{
					event: event.type,
				},
				'Notification event dispatched to worker',
			);
		}
	} catch (err: any) {
		logger.error(
			{ error: err.message, event: event.type },
			'Failed to dispatch notification to worker (swallowed)',
		);
	}
};
