import { logger } from '@/libs/logger';

const checkEnv = (key: string) => {
	const value = Bun.env[key];

	if (!value) {
		logger.error(`Missing required environment variable: ${key}`);
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
};

export const ENV = {
	REDIS_HOST: checkEnv('REDIS_HOST'),
	REDIS_PORT: checkEnv('REDIS_PORT'),
	KAFKA_BROKERS: checkEnv('KAFKA_BROKERS'),
	NOTIFICATION_WORKER_URL: checkEnv('NOTIFICATION_WORKER_URL'),
	WORKER_SECRET: checkEnv('WORKER_SECRET'),
};
