import z from 'zod';

export const usernameSchema = z.object({
	username: z
		.string()
		.min(3, 'Username must be at least 3 characters')
		.max(20, 'Username cannot exceed 20 characters')
		.regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
		.refine(
			(val) => {
				const RESERVED = [
					'admin',
					'support',
					'help',
					'api',
					'www',
					'settings',
					'profile',
					'login',
					'signup',
					'auth',
					'system',
					'bot',
					'official',
					'mod',
					'root',
					'test',
				];
				return !RESERVED.includes(val.toLowerCase());
			},
			{ message: 'This username is reserved' },
		),
});

export const referralSchema = z.object({
	referralCode: z.string().optional(),
});

export const notificationPrefsSchema = z.object({
	emailNewMarket: z.boolean().default(false),
	emailTradeExecuted: z.boolean().default(false),
	inAppNewMarket: z.boolean().default(true),
	inAppTradeExecuted: z.boolean().default(true),
	inAppPriceAlerts: z.boolean().default(false),
});
