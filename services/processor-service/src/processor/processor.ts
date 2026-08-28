import { DB_EVENTS } from '@/config/constants';
import { sendNotification } from '@/libs/notification/dispatcher';
import { updateStockPrice, updateTradersCount, handleMarketResolved } from '@/controllers/market';
import {
	recordTradeExecution,
	recordOrderPlaced,
	handleOrderCancelled,
	handleSharesSplit,
	handleSharesMerged,
} from '@/controllers/order';

export const processToDB = async (eventType: string, data: any) => {
	switch (eventType) {
		case DB_EVENTS.INCREASE_TRADERS_COUNT:
			await updateTradersCount(data);
			break;

		case DB_EVENTS.UPDATE_STOCK_PRICE:
			await updateStockPrice(data);
			break;

		case DB_EVENTS.TRADE_EXECUTED:
			await recordTradeExecution(data);
			break;

		case DB_EVENTS.ORDER_PLACED:
			await recordOrderPlaced(data);
			break;

		case DB_EVENTS.ORDER_CANCELLED:
			await handleOrderCancelled(data);
			break;

		case DB_EVENTS.MARKET_RESOLVED:
			await handleMarketResolved(data);
			break;

		case DB_EVENTS.SHARES_SPLIT:
			await handleSharesSplit(data);
			break;

		case DB_EVENTS.SHARES_MERGED:
			await handleSharesMerged(data);
			break;

		case DB_EVENTS.ARCHIVE_FAILED:
			await sendNotification({ type: 'archive.failed', data });
			break;

		default:
			throw new Error(`Unknown event type: ${eventType}`);
	}
};
