import { Hono } from 'hono';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { routes } from '@/routes/routes';
import { logger } from '@/libs/logger/logger';

const app = new Hono();

app.route('/api/v1', routes);

import { getRequestListener } from '@hono/node-server';

export const httpServer = createServer(getRequestListener(app.fetch));

export const io = new Server(httpServer, {
	cors: {
		origin: true,
		credentials: true,
		methods: ['GET', 'POST'],
	},
	transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
	logger.info(`Client connected: ${socket.id}`);

	socket.on('SUBSCRIBE_TICKERS', (symbols: string | string[]) => {
		const list = Array.isArray(symbols) ? symbols : [symbols];
		list.forEach((sym) => socket.join(`ticker:${sym}`));
		logger.info(`Client ${socket.id} subscribed tickers: ${list}`);
	});

	socket.on('UNSUBSCRIBE_TICKERS', (symbols: string | string[]) => {
		const list = Array.isArray(symbols) ? symbols : [symbols];
		list.forEach((sym) => socket.leave(`ticker:${sym}`));
		logger.info(`Client ${socket.id} unsubscribed tickers: ${list}`);
	});

	socket.on('SUBSCRIBE_MARKET', (symbol: string) => {
		socket.join(`market:${symbol}`);
		logger.info(`Client ${socket.id} subscribed full market: ${symbol}`);
	});

	socket.on('UNSUBSCRIBE_MARKET', (symbol: string) => {
		socket.leave(`market:${symbol}`);
		logger.info(`Client ${socket.id} unsubscribed full market: ${symbol}`);
	});

	socket.on('SUBSCRIBE_USER', (userId: string) => {
		socket.join(`user:${userId}`);
		socket.join(userId);
		logger.info(`Client ${socket.id} subscribed user: ${userId}`);
	});

	socket.on('UNSUBSCRIBE_USER', (userId: string) => {
		socket.leave(`user:${userId}`);
		socket.leave(userId);
		logger.info(`Client ${socket.id} unsubscribed user: ${userId}`);
	});

	socket.on('SUBSCRIBE', (room: string) => {
		socket.join(room);
		socket.join(`ticker:${room}`);
		socket.join(`market:${room}`);
		socket.join(`user:${room}`);
	});

	socket.on('UNSUBSCRIBE', (room: string) => {
		socket.leave(room);
		socket.leave(`ticker:${room}`);
		socket.leave(`market:${room}`);
		socket.leave(`user:${room}`);
	});

	socket.on('disconnect', () => {
		logger.info(`Client disconnected: ${socket.id}`);
	});
});
