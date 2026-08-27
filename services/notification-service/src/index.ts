import { ENV_CONFIG, validateEnv } from '@/config/env';
import { processEvent, NotificationEvent } from '@/router';
import { logger } from '@/libs/logger/logger';

export default {
	// ── HTTP handler: called directly by our API service (local dev + staging) ──
	async fetch(request: Request, env: ENV_CONFIG, ctx: ExecutionContext): Promise<Response> {
		const validEnv = validateEnv(env);

		if (request.method === 'GET') {
			return new Response(JSON.stringify({ status: 'ok', worker: 'notification-service' }), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		// Verify the shared secret so only our backend can call this
		const secret = request.headers.get('x-worker-secret');
		if (!secret || secret !== validEnv.WORKER_SECRET) {
			return new Response('Unauthorized', { status: 401 });
		}

		let event: NotificationEvent;
		try {
			event = (await request.json()) as NotificationEvent;
		} catch {
			return new Response('Invalid JSON body', { status: 400 });
		}

		// Fire-and-forget: we respond immediately and process in background.
		// This keeps API response times fast — the caller doesn't wait for emails.
		ctx.waitUntil(
			processEvent(validEnv, event).catch((err) =>
				logger.error(`[worker] Error processing event ${event.type}: ` + err),
			),
		);

		return new Response(JSON.stringify({ success: true, queued: true }), {
			status: 202,
			headers: { 'Content-Type': 'application/json' },
		});
	},

	// ── Queue handler: called by Cloudflare Queue (production) ──
	async queue(batch: MessageBatch<NotificationEvent>, env: ENV_CONFIG): Promise<void> {
		const validEnv = validateEnv(env);
		for (const message of batch.messages) {
			try {
				await processEvent(validEnv, message.body);
				message.ack();
			} catch (err) {
				logger.error(`[queue] Failed to process message: ` + err);
				message.retry(); // Cloudflare will retry up to max_retries times
			}
		}
	},

	// ── Cron handler: called by Cloudflare Cron Triggers (price alerts) ──
	async scheduled(
		controller: ScheduledController,
		env: ENV_CONFIG,
		ctx: ExecutionContext,
	): Promise<void> {
		logger.info(`[cron] Scheduled trigger fired at ${new Date().toISOString()}`);
	},
};
