import { ENV_CONFIG } from '@/config/env';
import { processEvent, NotificationEvent } from '@/router';

export default {
	// ── HTTP handler: called directly by our API service (local dev + staging) ──
	async fetch(request: Request, env: ENV_CONFIG, ctx: ExecutionContext): Promise<Response> {
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
		if (!secret || secret !== env.WORKER_SECRET) {
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
			processEvent(env, event).catch((err) =>
				console.error(`[worker] Error processing event ${event.type}:`, err),
			),
		);

		return new Response(JSON.stringify({ success: true, queued: true }), {
			status: 202,
			headers: { 'Content-Type': 'application/json' },
		});
	},

	// ── Queue handler: called by Cloudflare Queue (production) ──
	async queue(batch: MessageBatch<NotificationEvent>, env: ENV_CONFIG): Promise<void> {
		for (const message of batch.messages) {
			try {
				await processEvent(env, message.body);
				message.ack();
			} catch (err) {
				console.error(`[queue] Failed to process message:`, err);
				message.retry(); // Cloudflare will retry up to max_retries times
			}
		}
	},

	// ── Cron handler: called by Cloudflare Cron Triggers (price alerts) ──
	// This is intentionally empty — price alert crons are driven by your
	// BACKEND (api-service or processor-service), not by this worker.
	// The backend checks positions, finds triggered alerts, and PUSHES
	// price.alert events to this worker via the HTTP or Queue route above.
	async scheduled(
		controller: ScheduledController,
		env: ENV_CONFIG,
		ctx: ExecutionContext,
	): Promise<void> {
		console.log(`[cron] Scheduled trigger fired at ${new Date().toISOString()}`);
	},
};
