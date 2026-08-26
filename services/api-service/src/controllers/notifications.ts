import { Context } from 'hono';
import { logger } from '@/libs/logger';
import { prisma } from '@probstreet/database';
import { client } from '@/libs/redis/connection';

export const notifyUser = async (userId: string, data: any) => {
	try {
		await client.publish(
			'stream:data',
			JSON.stringify({
				...data,
				type: 'NOTIFICATION',
				notificationType: data.type,
				symbol: userId,
			}),
		);
	} catch (error) {
		logger.error({ error }, 'Failed to publish notification to redis');
	}
};

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
