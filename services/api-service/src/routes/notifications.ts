import { Hono } from 'hono';
import { authorization } from '@/middlewares/authorization';
import { getNotifications, markAsRead, streamNotifications } from '@/controllers/notifications';

export const notificationsRoutes = new Hono();

notificationsRoutes.use('*', authorization);

notificationsRoutes.get('/', getNotifications);
notificationsRoutes.patch('/read', markAsRead);
notificationsRoutes.get('/stream', streamNotifications);
