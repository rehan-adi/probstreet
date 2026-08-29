import { Context } from 'hono';
import { logger } from '@/libs/logger';
import { prisma } from '@probstreet/database';
import { pushToQueue } from '@/libs/redis/queue';

export const getOraclePending = async (c: Context) => {
	try {
		const pendingMarkets = await prisma.market.findMany({
			where: { oracleStatus: 'AWAITING_ADMIN' },
			include: {
				oracleLogs: {
					orderBy: { createdAt: 'desc' },
					take: 1,
				},
			},
		});

		return c.json({ success: true, data: pendingMarkets });
	} catch (error) {
		logger.error({ error }, 'Failed to fetch pending oracle markets');
		return c.json({ success: false, message: 'Internal server error' }, 500);
	}
};

export const confirmOracleResolution = async (c: Context) => {
	try {
		const { marketId, resolution, override } = await c.req.json();

		if (!marketId || !['YES', 'NO', 'CANCEL'].includes(resolution)) {
			return c.json({ success: false, message: 'Invalid payload' }, 400);
		}

		const market = await prisma.market.findUnique({ where: { id: marketId } });
		if (!market || market.status !== 'OPEN') {
			return c.json({ success: false, message: 'Market not open or not found' }, 404);
		}

		// Push to queue
		const queueResponse = await pushToQueue('RESOLVE_MARKET', {
			symbol: market.symbol,
			result: resolution,
		});

		if (queueResponse.success) {
			await prisma.market.update({
				where: { id: marketId },
				data: { oracleStatus: 'RESOLVED' },
			});

			await prisma.oracleLog.create({
				data: {
					marketId,
					action: override ? 'ADMIN_OVERRIDE' : 'ADMIN_CONFIRM',
					resolver: 'admin',
					verdict: resolution,
				},
			});

			return c.json({ success: true, message: 'Market resolved' });
		} else {
			return c.json({ success: false, message: queueResponse.message }, 400);
		}
	} catch (error) {
		logger.error({ error }, 'Failed to confirm oracle resolution');
		return c.json({ success: false, message: 'Internal server error' }, 500);
	}
};
