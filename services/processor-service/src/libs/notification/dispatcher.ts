import { ENV } from '@/config/env';
import { logger } from '@/libs/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Notification Dispatcher (Processor Service)
//
// Identical to the API service dispatcher — a fire-and-forget HTTP call
// to the Cloudflare Notification Worker. Errors are swallowed so notification
// failures never crash the Kafka processor.
// ─────────────────────────────────────────────────────────────────────────────

type NotificationEventType =
	'otp.send' | 'market.created' | 'trade.executed' | 'price.alert' | 'market.resolved';

interface NotificationEvent {
	type: NotificationEventType;
	data: Record<string, any>;
}

export const sendNotification = async (event: NotificationEvent): Promise<void> => {
	const workerUrl = ENV.NOTIFICATION_WORKER_URL;
	const workerSecret = ENV.WORKER_SECRET;

	if (!workerUrl) return;

	try {
		await fetch(workerUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-worker-secret': workerSecret,
			},
			body: JSON.stringify(event),
			signal: AbortSignal.timeout(3000),
		});

		logger.info({ event: event.type }, 'Notification event dispatched');
	} catch (err: any) {
		logger.error(
			{ error: err.message, event: event.type },
			'Failed to dispatch notification (swallowed)',
		);
	}
};
