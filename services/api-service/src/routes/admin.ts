import { Hono } from 'hono';
import { isAdmin } from '@/middlewares/isAdmin';
import { getSportsFixtures } from '@/controllers/sports';
import { authorization } from '@/middlewares/authorization';
import {
	resolveMarket,
	getDashboardMetrics,
	getUsers,
	getTransactions,
	getMarkets,
} from '@/controllers/admin';
import {
	getPendingVerifications,
	updatePendingVerification,
	getUserVerificationDetailsForAdmin,
} from '@/controllers/verification';
import { getOraclePending, confirmOracleResolution } from '@/controllers/oracle';

export const aapiRoutes = new Hono();

aapiRoutes.use('*', authorization, isAdmin);

aapiRoutes.get('/users', getUsers);
aapiRoutes.get('/markets', getMarkets);
aapiRoutes.get('/transactions', getTransactions);
aapiRoutes.get('/analytics/dashboard', getDashboardMetrics);

aapiRoutes.post('/markets/resolve', resolveMarket);

aapiRoutes.get('/oracle/pending', getOraclePending);
aapiRoutes.post('/oracle/confirm', confirmOracleResolution);

aapiRoutes.get('/sports/fixtures', getSportsFixtures);

aapiRoutes.get('/verification/pending', getPendingVerifications);
aapiRoutes.post('/verification/verify', updatePendingVerification);
aapiRoutes.get('/verification/:userId', getUserVerificationDetailsForAdmin);
