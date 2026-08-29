import { z } from 'zod';

export const envSchema = z.object({
	DATABASE_URL: z.string().min(1),
	BREVO_API_KEY: z.string().min(1),
	WORKER_SECRET: z.string().min(1),
	FIREBASE_SERVER_KEY: z.string().min(1),
	STREAM_SERVICE_URL: z.string().url(),
	FRONTEND_URL: z.string().url(),
});

export type ENV_CONFIG = z.infer<typeof envSchema>;

export function validateEnv(env: unknown): ENV_CONFIG {
	const parsed = envSchema.safeParse(env);
	if (!parsed.success) {
		const issues = parsed.error.issues
			.map((i) => `  • ${i.path.join('.')}: ${i.message}`)
			.join('\n');
		throw new Error(`Invalid environment variables:\n${issues}`);
	}
	return parsed.data;
}
