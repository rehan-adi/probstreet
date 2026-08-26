import { Hono } from 'hono';
import { rateLimiter } from '@/middlewares/limiter';
import { authorization } from '@/middlewares/authorization';
import {
	getVerificationDetails,
	getVerificationStatus,
	submitKyc,
	submitPaymentMethods,
	deletePaymentMethod,
} from '@/controllers/verification';

export const verificationRoutes = new Hono();

verificationRoutes.get(
	'/',
	authorization,
	rateLimiter({ points: 50, duration: 300 }),
	getVerificationDetails,
);
verificationRoutes.get(
	'/status',
	authorization,
	rateLimiter({ points: 50, duration: 300 }),
	getVerificationStatus,
);

// kyc and payment method submit routes
verificationRoutes.post(
	'/kyc/submit',
	rateLimiter({ points: 50, duration: 300 }),
	authorization,
	submitKyc,
);
verificationRoutes.post(
	'/payment-method/submit',
	authorization,
	rateLimiter({ points: 50, duration: 300 }),
	submitPaymentMethods,
);
verificationRoutes.delete(
	'/payment-method/:id',
	authorization,
	rateLimiter({ points: 50, duration: 300 }),
	deletePaymentMethod,
);
