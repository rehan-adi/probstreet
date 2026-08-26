import { dbQuery } from '@/db/proxy';
import { ENV_CONFIG } from '@/config/env';
import { sendFirebasePush } from '@/libs/firebase/push';

export async function handleMarketResolved(env: ENV_CONFIG, data: any): Promise<void> {
	const { marketId, title, result, winners } = data;

	if (!marketId || !title || !winners || winners.length === 0) return;

	console.log(`[market.resolved] Processing ${winners.length} winners for market ${marketId}`);

	const userIds = winners.map((w: any) => w.userId);

	// Try to get users to find their push tokens.
	// Make sure the proxy has this query, if not we skip push.
	let pushUsers: any[] = [];
	try {
		const res = await dbQuery(env, 'notification/users-by-ids', { userIds });
		pushUsers = res.users?.filter((u: any) => u.fcmToken) || [];
	} catch (error) {
		console.warn(`[market.resolved] Failed to fetch users for push tokens:`, error);
	}

	// 1. Bulk save in-app notifications
	try {
		await dbQuery(env, 'notification/save-bulk', {
			userIds: userIds,
			type: 'MARKET_RESOLVED',
			title: 'Market Resolved',
			message: `"${title}" has been resolved to ${result}. You won your trades!`,
			link: `/portfolio`,
			metadata: { marketId, result },
		});
		console.log(`[market.resolved] In-app notifications saved for ${userIds.length} users`);
	} catch (error) {
		console.error(`[market.resolved] Failed to save in-app notifications:`, error);
	}

	// 2. Send Firebase pushes to those with tokens
	if (pushUsers.length > 0) {
		await Promise.allSettled(
			pushUsers.map((u: any) =>
				sendFirebasePush(
					env,
					u.fcmToken,
					'Market Resolved 🏆',
					`"${title}" resolved to ${result}. Check your winnings!`,
					{ marketId, type: 'MARKET_RESOLVED' },
				),
			),
		);
		console.log(`[market.resolved] Firebase pushes sent to ${pushUsers.length} users`);
	}
}
