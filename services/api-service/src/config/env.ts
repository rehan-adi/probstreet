import { z } from 'zod';

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'production', 'staging']).default('development'),

	PORT: z.string().min(1),

	ACCESS_TOKEN_SECRET: z.string().min(1),
	REFRESH_TOKEN_SECRET: z.string().min(1),
	ACCESS_TOKEN_EXPIRY: z.string().min(1),
	REFRESH_TOKEN_EXPIRY: z.string().min(1),

	BACKEND_ORIGIN: z.string().url(),
	CORS_ORIGIN: z.string().min(1),
	FRONTEND_URL: z.string().url(),

	REDIS_HOST: z.string().min(1),
	REDIS_PORT: z.string().min(1),

	REDIS_PUBSUB_HOST: z.string().min(1),
	REDIS_PUBSUB_PORT: z.string().min(1),

	GOOGLE_CLIENT_ID: z.string().min(1),
	GOOGLE_CLIENT_SECRET: z.string().min(1),
	GOOGLE_REDIRECT_URI: z.string().url(),

	DISCORD_CLIENT_ID: z.string().min(1),
	DISCORD_CLIENT_SECRET: z.string().min(1),
	DISCORD_REDIRECT_URI: z.string().url(),

	TELEGRAM_BOT_TOKEN: z.string().min(1),

	TWILIO_SID: z.string().min(1),
	TWILIO_TOKEN: z.string().min(1),
	TWILIO_NUMBER: z.string().min(1),

	AWS_REGION: z.string().min(1),
	AWS_S3_BUCKET: z.string().min(1),
	AWS_ACCESS_KEY_ID: z.string().min(1),
	AWS_SECRET_ACCESS_KEY: z.string().min(1),

	CASHFREE_CLIENT_ID: z.string().min(1),
	CASHFREE_CLIENT_SECRET: z.string().min(1),
	CASHFREE_PAYOUT_CLIENT_ID: z.string().min(1),
	CASHFREE_PAYOUT_CLIENT_SECRET: z.string().min(1),

	NOTIFICATION_WORKER_URL: z.string().url(),
	WORKER_SECRET: z.string().min(1),

	GMAIL_USER: z.string().email(),
	GMAIL_APP_PASSWORD: z.string().min(1),
});

const parsed = envSchema.safeParse(Bun.env);

if (!parsed.success) {
	const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
	console.error(`\nInvalid environment variables:\n${issues}\n`);
	process.exit(1);
}

export const ENV = parsed.data;
