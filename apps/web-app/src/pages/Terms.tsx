import { useEffect } from 'react';

export default function TermsPage() {
	useEffect(() => {
		window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
	}, []);

	const sections = [
		{
			title: '1. Acceptance of Terms',
			content: (
				<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
					By accessing or using Probstreet ("the Platform"), you confirm that you have read,
					understood, and agree to be bound by these Terms of Service ("Terms"). If you do not
					agree, do not use the Platform. These Terms constitute a legally binding agreement between
					you and Probstreet.
				</p>
			),
		},
		{
			title: '2. Eligibility',
			content: (
				<ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300 list-disc pl-5">
					{[
						'You must be at least 18 years of age.',
						'You must be a resident of India with a valid PAN card for KYC purposes.',
						'You must not be located in a state where prediction markets are prohibited.',
						'You may not use the Platform if you have been previously suspended or removed by us.',
					].map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			),
		},
		{
			title: '3. Account Registration & KYC',
			content: (
				<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
					You must complete the KYC (Know Your Customer) process before making deposits or
					withdrawals. You agree to provide accurate, current, and complete information during
					registration and KYC, and to update it if it changes. You are responsible for maintaining
					the confidentiality of your credentials and for all activity that occurs under your
					account.
				</p>
			),
		},
		{
			title: '4. Financial Terms',
			content: (
				<ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
					{[
						[
							'Deposits',
							'Funds are credited to your Probstreet wallet after successful payment confirmation via Cashfree Payments.',
						],
						[
							'Withdrawals',
							'Processed to your verified bank account within 3–5 business days, subject to KYC completion. A processing fee of up to 0.25% may apply.',
						],
						['Minimum', 'Minimum deposit: ₹50. Minimum withdrawal: ₹100.'],
						[
							'Referral rewards',
							"Credited upon your referred user's first qualifying deposit of ₹50 or more. Rewards are non-withdrawable for 30 days after crediting.",
						],
						[
							'Taxes',
							'You are solely responsible for reporting and paying any taxes applicable to your winnings or income under Indian law (including TDS where applicable).',
						],
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
			title: '5. Prediction Markets & Orders',
			content: (
				<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
					All markets on Probstreet are opinion-based prediction events. Outcomes are determined by
					publicly verifiable real-world events. We reserve the right to void, suspend, or settle
					any market at our sole discretion in cases of market manipulation, data errors, or changes
					to the underlying event. Market settlement decisions by Probstreet are final.
				</p>
			),
		},
		{
			title: '6. Prohibited Conduct',
			content: (
				<>
					<p className="text-sm text-gray-600 dark:text-gray-300 mb-3">You agree not to:</p>
					<ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300 list-disc pl-5 mb-3">
						{[
							'Use automated bots, scripts, or tools to manipulate markets or prices.',
							"Create multiple accounts or use another person's identity.",
							'Engage in wash trading, collusion, or any form of market manipulation.',
							'Use the Platform for money laundering or any illegal activity.',
							'Attempt to reverse-engineer, scrape, or disrupt the Platform.',
							'Share your account credentials with any third party.',
						].map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
					<p className="text-sm text-gray-600 dark:text-gray-300">
						Violation may result in immediate account suspension, forfeiture of funds, and referral
						to law enforcement.
					</p>
				</>
			),
		},
		{
			title: '7. Intellectual Property',
			content: (
				<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
					All content, trademarks, and software on the Platform are the exclusive property of
					Probstreet or its licensors. You may not copy, reproduce, or distribute any part of the
					Platform without prior written consent.
				</p>
			),
		},
		{
			title: '8. Disclaimers',
			content: (
				<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
					The Platform is provided "as is" and "as available" without warranties of any kind,
					express or implied. We do not guarantee uninterrupted service or that predictions will be
					profitable. Prediction markets involve financial risk; only participate with funds you can
					afford to lose.
				</p>
			),
		},
		{
			title: '9. Limitation of Liability',
			content: (
				<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
					To the maximum extent permitted by law, Probstreet shall not be liable for any indirect,
					incidental, special, consequential, or punitive damages. Our total aggregate liability
					shall not exceed the funds held in your Probstreet wallet at the time the claim arises.
				</p>
			),
		},
		{
			title: '10. Termination',
			content: (
				<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
					We may terminate or suspend your account at any time, with or without cause. Upon
					termination, any available balance (after deducting pending withdrawals and applicable
					fees) will be returned to your registered bank account within 14 business days.
				</p>
			),
		},
		{
			title: '11. Governing Law & Disputes',
			content: (
				<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
					These Terms are governed by the laws of India. Disputes shall first be subject to
					good-faith negotiation. If unresolved, they shall be referred to binding arbitration under
					the Arbitration and Conciliation Act, 1996, with the seat in India. Class actions are not
					permitted.
				</p>
			),
		},
		{
			title: '12. Changes to Terms',
			content: (
				<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
					We may update these Terms at any time. Material changes will be communicated via email or
					an in-app notification at least 14 days before taking effect. Continued use after the
					effective date constitutes acceptance of the revised Terms.
				</p>
			),
		},
		{
			title: '13. Contact',
			content: (
				<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
					Probstreet · India
					<br />
					Email:{' '}
					<a
						href="mailto:legal@probstreet.com"
						className="text-gray-900 dark:text-white underline underline-offset-2"
					>
						legal@probstreet.com
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
						Terms of Service
					</h1>
					<p className="text-sm md:text-base text-gray-600 dark:text-gray-300">
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
