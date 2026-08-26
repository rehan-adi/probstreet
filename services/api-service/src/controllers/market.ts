import slugify from 'slugify';
import { Context } from 'hono';
import { customAlphabet } from 'nanoid';
import { logger } from '@/libs/logger';
import { prisma } from '@probstreet/database';
import { EVENTS } from '@/config/constants';
import { pushToQueue } from '@/libs/redis/queue';
import { createMarketSchema } from '@/validations/market';
import { generatePresignedUrl } from '@/libs/aws/presign';
import { sendNotification } from '@/libs/notification/dispatcher';

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
			},
		});

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

			// Automated Liquidity Provision (AMM Bot)
			// Seed the market with multi-level BUY orders on both YES and NO sides
			// This creates proper orderbook depth via MINT matching
			await pushToQueue(EVENTS.ADD_LIQUIDITY, {
				userId: user?.id,
				phone: user?.phone,
				role: 'ADMIN',
				marketId: newMarket.id,
				symbol: newMarket.symbol,
				levels: [
					{ price: 3.0, quantity: 10 },
					{ price: 4.0, quantity: 25 },
					{ price: 5.0, quantity: 50 },
					{ price: 6.0, quantity: 25 },
					{ price: 7.0, quantity: 10 },
				],
			});

			// Fire-and-forget: notify all subscribed users about the new market
			// This is non-blocking — it does NOT slow down the admin's response
			sendNotification({
				type: 'market.created',
				data: {
					marketId: newMarket.id,
					title: newMarket.title,
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
				category: {
					select: { categoryName: true },
				},
			},
		});

		const markets = rawMarkets.map((m) => ({
			...m,
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

		const markets = await prisma.market.findMany({
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
			},
		});

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
					category: {
						select: { categoryName: true },
					},
				},
			});

			// Calculate dynamic volume and traders for DB fallback
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
			const categoryId = response.data?.categoryId;

			if (categoryId) {
				const cat = await prisma.category.findUnique({
					where: { id: categoryId },
					select: { categoryName: true },
				});
				if (cat) categoryName = cat.categoryName;
			} else if (marketId) {
				const m = await prisma.market.findUnique({
					where: { id: marketId },
					select: {
						status: true,
						result: true,
						category: { select: { categoryName: true } },
					},
				});
				if (m?.category?.categoryName) categoryName = m.category.categoryName;
				if (response.data) {
					response.data.status = m?.status || response.data.status || 'OPEN';
					response.data.result = m?.result || response.data.result || null;
				}
			}

			// If engine data exists, attach it
			if (response.data) {
				response.data.volume = volume;
				response.data.traders = tradersCount;
				response.data.category = categoryName;
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

		return c.json(
			{
				success: true,
				data: markets,
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
	} catch (error) {
		console.error(error);
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
		console.error(error);
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
		console.error(error);
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
