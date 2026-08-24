import { dbQuery } from '@/db/proxy';
import { ENV_CONFIG } from '@/config/env';
import { mailerClient } from '@/libs/nodemailer/client';
import { priceAlertEmailHtml } from '@/libs/nodemailer/templates/price-alert';
import { sendFirebasePush } from '@/libs/firebase/push';

export async function handlePriceAlert(env: ENV_CONFIG, data: any): Promise<void> {
	const { userId, marketId, marketTitle, currentPrice, stockType, fcmToken, email } = data;

	await dbQuery(env, 'notification/save', {
		userId,
		type: 'PRICE_ALERT',
		title: 'Price Alert',
		message: `${marketTitle}: ${stockType} price is now ₹${currentPrice}`,
		link: `/market/${marketId}`,
		metadata: { marketId, currentPrice, stockType },
	});

	if (fcmToken) {
		await sendFirebasePush(
			env,
			fcmToken,
			'Price Alert',
			`${marketTitle}: ${stockType} → ₹${currentPrice}`,
			{ marketId, type: 'PRICE_ALERT' },
		);
	}

	if (email) {
		const mailer = mailerClient(env);
		await mailer.sendMail({
			from: `"Probstreet" <${env.GMAIL_USER}>`,
			to: email,
			subject: `Price Alert: ${marketTitle}`,
			html: priceAlertEmailHtml(marketTitle, stockType, currentPrice),
		});
	}

	console.log(`[price.alert] Notification sent to user ${userId}`);
}
