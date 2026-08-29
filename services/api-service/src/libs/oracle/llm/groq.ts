import { logger } from '@/libs/logger';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function callGroqLLM(prompt: string): Promise<string> {
	const apiKey = process.env.GROQ_API_KEY;

	if (!apiKey) {
		throw new Error('GROQ_API_KEY environment variable is not set');
	}

	const response = await fetch(GROQ_API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: 'openai/gpt-oss-120b',
			messages: [{ role: 'user', content: prompt }],
			temperature: 0.1,
			response_format: { type: 'json_object' },
		}),
		signal: AbortSignal.timeout(30_000),
	});

	if (!response.ok) {
		const errorText = await response.text();
		logger.error({ status: response.status, body: errorText }, 'Groq API request failed');
		throw new Error(`Groq API error: ${response.status}`);
	}

	const json = (await response.json()) as any;
	const text = json?.choices?.[0]?.message?.content;

	if (!text) {
		throw new Error('No text content in Groq response');
	}

	return text;
}
