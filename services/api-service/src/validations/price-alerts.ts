import { z } from 'zod';

export const createPriceAlertSchema = z.object({
	marketId: z.string().uuid('Invalid market ID'),
	stockType: z.enum(['YES', 'NO']),
	targetPrice: z.number().min(0.01).max(10),
});

export type CreatePriceAlertInput = z.infer<typeof createPriceAlertSchema>;
