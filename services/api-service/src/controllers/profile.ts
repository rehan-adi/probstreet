import { Context } from 'hono';
import { logger } from '@/libs/logger';
import { prisma } from '@probstreet/database';
import { client as redis } from '@/libs/redis/connection';

export const getProfile = async (c: Context) => {
	try {
		const user = c.get('user');
		if (!user) {
			return c.json({ success: false, message: 'Unauthorized' }, 401);
		}

		const dbUser = await prisma.user.findUnique({
			where: { id: user.id },
			select: {
				id: true,
				username: true,
				phone: true,
				avatarUrl: true,
				createdAt: true,
			},
		});

		if (!dbUser) {
			return c.json({ success: false, message: 'User not found' }, 404);
		}

		return c.json({
			success: true,
			data: dbUser,
		});
	} catch (error: any) {
		logger.error({ context: 'GET_PROFILE', message: error.message });
		return c.json({ success: false, message: 'Internal server error' }, 500);
	}
};

export const updateProfile = async (c: Context) => {
	try {
		const user = c.get('user');
		if (!user) {
			return c.json({ success: false, message: 'Unauthorized' }, 401);
		}

		const body = await c.req.json();
		const { name, avatarUrl } = body;

		const updateData: any = {};
		if (name !== undefined) updateData.name = name;
		if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

		const updatedUser = await prisma.user.update({
			where: { id: user.id },
			data: updateData,
			select: {
				id: true,
				username: true,
				phone: true,
				avatarUrl: true,
			},
		});

		return c.json({
			success: true,
			message: 'Profile updated successfully',
			data: updatedUser,
		});
	} catch (error: any) {
		logger.error({ context: 'UPDATE_PROFILE', message: error.message });
		return c.json({ success: false, message: 'Internal server error' }, 500);
	}
};

export const addToWatchlist = async (c: Context) => {
	try {
		const user = c.get('user');
		if (!user) return c.json({ success: false, message: 'Unauthorized' }, 401);

		const body = await c.req.json();
		const { marketId } = body;

		if (!marketId) {
			return c.json({ success: false, message: 'marketId is required' }, 400);
		}

		await prisma.watchlist.upsert({
			where: { userId_marketId: { userId: user.id, marketId } },
			update: {},
			create: { userId: user.id, marketId },
		});

		return c.json({ success: true, message: 'Added to watchlist' });
	} catch (error: any) {
		logger.error({ context: 'ADD_WATCHLIST', message: error.message });
		return c.json({ success: false, message: 'Internal server error' }, 500);
	}
};

export const removeFromWatchlist = async (c: Context) => {
	try {
		const user = c.get('user');
		if (!user) return c.json({ success: false, message: 'Unauthorized' }, 401);

		const { marketId } = c.req.param();

		await prisma.watchlist.delete({
			where: { userId_marketId: { userId: user.id, marketId } },
		});

		return c.json({ success: true, message: 'Removed from watchlist' });
	} catch (error: any) {
		logger.error({ context: 'REMOVE_WATCHLIST', message: error.message });
		return c.json({ success: false, message: 'Internal server error' }, 500);
	}
};

export const getWatchlist = async (c: Context) => {
	try {
		const user = c.get('user');
		if (!user) return c.json({ success: false, message: 'Unauthorized' }, 401);

		const watchlist = await prisma.watchlist.findMany({
			where: { userId: user.id },
			include: {
				market: {
					select: {
						id: true,
						title: true,
						yesPrice: true,
						noPrice: true,
						thumbnail: true,
						symbol: true,
						status: true,
					},
				},
			},
			orderBy: { createdAt: 'desc' },
		});

		return c.json({ success: true, data: watchlist.map((w) => w.market) });
	} catch (error: any) {
		logger.error({ context: 'GET_WATCHLIST', message: error.message });
		return c.json({ success: false, message: 'Internal server error' }, 500);
	}
};

export const getUserTrades = async (c: Context) => {
	try {
		const user = c.get('user');
		if (!user) return c.json({ success: false, message: 'Unauthorized' }, 401);

		const limit = Number(c.req.query('limit') || 50);

		const trades = await prisma.trade.findMany({
			where: {
				OR: [{ makerId: user.id }, { takerId: user.id }],
			},
			orderBy: { createdAt: 'desc' },
			take: limit > 100 ? 100 : limit,
			select: {
				id: true,
				marketId: true,
				makerId: true,
				takerId: true,
				stockType: true,
				takerAction: true,
				price: true,
				quantity: true,
				matchType: true,
				createdAt: true,
			},
		});

		return c.json({ success: true, data: trades });
	} catch (error: any) {
		logger.error({ context: 'GET_USER_TRADES', message: error.message });
		return c.json({ success: false, message: 'Internal server error' }, 500);
	}
};

export const getPublicProfile = async (c: Context) => {
	try {
		const { username } = c.req.param();

		const user = await prisma.user.findUnique({
			where: { username },
			select: {
				id: true,
				username: true,
				bio: true,
				avatarUrl: true,
				createdAt: true,
			},
		});

		if (!user)
			return c.json(
				{
					success: false,
					message: 'User not found',
				},
				404,
			);

		const [tradeStats, openPositionsCount] = await Promise.all([
			prisma.trade.aggregate({
				where: {
					OR: [
						{
							makerId: user.id,
						},
						{ takerId: user.id },
					],
				},
				_count: { id: true },
			}),

			prisma.position.count({
				where: {
					userId: user.id,
					OR: [{ yesQuantity: { gt: 0 } }, { noQuantity: { gt: 0 } }],
				},
			}),
		]);

		let netProfit = 0;

		try {
			const score = await redis.zscore('leaderboard:all_time', user.id);
			netProfit = score ? parseFloat(score) : 0;
		} catch {}

		const positions = await prisma.position.findMany({
			where: {
				userId: user.id,
				OR: [{ yesQuantity: { gt: 0 } }, { noQuantity: { gt: 0 } }],
			},
			take: 10,
			include: {
				market: {
					select: {
						id: true,
						title: true,
						symbol: true,
						yesPrice: true,
						noPrice: true,
						thumbnail: true,
						status: true,
						endTime: true,
					},
				},
			},
		});

		return c.json({
			success: true,
			data: {
				id: user.id,
				username: user.username,
				bio: user.bio,
				avatarUrl: user.avatarUrl,
				joinedAt: user.createdAt,
				stats: {
					tradesCount: tradeStats._count.id,
					openPositions: openPositionsCount,
					netProfit: Math.round(netProfit * 100) / 100,
				},
				positions,
			},
		});
	} catch (error: any) {
		logger.error({ context: 'GET_PUBLIC_PROFILE', message: error.message });
		return c.json({ success: false, message: 'Internal server error' }, 500);
	}
};
