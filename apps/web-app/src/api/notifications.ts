import { api } from '@/lib/axios';

export const getNotifications = async (limit = 20) => {
	const response = await api.get(`/notifications?limit=${limit}`);
	return response.data;
};

export const markNotificationsAsRead = async (notificationIds?: string[]) => {
	const response = await api.patch('/notifications/read', { notificationIds });
	return response.data;
};
