import { Context } from 'hono';
import { logger } from '@/libs/logger';
import { prisma } from '@probstreet/database';
import { createPriceAlertSchema } from '@/validations/price-alerts';

export const createAlert = async (c: Context) => {
	try {
		const user = c.get('user');
		if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

		const body = await c.req.json();
		const result = createPriceAlertSchema.safeParse(body);

		if (!result.success) {
			return c.json({ success: false, error: 'Invalid input', details: result.error.issues }, 400);
		}

		const { marketId, stockType, targetPrice } = result.data;

		// Check if market exists
		const market = await prisma.market.findUnique({ where: { id: marketId } });
		if (!market) {
			return c.json({ success: false, error: 'Market not found' }, 404);
		}

		// Check if user already has an active alert for this market + stockType
		const existingAlert = await prisma.priceAlert.findFirst({
			where: {
				userId: user.id,
				marketId,
				stockType,
				isActive: true,
			},
		});

		let alert;
		if (existingAlert) {
			// Update the existing alert threshold
			alert = await prisma.priceAlert.update({
				where: { id: existingAlert.id },
				data: { targetPrice },
			});
		} else {
			// Create a new alert
			alert = await prisma.priceAlert.create({
				data: {
					userId: user.id,
					marketId,
					stockType,
					targetPrice,
					isActive: true,
				},
			});
		}

		return c.json({ success: true, message: 'Price alert set successfully', data: { alert } }, 201);
	} catch (error) {
		logger.error({ error }, 'Failed to create price alert');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};

export const listAlerts = async (c: Context) => {
	try {
		const user = c.get('user');
		if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

		const alerts = await prisma.priceAlert.findMany({
			where: {
				userId: user.id,
				isActive: true,
			},
			include: {
				market: {
					select: {
						id: true,
						title: true,
						yesPrice: true,
						noPrice: true,
					},
				},
			},
			orderBy: {
				createdAt: 'desc',
			},
		});

		return c.json({ success: true, message: 'Price alerts retrieved', data: { alerts } });
	} catch (error) {
		logger.error({ error }, 'Failed to list price alerts');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};

export const deleteAlert = async (c: Context) => {
	try {
		const user = c.get('user');
		if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

		const alertId = c.req.param('id');
		if (!alertId) {
			return c.json({ success: false, error: 'Alert ID is required' }, 400);
		}

		const alert = await prisma.priceAlert.findUnique({
			where: { id: alertId },
		});

		if (!alert) {
			return c.json({ success: false, error: 'Price alert not found' }, 404);
		}

		if (alert.userId !== user.id) {
			return c.json({ success: false, error: 'Unauthorized' }, 403);
		}

		await prisma.priceAlert.delete({
			where: { id: alertId },
		});

		return c.json({ success: true, message: 'Price alert deleted successfully' });
	} catch (error) {
		logger.error({ error }, 'Failed to delete price alert');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};
