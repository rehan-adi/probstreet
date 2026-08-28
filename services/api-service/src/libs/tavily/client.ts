import { ENV } from '@/config/env';
import { tavily } from '@tavily/core';

export const tavilyClient = tavily({
	apiKey: ENV.TAVILY_API_KEY || '',
});
