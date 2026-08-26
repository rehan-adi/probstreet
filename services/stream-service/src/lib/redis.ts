import { io } from '@/app';
import Redis from 'ioredis';
import { ENV } from '@/config/env';
import { logger } from '@/utils/logger';

const redisSubscriber = new Redis({
	host: ENV.REDIS_HOST,
	port: Number(ENV.REDIS_PORT),
	db: Number(ENV.REDIS_DB),
});

redisSubscriber.on('connect', () => {
	logger.info('Connected to Redis');
});

redisSubscriber.on('error', () => {
	logger.error('Failed to connect to Redis');
});

export const startStreamSubscriber = async () => {
	await redisSubscriber.subscribe('stream:data', (err) => {
		if (err) {
			logger.error('Failed to subscribe to stream:data');
		}
	});

	redisSubscriber.on('message', (channel, message) => {
		try {
			const data = JSON.parse(message);
			const symbol = data.symbol;

			if (!symbol) {
				logger.warn('Message missing symbol: ' + message);
				return;
			}

			const type = data.type;
			logger.info(`Redis message received: symbol=${symbol} type=${type || 'UNSET'}`);

			if (type === 'TICKER') {
				// Ticker goes to both ticker browsers (Events/Wishlist) and full market details viewers
				io.to(`ticker:${symbol}`).emit('TICKER', data);
				io.to(`market:${symbol}`).emit('TICKER', data);
				io.to(symbol).emit('MESSAGE', data);
			} else if (type === 'ORDERBOOK') {
				// Orderbook ONLY goes to the market detail viewer
				io.to(`market:${symbol}`).emit('ORDERBOOK', data);
				io.to(symbol).emit('MESSAGE', data);
			} else if (type === 'ACTIVITY') {
				// Activity/Trades ONLY go to the market detail viewer
				io.to(`market:${symbol}`).emit('ACTIVITY', data);
				io.to(symbol).emit('MESSAGE', data);
			} else if (type === 'PORTFOLIO_UPDATE') {
				// Portfolio updates go to user private room
				io.to(`user:${symbol}`).emit('PORTFOLIO_UPDATE', data);
				io.to(symbol).emit('PORTFOLIO_UPDATE', data);
				io.to(symbol).emit('MESSAGE', data);
			} else if (type === 'NOTIFICATION') {
				// Notifications go to user private room
				io.to(`user:${symbol}`).emit('NOTIFICATION', data);
			} else {
				// Fallback for untyped messages
				io.to(`ticker:${symbol}`).emit('MESSAGE', data);
				io.to(`market:${symbol}`).emit('MESSAGE', data);
				io.to(symbol).emit('MESSAGE', data);
			}
		} catch (e) {
			logger.error('Invalid message format from Redis: ' + message);
		}
	});
};
