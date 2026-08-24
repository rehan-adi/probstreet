import { Hono } from 'hono';
import { ENV } from '@/config/env';
import { prisma } from '@probstreet/database';

// Internal routes for the Notification Worker to read/write DB data.
// These are NOT exposed publicly. They are protected by a shared secret.

export const internalRoutes = new Hono();

internalRoutes.use('*', async (c, next) => {
	const secret = c.req.header('x-worker-secret');
	if (!secret || secret !== ENV.WORKER_SECRET) {
		return c.json(
			{
				success: false,
				error: 'Unauthorized Access',
			},
			401,
		);
	}
	await next();
});

// ─── GET: fetch all users subscribed to market notifications ─────────────────
// Called by worker when handling market.created event

internalRoutes.post('/notification/market-subscribers', async (c) => {
	try {
		const users = await prisma.user.findMany({
			where: {
				notificationPrefs: {
					OR: [{ emailNewMarket: true }, { inAppNewMarket: true }],
				},
				deletedAt: null,
			},
			select: {
				id: true,
				email: true,
				fcmToken: true,
				notificationPrefs: {
					select: {
						emailNewMarket: true,
						inAppNewMarket: true,
					},
				},
			},
		});

		return c.json({
			users: users.map((u) => ({
				userId: u.id,
				email: u.email,
				fcmToken: u.fcmToken,
				emailNewMarket: u.notificationPrefs?.emailNewMarket ?? false,
				inAppNewMarket: u.notificationPrefs?.inAppNewMarket ?? false,
			})),
		});
	} catch (err: any) {
		return c.json(
			{
				success: false,
				error: err.message,
			},
			500,
		);
	}
});

// ─── GET: fetch specific users by IDs with their prefs ───────────────────────
// Called by worker when handling trade.executed event

internalRoutes.post('/notification/users-by-ids', async (c) => {
	try {
		const { userIds } = await c.req.json<{ userIds: string[] }>();

		const users = await prisma.user.findMany({
			where: { id: { in: userIds }, deletedAt: null },
			select: {
				id: true,
				email: true,
				fcmToken: true,
				notificationPrefs: {
					select: {
						emailTradeExecuted: true,
						inAppTradeExecuted: true,
					},
				},
			},
		});

		return c.json({
			users: users.map((u) => ({
				userId: u.id,
				email: u.email,
				fcmToken: u.fcmToken,
				emailTradeExecuted: u.notificationPrefs?.emailTradeExecuted ?? false,
				inAppTradeExecuted: u.notificationPrefs?.inAppTradeExecuted ?? true,
			})),
		});
	} catch (err: any) {
		return c.json({ error: err.message }, 500);
	}
});

// ─── POST: save a single in-app notification to DB ───────────────────────────

internalRoutes.post('/notification/save', async (c) => {
	try {
		const { userId, type, title, message, link, metadata } = await c.req.json();

		await prisma.notification.create({
			data: {
				userId,
				type,
				title,
				message,
				link: link ?? null,
				metadata: metadata ?? undefined,
			},
		});

		return c.json({ success: true });
	} catch (err: any) {
		return c.json({ error: err.message }, 500);
	}
});

// ─── POST: save multiple in-app notifications in bulk ────────────────────────

internalRoutes.post('/notification/save-bulk', async (c) => {
	try {
		const { userIds, type, title, message, link, metadata } = await c.req.json<{
			userIds: string[];
			type: string;
			title: string;
			message: string;
			link?: string;
			metadata?: Record<string, any>;
		}>();

		await prisma.notification.createMany({
			data: userIds.map((userId) => ({
				userId,
				type,
				title,
				message,
				link: link ?? null,
				metadata: metadata ?? undefined,
			})),
		});

		return c.json({ success: true, count: userIds.length });
	} catch (err: any) {
		return c.json({ error: err.message }, 500);
	}
});
