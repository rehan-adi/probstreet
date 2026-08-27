import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma';

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: ['info', 'warn', 'error'],
	});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export const createEdgePrisma = (connectionString: string) => {
	const pool = new Pool({ connectionString });
	const adapter = new PrismaPg(pool);
	return new PrismaClient({ adapter });
};

export * from './generated/prisma';
