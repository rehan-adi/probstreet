import { ENV_CONFIG } from '@/config/env';
import { createEdgePrisma } from '@probstreet/database';

let prismaClient: ReturnType<typeof createEdgePrisma> | undefined;

export function getPrisma(env: ENV_CONFIG) {
	if (!prismaClient) {
		prismaClient = createEdgePrisma(env.DATABASE_URL);
	}
	return prismaClient;
}
