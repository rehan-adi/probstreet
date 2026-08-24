import { logger } from '@/libs/logger';
import { prisma } from '@probstreet/database';
import { redisPublisher } from '@/libs/redis/connection';
import { sendNotification } from '@/libs/notification/dispatcher';

export const recordTradeExecution = async (data: any) => {
	try {
		const {
			marketId,
			makerId,
			takerId,
			makerOrderId,
			takerOrderId,
			stockType,
			takerAction,
			price,
			quantity,
			matchType,
		} = data;

		if (makerId === 'System' || !marketId) {
			logger.info('Skipping malformed System message');
			return;
		}

		const qty = Number(quantity);
		const executionPrice = Number(price);

		await prisma.$transaction(async (tx) => {
			// Ensure maker and taker orders exist (AMM orders are created in-memory in matching-engine)
			for (const [oId, uId, isMaker] of [
				[makerOrderId, makerId, true],
				[takerOrderId, takerId, false],
			] as const) {
				if (!oId) continue;
				const exists = await tx.order.findUnique({ where: { id: oId } });
				if (!exists) {
					const m = await tx.market.findUnique({ where: { id: marketId } });
					let sType = stockType;
					let p = executionPrice;
					if (isMaker && matchType === 'MINT') {
						sType = stockType === 'YES' ? 'NO' : 'YES';
						p = 10.0 - executionPrice;
					}
					await tx.order.create({
						data: {
							id: oId,
							marketId,
							userId: uId,
							stockSymbol: m?.symbol || '',
							stockType: sType as any,
							orderType: isMaker ? 'BUY' : (takerAction as any),
							price: p,
							quantity: 100000,
							totalPrice: p * 100000,
							status: 'PARTIAL',
							filledQuantity: 0,
						},
					});
				}
			}

			await tx.trade.create({
				data: {
					marketId,
					makerId,
					takerId,
					makerOrderId,
					takerOrderId,
					stockType,
					takerAction,
					price: executionPrice,
					quantity: qty,
					matchType,
				},
			});

			await tx.market.update({
				where: { id: marketId },
				data: { volume: { increment: qty * 10 } },
			});

			const TRADING_FEE_PERCENTAGE = 0.0025;

			if (matchType === 'STANDARD') {
				if (takerAction === 'BUY') {
					// Taker buys stockType from Maker
					const field = stockType.toLowerCase();
					const takerCost = executionPrice * qty;
					const takerFee = takerCost * TRADING_FEE_PERCENTAGE;

					// Taker: -Locked INR, -Fee, +Shares
					await tx.wallet.updateMany({
						where: { userId: takerId },
						data: {
							locked: { decrement: takerCost },
							balance: { decrement: takerFee },
						},
					});

					// Record fee for Taker
					await tx.platformRevenue.create({
						data: {
							userId: takerId,
							marketId: marketId,
							tradeId: takerOrderId,
							amount: takerFee,
							type: 'TRADE_FEE',
							remarks: '0.25% Taker BUY Fee',
						},
					});

					const takerStock = await tx.position.findFirst({ where: { userId: takerId, marketId } });
					if (takerStock) {
						await tx.position.update({
							where: { id: takerStock.id },
							data: {
								[`${field}Quantity`]: { increment: qty },
								[`${field}Invested`]: { increment: takerCost },
							},
						});
					} else {
						await tx.position.create({
							data: {
								userId: takerId,
								marketId,
								[`${field}Quantity`]: qty,
								[`${field}Invested`]: takerCost,
							},
						});
					}

					// Maker: -Locked Shares, +INR, -Fee
					const makerRevenue = takerCost;
					const makerFee = makerRevenue * TRADING_FEE_PERCENTAGE;

					await tx.position.updateMany({
						where: { userId: makerId, marketId },
						data: {
							[`${field}Locked`]: { decrement: qty },
							[`${field}SellValue`]: { increment: makerRevenue },
						},
					});
					await tx.wallet.updateMany({
						where: { userId: makerId },
						data: { balance: { increment: makerRevenue - makerFee } },
					});

					// Record fee for Maker
					await tx.platformRevenue.create({
						data: {
							userId: makerId,
							marketId: marketId,
							tradeId: makerOrderId,
							amount: makerFee,
							type: 'TRADE_FEE',
							remarks: '0.25% Maker SELL Fee',
						},
					});

					// Ledger entries
					await tx.ledgerEntry.create({
						data: {
							fromAccount: 'EXCHANGE_ESCROW',
							toAccount: makerId,
							amount: executionPrice * qty,
							type: 'BET',
							referenceId: marketId,
						},
					});
				} else {
					// Taker sells stockType to Maker
					const field = stockType.toLowerCase();
					const tradeValue = executionPrice * qty;
					const takerFee = tradeValue * TRADING_FEE_PERCENTAGE;
					const makerFee = tradeValue * TRADING_FEE_PERCENTAGE;

					// Taker: -Locked Shares, +Wallet INR, -Fee
					await tx.position.updateMany({
						where: { userId: takerId, marketId },
						data: {
							[`${field}Locked`]: { decrement: qty },
							[`${field}SellValue`]: { increment: tradeValue },
						},
					});
					await tx.wallet.updateMany({
						where: { userId: takerId },
						data: { balance: { increment: tradeValue - takerFee } },
					});
					await tx.platformRevenue.create({
						data: {
							userId: takerId,
							marketId: marketId,
							tradeId: takerOrderId,
							amount: takerFee,
							type: 'TRADE_FEE',
							remarks: '0.25% Taker SELL Fee',
						},
					});

					// Maker: -Locked INR, -Fee, +Shares
					await tx.wallet.updateMany({
						where: { userId: makerId },
						data: {
							locked: { decrement: tradeValue },
							balance: { decrement: makerFee },
						},
					});
					await tx.platformRevenue.create({
						data: {
							userId: makerId,
							marketId: marketId,
							tradeId: makerOrderId,
							amount: makerFee,
							type: 'TRADE_FEE',
							remarks: '0.25% Maker BUY Fee',
						},
					});

					const makerStock = await tx.position.findFirst({ where: { userId: makerId, marketId } });
					if (makerStock) {
						await tx.position.update({
							where: { id: makerStock.id },
							data: {
								[`${field}Quantity`]: { increment: qty },
								[`${field}Invested`]: { increment: tradeValue },
							},
						});
					} else {
						await tx.position.create({
							data: {
								userId: makerId,
								marketId,
								[`${field}Quantity`]: qty,
								[`${field}Invested`]: tradeValue,
							},
						});
					}

					// Ledger entries
					await tx.ledgerEntry.create({
						data: {
							fromAccount: 'EXCHANGE_ESCROW',
							toAccount: takerId,
							amount: tradeValue,
							type: 'BET',
							referenceId: marketId,
						},
					});
				}
			} else if (matchType === 'MINT') {
				// Both are BUYERS.
				const yesPrice = stockType === 'YES' ? executionPrice : 10.0 - executionPrice;
				const noPrice = stockType === 'YES' ? 10.0 - executionPrice : executionPrice;

				const yesBuyerId = stockType === 'YES' ? takerId : makerId;
				const noBuyerId = stockType === 'YES' ? makerId : takerId;

				const yesFee = yesPrice * qty * TRADING_FEE_PERCENTAGE;
				const noFee = noPrice * qty * TRADING_FEE_PERCENTAGE;

				// Yes Buyer
				await tx.wallet.updateMany({
					where: { userId: yesBuyerId },
					data: {
						locked: { decrement: yesPrice * qty },
						balance: { decrement: yesFee },
					},
				});
				await tx.platformRevenue.create({
					data: {
						userId: yesBuyerId,
						marketId,
						amount: yesFee,
						type: 'TRADE_FEE',
						remarks: '0.25% MINT YES Fee',
					},
				});

				const yesStock = await tx.position.findFirst({ where: { userId: yesBuyerId, marketId } });
				if (yesStock) {
					await tx.position.update({
						where: { id: yesStock.id },
						data: {
							yesQuantity: { increment: qty },
							yesInvested: { increment: yesPrice * qty },
						},
					});
				} else {
					await tx.position.create({
						data: { userId: yesBuyerId, marketId, yesQuantity: qty, yesInvested: yesPrice * qty },
					});
				}

				// No Buyer
				await tx.wallet.updateMany({
					where: { userId: noBuyerId },
					data: {
						locked: { decrement: noPrice * qty },
						balance: { decrement: noFee },
					},
				});
				await tx.platformRevenue.create({
					data: {
						userId: noBuyerId,
						marketId,
						amount: noFee,
						type: 'TRADE_FEE',
						remarks: '0.25% MINT NO Fee',
					},
				});

				const noStock = await tx.position.findFirst({ where: { userId: noBuyerId, marketId } });
				if (noStock) {
					await tx.position.update({
						where: { id: noStock.id },
						data: {
							noQuantity: { increment: qty },
							noInvested: { increment: noPrice * qty },
						},
					});
				} else {
					await tx.position.create({
						data: { userId: noBuyerId, marketId, noQuantity: qty, noInvested: noPrice * qty },
					});
				}
			} else if (matchType === 'MERGE') {
				// Both are SELLERS.
				const yesPrice = stockType === 'YES' ? executionPrice : 10.0 - executionPrice;
				const noPrice = stockType === 'YES' ? 10.0 - executionPrice : executionPrice;

				const yesSellerId = stockType === 'YES' ? takerId : makerId;
				const noSellerId = stockType === 'YES' ? makerId : takerId;

				const yesFee = yesPrice * qty * TRADING_FEE_PERCENTAGE;
				const noFee = noPrice * qty * TRADING_FEE_PERCENTAGE;

				// Yes Seller
				await tx.position.updateMany({
					where: { userId: yesSellerId, marketId },
					data: {
						yesLocked: { decrement: qty },
						yesSellValue: { increment: yesPrice * qty },
					},
				});
				await tx.wallet.updateMany({
					where: { userId: yesSellerId },
					data: { balance: { increment: yesPrice * qty - yesFee } },
				});
				await tx.platformRevenue.create({
					data: {
						userId: yesSellerId,
						marketId,
						amount: yesFee,
						type: 'TRADE_FEE',
						remarks: '0.25% MERGE YES Fee',
					},
				});

				// No Seller
				await tx.position.updateMany({
					where: { userId: noSellerId, marketId },
					data: {
						noLocked: { decrement: qty },
						noSellValue: { increment: noPrice * qty },
					},
				});
				await tx.wallet.updateMany({
					where: { userId: noSellerId },
					data: { balance: { increment: noPrice * qty - noFee } },
				});
				await tx.platformRevenue.create({
					data: {
						userId: noSellerId,
						marketId,
						amount: noFee,
						type: 'TRADE_FEE',
						remarks: '0.25% MERGE NO Fee',
					},
				});

				// Ledger entries
				await tx.ledgerEntry.createMany({
					data: [
						{
							fromAccount: 'EXCHANGE_ESCROW',
							toAccount: yesSellerId,
							amount: yesPrice * qty,
							type: 'BET',
							referenceId: marketId,
						},
						{
							fromAccount: 'EXCHANGE_ESCROW',
							toAccount: noSellerId,
							amount: noPrice * qty,
							type: 'BET',
							referenceId: marketId,
						},
					],
				});
			}

			// Helper to update Order table
			const updateOrder = async (orderId: string, tradeQty: number) => {
				if (!orderId) return;
				const order = await tx.order.findUnique({ where: { id: orderId } });
				if (order) {
					const newTraded = order.filledQuantity + tradeQty;
					const newStatus = newTraded >= order.quantity ? 'COMPLETED' : 'PARTIAL';
					await tx.order.update({
						where: { id: orderId },
						data: { filledQuantity: newTraded, status: newStatus },
					});
				}
			};

			await updateOrder(makerOrderId, qty);
			await updateOrder(takerOrderId, qty);
		});

		// Broadcast portfolio updates
		redisPublisher.publish(
			'stream:data',
			JSON.stringify({ symbol: makerId, type: 'PORTFOLIO_UPDATE' }),
		);
		redisPublisher.publish(
			'stream:data',
			JSON.stringify({ symbol: takerId, type: 'PORTFOLIO_UPDATE' }),
		);

		// Fire-and-forget: send trade executed notifications to maker + taker
		// We fetch the market title here since the processor has DB access
		prisma.market
			.findUnique({ where: { id: marketId }, select: { title: true } })
			.then((market) => {
				sendNotification({
					type: 'trade.executed',
					data: {
						makerId,
						takerId,
						marketId,
						marketTitle: market?.title ?? 'Market',
						stockType,
						price: executionPrice,
						quantity: qty,
					},
				});
			})
			.catch(() => {
				/* swallow — notification failure never crashes the processor */
			});
	} catch (error) {
		logger.error(
			{ error, data, context: 'TRADE_EXECUTED_FAIL' },
			'Failed to record trade execution',
		);
		throw error;
	}
};

export const recordOrderPlaced = async (data: any) => {
	try {
		const { userId, marketId, side, action, price, originalQuantity } = data;
		const totalCost = Number(price) * Number(originalQuantity);

		await prisma.$transaction(async (tx) => {
			if (action === 'BUY') {
				await tx.wallet.updateMany({
					where: { userId },
					data: {
						balance: { decrement: totalCost },
						locked: { increment: totalCost },
					},
				});

				await tx.ledgerEntry.create({
					data: {
						fromAccount: userId,
						toAccount: 'EXCHANGE_ESCROW',
						amount: totalCost,
						type: 'BET',
						referenceId: marketId,
					},
				});
			} else {
				const field = side === 'YES' ? 'yes' : 'no';
				await tx.position.updateMany({
					where: { userId, marketId },
					data: {
						[`${field}Quantity`]: { decrement: Number(originalQuantity) },
						[`${field}Locked`]: { increment: Number(originalQuantity) },
					},
				});
			}
		});

		// Broadcast portfolio update
		redisPublisher.publish(
			'stream:data',
			JSON.stringify({ symbol: userId, type: 'PORTFOLIO_UPDATE' }),
		);
	} catch (error) {
		logger.error({ error, data, context: 'ORDER_PLACED_FAIL' }, 'Failed to record order placement');
		throw error;
	}
};

export const handleOrderCancelled = async (data: any) => {
	try {
		const { userId, orderId, refund, type, marketId } = data;
		const qty = Number(refund);

		await prisma.$transaction(async (tx) => {
			if (orderId) {
				await tx.order.update({
					where: { id: orderId },
					data: { status: 'CANCELLED' },
				});
			}

			if (type === 'INR') {
				await tx.wallet.updateMany({
					where: { userId },
					data: {
						locked: { decrement: qty },
						balance: { increment: qty },
					},
				});
				await tx.ledgerEntry.create({
					data: {
						fromAccount: 'EXCHANGE_ESCROW',
						toAccount: userId,
						amount: qty,
						type: 'REFUND',
						referenceId: marketId || 'CANCEL',
					},
				});
			} else if (type === 'YES_STOCK' || type === 'NO_STOCK') {
				const field = type === 'YES_STOCK' ? 'yes' : 'no';
				await tx.position.updateMany({
					where: { userId, marketId },
					data: {
						[`${field}Locked`]: { decrement: qty },
						[`${field}Quantity`]: { increment: qty },
					},
				});
			}
		});

		// Broadcast portfolio update
		redisPublisher.publish(
			'stream:data',
			JSON.stringify({ symbol: userId, type: 'PORTFOLIO_UPDATE' }),
		);
	} catch (error) {
		logger.error({ error, data }, 'Failed to process order cancellation');
		throw error;
	}
};

export const handleSharesSplit = async (data: any) => {
	try {
		const { userId, marketId, quantity, cost } = data;
		const qty = Number(quantity);
		const totalCost = Number(cost);

		await prisma.$transaction(async (tx) => {
			// Deduct INR
			await tx.wallet.updateMany({
				where: { userId },
				data: { balance: { decrement: totalCost } },
			});
			// Add YES and NO shares
			const pos = await tx.position.findFirst({ where: { userId, marketId } });
			if (pos) {
				await tx.position.update({
					where: { id: pos.id },
					data: {
						yesQuantity: { increment: qty },
						noQuantity: { increment: qty },
						yesInvested: { increment: totalCost / 2 },
						noInvested: { increment: totalCost / 2 },
					},
				});
			} else {
				await tx.position.create({
					data: {
						userId,
						marketId,
						yesQuantity: qty,
						noQuantity: qty,
						yesInvested: totalCost / 2,
						noInvested: totalCost / 2,
					},
				});
			}

			// Ledger entry for minting
			await tx.ledgerEntry.create({
				data: {
					fromAccount: userId,
					toAccount: 'EXCHANGE_ESCROW',
					amount: totalCost,
					type: 'BET',
					referenceId: marketId,
				},
			});
		});

		redisPublisher.publish(
			'stream:data',
			JSON.stringify({ symbol: userId, type: 'PORTFOLIO_UPDATE' }),
		);
	} catch (error) {
		logger.error({ error, data }, 'Failed to process shares split');
		throw error;
	}
};

export const handleSharesMerged = async (data: any) => {
	try {
		const { userId, marketId, quantity, refund } = data;
		const qty = Number(quantity);
		const totalRefund = Number(refund);

		await prisma.$transaction(async (tx) => {
			// Deduct YES and NO shares
			await tx.position.updateMany({
				where: { userId, marketId },
				data: {
					yesQuantity: { decrement: qty },
					noQuantity: { decrement: qty },
				},
			});
			// Add INR
			await tx.wallet.updateMany({
				where: { userId },
				data: { balance: { increment: totalRefund } },
			});

			// Ledger entry for redeeming
			await tx.ledgerEntry.create({
				data: {
					fromAccount: 'EXCHANGE_ESCROW',
					toAccount: userId,
					amount: totalRefund,
					type: 'REFUND',
					referenceId: marketId,
				},
			});
		});

		redisPublisher.publish(
			'stream:data',
			JSON.stringify({ symbol: userId, type: 'PORTFOLIO_UPDATE' }),
		);
	} catch (error) {
		logger.error({ error, data }, 'Failed to process shares merged');
		throw error;
	}
};
