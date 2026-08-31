import * as zlib from 'zlib';
import slugify from 'slugify';
import { Context } from 'hono';
import { promisify } from 'util';
import { ENV } from '@/config/env';
import { logger } from '@/libs/logger';
import { customAlphabet } from 'nanoid';
import { EVENTS } from '@/config/constants';
import { s3Client } from '@/libs/aws/client';
import { prisma } from '@probstreet/database';
import { pushToQueue } from '@/libs/redis/queue';
import { client } from '@/libs/redis/connection';
import { fetchLiveMarketData } from '@/libs/live';
import { tavilyClient } from '@/libs/tavily/client';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createMarketSchema } from '@/validations/market';
import { generatePresignedUrl } from '@/libs/aws/presign';
import { sendNotification } from '@/libs/notification/dispatcher';

const gunzip = promisify(zlib.gunzip);
const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);

/**
 * Create market controller, for admin only
 * @param c Hono context
 * @returns Json response
 */

export const createMarket = async (c: Context) => {
	try {
		const user = c.get('user');

		if (user?.role !== 'ADMIN') {
			logger.warn(
				{
					context: 'CREATE_MARKET_UNAUTHORIZED',
					userId: user?.id,
				},
				'Unauthorized attempt to createMarket',
			);
			return c.json(
				{
					success: false,
					message: 'Unauthorized',
				},
				403,
			);
		}

		const body = await c.req.json();
		const parsed = createMarketSchema.safeParse(body);

		if (!parsed.success) {
			logger.warn(
				{
					context: 'CREATE_MARKET_VALIDATE_ERROR',
					error: parsed.error.issues,
				},
				'Validation error',
			);
			return c.json(
				{
					success: false,
					message: 'Validation error',
					error: parsed.error.issues,
				},
				400,
			);
		}

		const data = parsed.data;

		const category = await prisma.category.findUnique({
			where: { id: data.categoryId },
		});

		if (!category) {
			return c.json(
				{
					success: false,
					message: 'Invalid categoryId',
				},
				400,
			);
		}

		const slug = slugify(data.title, { lower: true, strict: true });
		const symbol = `${slug}-${nanoid()}`;

		const existingMarket = await prisma.market.findFirst({
			where: {
				OR: [{ symbol: symbol }, { title: data.title }],
			},
		});

		if (existingMarket) {
			logger.warn(
				{
					context: 'CREATE_MARKET_CONFLICT',
					userId: user?.id,
					title: data.title,
					symbol,
				},
				'Market already exists with the same title or symbol',
			);
			return c.json(
				{
					success: false,
					message: 'Market already exists with same title or symbol',
				},
				409,
			);
		}

		const newMarket = await prisma.market.create({
			data: {
				title: data.title,
				symbol,
				yesPrice: 5.0,
				noPrice: 5.0,
				startTime: data.startTime,
				endTime: data.endTime,
				eos: data.eos,
				rules: data.rules,
				thumbnail: data.thumbnail,
				categoryId: data.categoryId,
				sourceOfTruth: data.sourceOfTruth,
				resolutionMode: data.resolutionMode,
				oracleConfig: data.oracleConfig ? (data.oracleConfig as any) : undefined,
				oracleStatus: data.resolutionMode === 'AUTOMATIC' ? 'PENDING' : null,
				cryptoMarketType: data.cryptoMarketType,
			},
		});

		const coinPair = resolveBinanceSymbol(newMarket.title, newMarket.symbol);
		const isCryptoMarket =
			!!coinPair ||
			category.categoryName.toLowerCase().includes('crypto') ||
			(data.oracleConfig as any)?.resolver === 'crypto_price';

		if (isCryptoMarket && coinPair) {
			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 4000);
				const binanceRes = await fetch(
					`https://api.binance.com/api/v3/ticker/price?symbol=${coinPair}`,
					{ signal: controller.signal },
				);
				clearTimeout(timeoutId);

				if (binanceRes.ok) {
					const binanceData = (await binanceRes.json()) as any;
					const startPrice = parseFloat(binanceData.price);

					let marketType = data.cryptoMarketType;

					await prisma.market.update({
						where: { id: newMarket.id },
						data: {
							cryptoMarketType: marketType,
							startPrice,
							trackedHigh: startPrice,
							trackedLow: startPrice,
						},
					});
				}
			} catch (err: any) {
				logger.warn(
					{ err: err.message, symbol: coinPair },
					'Failed to fetch start price from Binance',
				);
			}
		}

		const yesPrice = parseFloat(newMarket.yesPrice.toString());
		const noPrice = parseFloat(newMarket.noPrice.toString());

		const queuePayload = {
			marketId: newMarket.id,
			title: newMarket.title,
			symbol: newMarket.symbol,
			yesPrice: yesPrice,
			noPrice: noPrice,
			eos: newMarket.eos,
			rules: newMarket.rules,
			endDate: newMarket.endTime,
			thumbnail: newMarket.thumbnail,
			startDate: newMarket.startTime,
			categoryId: newMarket.categoryId,
			sourceOfTruth: newMarket.sourceOfTruth,
			numberOftraders: newMarket.numberOfTraders,
		};

		let response = await pushToQueue(EVENTS.CREATE_MARKET, queuePayload);

		if (!response.success && response.retryable) {
			for (let attempt = 0; attempt < 3; attempt++) {
				response = await pushToQueue(EVENTS.CREATE_MARKET, queuePayload);
				if (response.success) break;
			}
		}

		if (!response.success) {
			logger.error(
				{
					alert: true,
					context: 'CREATE_MARKET_QUEUE_PUSH_FAILED',
					marketId: newMarket.id,
				},
				'Failed to push CREATE_MARKET job to queue',
			);
		} else {
			logger.info(
				{
					context: 'CREATE_MARKET_SUCCESS',
					userId: user?.id,
					marketId: newMarket.id,
					symbol,
				},
				'Market created and enqueued successfully',
			);

			sendNotification({
				type: 'market.created',
				data: {
					marketId: newMarket.id,
					title: newMarket.title,
					slug: symbol,
				},
			});
		}

		return c.json(
			{
				success: true,
				message: 'Market created successfully',
				data: {
					id: newMarket.id,
					symbol,
				},
			},
			201,
		);
	} catch (error) {
		logger.error(
			{
				alert: true,
				context: 'CREATE_MARKET_CONTROLLER_FAIL',
				error: error instanceof Error ? error.message : error,
				stack: error instanceof Error ? error.stack : undefined,
				userId: c.get('user')?.id,
			},
			'Unhandled error during market creation',
		);
		return c.json(
			{
				success: false,
				message: 'Internal server error',
				error: error instanceof Error ? error.message : 'Unknown error',
			},
			500,
		);
	}
};

export const addLiquidity = async (c: Context) => {
	try {
		const user = c.get('user');

		if (user?.role !== 'ADMIN') {
			logger.warn(
				{
					context: 'CREATE_MARKET_UNAUTHORIZED',
					userId: user?.id,
				},
				'Unauthorized attempt to createMarket',
			);
			return c.json(
				{
					success: false,
					message: 'Unauthorized',
				},
				403,
			);
		}

		const body = await c.req.json<{
			marketId: string;
			symbol: string;
			levels?: { price: number; quantity: number }[];
		}>();

		const response = await pushToQueue(EVENTS.ADD_LIQUIDITY, {
			userId: user.id,
			phone: user.phone,
			role: 'ADMIN',
			marketId: body.marketId,
			symbol: body.symbol,
			levels: body.levels || [],
		});

		if (!response.success) {
			return c.json(
				{
					success: false,
					message: response.message,
					error: response.error,
				},
				500,
			);
		}

		return c.json(
			{
				success: true,
				message: 'Added done',
				data: response.data,
			},
			200,
		);
	} catch (error) {
		logger.error(
			{
				alert: true,
				context: 'ADD_LIQUIDITY_CONTROLLER_FAIL',
				error: error instanceof Error ? error.message : error,
				stack: error instanceof Error ? error.stack : undefined,
			},
			'Unhandled error during addLiquidity',
		);
		return c.json(
			{
				success: false,
				message: 'Internal server error',
				error: error instanceof Error ? error.message : 'Unknown error',
			},
			500,
		);
	}
};

/**
 * fetch all markets or events from db
 * @param c Hono context
 * @returns json response
 */

export const getAllMarket = async (c: Context) => {
	try {
		const rawMarkets = await prisma.market.findMany({
			where: {
				status: { in: ['OPEN', 'CLOSED'] },
			},
			orderBy: {
				createdAt: 'desc',
			},
			select: {
				id: true,
				title: true,
				yesPrice: true,
				noPrice: true,
				endTime: true,
				numberOfTraders: true,
				thumbnail: true,
				categoryId: true,
				status: true,
				symbol: true,
				result: true,
				volume: true,
				category: {
					select: { categoryName: true },
				},
			},
		});

		const markets = rawMarkets.map((m) => ({
			...m,
			volume: Number(m.volume || 0),
			category: m.category?.categoryName || 'Unknown',
		}));

		return c.json(
			{
				success: true,
				message: 'Markets or events fetched successfully',
				data: markets,
			},
			200,
		);
	} catch (error) {
		logger.error(
			{
				alert: true,
				context: 'GET_ALL_MARKET_CONTROLLER_FAIL',
				error: error instanceof Error ? error.message : error,
				stack: error instanceof Error ? error.stack : undefined,
			},
			'Unhandled error during get all market',
		);

		return c.json(
			{
				success: false,
				message: 'Internal server error',
				error: error instanceof Error ? error.message : 'Unknown error',
			},
			500,
		);
	}
};

/**
 * fetch market or event from db for a category (Crypto, Cricket)
 * @param c Hono context
 * @returns json response
 */

export const getMarketsByCategory = async (c: Context) => {
	try {
		const categoryParam = c.req.param('categoryParam');

		if (!categoryParam) {
			logger.warn(
				{
					context: 'GET_MARKETS_BY_CATEGORY_MISSING_PARAM',
				},
				'Missing category parameter in request',
			);
			return c.json(
				{
					success: false,
					message: 'category parameter is required',
				},
				400,
			);
		}

		let category = await prisma.category.findUnique({
			where: { id: categoryParam },
		});

		if (!category) {
			category = await prisma.category.findFirst({
				where: { categoryName: { equals: categoryParam, mode: 'insensitive' } },
			});
		}

		if (!category) {
			return c.json(
				{
					success: false,
					message: 'Invalid category',
				},
				400,
			);
		}

		const rawMarkets = await prisma.market.findMany({
			where: {
				categoryId: category.id,
				status: { in: ['OPEN', 'CLOSED'] },
			},
			orderBy: {
				createdAt: 'desc',
			},
			select: {
				id: true,
				title: true,
				categoryId: true,
				yesPrice: true,
				noPrice: true,
				endTime: true,
				numberOfTraders: true,
				thumbnail: true,
				status: true,
				symbol: true,
				result: true,
				volume: true,
			},
		});

		const markets = rawMarkets.map((m) => ({
			...m,
			volume: Number(m.volume || 0),
		}));

		return c.json(
			{
				success: true,
				message: 'Markets fetched successfully',
				data: markets,
			},
			200,
		);
	} catch (error) {
		logger.error(
			{
				alert: true,
				context: 'GET_MARKET_DETAILS_CONTROLLER_FAIL',
				error: error instanceof Error ? error.message : error,
				stack: error instanceof Error ? error.stack : undefined,
			},
			'Unhandled error during fetching markets by category',
		);

		return c.json(
			{
				success: false,
				message: 'Internal server error',
				error: error instanceof Error ? error.message : 'Unknown error',
			},
			500,
		);
	}
};

/**
 * Get Market details from engine and send back to clien which includes orderbook, timeline and activity of the market.
 * @param c Hono context
 * @returns Json response with market details
 */

export const resolveMarket = async (c: Context) => {
	try {
		const userId = c.get('user').id;
		const user = await prisma.user.findUnique({ where: { id: userId } });

		if (!user || user.role !== 'ADMIN') {
			return c.json({ success: false, error: 'Unauthorized: Admin only' }, 401);
		}

		const body = await c.req.json<{ marketId: string; result: string }>();

		// Update DB
		const market = await prisma.market.update({
			where: { id: body.marketId },
			data: { status: 'CLOSED', result: body.result },
		});

		// Push to Engine to halt trading and settle
		const response = await pushToQueue(EVENTS.RESOLVE_MARKET, {
			marketId: body.marketId,
			symbol: market.symbol,
			result: body.result,
		});

		if (!response.success) {
			return c.json({ success: false, message: response.message }, 502);
		}

		return c.json({ success: true, message: 'Market resolved successfully', data: market }, 200);
	} catch (error) {
		logger.error({ error }, 'Failed to resolve market');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};

export const getMarketDetails = async (c: Context) => {
	try {
		const symbol = c.req.param('symbol');

		if (!symbol) {
			logger.warn({
				context: 'GET_MARKET_DETAILS',
				reason: 'Missing symbol parameter',
			});
			return c.json(
				{
					success: false,
					message: 'Symbol parameter is required',
				},
				400,
			);
		}

		const response = await pushToQueue(EVENTS.GET_MARKET_WITH_SYMBOL, { symbol });

		if (!response.success) {
			logger.warn(
				{
					alert: false,
					context: 'GET_MARKET_DETAILS_ENGINE_MISS',
					symbol,
					engineMessage: response.message || 'No message from engine',
					engineError: response.error || null,
				},
				'Engine failed or timed out, falling back to database',
			);

			// if engine fails or down to send back response then i just call db for fallback.
			// but this has some stale data problem

			const marketDetails = await prisma.market.findUnique({
				where: {
					symbol,
				},
				select: {
					id: true,
					title: true,
					symbol: true,
					yesPrice: true,
					noPrice: true,
					thumbnail: true,
					eos: true,
					rules: true,
					endTime: true,
					startTime: true,
					sourceOfTruth: true,
					status: true,
					result: true,
					numberOfTraders: true,
					startPrice: true,
					cryptoMarketType: true,
					category: {
						select: { categoryName: true },
					},
				},
			});

			if (marketDetails?.status === 'CLOSED') {
				try {
					const cacheKey = `cache:closed_market:${symbol}`;
					let archivedDataStr = await client.get(cacheKey);

					if (!archivedDataStr) {
						const bucketName = ENV.S3_SNAPSHOT_BUCKET || 'probstreet-closed-markets';

						if (bucketName && process.env.NODE_ENV !== 'development') {
							logger.info({ symbol }, 'Fetching closed market archive from S3');
							const command = new GetObjectCommand({
								Bucket: bucketName,
								Key: `closed_markets/${symbol}.json.gz`,
							});
							const s3Response = await s3Client.send(command);

							if (s3Response.Body) {
								const byteArray = await s3Response.Body.transformToByteArray();
								const unzipped = await gunzip(Buffer.from(byteArray));
								archivedDataStr = unzipped.toString('utf-8');

								await client.set(cacheKey, archivedDataStr, 'EX', 30 * 24 * 60 * 60);
							}
						}
					}

					if (archivedDataStr) {
						const archivedData = JSON.parse(archivedDataStr);
						return c.json(
							{
								success: true,
								message: 'Market details retrieved successfully from archive',
								data: {
									...marketDetails,
									category: marketDetails?.category?.categoryName || 'Unknown',
									volume: archivedData.Volume || 0,
									traders: archivedData.NumberOfTraders || marketDetails?.numberOfTraders || 0,
									startPrice: marketDetails?.startPrice || null,
									cryptoMarketType: marketDetails?.cryptoMarketType || null,
									orderbook: archivedData.OrderBook || { yes: [], no: [] },
									trades: archivedData.Trades || [],
								},
								source: 's3_archive',
							},
							200,
						);
					}
				} catch (archiveErr) {
					logger.error({ err: archiveErr, symbol }, 'Failed to fetch market archive from R2');
				}
			}

			let volume = 0;
			let tradersCount = marketDetails?.numberOfTraders || 0;

			if (marketDetails) {
				const orders = await prisma.order.findMany({
					where: { marketId: marketDetails.id },
					select: { price: true, filledQuantity: true, userId: true },
				});

				const uniqueTraders = new Set<string>();
				for (const o of orders) {
					volume += Number(o.price) * o.filledQuantity;
					uniqueTraders.add(o.userId);
				}
				if (uniqueTraders.size > 0) {
					tradersCount = uniqueTraders.size;
				}
			}

			return c.json(
				{
					success: true,
					message: 'Market details retrieved successfully',
					data: {
						...marketDetails,
						category: marketDetails?.category?.categoryName || 'Unknown',
						volume: volume,
						traders: tradersCount,
						startPrice: marketDetails.startPrice,
						cryptoMarketType: marketDetails.cryptoMarketType,
					},
					source: 'db',
				},
				200,
			);
		}

		logger.info(
			{
				context: 'GET_MARKET_DETAILS_SUCCESS',
				symbol,
				engineMessage: response.message,
				dataPreview: response.data ? JSON.stringify(response.data).slice(0, 200) : null,
			},
			'Successfully retrieved market details from engine',
		);

		// Calculate dynamic volume and traders
		const marketId = response.data?.marketId;
		let volume = 0;
		let tradersCount = response.data?.numberOftraders || 0;

		if (marketId) {
			const orders = await prisma.order.findMany({
				where: { marketId },
				select: { price: true, filledQuantity: true, userId: true },
			});

			const uniqueTraders = new Set<string>();
			for (const o of orders) {
				volume += Number(o.price) * o.filledQuantity;
				uniqueTraders.add(o.userId);
			}
			tradersCount = uniqueTraders.size;

			let categoryName = 'Unknown';
			const m = await prisma.market.findUnique({
				where: { id: marketId },
				select: {
					status: true,
					result: true,
					startPrice: true,
					cryptoMarketType: true,
					category: { select: { categoryName: true } },
				},
			});

			if (m?.category?.categoryName) categoryName = m.category.categoryName;

			if (response.data) {
				response.data.status = m?.status || response.data.status || 'OPEN';
				response.data.result = m?.result || response.data.result || null;
			}

			// If engine data exists, attach it
			if (response.data) {
				response.data.volume = volume;
				response.data.traders = tradersCount;
				response.data.category = categoryName;
				response.data.startPrice = m?.startPrice || null;
				response.data.cryptoMarketType = m?.cryptoMarketType || null;
			}
		}

		return c.json(
			{
				success: true,
				message: response.message || 'Market details retrieved successfully',
				data: response.data,
			},
			200,
		);
	} catch (error) {
		logger.error(
			{
				alert: true,
				context: 'GET_MARKET_DETAILS_CONTROLLER_FAIL',
				error: error instanceof Error ? error.message : error,
				stack: error instanceof Error ? error.stack : undefined,
			},
			'Unhandled error during getMarketDetails',
		);

		return c.json(
			{
				success: false,
				message: 'Internal server error',
				error: error instanceof Error ? error.message : 'Unknown error',
			},
			500,
		);
	}
};

export const searchMarkets = async (c: Context) => {
	try {
		const q = c.req.query('q') || '';
		const page = parseInt(c.req.query('page') || '1', 10);
		const limit = parseInt(c.req.query('limit') || '10', 10);
		const skip = (page - 1) * limit;

		if (!q.trim()) {
			return c.json({ success: true, data: [], total: 0 }, 200);
		}

		const [markets, total] = await Promise.all([
			prisma.market.findMany({
				where: {
					status: { in: ['OPEN', 'CLOSED'] },
					OR: [
						{ title: { contains: q, mode: 'insensitive' } },
						{ symbol: { contains: q, mode: 'insensitive' } },
					],
				},
				select: {
					id: true,
					title: true,
					symbol: true,
					yesPrice: true,
					noPrice: true,
					thumbnail: true,
					status: true,
					volume: true,
				},
				skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
			}),
			prisma.market.count({
				where: {
					status: { in: ['OPEN', 'CLOSED'] },
					OR: [
						{ title: { contains: q, mode: 'insensitive' } },
						{ symbol: { contains: q, mode: 'insensitive' } },
					],
				},
			}),
		]);

		const formattedMarkets = markets.map((m) => ({
			...m,
			volume: Number(m.volume || 0),
		}));

		return c.json(
			{
				success: true,
				data: formattedMarkets,
				total,
				page,
				limit,
				hasMore: skip + markets.length < total,
			},
			200,
		);
	} catch (error: any) {
		logger.error({ context: 'SEARCH_MARKETS', error: error.message });
		return c.json({ success: false, message: 'Internal server error' }, 500);
	}
};

export const getMarketKlines = async (c: Context) => {
	const symbol = c.req.param('symbol');
	const resolution = c.req.query('resolution') || '1m';
	const from = c.req.query('from');
	const to = c.req.query('to');

	try {
		const market = await prisma.market.findUnique({
			where: { symbol },
			select: { id: true },
		});

		if (!market) {
			return c.json({ success: false, message: 'Market not found' }, 404);
		}

		// Convert resolution to PostgreSQL interval format
		let interval = '1 minute';
		switch (resolution) {
			case '1m':
				interval = '1 minute';
				break;
			case '5m':
				interval = '5 minutes';
				break;
			case '15m':
				interval = '15 minutes';
				break;
			case '1h':
				interval = '1 hour';
				break;
			case '4h':
				interval = '4 hours';
				break;
			case '1d':
				interval = '1 day';
				break;
			default:
				interval = '1 minute';
		}

		// Default to last 30 days if from/to are not provided
		const fromDate = from
			? new Date(Number(from) * 1000)
			: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		const toDate = to ? new Date(Number(to) * 1000) : new Date();

		const query = `
			SELECT 
				time_bucket($1::interval, bucket) AS time,
				first(open, bucket) AS open,
				max(high) AS high,
				min(low) AS low,
				last(close, bucket) AS close,
				sum(volume) AS volume
			FROM trade_candles_1m
			WHERE "marketId" = $2
			  AND bucket >= $3
			  AND bucket <= $4
			GROUP BY time
			ORDER BY time ASC;
		`;

		const klines: any[] = await prisma.$queryRawUnsafe(
			query,
			interval,
			market.id,
			fromDate,
			toDate,
		);

		return c.json({
			success: true,
			data: klines,
		});
	} catch (error: any) {
		if (error.code === 'P2010' || (error.message && error.message.includes('does not exist'))) {
			// Table doesn't exist yet, just return empty klines gracefully
			return c.json({ success: true, data: [] });
		}
		logger.error({ error }, 'Error in getMarketKlines');
		return c.json({ success: false, message: 'Failed to fetch klines' }, 500);
	}
};

export const getMarketTrades = async (c: Context) => {
	const symbol = c.req.param('symbol');
	const limit = Number(c.req.query('limit') || 50);

	try {
		const market = await prisma.market.findUnique({
			where: { symbol },
			select: { id: true },
		});

		if (!market) {
			return c.json({ success: false, message: 'Market not found' }, 404);
		}

		const trades = await prisma.trade.findMany({
			where: { marketId: market.id },
			orderBy: { createdAt: 'desc' },
			take: limit > 100 ? 100 : limit,
			select: {
				id: true,
				makerId: true,
				takerId: true,
				stockType: true,
				takerAction: true,
				price: true,
				quantity: true,
				matchType: true,
				createdAt: true,
				maker: { select: { username: true } },
				taker: { select: { username: true } },
			},
		});

		const formattedTrades = trades.map((trade) => ({
			...trade,
			makerName: trade.maker?.username,
			takerName: trade.taker?.username,
			maker: undefined,
			taker: undefined,
		}));

		return c.json({
			success: true,
			data: formattedTrades,
		});
	} catch (error) {
		logger.error({ error }, 'Error in getMarketKlines');
		return c.json({ success: false, message: 'Failed to fetch trades' }, 500);
	}
};

export const getMarketStats = async (c: Context) => {
	const symbol = c.req.param('symbol');

	try {
		const market = await prisma.market.findUnique({
			where: { symbol },
			select: { id: true, yesPrice: true, noPrice: true, volume: true },
		});

		if (!market) {
			return c.json({ success: false, message: 'Market not found' }, 404);
		}

		// 24h stats
		const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

		const query = `
			SELECT 
				max(high) AS high,
				min(low) AS low,
				sum(volume) AS volume24h,
				first(open, bucket) AS open24h
			FROM trade_candles_1m
			WHERE "marketId" = $1 AND bucket >= $2
		`;

		const stats: any[] = await prisma.$queryRawUnsafe(query, market.id, oneDayAgo);

		return c.json({
			success: true,
			data: {
				currentYesPrice: market.yesPrice,
				currentnoPrice: market.noPrice,
				totalVolume: market.volume,
				high24h: stats[0]?.high || market.yesPrice,
				low24h: stats[0]?.low || market.yesPrice,
				volume24h: stats[0]?.volume24h || 0,
				open24h: stats[0]?.open24h || market.yesPrice,
			},
		});
	} catch (error) {
		logger.error({ error }, 'Error in searchMarkets');
		return c.json({ success: false, message: 'Failed to fetch market stats' }, 500);
	}
};

/**
 * Generate a presigned URL for file uploads, used during market creation
 * @param c Hono context
 * @returns Json response with presigned URL
 */

export const generatePresignedUrlRoute = async (c: Context) => {
	try {
		const body = await c.req.json();
		const { fileName, fileType } = body;

		if (!fileName || !fileType) {
			return c.json(
				{
					success: false,
					message: 'Missing file name or type',
				},
				400,
			);
		}

		const { url, publicUrl } = await generatePresignedUrl(fileName, fileType);
		return c.json({
			success: true,
			message: 'Presinges url generated',
			url,
			publicUrl,
		});
	} catch (error) {
		logger.error({ error }, 'Failed to generate presigned URL');
		return c.json({ success: false, message: 'Internal server error' }, 500);
	}
};

export const splitShares = async (c: Context) => {
	try {
		const user = c.get('user');
		const symbol = c.req.param('symbol');
		const { quantity } = await c.req.json<{ quantity: number }>();

		if (!quantity || quantity <= 0) {
			return c.json({ success: false, message: 'Quantity must be greater than 0' }, 400);
		}

		const market = await prisma.market.findUnique({ where: { symbol } });
		if (!market) {
			return c.json({ success: false, message: 'Market not found' }, 404);
		}

		const response = await pushToQueue(EVENTS.SPLIT_SHARES, {
			userId: user.id,
			marketId: market.id,
			symbol,
			quantity,
		});

		if (!response.success) {
			return c.json({ success: false, message: response.message }, 502);
		}

		return c.json({ success: true, message: 'Shares split successfully' }, 200);
	} catch (error: any) {
		logger.error({ context: 'SPLIT_SHARES', error: error.message });
		return c.json({ success: false, message: 'Internal server error' }, 500);
	}
};

export const mergeShares = async (c: Context) => {
	try {
		const user = c.get('user');
		const symbol = c.req.param('symbol');
		const { quantity } = await c.req.json<{ quantity: number }>();

		if (!quantity || quantity <= 0) {
			return c.json({ success: false, message: 'Quantity must be greater than 0' }, 400);
		}

		const market = await prisma.market.findUnique({ where: { symbol } });
		if (!market) {
			return c.json({ success: false, message: 'Market not found' }, 404);
		}

		const response = await pushToQueue(EVENTS.MERGE_SHARES, {
			userId: user.id,
			marketId: market.id,
			symbol,
			quantity,
		});

		if (!response.success) {
			return c.json({ success: false, message: response.message }, 502);
		}

		return c.json({ success: true, message: 'Shares merged successfully' }, 200);
	} catch (error: any) {
		logger.error({ context: 'MERGE_SHARES', error: error.message });
		return c.json({ success: false, message: 'Internal server error' }, 500);
	}
};

export const getMarketNews = async (c: Context) => {
	try {
		const symbol = c.req.param('symbol');

		if (!symbol) {
			return c.json(
				{
					success: false,
					message: 'Symbol is required',
				},
				400,
			);
		}

		if (!ENV.TAVILY_API_KEY) {
			return c.json(
				{
					success: false,
					message: 'Search API is not configured',
				},
				501,
			);
		}

		const cacheKey = `cache:news:${symbol}`;
		const cachedNews = await client.get(cacheKey);

		if (cachedNews) {
			return c.json({
				success: true,
				data: JSON.parse(cachedNews),
				source: 'cache',
			});
		}

		const market = await prisma.market.findUnique({
			where: { symbol },
			select: { title: true, category: { select: { categoryName: true } } },
		});

		if (!market) {
			return c.json(
				{
					success: false,
					message: 'Market not found',
				},
				404,
			);
		}

		const timeoutPromise = new Promise((_, reject) =>
			setTimeout(() => reject(new Error('Tavily request timed out')), 65000),
		);

		const searchPromise = tavilyClient.search(`"${market.title}" news`, {
			searchDepth: 'fast',
			topic: 'news',
			includeImages: true,
			maxResults: 5,
		});

		const response: any = await Promise.race([searchPromise, timeoutPromise]);

		const parsedNews = response.results.map((result: any, idx: number) => ({
			title: result.title,
			link: result.url,
			source: result.url.split('/')[2]?.replace('www.', '') || 'News',
			thumbnail: result.image || response.images?.[idx] || '',
		}));

		if (parsedNews.length > 0) {
			await client.set(cacheKey, JSON.stringify(parsedNews), 'EX', 2 * 60 * 60);
		}

		return c.json({
			success: true,
			message: 'Market news fetched successfully',
			data: parsedNews,
			source: 'tavily',
		});
	} catch (error: any) {
		logger.error(
			{
				message: error.message,
				status: error.status,
			},
			'Failed to fetch market news',
		);
		return c.json(
			{
				success: false,
				message: 'Failed to fetch news',
				error: error.message,
			},
			500,
		);
	}
};

export const getMarketLiveStatus = async (c: Context) => {
	const symbol = c.req.param('symbol');

	if (!symbol) {
		return c.json({ success: false, message: 'Symbol is required' }, 400);
	}

	try {
		const cacheKey = `market:live:${symbol}`;
		const cached = await client.get(cacheKey);
		if (cached) {
			return c.json({
				success: true,
				data: JSON.parse(cached),
				cached: true,
			});
		}

		const market = await prisma.market.findUnique({
			where: { symbol },
			include: { category: true },
		});

		if (!market) {
			return c.json({ success: false, message: 'Market not found' }, 404);
		}

		const liveData = await fetchLiveMarketData(market);

		// Instant auto-resolution from frontend has been removed for security and reliability.
		// All market resolution is now handled exclusively by the secure backend cron job.
		// Cache for 5 seconds to strictly protect upstream API limits
		await client.set(cacheKey, JSON.stringify(liveData), 'EX', 5);

		return c.json({
			success: true,
			data: liveData,
		});
	} catch (error: any) {
		logger.error({ error: error.message, symbol }, 'Error fetching market live status');
		return c.json({ success: false, message: 'Internal server error' }, 500);
	}
};

// Function removed: autoResolveMarket is replaced by backend cron to prevent frontend-triggered wicks.

// Binance klines proxy — no Redis cache, direct passthrough to Binance public API.
// Binance /api/v3/klines rate limit: 2400 weight/min (each request = 1 weight for limit≤100).
// At 5s poll interval with 100 users we'd use ~1200/min — well within limits.
// No caching here since klines are fetched infrequently (on page load + timeframe change).
const COIN_SYMBOL_MAP: Record<string, string> = {
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

function resolveBinanceSymbol(marketTitle: string, marketSymbol: string): string | null {
	const text = `${marketTitle} ${marketSymbol}`.toUpperCase();
	for (const [keyword, pair] of Object.entries(COIN_SYMBOL_MAP)) {
		if (text.includes(keyword)) return pair;
	}
	return null;
}

export const getMarketProxyKlines = async (c: Context) => {
	const symbol = c.req.param('symbol');
	const interval = c.req.query('interval') || '1m';
	const limit = Math.min(Number(c.req.query('limit') || 60), 500);

	const VALID_INTERVALS = [
		'1m',
		'3m',
		'5m',
		'15m',
		'30m',
		'1h',
		'2h',
		'4h',
		'6h',
		'12h',
		'1d',
		'1w',
	];
	if (!VALID_INTERVALS.includes(interval)) {
		return c.json(
			{ success: false, message: `Invalid interval. Use one of: ${VALID_INTERVALS.join(', ')}` },
			400,
		);
	}

	try {
		const market = await prisma.market.findUnique({
			where: { symbol },
			select: { title: true, symbol: true, status: true },
		});

		if (!market) {
			return c.json({ success: false, message: 'Market not found' }, 404);
		}

		const binancePair = resolveBinanceSymbol(market.title, market.symbol);
		if (!binancePair) {
			return c.json({ success: false, message: 'No crypto asset detected for this market' }, 422);
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5000);

		const res = await fetch(
			`https://api.binance.com/api/v3/klines?symbol=${binancePair}&interval=${interval}&limit=${limit}`,
			{ signal: controller.signal },
		);
		clearTimeout(timeoutId);

		if (!res.ok) {
			logger.warn({ binancePair, interval, status: res.status }, 'Binance klines fetch failed');
			return c.json({ success: false, message: 'Failed to fetch klines from upstream' }, 502);
		}

		const raw = (await res.json()) as any[];

		// Binance kline format: [openTime, open, high, low, close, volume, closeTime, ...]
		const klines = raw.map((k) => ({
			time: k[0], // open timestamp ms
			open: parseFloat(k[1]),
			high: parseFloat(k[2]),
			low: parseFloat(k[3]),
			close: parseFloat(k[4]),
			volume: parseFloat(k[5]),
		}));

		return c.json({
			success: true,
			data: klines,
			coin: binancePair.replace('USDT', ''),
			binancePair,
		});
	} catch (error: any) {
		if (error.name === 'AbortError') {
			return c.json({ success: false, message: 'Upstream timeout fetching klines' }, 504);
		}
		logger.error({ error: error.message, symbol }, 'Error in getMarketProxyKlines');
		return c.json({ success: false, message: 'Internal server error' }, 500);
	}
};

const CHAT_RATE_LIMIT_SEC = 5;

export const getMarketComments = async (c: Context) => {
	try {
		const symbol = c.req.param('symbol');
		const cursor = c.req.query('cursor');

		const market = await prisma.market.findUnique({
			where: { symbol },
			select: { id: true },
		});

		if (!market)
			return c.json(
				{
					success: false,
					message: 'Market not found',
				},
				404,
			);

		const comments = await prisma.marketComment.findMany({
			where: {
				marketId: market.id,
				...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
			},
			orderBy: { createdAt: 'desc' },
			take: 50,
			select: {
				id: true,
				message: true,
				createdAt: true,
				user: { select: { id: true, username: true, avatarUrl: true } },
			},
		});

		return c.json({
			success: true,
			data: comments,
			nextCursor: comments.length === 50 ? comments[0].createdAt.toISOString() : null,
		});
	} catch (error: any) {
		logger.error({ context: 'GET_MARKET_COMMENTS', error: error.message });
		return c.json(
			{
				success: false,
				message: 'Internal server error',
			},
			500,
		);
	}
};

export const postMarketComment = async (c: Context) => {
	try {
		const user = c.get('user');

		if (!user)
			return c.json(
				{
					success: false,
					message: 'Unauthorized',
				},
				401,
			);

		const symbol = c.req.param('symbol');
		const { message } = await c.req.json<{ message: string }>();

		if (!message || typeof message !== 'string' || !message.trim()) {
			return c.json(
				{
					success: false,
					message: 'Message cannot be empty',
				},
				400,
			);
		}

		const trimmed = message.trim().slice(0, 280);

		const rateLimitKey = `chat:rate:${user.id}:${symbol}`;
		const limited = await client.get(rateLimitKey);

		if (limited) {
			return c.json(
				{
					success: false,
					message: 'Slow down — 1 message per 5 seconds',
				},
				429,
			);
		}
		await client.set(rateLimitKey, '1', 'EX', CHAT_RATE_LIMIT_SEC);

		const market = await prisma.market.findUnique({ where: { symbol }, select: { id: true } });

		if (!market)
			return c.json(
				{
					success: false,
					message: 'Market not found',
				},
				404,
			);

		const dbUser = await prisma.user.findUnique({
			where: { id: user.id },
			select: { username: true, avatarUrl: true },
		});

		const comment = await prisma.marketComment.create({
			data: { marketId: market.id, userId: user.id, message: trimmed },
		});

		const payload = {
			id: comment.id,
			message: comment.message,
			createdAt: comment.createdAt,
			user: {
				id: user.id,
				username: dbUser?.username || 'Anonymous',
				avatarUrl: dbUser?.avatarUrl || null,
			},
		};

		await client.publish(`chat:${symbol}`, JSON.stringify(payload));

		logger.info({ userId: user.id, symbol }, 'Chat message posted');
		return c.json(
			{
				success: true,
				data: payload,
			},
			201,
		);
	} catch (error: any) {
		logger.error({ context: 'POST_MARKET_COMMENT', error: error.message });
		return c.json(
			{
				success: false,
				message: 'Internal server error',
			},
			500,
		);
	}
};

export const deleteMarketComment = async (c: Context) => {
	try {
		const user = c.get('user');
		if (!user)
			return c.json(
				{
					success: false,
					message: 'Unauthorized',
				},
				401,
			);

		const commentId = c.req.param('commentId');

		const comment = await prisma.marketComment.findUnique({
			where: { id: commentId },
			select: { userId: true },
		});

		if (!comment) {
			return c.json(
				{
					success: false,
					message: 'Comment not found',
				},
				404,
			);
		}

		if (comment.userId !== user.id) {
			return c.json({ success: false, message: 'Forbidden' }, 403);
		}

		await prisma.marketComment.delete({
			where: { id: commentId },
		});

		return c.json({
			success: true,
			message: 'Comment removed',
		});
	} catch (error: any) {
		logger.error({ context: 'DELETE_MARKET_COMMENT', error: error.message });
		return c.json({ success: false, message: 'Internal server error' }, 500);
	}
};
