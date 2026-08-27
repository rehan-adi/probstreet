import { io } from '@/app';
import { Hono } from 'hono';
import { ENV } from '@/config/env';
import { logger } from '@/libs/logger/logger';

export const routes = new Hono();

routes.get('/health', (c) => {
	return c.json(
		{
			success: true,
			message: 'stream service is up and running',
		},
		200,
	);
});

routes.post('/internal/notify', async (c: any) => {
	const secret = c.req.header('x-worker-secret');

	if (!secret || secret !== ENV.WORKER_SECRET) {
		logger.warn('[stream-service] Unauthorized /notify request');
		return c.json(
			{
				success: false,
				error: 'Unauthorized',
			},
			401,
		);
	}

	try {
		const { userId, notification } = await c.req.json();

		if (userId && notification) {
			io.to(`user:${userId}`).emit('NOTIFICATION', notification);
		} else {
			logger.warn('[stream-service] Missing userId or notification payload');
		}
		return c.json({ success: true });
	} catch (error) {
		logger.error('[stream-service] Error processing /notify request: ' + error);
		return c.json({ success: false, error: 'Invalid payload' }, 400);
	}
});
