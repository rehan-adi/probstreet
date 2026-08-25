import { logger } from '@/libs/logger';
import { getCookie } from 'hono/cookie';
import { Context, MiddlewareHandler } from 'hono';
import { verifyAccessToken } from '@/utils/token';

export const authorization: MiddlewareHandler = async (c: Context, next) => {
	try {
		let token = getCookie(c, 'accessToken');

		if (!token) {
			const authHeader = c.req.header('Authorization');
			if (authHeader && authHeader.startsWith('Bearer ')) {
				token = authHeader.substring(7);
			}
		}

		if (!token) {
			token = c.req.query('token');
		}

		if (!token) {
			logger.warn('No token found in cookies, Authorization header, or query param');
			return c.json({ success: false, message: 'Unauthorized' }, 401);
		}

		const payload = await verifyAccessToken(token);

		const { id, email, role } = payload;

		c.set('user', { id, email, role });

		await next();
	} catch (error) {
		logger.error({ error }, 'Access token verification failed');
		return c.json({ success: false, message: 'Invalid or expired token' }, 401);
	}
};
