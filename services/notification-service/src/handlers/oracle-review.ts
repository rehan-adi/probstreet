import { ENV_CONFIG } from '@/config/env';
import { notifyWebSockets } from '@/libs/ws';
import { logger } from '@/libs/logger/logger';
import { sendBrevoEmail } from '@/libs/brevo/client';
import { sendFirebasePush } from '@/libs/firebase/push';

export async function handleOracleReview(env: ENV_CONFIG, prisma: any, data: any): Promise<void> {
	const { marketId, marketTitle, score, verdict } = data;

	if (!marketId || !marketTitle) throw new Error('Missing marketId or title for oracle.review');

	const admins = await prisma.user.findMany({
		where: { role: 'ADMIN' },
		select: { id: true, email: true, fcmToken: true },
	});

	if (admins.length === 0) {
		logger.warn('[oracle.review] No admins found to notify');
		return;
	}

	const subject = `[Action Required] AI Oracle Review: ${marketTitle}`;
	const html = `
		<h3>Oracle Resolution Review Required</h3>
		<p>The AI Oracle has flagged a market for admin review due to low confidence.</p>
		<ul>
			<li><strong>Market:</strong> ${marketTitle}</li>
			<li><strong>Proposed Verdict:</strong> ${verdict || 'INCONCLUSIVE'}</li>
			<li><strong>Confidence Score:</strong> ${score || 0} / 100</li>
		</ul>
		<p><a href="${env.FRONTEND_URL}/dashboard/oracle/review">Click here to review and confirm the resolution</a>.</p>
	`;

	const emailAdmins = admins.filter((a: any) => a.email);
	if (emailAdmins.length > 0) {
		await Promise.allSettled(
			emailAdmins.map((a: any) => sendBrevoEmail(env, a.email, subject, html)),
		);
	}

	const notificationData = {
		type: 'SYSTEM',
		title: 'Oracle Review Required',
		message: `Market "${marketTitle}" requires manual resolution confirmation (Score: ${score}).`,
		link: `/dashboard/oracle/review`,
		metadata: { marketId },
	};

	// Save in-app notifications
	await prisma.notification.createMany({
		data: admins.map((a: any) => ({
			userId: a.id,
			...notificationData,
		})),
	});

	// Send push notifications
	const pushAdmins = admins.filter((a: any) => a.fcmToken);
	if (pushAdmins.length > 0) {
		await Promise.allSettled(
			pushAdmins.map((a: any) =>
				sendFirebasePush(env, a.fcmToken, notificationData.title, notificationData.message, {
					marketId,
					type: 'SYSTEM',
				}),
			),
		);
	}

	// Notify via WebSockets
	await Promise.allSettled(
		admins.map((a: any) =>
			notifyWebSockets(env, a.id, {
				...notificationData,
				userId: a.id,
				createdAt: new Date(),
				isRead: false,
			}),
		),
	);

	logger.info(`[oracle.review] Notified ${admins.length} admins about market ${marketId}`);
}
