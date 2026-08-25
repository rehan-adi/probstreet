import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { aapiRoutes } from '@/routes/admin';
import { authRoutes } from '@/routes/auth';
import { orderRoutes } from '@/routes/order';
import { healthRoutes } from '@/routes/health';
import { marketRoutes } from '@/routes/market';
import { paymentRoutes } from '@/routes/payment';
import { profileRoutes } from '@/routes/profile';
import { balanceRoutes } from '@/routes/balance';
import { settingsRoutes } from '@/routes/settings';
import { referralRoutes } from '@/routes/referral';
import { internalRoutes } from '@/routes/internal';
import { portfolioRoutes } from '@/routes/portfolio';
import { onboardingRoutes } from '@/routes/onboarding';
import { categoriesRoutes } from '@/routes/categories';
import { transactionRoutes } from '@/routes/transaction';
import { leaderboardRoutes } from '@/routes/leaderboard';
import { priceAlertsRoutes } from '@/routes/price-alerts';
import { verificationRoutes } from '@/routes/verification';
import { notificationsRoutes } from '@/routes/notifications';

const app = new Hono();

app.use(logger());
app.use(
	cors({
		origin: ['http://localhost:5173'],
		allowHeaders: ['Content-Type', 'Authorization', 'X-Custom-Header'],
		allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
		exposeHeaders: ['Content-Length', 'X-Custom-Header'],
		maxAge: 86400,
		credentials: true,
	}),
);
app.use('*', async (c, next) => {
	c.header('X-Content-Type-Options', 'nosniff');
	c.header('X-Frame-Options', 'DENY');
	c.header('X-XSS-Protection', '1; mode=block');
	c.header('Referrer-Policy', 'no-referrer');
	await next();
});

// Client APIs (CAPI)
app.route('/api/v1/capi/auth', authRoutes);
app.route('/api/v1/capi/order', orderRoutes);
app.route('/api/v1/capi/market', marketRoutes);
app.route('/api/v1/capi/balance', balanceRoutes);
app.route('/api/v1/capi/profile', profileRoutes);
app.route('/api/v1/capi/payments', paymentRoutes);
app.route('/api/v1/capi/settings', settingsRoutes);
app.route('/api/v1/capi/referral', referralRoutes);
app.route('/api/v1/capi/portfolio', portfolioRoutes);
app.route('/api/v1/capi/onboarding', onboardingRoutes);
app.route('/api/v1/capi/categories', categoriesRoutes);
app.route('/api/v1/capi/transaction', transactionRoutes);
app.route('/api/v1/capi/leaderboard', leaderboardRoutes);
app.route('/api/v1/capi/price-alerts', priceAlertsRoutes);
app.route('/api/v1/capi/verification', verificationRoutes);
app.route('/api/v1/capi/notifications', notificationsRoutes);

// Admin APIs (AAPI)
app.route('/api/v1/aapi', aapiRoutes);

// Health check APIs (PAPI)
app.route('/api/v1/papi/health', healthRoutes);

// Internal APIs (secret-protected DB proxy)
app.route('/api/v1/iapi', internalRoutes);

export default app;
