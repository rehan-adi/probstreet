import { Context } from 'hono';
import { logger } from '@/libs/logger';
import { prisma } from '@probstreet/database';
import { EVENTS } from '@/config/constants';
import { pushToQueue } from '@/libs/redis/queue';

export const resolveMarket = async (c: Context) => {
	try {
		const body = await c.req.json();
		const { marketId, resolution } = body;

		if (!marketId || !resolution || !['YES', 'NO', 'CANCEL'].includes(resolution)) {
			return c.json(
				{
					success: false,
					error: 'Invalid or missing marketId or resolution (YES/NO/CANCEL)',
				},
				400,
			);
		}

		const market = await prisma.market.findUnique({
			where: { id: marketId },
		});

		if (!market) {
			return c.json({ success: false, error: 'Market not found' }, 404);
		}
		if (market.status === 'CLOSED') {
			return c.json({ success: false, error: 'Market is already closed' }, 400);
		}

		// Push to Engine Queue
		const response = await pushToQueue(EVENTS.RESOLVE_MARKET, {
			symbol: market.symbol, // FIX: Engine expects symbol
			result: resolution,
		});

		if (!response.success) {
			return c.json({ success: false, error: response.message }, 400);
		}

		return c.json({
			success: true,
			message: `Market ${marketId} resolved to ${resolution}`,
		});
	} catch (error) {
		logger.error({ error }, 'Error in resolveMarket');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};

export const getDashboardMetrics = async (c: Context) => {
	try {
		const periodParam = c.req.query('period') || '7d';
		const days = periodParam === '90d' ? 90 : periodParam === '30d' ? 30 : 7;

		// 1. Total Active Users
		const totalUsers = await prisma.user.count();

		// 2. Total Open Markets
		const totalMarkets = await prisma.market.count({ where: { status: 'OPEN' } });

		// 3. Platform Revenue (Sum of all PlatformRevenue)
		const revenueResult = await prisma.platformRevenue.aggregate({
			_sum: { amount: true },
		});
		const totalRevenue = revenueResult._sum.amount || 0;

		// 4. Volume (Total Volume of all markets)
		const volumeResult = await prisma.market.aggregate({
			_sum: { volume: true },
		});
		const totalVolume = volumeResult._sum.volume || 0;

		// 5. Pending Verifications Count
		const pendingKycCount = await prisma.kyc.count({ where: { status: 'PENDING' } });
		const pendingPaymentCount = await prisma.paymentMethod.count({ where: { status: 'PENDING' } });
		const totalPendingVerifications = pendingKycCount + pendingPaymentCount;

		// Chart Data: Dynamic Days Revenue and Volume (Gap-filled)
		const revenueChart: { date: string; amount: number; volume: number }[] = [];
		for (let i = days - 1; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);
			revenueChart.push({
				date: d.toISOString().split('T')[0],
				amount: 0,
				volume: 0,
			});
		}

		const periodStartDate = new Date();
		periodStartDate.setDate(periodStartDate.getDate() - days);

		const recentRevenue = await prisma.platformRevenue.findMany({
			where: { createdAt: { gte: periodStartDate } },
			select: { amount: true, createdAt: true },
		});

		const recentMarkets = await prisma.market.findMany({
			where: { createdAt: { gte: periodStartDate } },
			select: { volume: true, createdAt: true },
		});

		// Process chart data and fill in values
		recentRevenue.forEach((rev) => {
			const date = rev.createdAt.toISOString().split('T')[0];
			const chartItem = revenueChart.find((item) => item.date === date);
			if (chartItem) {
				chartItem.amount += Number(rev.amount);
			}
		});

		recentMarkets.forEach((market) => {
			const date = market.createdAt.toISOString().split('T')[0];
			const chartItem = revenueChart.find((item) => item.date === date);
			if (chartItem) {
				chartItem.volume += Number(market.volume || 0);
			}
		});

		const openMarketsCount = await prisma.market.count({ where: { status: 'OPEN' } });
		const closedMarketsCount = await prisma.market.count({ where: { status: 'CLOSED' } });

		const marketDistribution = [
			{ name: 'Open', value: openMarketsCount },
			{ name: 'Closed', value: closedMarketsCount },
		];

		// Recent 5 transactions
		const recentTransactions = await prisma.transaction.findMany({
			take: 5,
			orderBy: { createdAt: 'desc' },
			include: {
				user: { select: { username: true, email: true } },
			},
		});

		return c.json({
			success: true,
			data: {
				totalUsers,
				totalMarkets,
				totalRevenue: Number(totalRevenue),
				totalVolume: Number(totalVolume),
				totalPendingVerifications,
				pendingKycCount,
				pendingPaymentCount,
				revenueChart,
				marketDistribution,
				recentTransactions,
			},
		});
	} catch (error) {
		logger.error({ error }, 'Error in getDashboardMetrics');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};

export const getUsers = async (c: Context) => {
	try {
		const page = Math.max(1, parseInt(c.req.query('page') || '1'));
		const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20')));
		const skip = (page - 1) * limit;

		const [users, total] = await Promise.all([
			prisma.user.findMany({
				orderBy: { createdAt: 'desc' },
				skip,
				take: limit,
				select: {
					id: true,
					email: true,
					phone: true,
					username: true,
					role: true,
					kycVerificationStatus: true,
					paymentVerificationStatus: true,
					createdAt: true,
				},
			}),
			prisma.user.count(),
		]);

		return c.json({
			success: true,
			data: users,
			meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
		});
	} catch (error) {
		logger.error({ error }, 'Error in getUsers');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};

export const getTransactions = async (c: Context) => {
	try {
		const page = Math.max(1, parseInt(c.req.query('page') || '1'));
		const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20')));
		const skip = (page - 1) * limit;

		const [transactions, total] = await Promise.all([
			prisma.transaction.findMany({
				orderBy: { createdAt: 'desc' },
				skip,
				take: limit,
				include: {
					user: {
						select: { username: true, email: true },
					},
				},
			}),
			prisma.transaction.count(),
		]);

		return c.json({
			success: true,
			data: transactions,
			meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
		});
	} catch (error) {
		logger.error({ error }, 'Error in getTransactions');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};

export const getMarkets = async (c: Context) => {
	try {
		const page = Math.max(1, parseInt(c.req.query('page') || '1'));
		const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20')));
		const skip = (page - 1) * limit;

		const [markets, total] = await Promise.all([
			prisma.market.findMany({
				orderBy: { createdAt: 'desc' },
				skip,
				take: limit,
				select: {
					id: true,
					title: true,
					symbol: true,
					yesPrice: true,
					noPrice: true,
					status: true,
					volume: true,
					thumbnail: true,
					categoryId: true,
					createdAt: true,
					numberOfTraders: true,
					endTime: true,
				},
			}),
			prisma.market.count(),
		]);

		return c.json({
			success: true,
			data: markets,
			meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
		});
	} catch (error) {
		logger.error({ error }, 'Error in getMarkets');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};
