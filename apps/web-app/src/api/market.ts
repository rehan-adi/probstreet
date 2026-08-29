import { api } from '@/lib/axios';

export const createMarket = (form: {
	title: string;
	eos?: string;
	rules?: string;
	startTime?: string;
	endTime: string;
	sourceOfTruth?: string;
	resolutionMode?: 'MANUAL' | 'AUTOMATIC';
	oracleConfig?: Record<string, any>;
	categoryId: string;
	thumbnail: string | null;
}) => {
	return api.post('/market/create', form);
};

export const getMarketDetails = (symbol: string) => {
	return api.get(`/markets/${symbol}`);
};

export const splitShares = (symbol: string, quantity: number) => {
	return api.post(`/market/${symbol}/split`, { quantity });
};

export const mergeShares = (symbol: string, quantity: number) => {
	return api.post(`/market/${symbol}/merge`, { quantity });
};
