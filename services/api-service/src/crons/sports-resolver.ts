import cron from 'node-cron';
import { ENV } from '@/config/env';
import { logger } from '@/libs/logger';
import { EVENTS } from '@/config/constants';
import { prisma } from '@probstreet/database';
import { pushToQueue } from '@/libs/redis/queue';

async function resolveSportsMarkets() {
	if (!ENV.FOOTBALL_DATA_API_KEY) return;

	try {
		const openMarkets = await prisma.market.findMany({
			where: {
				status: 'OPEN',
				resolutionMode: 'AUTOMATIC',
				oracleStatus: { not: 'RESOLVED' },
			},
		});

		const sportsMarkets = openMarkets.filter((m) => {
			const config = m.oracleConfig as any;
			return config && config.resolver === 'sports_match' && config.scheduledStartTime;
		});

		if (sportsMarkets.length === 0) return;

		for (const market of sportsMarkets) {
			const config = market.oracleConfig as any;
			const startTime = new Date(config.scheduledStartTime).getTime();
			const now = Date.now();

			// Only start polling if it's within 15 minutes of the start time or already past it
			if (now < startTime - 15 * 60 * 1000) {
				continue;
			}

			// Also, to respect rate limits, if we recently checked this (within last 30 seconds), skip
			if (market.oracleLastChecked && now - new Date(market.oracleLastChecked).getTime() < 30000) {
				continue;
			}

			try {
				const response = await fetch(market.sourceOfTruth!, {
					headers: { 'X-Auth-Token': ENV.FOOTBALL_DATA_API_KEY },
				});

				if (!response.ok) {
					// Wait 6 seconds before next iteration to respect 10 req/min limit
					await new Promise((r) => setTimeout(r, 6000));
					continue;
				}

				const json: any = await response.json();
				const status = json.status;

				if (status === 'FINISHED') {
					const homeScore = json.score.fullTime.home;
					const awayScore = json.score.fullTime.away;

					let result = 'NO';
					if (config.condition === 'home_win' && homeScore > awayScore) result = 'YES';
					else if (config.condition === 'away_win' && awayScore > homeScore) result = 'YES';
					else if (config.condition === 'draw' && homeScore === awayScore) result = 'YES';

					logger.info({ marketId: market.id, result }, 'Sports market resolved deterministically');

					await prisma.market.update({
						where: { id: market.id },
						data: {
							oracleStatus: 'RESOLVED',
							oracleLastChecked: new Date(),
						},
					});

					await pushToQueue(EVENTS.RESOLVE_MARKET, {
						symbol: market.symbol,
						result,
					});
				} else if (status === 'POSTPONED' || status === 'CANCELLED') {
					logger.warn({ marketId: market.id, status }, 'Sports match postponed or cancelled');
					await prisma.market.update({
						where: { id: market.id },
						data: {
							oracleStatus: 'FAILED',
							oracleLastChecked: new Date(),
						},
					});
				} else {
					// Just update last checked so we don't spam
					await prisma.market.update({
						where: { id: market.id },
						data: { oracleLastChecked: new Date() },
					});
				}

				// Wait 6 seconds before next iteration to respect 10 req/min limit
				await new Promise((r) => setTimeout(r, 6000));
			} catch (err) {
				logger.error({ marketId: market.id, err }, 'Failed to process sports market');
			}
		}
	} catch (error) {
		logger.error({ error }, 'Error in sports resolver cron');
	}
}

export function startSportsResolverCron() {
	logger.info('Starting Sports Resolver Cron');
	const job = cron.schedule('* * * * *', resolveSportsMarkets);
	job.start();
}
