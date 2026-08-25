import { api } from '@/lib/axios';

export const getPriceAlerts = async () => {
	const response = await api.get('/price-alerts');
	return response.data;
};

export const createOrUpdatePriceAlert = async (data: {
	marketId: string;
	stockType: 'YES' | 'NO';
	targetPrice: number;
}) => {
	const response = await api.post('/price-alerts', data);
	return response.data;
};

export const deletePriceAlert = async (id: string) => {
	const response = await api.delete(`/price-alerts/${id}`);
	return response.data;
};
