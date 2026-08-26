import { ENV_CONFIG } from '@/config/env';

export async function dbQuery(
	env: ENV_CONFIG,
	endpoint: string,
	body: Record<string, any>,
): Promise<any> {
	const res = await fetch(`${env.API_INTERNAL_URL}/api/v1/iapi/${endpoint}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-worker-secret': env.WORKER_SECRET,
		},
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`DB proxy error [${endpoint}]: ${text}`);
	}

	return res.json();
}
