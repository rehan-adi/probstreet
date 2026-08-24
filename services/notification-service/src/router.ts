import { ENV_CONFIG } from '@/config/env';
import { handlePriceAlert } from '@/handlers/price-alert';
import { handleMarketCreated } from '@/handlers/market-created';
import { handleTradeExecuted } from '@/handlers/trade-executed';

export type NotificationEventTypes = 'market.created' | 'trade.executed' | 'price.alert';

export interface NotificationEvent {
	type: NotificationEventTypes;
	data: Record<string, any>;
}

export async function processEvent(env: ENV_CONFIG, event: NotificationEvent): Promise<void> {
	switch (event.type) {
		case 'market.created':
			await handleMarketCreated(env, event.data);
			break;
		case 'trade.executed':
			await handleTradeExecuted(env, event.data);
			break;
		case 'price.alert':
			await handlePriceAlert(env, event.data);
			break;
		default:
			console.warn(`[worker] Unknown event type: ${(event as any).type}`);
	}
}
