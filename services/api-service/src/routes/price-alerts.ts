import { Hono } from 'hono';
import { authorization } from '@/middlewares/authorization';
import { createAlert, listAlerts, deleteAlert } from '@/controllers/price-alerts';

const app = new Hono();

app.use('*', authorization);

app.get('/', listAlerts);
app.post('/', createAlert);
app.delete('/:id', deleteAlert);

export default app;
