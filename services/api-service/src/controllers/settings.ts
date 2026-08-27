import { Context } from 'hono';
import { prisma } from '@probstreet/database';

/**
 * @desc Get all settings (profile, notification preferences)
 * @param c Hono context
 * @returns Json response with user profile and notification settings
 */

export async function getSettings(c: Context) {
	const user = c.get('user');

	try {
		const settings = await prisma.user.findUnique({
			where: { id: user.id },
			include: {
				notificationPrefs: true,
			},
		});

		if (!settings) {
			return c.json(
				{
					error: 'User not found',
				},
				404,
			);
		}

		return c.json(settings);
	} catch (error) {
		console.error('Error in getSettings:', error);
		return c.json({ error: 'Failed to fetch settings' }, 500);
	}
}

/**
 * @desc Update user profile (bio, username)
 * @param c Hono context
 * @returns Json response with updated user
 */

export async function updateProfile(c: Context) {
	const user = c.get('user');
	const body = await c.req.json();
	const { bio, username } = body;

	try {
		if (username && username !== user.username) {
			const existingUser = await prisma.user.findUnique({ where: { username } });

			if (existingUser) {
				return c.json({ error: 'Username already taken' }, 400);
			}

			if (user.usernameChangedAt) {
				const fourteenDaysAgo = new Date();
				fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

				if (new Date(user.usernameChangedAt) > fourteenDaysAgo) {
					return c.json({ error: 'You can only change your username once every 14 days' }, 403);
				}
			}

			const updatedUser = await prisma.user.update({
				where: { id: user.id },
				data: {
					username,
					bio: bio !== undefined ? bio : user.bio,
					usernameChangedAt: new Date(),
				},
			});
			return c.json({
				user: updatedUser,
				message: 'Profile updated successfully',
			});
		} else if (bio !== undefined && bio !== user.bio) {
			// Update bio only
			const updatedUser = await prisma.user.update({
				where: { id: user.id },
				data: { bio },
			});
			return c.json({ user: updatedUser, message: 'Profile updated successfully' });
		}

		return c.json({ message: 'No changes made', user });
	} catch (error) {
		console.error('Error in updateProfile:', error);
		return c.json({ error: 'Failed to update profile' }, 500);
	}
}

/**
 * @desc Update notification preferences
 * @param c Hono context
 * @returns Json response with updated notification settings
 */

export async function updateNotifications(c: Context) {
	const user = c.get('user');
	const body = await c.req.json();
	const {
		emailNewMarket,
		emailTradeExecuted,
		emailPriceAlerts,
		emailMarketResolved,
		inAppNewMarket,
		inAppTradeExecuted,
		inAppPriceAlerts,
		inAppMarketResolved,
	} = body;

	try {
		const updatedPrefs = await prisma.notificationSettings.upsert({
			where: { userId: user.id },
			update: {
				emailNewMarket,
				emailTradeExecuted,
				emailPriceAlerts,
				emailMarketResolved,
				inAppNewMarket,
				inAppTradeExecuted,
				inAppPriceAlerts,
				inAppMarketResolved,
			},
			create: {
				userId: user.id,
				emailNewMarket,
				emailTradeExecuted,
				emailPriceAlerts,
				emailMarketResolved,
				inAppNewMarket,
				inAppTradeExecuted,
				inAppPriceAlerts,
				inAppMarketResolved,
			},
		});

		return c.json({ notificationSettings: updatedPrefs, message: 'Notification settings updated' });
	} catch (error) {
		console.error('Error in updateNotifications:', error);
		return c.json({ error: 'Failed to update notification preferences' }, 500);
	}
}

/**
 * @desc Soft delete user account
 * @param c Hono context
 * @returns Json response confirming deletion
 */

export async function deleteAccount(c: Context) {
	const user = c.get('user');

	try {
		await prisma.user.update({
			where: { id: user.id },
			data: { deletedAt: new Date() },
		});

		// Return success, the frontend handles session cleanup
		return c.json({ message: 'Account deleted successfully' });
	} catch (error) {
		console.error('Error in deleteAccount:', error);
		return c.json({ error: 'Failed to delete account' }, 500);
	}
}
