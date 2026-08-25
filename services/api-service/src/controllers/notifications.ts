import { Context } from 'hono';
import { logger } from '@/libs/logger';
import { EventEmitter } from 'events';
import { streamSSE } from 'hono/streaming';
import { prisma } from '@probstreet/database';

export const notificationEmitter = new EventEmitter();

notificationEmitter.setMaxListeners(1000);

export const getNotifications = async (c: Context) => {
	try {
		const user = c.get('user');

		if (!user)
			return c.json(
				{
					success: false,
					error: 'Unauthorized',
				},
				401,
			);

		const limit = Number(c.req.query('limit')) || 20;

		const notifications = await prisma.notification.findMany({
			where: { userId: user.id },
			orderBy: { createdAt: 'desc' },
			take: limit,
		});

		const unreadCount = await prisma.notification.count({
			where: { userId: user.id, isRead: false },
		});

		return c.json({
			success: true,
			data: { notifications, unreadCount },
		});
	} catch (error) {
		logger.error({ error }, 'Failed to fetch notifications');
		return c.json(
			{
				success: false,
				error: 'Internal server error',
			},
			500,
		);
	}
};

export const markAsRead = async (c: Context) => {
	try {
		const user = c.get('user');

		if (!user)
			return c.json(
				{
					success: false,
					error: 'Unauthorized',
				},
				401,
			);

		const body = await c.req.json().catch(() => ({}));

		const { notificationIds } = body;

		if (notificationIds && Array.isArray(notificationIds)) {
			await prisma.notification.updateMany({
				where: {
					userId: user.id,
					id: { in: notificationIds },
					isRead: false,
				},
				data: { isRead: true },
			});
		} else {
			await prisma.notification.updateMany({
				where: {
					userId: user.id,
					isRead: false,
				},
				data: { isRead: true },
			});
		}

		return c.json({
			success: true,
			message: 'Notifications marked as read',
		});
	} catch (error) {
		logger.error({ error }, 'Failed to mark notifications as read');
		return c.json(
			{
				success: false,
				error: 'Internal server error',
			},
			500,
		);
	}
};

export const streamNotifications = async (c: Context) => {
	const user = c.get('user');

	if (!user)
		return c.json(
			{
				success: false,
				error: 'Unauthorized',
			},
			401,
		);

	const userId = user.id;

	return streamSSE(c, async (stream) => {
		await stream.writeSSE({
			data: JSON.stringify({ type: 'connected' }),
			event: 'connected',
		});

		const onNotification = async (notification: any) => {
			if (notification.userId === userId) {
				await stream.writeSSE({
					data: JSON.stringify(notification),
					event: 'notification',
				});
			}
		};

		notificationEmitter.on('new_notification', onNotification);

		const interval = setInterval(async () => {
			await stream.writeSSE({
				data: 'ping',
				event: 'ping',
			});
		}, 30000);

		stream.onAbort(() => {
			notificationEmitter.off('new_notification', onNotification);
			clearInterval(interval);
		});

		await new Promise(() => {});
	});
};
