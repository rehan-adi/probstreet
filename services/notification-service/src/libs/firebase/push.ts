import { ENV_CONFIG } from '@/config/env';

export async function sendFirebasePush(
	env: ENV_CONFIG,
	fcmToken: string,
	title: string,
	body: string,
	data?: Record<string, string>,
): Promise<void> {
	if (!env.FIREBASE_SERVER_KEY || !fcmToken) return;

	await fetch('https://fcm.googleapis.com/fcm/send', {
		method: 'POST',
		headers: {
			Authorization: `key=${env.FIREBASE_SERVER_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			to: fcmToken,
			notification: { title, body },
			data: data ?? {},
		}),
	});
}
