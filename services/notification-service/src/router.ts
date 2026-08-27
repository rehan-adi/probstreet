import { ENV_CONFIG } from '@/config/env';
import { logger } from '@/libs/logger/logger';
import { handlePriceAlert } from '@/handlers/price-alert';
import { handleMarketCreated } from '@/handlers/market-created';
import { handleTradeExecuted } from '@/handlers/trade-executed';

export type NotificationEventTypes =
	'market.created' | 'trade.executed' | 'price.alert' | 'market.resolved';

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
			default:
				logger.warn(`[worker] Unknown event type: ${(event as any).type}`);
		}
	} finally {
		await prisma.$disconnect();
	}
}
