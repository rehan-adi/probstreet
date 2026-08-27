import Redis from 'ioredis';
import { ENV } from '@/config/env';
import { logger } from '@/libs/logger/logger';

export const redisSubscriber = new Redis({
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
