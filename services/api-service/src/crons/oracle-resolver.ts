import cron from 'node-cron';
import { logger } from '@/libs/logger';
import { prisma } from '@probstreet/database';
import { pushToQueue } from '@/libs/redis/queue';
import { runResolutionPipeline } from '@/libs/oracle/pipeline';
import { sendNotification } from '@/libs/notification/dispatcher';

export function startOracleResolverCron() {
	logger.info('Starting Oracle Resolver Cron (every 1 minute)');

	cron.schedule('*/1 * * * *', async () => {
		try {
			logger.info('Checking for markets requiring oracle resolution...');

			const now = new Date();

			const markets = await prisma.market.findMany({
				where: {
					status: 'OPEN',
					resolutionMode: 'AUTOMATIC',
					endTime: { lte: now },
					OR: [
						{ oracleStatus: 'PENDING' },
						{ oracleStatus: null },
						{
							oracleStatus: { in: ['CHECKING', 'FAILED'] },
							oracleLastChecked: { lte: new Date(now.getTime() - 15 * 60 * 1000) },
						},
					],
				},
			});

			for (const market of markets) {
				const config = market.oracleConfig as any;

				if (config && (config.resolver === 'crypto_price' || config.resolver === 'sports_match')) {
					continue;
				}

				logger.info({ marketId: market.id }, 'Triggering oracle resolution pipeline');

				await prisma.market.update({
					where: { id: market.id },
					data: {
						oracleStatus: 'CHECKING',
						oracleLastChecked: new Date(),
					},
				});

				const result = await runResolutionPipeline(market);

				if (result.resolved && result.verdict) {
					logger.info(
						{ marketId: market.id, verdict: result.verdict },
						'Pushing resolve event to queue',
					);

					const queueResponse = await pushToQueue('RESOLVE_MARKET', {
						symbol: market.symbol,
						result: result.verdict,
					});

					if (queueResponse.success) {
						await prisma.market.update({
							where: { id: market.id },
							data: { oracleStatus: 'RESOLVED' },
						});

						// Notify admins of automated resolution
						await sendNotification({
							type: 'oracle.resolved',
							data: {
								marketId: market.id,
								marketTitle: market.title,
								symbol: market.symbol,
								verdict: result.verdict,
								score: result.rubricScore,
								source: result.source,
								reasoning: result.reasoning,
							},
						});
					} else {
						logger.error(
							{ marketId: market.id, response: queueResponse },
							'Failed to push resolution to queue',
						);
						await prisma.market.update({
							where: { id: market.id },
							data: { oracleStatus: 'FAILED' },
						});
					}
				} else if (result.source === 'admin_required') {
					await prisma.market.update({
						where: { id: market.id },
						data: { oracleStatus: 'AWAITING_ADMIN' },
					});

					await sendNotification({
						type: 'oracle.review',
						data: {
							marketId: market.id,
							marketTitle: market.title,
							score: result.rubricScore,
							verdict: result.verdict,
						},
					});
				} else {
					await prisma.market.update({
						where: { id: market.id },
						data: { oracleStatus: 'FAILED' },
					});
				}

				// Log to DB
				await prisma.oracleLog.create({
					data: {
						marketId: market.id,
						action: result.resolved
							? 'RESOLVE'
							: result.source === 'admin_required'
								? 'AWAITING_ADMIN'
								: 'ERROR',
						resolver: result.source,
						rawData: result.rawData ? JSON.parse(JSON.stringify(result.rawData)) : null, // Ensure JSON safety
						verdict: result.verdict,
						rubricScore: result.rubricScore,
						reasoning: result.reasoning,
						error: result.error,
					},
				});
			}
		} catch (error) {
			logger.error({ error }, 'Error running oracle resolver cron');
		}
	});
}
