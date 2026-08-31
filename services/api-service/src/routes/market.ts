import { Hono } from 'hono';
import { isAdmin } from '@/middlewares/isAdmin';
import { authorization } from '@/middlewares/authorization';
import {
	createMarket,
	addLiquidity,
	getAllMarket,
	getMarketDetails,
	getMarketsByCategory,
	resolveMarket,
	searchMarkets,
	getMarketKlines,
	getMarketTrades,
	getMarketStats,
	generatePresignedUrlRoute,
	splitShares,
	mergeShares,
	getMarketNews,
	getMarketLiveStatus,
	getMarketProxyKlines,
	getMarketComments,
	postMarketComment,
	deleteMarketComment,
} from '@/controllers/market';
import { optionalAuthorization } from '@/middlewares/optionalAuthorization';

export const marketRoutes = new Hono();

marketRoutes.get('/', getAllMarket);
marketRoutes.get('/category/:categoryParam', getMarketsByCategory);
marketRoutes.post('/create', authorization, isAdmin, createMarket);
marketRoutes.post('/liquidity-add', authorization, addLiquidity);
marketRoutes.post('/resolve', authorization, isAdmin, resolveMarket);
marketRoutes.post('/generate-url', authorization, isAdmin, generatePresignedUrlRoute);
marketRoutes.post('/:symbol/split', authorization, splitShares);
marketRoutes.post('/:symbol/merge', authorization, mergeShares);

marketRoutes.get('/search', searchMarkets);
marketRoutes.get('/:symbol', getMarketDetails);
marketRoutes.get('/:symbol/live', getMarketLiveStatus);
marketRoutes.get('/:symbol/klines', getMarketKlines);
marketRoutes.get('/:symbol/proxy-klines', getMarketProxyKlines);
marketRoutes.get('/:symbol/trades', getMarketTrades);
marketRoutes.get('/:symbol/stats', getMarketStats);
marketRoutes.get('/:symbol/news-change', getMarketNews); // we will change it later before launch

marketRoutes.get('/:symbol/comments', optionalAuthorization, getMarketComments);
marketRoutes.post('/:symbol/comments', authorization, postMarketComment);
marketRoutes.delete('/:symbol/comments/:commentId', authorization, deleteMarketComment);
