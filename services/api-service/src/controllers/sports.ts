import { Context } from 'hono';
import { ENV } from '@/config/env';
import { logger } from '@/libs/logger';

export const getSportsFixtures = async (c: Context) => {
	try {
		const dateFrom = c.req.query('dateFrom');
		const dateTo = c.req.query('dateTo');

		if (!dateFrom || !dateTo) {
			return c.json(
				{
					success: false,
					error: 'dateFrom and dateTo are required',
				},
				400,
			);
		}

		if (!ENV.FOOTBALL_DATA_API_KEY) {
			return c.json(
				{
					success: false,
					error: 'FOOTBALL_DATA_API_KEY not configured',
				},
				500,
			);
		}

		const response = await fetch(
			`https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`,
			{
				headers: {
					'X-Auth-Token': ENV.FOOTBALL_DATA_API_KEY,
				},
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			logger.error({ status: response.status, errorText }, 'Failed to fetch sports fixtures');
			return c.json(
				{
					success: false,
					error: 'Failed to fetch fixtures from provider',
				},
				500,
			);
		}

		const data: any = await response.json();

		return c.json({
			success: true,
			data: data.matches || [],
		});
	} catch (error) {
		logger.error({ error }, 'Error in getSportsFixtures');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};
