import { dbQuery } from '@/db/proxy';
import { ENV_CONFIG } from '@/config/env';
import { mailerClient } from '@/libs/nodemailer/client';
import { sendFirebasePush } from '@/libs/firebase/push';
import { tradeExecutedEmailHtml } from '@/libs/nodemailer/templates/trade-executed';

export async function handleTradeExecuted(env: ENV_CONFIG, data: any): Promise<void> {
	const { makerId, takerId, marketId, marketTitle, stockType, price, quantity } = data;

	const totalValue = price * quantity;
	const mailer = mailerClient(env);

	const { users } = await dbQuery(env, 'notification/users-by-ids', {
		userIds: [makerId, takerId],
	});

	for (const user of users) {
		if (user.emailTradeExecuted && user.email) {
			await dbQuery(env, 'notification/send-email', {
				to: user.email,
				subject: `Trade Executed on "${marketTitle}"`,
				html: tradeExecutedEmailHtml(marketTitle, stockType, price, quantity, totalValue),
			});
		}

		if (user.inAppTradeExecuted) {
			await dbQuery(env, 'notification/save', {
				userId: user.userId,
				type: 'TRADE_EXECUTED',
				title: 'Trade Executed',
				message: `${quantity} ${stockType} shares at ₹${price} on "${marketTitle}"`,
				link: `/market/${marketId}`,
				metadata: { marketId, stockType, price, quantity },
			});

			if (user.fcmToken) {
				await sendFirebasePush(
					env,
					user.fcmToken,
					'Trade Executed',
					`${quantity} ${stockType} @ ₹${price}`,
					{ marketId, type: 'TRADE_EXECUTED' },
				);
			}
		}
	}

	console.log(`[trade.executed] Notifications sent for trade on market ${marketId}`);
}
