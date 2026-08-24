import { ENV } from '@/config/env';
import nodemailer from 'nodemailer';

export const mailerClient = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: ENV.GMAIL_USER,
		pass: ENV.GMAIL_APP_PASSWORD,
	},
});
