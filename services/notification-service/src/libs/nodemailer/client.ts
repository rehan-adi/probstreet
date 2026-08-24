import * as nodemailer from 'nodemailer';
import { ENV_CONFIG } from '@/config/env';

export const mailerClient = (env: ENV_CONFIG) =>
	nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user: env.GMAIL_USER,
			pass: env.GMAIL_APP_PASSWORD,
		},
	});
