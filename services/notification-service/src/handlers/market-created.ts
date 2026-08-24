import { dbQuery } from '@/db/proxy';
import { ENV_CONFIG } from '@/config/env';
import { mailerClient } from '@/libs/nodemailer/client';
import { sendFirebasePush } from '@/libs/firebase/push';
import { newMarketEmailHtml } from '@/libs/nodemailer/templates/market-created';

export async function handleMarketCreated(env: ENV_CONFIG, data: any): Promise<void> {
	const { marketId, title } = data;

	if (!marketId || !title) throw new Error('Missing marketId or title');

	const { users } = await dbQuery(env, 'notification/market-subscribers', { marketId });

	const mailer = mailerClient(env);
	const emailUsers = users.filter((u: any) => u.emailNewMarket && u.email);
	const inAppUsers = users.filter((u: any) => u.inAppNewMarket);

	if (emailUsers.length > 0) {
		await Promise.allSettled(
			emailUsers.map((u: any) =>
				mailer.sendMail({
					from: `"Probstreet" <${env.GMAIL_USER}>`,
					to: u.email,
					subject: `New Market: ${title}`,
					html: newMarketEmailHtml(title, marketId),
				}),
			),
		);
		console.log(`[market.created] Sent emails to ${emailUsers.length} users`);
	}

	if (inAppUsers.length > 0) {
		await dbQuery(env, 'notification/save-bulk', {
			userIds: inAppUsers.map((u: any) => u.userId),
			type: 'NEW_MARKET',
			title: 'New Market Available',
			message: `A new market is live: "${title}"`,
			link: `/market/${marketId}`,
			metadata: { marketId },
		});

		const pushUsers = inAppUsers.filter((u: any) => u.fcmToken);
		await Promise.allSettled(
			pushUsers.map((u: any) =>
				sendFirebasePush(env, u.fcmToken, 'New Market Available', `"${title}" is now live!`, {
					marketId,
					type: 'NEW_MARKET',
				}),
			),
		);
		console.log(`[market.created] In-app notifications saved for ${inAppUsers.length} users`);
	}
}
