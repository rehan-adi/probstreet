import crypto from 'crypto';
import { Context } from 'hono';
import { ENV } from '@/config/env';
import { logger } from '@/libs/logger';
import { getClientInfo } from '@/utils/client';
import { EVENTS } from '@/config/constants';
import { pushToQueue } from '@/libs/redis/queue';
import { deleteCookie, getCookie } from 'hono/cookie';
import { sendOtpEmail } from '@/libs/nodemailer/mailer';
import { client as redis } from '@/libs/redis/connection';
import { prisma, AuthProvider } from '@probstreet/database';
import {
	generateAccessToken,
	generateRefreshTokenString,
	hashRefreshToken,
	setAuthCookies,
} from '@/utils/token';
import {
	sendEmailOtpSchema,
	verifyEmailOtpSchema,
	verifyGoogleSchema,
	verifyDiscordSchema,
	verifyTelegramSchema,
} from '@/validations/auth';

const logAudit = async (
	action: string,
	userId?: string,
	ip?: string,
	userAgent?: string,
	metadata?: any,
) => {
	try {
		await prisma.auditLog.create({
			data: {
				action,
				userId,
				ip,
				userAgent,
				metadata: metadata ? metadata : undefined,
			},
		});
	} catch (error) {
		logger.error(
			{
				error,
				action,
				userId,
			},
			'Failed to write audit log',
		);
	}
};

const resolveOrCreateUser = async (
	email: string,
	provider: AuthProvider,
	providerUserId: string,
) => {
	const existingLink = await prisma.linkedAccount.findUnique({
		where: { provider_providerUserId: { provider, providerUserId } },
		include: { user: true },
	});

	if (existingLink) return { user: existingLink.user, isNewUser: false };

	let user: any = await prisma.user.findUnique({ where: { email } });

	if (user) {
		await prisma.linkedAccount.create({
			data: { userId: user.id, provider, providerUserId, providerEmail: email },
		});
		return { user, isNewUser: false };
	}

	try {
		await prisma.$transaction(async (tx) => {
			user = await tx.user.create({
				data: {
					email,
					isNewUser: true,
					onboardingStatus: 'PENDING_USERNAME',
					referralCode: crypto.randomUUID().substring(0, 5).toUpperCase(),
					avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
				},
			});
			await tx.linkedAccount.create({
				data: { userId: user.id, provider, providerUserId, providerEmail: email },
			});

			await tx.wallet.create({
				data: { userId: user.id, balance: 15.0 },
			});
			await tx.transaction.create({
				data: {
					userId: user.id,
					type: 'SIGNUP_BONUS',
					status: 'SUCCESS',
					amount: '15.00',
					remarks: 'Signup Bonus',
				},
			});
		});
	} catch (error) {
		logger.error({ error, email }, 'Failed to create new user in transaction');
		throw new Error('Failed to create user account');
	}

	if (!user) throw new Error('User creation failed');

	try {
		await pushToQueue(EVENTS.CREATE_USER, { id: user.id, name: user.name });
		await pushToQueue(EVENTS.INIT_BALANCE, { userId: user.id, amount: 15.0 });
	} catch (error) {
		logger.error({ error, userId: user.id }, 'Failed to queue events for new user');
	}

	return { user, isNewUser: true };
};

const createSession = async (
	userId: string,
	role: string,
	email?: string | null,
	userAgent?: string,
	ipAddress?: string,
) => {
	const accessToken = await generateAccessToken(userId, role, email);
	const refreshTokenString = generateRefreshTokenString();

	const hashedRefreshToken = hashRefreshToken(refreshTokenString);
	const expiresAt = new Date(Date.now() + Number(ENV.REFRESH_TOKEN_EXPIRY) * 1000);

	await prisma.session.create({
		data: {
			userId,
			refreshToken: hashedRefreshToken,
			userAgent,
			ipAddress,
			expiresAt,
		},
	});
	return { accessToken, refreshToken: refreshTokenString };
};

/**
 * @desc Initiates the email signin process by validating the email, generating a 6-digit OTP, storing it in Redis with a TTL, and pushing an email task to the background queue.
 * @param c Hono Context
 * @returns JSON response
 */
export const initSignin = async (c: Context) => {
	try {
		const body = await c.req.json();

		const result = sendEmailOtpSchema.safeParse(body);

		if (!result.success)
			return c.json(
				{
					success: false,
					error: result.error.issues,
				},
				400,
			);

		const { email } = result.data;

		const attemptsKey = `otp_attempts:${email}`;
		const otpKey = `otp:${email}`;

		const attempts = await redis.get(attemptsKey);

		if (attempts && parseInt(attempts) >= 5) {
			return c.json(
				{ success: false, error: 'Too many failed attempts. Please wait 15 minutes.' },
				400,
			);
		}

		const otp = Math.floor(100000 + Math.random() * 900000).toString();

		await redis.set(otpKey, otp, 'EX', 300);

		if (!attempts) await redis.set(attemptsKey, 0, 'EX', 900);

		logger.info({ email }, 'Generated OTP');

		await sendOtpEmail(email, otp);

		return c.json({
			success: true,
			message: 'OTP sent successfully',
		});
	} catch (error: any) {
		logger.error({ error }, 'Failed to send email OTP');
		return c.json(
			{
				success: false,
				error: error.message || 'Failed to send OTP',
			},
			400,
		);
	}
};

/**
 * @desc Verifies the provided email OTP against the stored value in Redis, creates or retrieves the user account, establishes a secure session, and sets HTTP-only cookies with access and refresh tokens.
 * @param c Hono Context
 * @returns JSON response
 */
export const verifyOtp = async (c: Context) => {
	try {
		const body = await c.req.json();

		const result = verifyEmailOtpSchema.safeParse(body);

		if (!result.success)
			return c.json(
				{
					success: false,
					error: result.error.issues,
				},
				400,
			);

		const { email, otp } = result.data;
		const { ip, userAgent } = getClientInfo(c);

		const otpKey = `otp:${email}`;
		const attemptsKey = `otp_attempts:${email}`;

		const attempts = await redis.get(attemptsKey);

		if (attempts && parseInt(attempts) >= 5)
			return c.json(
				{ success: false, error: 'Too many failed attempts. Please wait 15 minutes.' },
				400,
			);

		const storedOtp = await redis.get(otpKey);

		if (!storedOtp) return c.json({ success: false, error: 'OTP expired or not found' }, 400);

		if (storedOtp !== otp) {
			await redis.incr(attemptsKey);
			return c.json({ success: false, error: 'Invalid OTP' }, 400);
		}

		await redis.del(otpKey);
		await redis.del(attemptsKey);

		const { user, isNewUser } = await resolveOrCreateUser(email, 'EMAIL', email);

		await prisma.user.update({
			where: { id: user.id },
			data: { lastProvider: 'EMAIL' },
		});

		const { accessToken, refreshToken } = await createSession(
			user.id,
			user.role,
			user.email,
			userAgent,
			ip,
		);

		setAuthCookies(c, accessToken, refreshToken);
		await logAudit('LOGIN_EMAIL', user.id, ip, userAgent);

		return c.json({
			success: true,
			data: {
				id: user.id,
				email: user.email,
				username: user.username,
				avatarUrl: user.avatarUrl,
				phone: user.phone,
				role: user.role,
				isNewUser,
				onboardingStatus: user.onboardingStatus,
				referralCode: user.referralCode,
			},
		});
	} catch (error: any) {
		logger.error({ error }, 'Failed to verify email OTP');
		return c.json(
			{
				success: false,
				error: error.message || 'Invalid OTP',
			},
			401,
		);
	}
};

/**
 * @desc Handles the Google OAuth callback by verifying the Google access token, fetching user info from Google API, creating/linking the user account, and establishing a session.
 * @param c Hono Context
 * @returns JSON response
 */
export const googleCallback = async (c: Context) => {
	try {
		const body = await c.req.json();
		const result = verifyGoogleSchema.safeParse(body);

		if (!result.success)
			return c.json(
				{
					success: false,
					error: result.error.issues,
				},
				400,
			);

		const { ip, userAgent } = getClientInfo(c);

		if (!ENV.GOOGLE_CLIENT_ID)
			return c.json({ success: false, error: 'Google Auth not configured' }, 400);

		const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
			headers: { Authorization: `Bearer ${result.data.idToken}` },
		});

		if (!response.ok) return c.json({ success: false, error: 'Invalid Google Access Token' }, 400);

		const googlePayload: any = await response.json();
		const providerUserId = googlePayload.sub;
		const email = googlePayload.email;

		const { user, isNewUser } = await resolveOrCreateUser(email, 'GOOGLE', providerUserId);

		await prisma.user.update({ where: { id: user.id }, data: { lastProvider: 'GOOGLE' } });
		const { accessToken, refreshToken } = await createSession(
			user.id,
			user.role,
			user.email,
			userAgent,
			ip,
		);
		setAuthCookies(c, accessToken, refreshToken);
		await logAudit('LOGIN_GOOGLE', user.id, ip, userAgent);

		return c.json({
			success: true,
			data: {
				id: user.id,
				email: user.email,
				username: user.username,
				avatarUrl: user.avatarUrl,
				phone: user.phone,
				role: user.role,
				isNewUser,
				onboardingStatus: user.onboardingStatus,
				referralCode: user.referralCode,
			},
		});
	} catch (error: any) {
		logger.error({ error }, 'Google login failed');
		return c.json({ success: false, error: 'Authentication failed' }, 401);
	}
};

/**
 * @desc Handles the Discord OAuth callback by fetching user info from Discord API using the access token, creating/linking the user account, and establishing a secure session.
 * @param c Hono Context
 * @returns JSON response
 */
export const discordCallback = async (c: Context) => {
	try {
		const body = await c.req.json();
		const result = verifyDiscordSchema.safeParse(body);
		if (!result.success) return c.json({ success: false, error: result.error.issues }, 400);

		const { ip, userAgent } = getClientInfo(c);
		if (!ENV.DISCORD_CLIENT_ID)
			return c.json({ success: false, error: 'Discord Auth not configured' }, 400);

		const response = await fetch('https://discord.com/api/users/@me', {
			headers: { Authorization: `Bearer ${result.data.accessToken}` },
		});
		if (!response.ok) return c.json({ success: false, error: 'Invalid Discord Access Token' }, 400);
		const discordPayload: any = await response.json();
		if (!discordPayload.email)
			return c.json({ success: false, error: 'Discord sign in did not provide an email' }, 400);

		const { user, isNewUser } = await resolveOrCreateUser(
			discordPayload.email,
			'DISCORD',
			discordPayload.id,
		);
		await prisma.user.update({ where: { id: user.id }, data: { lastProvider: 'DISCORD' } });
		const { accessToken, refreshToken } = await createSession(
			user.id,
			user.role,
			user.email,
			userAgent,
			ip,
		);
		setAuthCookies(c, accessToken, refreshToken);
		await logAudit('LOGIN_DISCORD', user.id, ip, userAgent);

		return c.json({
			success: true,
			data: {
				id: user.id,
				email: user.email,
				username: user.username,
				avatarUrl: user.avatarUrl,
				phone: user.phone,
				role: user.role,
				isNewUser,
				onboardingStatus: user.onboardingStatus,
				referralCode: user.referralCode,
			},
		});
	} catch (error: any) {
		logger.error({ error }, 'Discord login failed');
		return c.json({ success: false, error: 'Authentication failed' }, 401);
	}
};

/**
 * @desc Handles the Telegram OAuth callback by cryptographically verifying the Telegram data hash, extracting user info, creating/linking the account, and establishing a session.
 * @param c Hono Context
 * @returns JSON response
 */
export const telegramCallback = async (c: Context) => {
	try {
		const body = await c.req.json();
		const result = verifyTelegramSchema.safeParse(body);
		if (!result.success) return c.json({ success: false, error: result.error.issues }, 400);

		const { ip, userAgent } = getClientInfo(c);
		if (!ENV.TELEGRAM_BOT_TOKEN)
			return c.json({ success: false, error: 'Telegram Auth not configured' }, 400);

		let providerUserId = '';
		if (result.data.initData) {
			const urlParams = new URLSearchParams(result.data.initData);
			const hash = urlParams.get('hash');
			urlParams.delete('hash');
			urlParams.sort();
			let dataCheckString = '';
			for (const [key, value] of urlParams.entries()) {
				dataCheckString += `${key}=${value}
`;
			}
			dataCheckString = dataCheckString.slice(0, -1);
			const secretKey = crypto
				.createHmac('sha256', 'WebAppData')
				.update(ENV.TELEGRAM_BOT_TOKEN)
				.digest();
			const calculatedHash = crypto
				.createHmac('sha256', secretKey)
				.update(dataCheckString)
				.digest('hex');
			if (calculatedHash !== hash)
				return c.json({ success: false, error: 'Invalid Telegram Data' }, 400);
			const telegramUser = JSON.parse(urlParams.get('user') || '{}');
			if (!telegramUser.id)
				return c.json({ success: false, error: 'No user data in Telegram payload' }, 400);
			providerUserId = telegramUser.id.toString();
		} else if (result.data.widgetData) {
			const { hash, ...data } = result.data.widgetData;
			const dataCheckString = Object.keys(data)
				.sort()
				.map((key) => `${key}=${data[key]}`)
				.join('\\n');
			const secretKey = crypto.createHash('sha256').update(ENV.TELEGRAM_BOT_TOKEN).digest();
			const calculatedHash = crypto
				.createHmac('sha256', secretKey)
				.update(dataCheckString)
				.digest('hex');
			if (calculatedHash !== hash)
				return c.json({ success: false, error: 'Invalid Telegram Widget Data' }, 400);
			if (!result.data.widgetData.id)
				return c.json({ success: false, error: 'No user data in Telegram payload' }, 400);
			providerUserId = result.data.widgetData.id.toString();
		} else {
			return c.json({ success: false, error: 'No Telegram data provided' }, 400);
		}

		const email = `${providerUserId}@telegram.probstreet.local`;
		const { user, isNewUser } = await resolveOrCreateUser(email, 'TELEGRAM', providerUserId);
		await prisma.user.update({ where: { id: user.id }, data: { lastProvider: 'TELEGRAM' } });
		const { accessToken, refreshToken } = await createSession(
			user.id,
			user.role,
			user.email,
			userAgent,
			ip,
		);
		setAuthCookies(c, accessToken, refreshToken);
		await logAudit('LOGIN_TELEGRAM', user.id, ip, userAgent);

		return c.json({
			success: true,
			data: {
				id: user.id,
				email: user.email,
				username: user.username,
				avatarUrl: user.avatarUrl,
				phone: user.phone,
				role: user.role,
				isNewUser,
				onboardingStatus: user.onboardingStatus,
				referralCode: user.referralCode,
			},
		});
	} catch (error: any) {
		logger.error({ error }, 'Telegram login failed');
		return c.json({ success: false, error: 'Authentication failed' }, 401);
	}
};

/**
 * @desc Logs out the user from the current device by revoking the specific refresh token in the database and clearing the authentication cookies.
 * @param c Hono Context
 * @returns JSON response
 */
export const logout = async (c: Context) => {
	try {
		const token = getCookie(c, 'refreshToken');

		if (token) {
			const hashedToken = hashRefreshToken(token);
			await prisma.session.updateMany({
				where: { refreshToken: hashedToken },
				data: { isRevoked: true },
			});
		}

		deleteCookie(c, 'accessToken', { path: '/' });
		deleteCookie(c, 'refreshToken', { path: '/api/v1/auth' });
		return c.json({
			success: true,
			message: 'Logged out successfully',
		});
	} catch (error) {
		logger.error({ error }, 'Logout failed');
		return c.json(
			{
				success: false,
				error: 'Internal server error',
			},
			500,
		);
	}
};

/**
 * @desc Validates the provided refresh token, revokes the old one to prevent reuse, and generates a fresh pair of access and refresh tokens for the user session.
 * @param c Hono Context
 * @returns JSON response
 */
export const refresh = async (c: Context) => {
	try {
		const token = getCookie(c, 'refreshToken');
		if (!token) return c.json({ success: false, error: 'No refresh token provided' }, 401);

		const { ip, userAgent } = getClientInfo(c);
		const hashedOldToken = hashRefreshToken(token);
		const session = await prisma.session.findUnique({
			where: { refreshToken: hashedOldToken },
			include: { user: true },
		});

		if (!session || session.isRevoked || session.expiresAt < new Date()) {
			if (session && !session.isRevoked) {
				await prisma.session.update({ where: { id: session.id }, data: { isRevoked: true } });
			}
			return c.json({ success: false, error: 'Invalid or expired refresh token' }, 401);
		}

		const newRefreshTokenString = generateRefreshTokenString();
		const hashedNewToken = hashRefreshToken(newRefreshTokenString);
		const expiresAt = new Date(Date.now() + Number(ENV.REFRESH_TOKEN_EXPIRY) * 1000);
		await prisma.session.update({
			where: { id: session.id },
			data: {
				refreshToken: hashedNewToken,
				lastActiveAt: new Date(),
				expiresAt,
				userAgent,
				ipAddress: ip,
			},
		});

		const accessToken = await generateAccessToken(
			session.userId,
			session.user.role,
			session.user.email,
		);
		setAuthCookies(c, accessToken, newRefreshTokenString);

		return c.json({ success: true, message: 'Token refreshed' });
	} catch (error: any) {
		logger.error({ error }, 'Refresh token failed');
		deleteCookie(c, 'accessToken', { path: '/' });
		deleteCookie(c, 'refreshToken', { path: '/api/v1/auth' });
		return c.json({ success: false, error: 'Invalid or expired session' }, 401);
	}
};

/**
 * @desc Retrieves the authenticated user's detailed profile information, including their current wallet balance, pending withdrawals, and referral statistics.
 * @param c Hono Context
 * @returns JSON response
 */
export const getMe = async (c: Context) => {
	try {
		const authUser = c.get('user');
		if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401);
		const user = await prisma.user.findUnique({
			where: { id: authUser.id },
			select: {
				id: true,
				email: true,
				phone: true,
				username: true,
				avatarUrl: true,
				role: true,
				isNewUser: true,
				onboardingStatus: true,
				referralCode: true,
				createdAt: true,
			},
		});
		if (!user) return c.json({ success: false, error: 'User not found' }, 404);
		return c.json({ success: true, data: user });
	} catch (error) {
		logger.error({ error }, 'Failed to fetch profile');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};

/**
 * @desc Retrieves a list of all active, non-revoked sessions for the authenticated user across all devices.
 * @param c Hono Context
 * @returns JSON response
 */
export const getSessions = async (c: Context) => {
	try {
		const user = c.get('user');
		if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);
		const sessions = await prisma.session.findMany({
			where: { userId: user.id, isRevoked: false, expiresAt: { gt: new Date() } },
			select: {
				id: true,
				userAgent: true,
				ipAddress: true,
				deviceName: true,
				lastActiveAt: true,
				createdAt: true,
			},
			orderBy: { lastActiveAt: 'desc' },
		});
		return c.json({ success: true, data: sessions });
	} catch (error) {
		logger.error({ error }, 'Failed to get sessions');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};

/**
 * @desc Logs out the user from all devices by revoking all active sessions in the database and clearing the current device's authentication cookies.
 * @param c Hono Context
 * @returns JSON response
 */
export const logoutAll = async (c: Context) => {
	try {
		const user = c.get('user');
		if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);
		await prisma.session.updateMany({
			where: { userId: user.id, isRevoked: false },
			data: { isRevoked: true },
		});
		deleteCookie(c, 'accessToken', { path: '/' });
		deleteCookie(c, 'refreshToken', { path: '/api/v1/auth' });
		return c.json({ success: true, message: 'Logged out of all devices' });
	} catch (error) {
		logger.error({ error }, 'Logout all failed');
		return c.json({ success: false, error: 'Internal server error' }, 500);
	}
};
