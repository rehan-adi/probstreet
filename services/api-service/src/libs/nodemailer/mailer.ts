import { ENV } from '@/config/env';
import { logger } from '@/libs/logger';
import { mailerClient } from '@/libs/nodemailer/client';
import { otpEmailHtml } from '@/libs/nodemailer/templates/otp';

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
	if (ENV.NODE_ENV === 'development') {
		logger.info({ email, otp }, '[DEV] OTP');
		return;
	}

	await mailerClient.sendMail({
		from: `"Probstreet" <${ENV.GMAIL_USER}>`,
		to: email,
		subject: 'Your Probstreet Login Code',
		text: `Your login OTP is: ${otp}. It expires in 5 minutes. Do not share this with anyone.`,
		html: otpEmailHtml(otp),
	});

	logger.info({ email }, 'OTP email sent successfully');
}
