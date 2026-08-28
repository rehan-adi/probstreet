import { useEffect } from 'react';

export default function PrivacyPage() {
	useEffect(() => {
		window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
	}, []);

	const sections = [
		{
			title: '1. Introduction',
			content: (
				<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
					Probstreet operates the prediction-markets platform accessible at{' '}
					<span className="font-semibold text-gray-800 dark:text-gray-100 hover:underline cursor-pointer">
						probstreet.com
					</span>{' '}
					(the "Platform"). This Privacy Policy describes how we collect, use, disclose, and
					safeguard your personal data. By creating an account or using the Platform you consent to
					the practices described in this Policy.
				</p>
			),
		},
		{
			title: '2. Information We Collect',
			content: (
				<ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
					{[
						[
							'Account data',
							'Name, email, phone number, username, and profile photo provided at registration or via OAuth (Google, Discord, Telegram).',
						],
						[
							'Identity & KYC',
							'Government-issued ID, PAN card details collected during the KYC process as required by Indian regulations.',
						],
						[
							'Financial data',
							'Deposit/withdrawal amounts, payment order IDs, and bank details needed to process payouts. We do not store full card numbers — payments are handled by Cashfree Payments.',
						],
						[
							'AI Usage data',
							'Pages visited, events viewed, orders placed, IP address, browser type, device identifiers, and timestamps.',
						],
						['Comunication', 'Messages sent to our support team, feedback, and survey responses.'],
					].map(([label, desc]) => (
						<li key={label} className="flex gap-2">
							<span className="shrink-0 text-gray-900 dark:text-white font-medium">{label}:</span>
							<span>{desc}</span>
						</li>
					))}
				</ul>
			),
		},
		{
			title: '3. How We Use Your Information',
			content: (
				<ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300 list-disc pl-5">
					{[
						'Create and manage your account and authenticate your identity.',
						'Process deposits, withdrawals, and referral rewards.',
						'Comply with applicable laws including KYC/AML requirements under Indian law.',
						'Send transactional notifications (order fills, payment confirmations).',
						'Detect and prevent fraud, abuse, and security incidents.',
						'Improve the Platform through analytics and A/B testing using aggregated, anonymised data.',
						'Respond to legal requests from competent authorities.',
					].map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			),
		},
		{
			title: '4. Sharing of Information',
			content: (
				<>
					<p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
						We do <span className="font-semibold text-gray-700 dark:text-gray-300">not</span> sell
						your personal data. We may share it with:
					</p>
					<ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300 list-disc pl-5">
						{[
							[
								'Payment processors',
								'Cashfree Payments India Pvt. Ltd. for processing transactions.',
							],
							[
								'Cloud providers',
								'Amazon Web Services and cloudflare as infrastructure partners necessary to operate the Platform.',
							],
							[
								'Communication providers',
								'Nodemailer for email and in-app notifications using sockets.',
							],
							[
								'Legal authorities',
								'When required by court order, regulatory mandate, or applicable law.',
							],
							[
								'Business transfers',
								'In the event of a merger, acquisition, or sale of assets, your data may transfer to the successor entity.',
							],
						].map(([label, desc]) => (
							<li key={label}>
								<span className="font-medium text-gray-700 dark:text-gray-300">{label}:</span>{' '}
								{desc}
							</li>
						))}
					</ul>
				</>
			),
		},
		{
			title: '5. Data Retention',
			content: (
				<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
					We retain your data for as long as your account is active or as needed to provide
					services. KYC records and financial transaction logs are retained for a minimum of 5 years
					as required by Indian AML regulations. You may request deletion of non-regulatory data —
					see Section 7.
				</p>
			),
		},
		{
			title: '6. Security',
			content: (
				<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
					We implement industry-standard measures including HTTPS encryption in transit, hashed
					credential storage, webhook signature verification, and Redis-based idempotency locks. No
					system is 100% secure; we will notify affected users in accordance with applicable law if
					a breach occurs.
				</p>
			),
		},
		{
			title: '7. Your Rights',
			content: (
				<>
					<ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300 list-disc pl-5 mb-3">
						{[
							'Access the personal data we hold about you.',
							'Correct inaccurate or incomplete data.',
							'Request deletion of your data (subject to legal retention obligations).',
							'Withdraw consent at any time where processing is based on consent.',
							'Lodge a complaint with the relevant data protection authority.',
						].map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
					<p className="text-sm text-gray-600 dark:text-gray-300">
						To exercise these rights, email{' '}
						<a
							href="mailto:privacy@probstreet.com"
							className="text-gray-900 dark:text-white underline underline-offset-2"
						>
							privacy@probstreet.com
						</a>
						.
					</p>
				</>
			),
		},
		{
			title: '8. Cookies & Tracking',
			content: (
				<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
					We use browser localStorage and sessionStorage to maintain your authenticated session. We
					do not use third-party advertising cookies. Analytics may use first-party cookies to count
					visits and measure feature engagement.
				</p>
			),
		},
		{
			title: '9. Children',
			content: (
				<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
					The Platform is intended only for users aged 18 and above. We do not knowingly collect
					data from minors. If you believe a minor has registered, contact us immediately.
				</p>
			),
		},
		{
			title: '10. Changes to This Policy',
			content: (
				<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
					We may update this Policy from time to time. Material changes will be communicated via
					email or an in-app banner at least 14 days before taking effect. Continued use after the
					effective date constitutes acceptance.
				</p>
			),
		},
		{
			title: '11. Contact',
			content: (
				<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
					Probstreet · India
					<br />
					Email:{' '}
					<a
						href="mailto:privacy@probstreet.com"
						className="text-gray-900 dark:text-white underline underline-offset-2"
					>
						privacy@probstreet.com
					</a>
				</p>
			),
		},
	];

	return (
		<div
			className="w-full min-h-screen bg-[#f4f4f5] dark:bg-[#090C1A] transition-colors"
			style={{ animation: 'pageEnter 0.4s ease-out both' }}
		>
			<style>{`
				@keyframes pageEnter {
					from { opacity: 0; transform: translateY(16px); }
					to   { opacity: 1; transform: translateY(0); }
				}
			`}</style>
			<div className="max-w-4xl mx-auto px-6 py-10 md:py-14">
				<div className="mb-8">
					<h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white tracking-tight mb-1">
						Privacy Policy
					</h1>
					<p className="md:text-base text-sm text-gray-600 dark:text-gray-300">
						Effective Date: 27 August 2026 · Last Updated: 27 August 2026
					</p>
				</div>

				<div className="flex flex-col gap-3">
					{sections.map(({ title, content }) => (
						<div
							key={title}
							className="bg-white dark:bg-[#0F1225] border border-gray-200 dark:border-white/6 rounded-xl p-5 md:p-6"
						>
							<h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 tracking-tight">
								{title}
							</h2>
							{content}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
