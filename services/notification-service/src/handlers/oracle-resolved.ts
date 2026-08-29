import { ENV_CONFIG } from '@/config/env';
import { notifyWebSockets } from '@/libs/ws';
import { logger } from '@/libs/logger/logger';
import { sendBrevoEmail } from '@/libs/brevo/client';
import { sendFirebasePush } from '@/libs/firebase/push';

export async function handleOracleResolved(env: ENV_CONFIG, prisma: any, data: any): Promise<void> {
	const { marketId, marketTitle, symbol, verdict, score, source, reasoning } = data;

	if (!marketId || !marketTitle) {
		throw new Error('Missing marketId or title for oracle.resolved');
	}

	const admins = await prisma.user.findMany({
		where: { role: 'ADMIN' },
		select: { id: true, email: true, fcmToken: true },
	});

	if (admins.length === 0) {
		logger.warn('[oracle.resolved] No admins found to notify');
		return;
	}

	const sourceLabel =
		source === 'deterministic'
			? 'Deterministic Engine (Instant API Math)'
			: 'AI Evaluator (Groq 120B)';

	const subject = `[Auto-Resolved] Oracle Resolution: ${marketTitle} -> ${verdict}`;
	const html = `
		<h3>Market Successfully Auto-Resolved</h3>
		<p>The automated Oracle pipeline has resolved the following market:</p>
		<ul>
			<li><strong>Market:</strong> ${marketTitle}</li>
			<li><strong>Verdict:</strong> <span style="color: ${verdict === 'YES' ? 'green' : 'red'}; font-weight: bold;">${verdict}</span></li>
			<li><strong>Method:</strong> ${sourceLabel}</li>
			${score !== undefined ? `<li><strong>Confidence Score:</strong> ${score} / 100</li>` : ''}
			${reasoning ? `<li><strong>Reasoning:</strong> ${reasoning}</li>` : ''}
		</ul>
		<p><a href="${env.FRONTEND_URL}/market/${symbol || marketId}">View Resolved Market</a> | <a href="${env.FRONTEND_URL}/dashboard/markets">Admin Dashboard</a></p>
	`;

	const emailAdmins = admins.filter((a: any) => a.email);
	if (emailAdmins.length > 0) {
		await Promise.allSettled(
			emailAdmins.map((a: any) => sendBrevoEmail(env, a.email, subject, html)),
		);
	}

	const notificationData = {
		type: 'SYSTEM',
		title: `Oracle Auto-Resolved: ${verdict}`,
		message: `"${marketTitle}" was automatically resolved to ${verdict} via ${source === 'deterministic' ? 'API Resolver' : 'AI Oracle'}.`,
		link: `/market/${symbol || marketId}`,
		metadata: { marketId, verdict, source, score },
	};

	await prisma.notification.createMany({
		data: admins.map((a: any) => ({
			userId: a.id,
			...notificationData,
		})),
	});

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

	logger.info(
		`[oracle.resolved] Notified ${admins.length} admins about auto-resolved market ${marketId}`,
	);
}
