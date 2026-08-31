import cron from 'node-cron';
import { logger } from '@/libs/logger';
import { prisma } from '@probstreet/database';
import { tryAcquireResolve, completeResolve } from '@/libs/crypto/atomic-resolve';
import { checkWickConfirmation } from '@/libs/crypto/wick-guard';

const COIN_MAP: Record<string, string> = {
	BTC: 'BTCUSDT',
	BITCOIN: 'BTCUSDT',
	ETH: 'ETHUSDT',
	ETHEREUM: 'ETHUSDT',
	SOL: 'SOLUSDT',
	SOLANA: 'SOLUSDT',
	XRP: 'XRPUSDT',
	RIPPLE: 'XRPUSDT',
	DOGE: 'DOGEUSDT',
	DOGECOIN: 'DOGEUSDT',
	BNB: 'BNBUSDT',
	ADA: 'ADAUSDT',
	CARDANO: 'ADAUSDT',
	AVAX: 'AVAXUSDT',
	AVALANCHE: 'AVAXUSDT',
	LINK: 'LINKUSDT',
	CHAINLINK: 'LINKUSDT',
	DOT: 'DOTUSDT',
	POLKADOT: 'DOTUSDT',
};

function detectCoinAndPair(title: string, symbol: string): { coin: string; pair: string } | null {
	const text = `${title} ${symbol}`.toUpperCase();
	for (const [key, pair] of Object.entries(COIN_MAP)) {
		if (text.includes(key)) {
			return { coin: pair.replace('USDT', ''), pair };
		}
	}
	return null;
}

function extractTargetAndCondition(market: any): { targetValue?: number; condition: string } {
	const config = (market.oracleConfig as any) || {};

	if (config.targetValue !== undefined && config.targetValue !== null) {
		return {
			targetValue: Number(config.targetValue),
			condition: (config.condition || 'gte').toLowerCase(),
		};
	}

	const title = market.title || '';
	const aboveMatch = title.match(
		/(?:hit|reach|above|touch|cross|exceed|over|at least)\s*\$?([0-9]+(?:\.[0-9]+)?)/i,
	);
	if (aboveMatch) {
		return { targetValue: parseFloat(aboveMatch[1]), condition: 'gte' };
	}

	const belowMatch = title.match(
		/(?:below|under|drop to|fall to|less than)\s*\$?([0-9]+(?:\.[0-9]+)?)/i,
	);
	if (belowMatch) {
		return { targetValue: parseFloat(belowMatch[1]), condition: 'lte' };
	}

	return { condition: 'gte' };
}

export async function checkAndResolveCryptoMarkets() {
	try {
		const now = new Date();

		const markets = await prisma.market.findMany({
			where: {
				status: 'OPEN',
				resolutionMode: 'AUTOMATIC',
			},
			include: { category: true },
		});

		for (const market of markets) {
			const detected = detectCoinAndPair(market.title, market.symbol);
			const isCrypto =
				!!detected ||
				(market.category?.categoryName || '').toLowerCase().includes('crypto') ||
				(market.oracleConfig as any)?.resolver === 'crypto_price';

			if (!isCrypto || !detected) continue;

			const { targetValue, condition } = extractTargetAndCondition(market);
			if (targetValue === undefined || isNaN(targetValue)) continue;

			let currentPrice: number | null = null;
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 4000);
				const res = await fetch(
					`https://api.binance.com/api/v3/ticker/price?symbol=${detected.pair}`,
					{ signal: controller.signal },
				);
				clearTimeout(timeoutId);

				if (res.ok) {
					const data = (await res.json()) as any;
					currentPrice = parseFloat(data.price);
				}
			} catch (err: any) {
				logger.warn(
					{ pair: detected.pair, err: err.message },
					'Failed to fetch Binance ticker in crypto resolver',
				);
				continue;
			}

			if (currentPrice === null) continue;

			// Update tracked high/low internally
			let trackedHigh = currentPrice;
			let trackedLow = currentPrice;

			if (market.trackedHigh) {
				trackedHigh = Math.max(parseFloat(market.trackedHigh.toString()), currentPrice);
			}
			if (market.trackedLow) {
				trackedLow = Math.min(parseFloat(market.trackedLow.toString()), currentPrice);
			}

			await prisma.market.update({
				where: { id: market.id },
				data: {
					trackedHigh,
					trackedLow,
				},
			});

			const isExpired = market.endTime && new Date(market.endTime) <= now;
			const marketType = market.cryptoMarketType;

			let verdict: 'YES' | 'NO' | null = null;
			let reason = '';

			if (marketType === 'TOUCH') {
				const wickCheck = await checkWickConfirmation(market, currentPrice, targetValue, condition);

				if (wickCheck.confirmed) {
					verdict = 'YES';
					reason = `Price target reached and confirmed! Current price: $${currentPrice}, Target: $${targetValue}`;
				} else if (isExpired) {
					verdict = 'NO';
					reason = `Market expired at ${market.endTime?.toISOString()}. Target was never confirmed. Final price: $${currentPrice}, Target: $${targetValue}`;
				}
			} else if (marketType === 'DIRECTION') {
				if (isExpired) {
					const startPrice = Number(market.startPrice) || 0;
					const isHit = ['gte', 'gt', 'eq'].includes(condition)
						? currentPrice >= startPrice
						: currentPrice <= startPrice;
					verdict = isHit ? 'YES' : 'NO';
					reason = `Direction resolved at expiry. Start price: $${startPrice}, Final price: $${currentPrice}. Condition: ${condition}`;
				}
			}

			if (verdict) {
				const acquiredMarket = await tryAcquireResolve(market.id);
				if (acquiredMarket) {
					await completeResolve(acquiredMarket, verdict, reason);
				} else {
					logger.info(
						{ marketId: market.id },
						'Could not acquire lock for resolution. Another process may be resolving it.',
					);
				}
			}
		}
	} catch (error) {
		logger.error({ error }, 'Error in checkAndResolveCryptoMarkets cron');
	}
}

export function startCryptoResolverCron() {
	logger.info('⚡ Starting Deterministic Crypto Resolver Cron (every 15s)');
	cron.schedule('*/15 * * * * *', async () => {
		await checkAndResolveCryptoMarkets();
	});
}
