import { io } from '@/app';
import { logger } from '@/libs/logger/logger';
import { redisSubscriber } from '@/libs/redis/client';

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
				io.to(`ticker:${symbol}`).emit('TICKER', data);
				io.to(`market:${symbol}`).emit('TICKER', data);
				io.to(symbol).emit('MESSAGE', data);
			} else if (type === 'ORDERBOOK') {
				io.to(`market:${symbol}`).emit('ORDERBOOK', data);
				io.to(symbol).emit('MESSAGE', data);
			} else if (type === 'ACTIVITY') {
				io.to(`market:${symbol}`).emit('ACTIVITY', data);
				io.to(symbol).emit('MESSAGE', data);
			} else if (type === 'PORTFOLIO_UPDATE') {
				io.to(`user:${symbol}`).emit('PORTFOLIO_UPDATE', data);
				io.to(symbol).emit('PORTFOLIO_UPDATE', data);
				io.to(symbol).emit('MESSAGE', data);
			} else if (type === 'NOTIFICATION') {
				io.to(`user:${symbol}`).emit('NOTIFICATION', data);
			} else {
				io.to(`ticker:${symbol}`).emit('MESSAGE', data);
				io.to(`market:${symbol}`).emit('MESSAGE', data);
				io.to(symbol).emit('MESSAGE', data);
			}
		} catch (e) {
			logger.error('Invalid message format from Redis: ' + message);
		}
	});
};
