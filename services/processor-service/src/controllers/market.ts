import { logger } from '@/libs/logger';
import { prisma } from '@probstreet/database';
import { redisPublisher } from '@/libs/redis/connection';
import { sendNotification } from '@/libs/notification/dispatcher';

export const updateTradersCount = async (data: any) => {
	try {
		await prisma.market.update({
			where: {
				id: data.marketId,
			},
			data: {
				numberOfTraders: {
					increment: 1,
				},
			},
		});
	} catch (error) {
		logger.error(
			{
				alert: true,
				context: 'TRADERS_COUNT_DB_UPDATE_FAIL',
				error,
				data,
			},
			'Failed to update database for traders count',
		);
		throw error;
	}
};

export const updateStockPrice = async (data: any) => {
	try {
		await prisma.market.update({
			where: {
				id: data.marketId,
			},
			data: {
				yesPrice: data.yesPrice,
				noPrice: data.noPrice,
			},
		});
	} catch (error) {
		logger.error(
			{
				alert: true,
				context: 'STOCK_PRICE_DB_UPDATE_FAIL',
				error,
				data,
			},
			'Failed to update database for stock price',
		);
		throw error;
	}
};

export const handleMarketResolved = async (data: any) => {
	try {
		const { marketId, result } = data;

		if (!['YES', 'NO', 'CANCEL'].includes(result)) {
			logger.warn({ marketId, result }, 'Invalid market resolution result');
			return;
		}

		const payoutsToEngine: { userId: string; amount: number }[] = [];

		await prisma.$transaction(async (tx) => {
			// Update Market result and status
			await tx.market.update({
				where: { id: marketId },
				data: { result, status: 'CLOSED' },
			});

			const holders = await tx.position.findMany({
				where: { marketId },
			});

			for (const holder of holders) {
				let payout = 0;

				if (result === 'YES') {
					payout = Number(holder.yesQuantity) * 10.0;
				} else if (result === 'NO') {
					payout = Number(holder.noQuantity) * 10.0;
				} else if (result === 'CANCEL') {
					payout =
						Number(holder.yesInvested) +
						Number(holder.noInvested) -
						Number(holder.yesSellValue) -
						Number(holder.noSellValue);
				}

				if (payout > 0) {
					// Add INR to wallet
					await tx.wallet.update({
						where: { userId: holder.userId },
						data: { balance: { increment: payout } },
					});

					// Create Ledger Entry for winnings/refund
					await tx.ledgerEntry.create({
						data: {
							fromAccount: 'EXCHANGE_ESCROW',
							toAccount: holder.userId,
							amount: payout,
							type: result === 'CANCEL' ? 'REFUND' : 'WINNINGS',
							referenceId: marketId,
						},
					});

					payoutsToEngine.push({ userId: holder.userId, amount: payout });
				}

				// Update Leaderboard score if market resolution is definitive (YES/NO)
				if (result === 'YES' || result === 'NO') {
					const totalInvested = Number(holder.yesInvested) + Number(holder.noInvested);
					const totalSellVal = Number(holder.yesSellValue) + Number(holder.noSellValue);
					const netProfit = payout + totalSellVal - totalInvested;

					const now = new Date();
					const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
					const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
					const startOfYear = new Date(now.getFullYear(), 0, 1);
					const weekNum = Math.ceil(
						((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7,
					);
					const yearWeek = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

					try {
						await Promise.all([
							redisPublisher.zincrby('leaderboard:all_time', netProfit, holder.userId),
							redisPublisher.zincrby(`leaderboard:today:${todayStr}`, netProfit, holder.userId),
							redisPublisher.zincrby(`leaderboard:monthly:${yearMonth}`, netProfit, holder.userId),
							redisPublisher.zincrby(`leaderboard:weekly:${yearWeek}`, netProfit, holder.userId),
						]);
					} catch (redisErr) {
						logger.error(
							{ redisErr, userId: holder.userId },
							'Failed to update Redis leaderboard score',
						);
					}
				}
			}

			// Keep the position history, just don't delete them, maybe just zero out the balances?
			// Removed hard-delete so Portfolio historical P&L works properly
			// await tx.position.deleteMany({
			// 	where: { marketId },
			// });
		});

		// Push deposits to the engine so memory balances stay in sync
		for (const payout of payoutsToEngine) {
			await redisPublisher.lpush(
				'engine:queue',
				JSON.stringify({
					responseId: `payout-${marketId}-${payout.userId}`,
					eventType: 'DEPOSIT_BALANCE',
					data: {
						userId: payout.userId,
						amount: payout.amount,
					},
				}),
			);
		}

		// Dispatch notifications for winners
		if (payoutsToEngine.length > 0) {
			const market = await prisma.market.findUnique({ where: { id: marketId } });
			if (market) {
				await sendNotification({
					type: 'market.resolved',
					data: {
						marketId,
						title: market.title,
						result,
						winners: payoutsToEngine.map((p) => ({ userId: p.userId, amount: p.amount })),
					},
				});
			}
		}
	} catch (error) {
		logger.error({ error, data }, 'Failed to process market resolution');
		throw error;
	}
};
