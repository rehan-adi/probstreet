import { Hono } from 'hono';
import { ENV } from '@/config/env';
import * as nodemailer from 'nodemailer';
import { prisma } from '@probstreet/database';
import { notifyUser } from '@/controllers/notifications';

// Internal routes for the Notification Worker to read/write DB data.
// These are NOT exposed publicly. They are protected by a shared secret.

export const internalRoutes = new Hono();

const mailer = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: process.env.GMAIL_USER,
		pass: process.env.GMAIL_APP_PASSWORD,
	},
});

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

		const prefs = await prisma.notificationSettings.findUnique({
			where: { userId },
		});

		if (prefs) {
			if (type === 'NEW_MARKET' && !prefs.inAppNewMarket)
				return c.json({ success: true, skipped: true });
			if (type === 'TRADE_EXECUTED' && !prefs.inAppTradeExecuted)
				return c.json({ success: true, skipped: true });
			if (type === 'PRICE_ALERT' && !prefs.inAppPriceAlerts)
				return c.json({ success: true, skipped: true });
		}

		const notification = await prisma.notification.create({
			data: {
				userId,
				type,
				title,
				message,
				link: link ?? null,
				metadata: metadata ?? undefined,
			},
		});

		notifyUser(userId, notification);

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

		let finalUserIds = userIds;

		// Filter users based on their in-app preferences
		if (type === 'NEW_MARKET' || type === 'TRADE_EXECUTED' || type === 'PRICE_ALERT') {
			const prefs = await prisma.notificationSettings.findMany({
				where: { userId: { in: userIds } },
			});
			const optInMap = new Map(prefs.map((p) => [p.userId, p]));

			finalUserIds = userIds.filter((uid) => {
				const p = optInMap.get(uid);
				if (!p) return true; // fallback to default true if no record exists
				if (type === 'NEW_MARKET') return p.inAppNewMarket;
				if (type === 'TRADE_EXECUTED') return p.inAppTradeExecuted;
				if (type === 'PRICE_ALERT') return p.inAppPriceAlerts;
				return true;
			});
		}

		if (finalUserIds.length === 0) {
			return c.json({ success: true, skipped: true });
		}

		await prisma.notification.createMany({
			data: finalUserIds.map((userId) => ({
				userId,
				type,
				title,
				message,
				link: link ?? null,
				metadata: metadata ?? undefined,
			})),
		});

		finalUserIds.forEach((uid) => {
			notifyUser(uid, {
				userId: uid,
				type,
				title,
				message,
				link: link ?? null,
				metadata: metadata ?? undefined,
				createdAt: new Date(),
				isRead: false,
			});
		});

		return c.json({ success: true, count: finalUserIds.length });
	} catch (err: any) {
		return c.json({ error: err.message }, 500);
	}
});

internalRoutes.post('/notification/send-email', async (c) => {
	try {
		const { to, subject, html } = await c.req.json<{ to: string; subject: string; html: string }>();
		await mailer.sendMail({
			from: `"Probstreet" <${process.env.GMAIL_USER}>`,
			to,
			subject,
			html,
		});
		return c.json({ success: true });
	} catch (error: any) {
		return c.json({ success: false, error: error.message }, 500);
	}
});
