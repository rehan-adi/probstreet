import { z } from 'zod';

export const createMarketSchema = z
	.object({
		title: z
			.string()
			.min(3, { message: 'Title must be at least 3 characters' })
			.max(100, { message: 'Title must be under 100 characters' }),
		startTime: z.coerce.date().default(() => new Date()),
		endTime: z.coerce.date(),
		thumbnail: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
		categoryId: z.string().min(1, { message: 'Category ID is required' }),
		resolutionMode: z.enum(['MANUAL', 'AUTOMATIC']).default('MANUAL'),
		oracleUrl: z.string().url().optional().or(z.literal('')),
		oracleConfig: z.record(z.string(), z.unknown()).optional(),
		cryptoMarketType: z.enum(['TOUCH', 'DIRECTION']).optional(),
		sourceOfTruth: z
			.string()
			.max(300, { message: 'Source must be under 300 characters' })
			.optional(),
		eos: z.string().max(2000, { message: 'Eos must be under 2000 characters' }).optional(),
		rules: z.string().max(2000, { message: 'Rules must be under 2000 characters' }).optional(),
	})
	.refine((data) => data.endTime > data.startTime, {
		message: 'End time must be after start time',
		path: ['endTime'],
	});
