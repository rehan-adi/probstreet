import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
	baseURL: `${API_URL}/api/v1/capi/price-alerts`,
	withCredentials: true,
});

export const getPriceAlerts = async () => {
	const response = await api.get('/');
	return response.data;
};

export const createOrUpdatePriceAlert = async (data: {
	marketId: string;
	stockType: 'YES' | 'NO';
	targetPrice: number;
}) => {
	const response = await api.post('/', data);
	return response.data;
};

export const deletePriceAlert = async (id: string) => {
	const response = await api.delete(`/${id}`);
	return response.data;
};
