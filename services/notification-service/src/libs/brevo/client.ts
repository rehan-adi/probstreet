import { ENV_CONFIG } from '@/config/env';

export async function sendBrevoEmail(env: ENV_CONFIG, to: string, subject: string, html: string) {
	const response = await fetch('https://api.brevo.com/v3/smtp/email', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'api-key': env.BREVO_API_KEY,
		},
		body: JSON.stringify({
			sender: { name: 'Probstreet', email: 'rehanalire52@gmail.com' },
			to: [{ email: to }],
			subject,
			htmlContent: html,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Brevo API error: ${response.status} ${errorText}`);
	}

	return response.json();
}
