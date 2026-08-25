import { Hono } from 'hono';
import { authorization } from '@/middlewares/authorization';
import { createAlert, listAlerts, deleteAlert } from '@/controllers/price-alerts';

export const priceAlertsRoutes = new Hono();

priceAlertsRoutes.use('*', authorization);

priceAlertsRoutes.get('/', listAlerts);
priceAlertsRoutes.post('/', createAlert);
priceAlertsRoutes.delete('/:id', deleteAlert);
