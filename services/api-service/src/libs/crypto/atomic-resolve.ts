import { Market } from '@probstreet/database';
import { prisma } from '@probstreet/database';
import { pushToQueue } from '@/libs/redis/queue';
import { sendNotification } from '@/libs/notification/dispatcher';
import { logger } from '@/libs/logger';

/**
 * Atomically flip market status OPEN → RESOLVING.
 * Returns the market if acquired, null if already taken.
 * Uses Prisma's updateMany with WHERE status='OPEN' for atomic CAS.
 */
export async function tryAcquireResolve(marketId: string): Promise<Market | null> {
	const result = await prisma.market.updateMany({
		where: { id: marketId, status: 'OPEN' },
		data: { status: 'RESOLVING' as any }, // casting because it is an enum that we just added
	});

	if (result.count === 0) return null; // Someone else got it

	return prisma.market.findUnique({ where: { id: marketId } });
}

/**
 * Complete the resolution: push to queue + flip RESOLVING → CLOSED.
 * If queue push fails, rollback to OPEN.
 */
export async function completeResolve(
	market: Market,
	verdict: 'YES' | 'NO',
	reason: string,
): Promise<boolean> {
	logger.info(
		{ marketId: market.id, symbol: market.symbol, verdict, reason },
		'Completing market resolution',
	);

	const queueResponse = await pushToQueue('RESOLVE_MARKET', {
		symbol: market.symbol,
		result: verdict,
	});

	if (!queueResponse.success) {
		logger.error(
			{ marketId: market.id, response: queueResponse },
			'Failed to push to queue. Rolling back to OPEN.',
		);
		// Rollback — release the lock
		await prisma.market.update({
			where: { id: market.id },
			data: { status: 'OPEN' },
		});
		return false;
	}

	await prisma.market.update({
		where: { id: market.id },
		data: { status: 'CLOSED', oracleStatus: 'RESOLVED' },
	});

	// Log + notify
	await Promise.all([
		prisma.oracleLog.create({
			data: {
				marketId: market.id,
				action: 'RESOLVE',
				resolver: 'deterministic_binance',
				verdict,
				reasoning: reason,
				rubricScore: 100,
			},
		}),
		sendNotification({
			type: 'oracle.resolved',
			data: {
				marketId: market.id,
				marketTitle: market.title,
				symbol: market.symbol,
				verdict,
				score: 100,
				source: 'deterministic_binance',
				reasoning: reason,
			},
		}),
	]);

	return true;
}
