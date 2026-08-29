import { ENV_CONFIG } from '@/config/env';
import { logger } from '@/libs/logger/logger';
import { handlePriceAlert } from '@/handlers/price-alert';
import { handleOracleReview } from '@/handlers/oracle-review';
import { handleMarketCreated } from '@/handlers/market-created';
import { handleTradeExecuted } from '@/handlers/trade-executed';
import { handleArchiveFailed } from '@/handlers/archive-failed';
import { handleOracleResolved } from '@/handlers/oracle-resolved';

export type NotificationEventTypes =
	| 'market.created'
	| 'trade.executed'
	| 'price.alert'
	| 'market.resolved'
	| 'archive.failed'
	| 'oracle.review'
	| 'oracle.resolved';

export interface NotificationEvent {
	type: NotificationEventTypes;
	data: Record<string, any>;
}

export async function processEvent(env: ENV_CONFIG, event: NotificationEvent): Promise<void> {
	const { createEdgePrisma } = await import('@probstreet/database');
	const prisma = createEdgePrisma(env.DATABASE_URL);

	try {
		switch (event.type) {
			case 'market.created':
				await handleMarketCreated(env, prisma, event.data);
				break;
			case 'trade.executed':
				await handleTradeExecuted(env, prisma, event.data);
				break;
			case 'price.alert':
				await handlePriceAlert(env, prisma, event.data);
				break;
			case 'market.resolved':
				const { handleMarketResolved } = await import('@/handlers/market-resolved');
				await handleMarketResolved(env, prisma, event.data);
				break;
			case 'archive.failed':
				await handleArchiveFailed(env, event.data);
				break;
			case 'oracle.review':
				await handleOracleReview(env, prisma, event.data);
				break;
			case 'oracle.resolved':
				await handleOracleResolved(env, prisma, event.data);
				break;
			default:
				logger.warn(`[worker] Unknown event type: ${(event as any).type}`);
		}
	} finally {
		await prisma.$disconnect();
	}
}
