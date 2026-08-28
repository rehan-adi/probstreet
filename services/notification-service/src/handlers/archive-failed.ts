import { ENV_CONFIG } from '@/config/env';
import { logger } from '@/libs/logger/logger';
import { sendBrevoEmail } from '@/libs/brevo/client';
import { getArchiveFailedTemplate } from '@/libs/brevo/templates/archive-failed';

export const handleArchiveFailed = async (env: ENV_CONFIG, data: any) => {
	try {
		const { symbol, error } = data;
		const html = getArchiveFailedTemplate(symbol, error || 'Unknown error');

		await sendBrevoEmail(
			env,
			'officia.rehan.me@gmail.com',
			`ALERT: Engine Archival Failed for ${symbol}`,
			html,
		);

		logger.info({ symbol }, '[handler] Archive failed email sent to admin');
	} catch (err: any) {
		logger.error({ err: err.message }, '[handler] Failed to send archive-failed email');
	}
};
