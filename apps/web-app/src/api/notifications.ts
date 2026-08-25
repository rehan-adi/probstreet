import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
	baseURL: `${API_URL}/api/v1/capi/notifications`,
	withCredentials: true,
});

export const getNotifications = async (limit = 20) => {
	const response = await api.get(`/?limit=${limit}`);
	return response.data;
};

export const markNotificationsAsRead = async (notificationIds?: string[]) => {
	const response = await api.patch('/read', { notificationIds });
	return response.data;
};
