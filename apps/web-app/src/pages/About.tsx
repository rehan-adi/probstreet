import { IndianRupee, ShieldCheck, Trophy } from 'lucide-react';
import { useEffect } from 'react';

export default function AboutPage() {
	useEffect(() => {
		window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
	}, []);

	const features = [
		['Real Order Book', 'All trades on a central limit order book — no house edge, no spread manipulation.'],
		['Instant Matching', 'Our high-performance matching engine settles orders in milliseconds.'],
		['Secure Payments', 'Deposits and withdrawals powered by Cashfree with full KYC compliance.'],
		['Transparent Settlement', 'Market outcomes resolved using publicly verifiable sources.'],
		['Referral Rewards', 'Earn real money when friends you refer make their first qualifying deposit.'],
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
						About Probstreet
					</h1>
					<p className="md:text-base text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
						India's prediction market platform where knowledge meets opportunity.
					</p>
				</div>

				<div className="flex flex-col gap-3">
					<div className="bg-white dark:bg-[#0F1225] border border-gray-200 dark:border-white/6 rounded-xl p-5 md:p-6">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 tracking-tight">
							Our Mission
						</h2>
						<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
							We believe collective intelligence — the wisdom of crowds — consistently produces more
							accurate forecasts than any individual expert. Probstreet harnesses that intelligence
							by creating a fair, transparent, and liquid market for predictions. Our goal is to
							become India's most trusted information market: a place where your insight has real
							value.
						</p>
					</div>

					<div className="bg-white dark:bg-[#0F1225] border border-gray-200 dark:border-white/6 rounded-xl p-5 md:p-6">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 tracking-tight">
							How It Works
						</h2>
						<div className="grid gap-4 sm:grid-cols-3">
							{[
								[<ShieldCheck size={24} />, 'Pick an Event', 'Browse live markets across sports, politics, finance, and more. Each is a Yes/No question on a real outcome.'],
								[<IndianRupee size={20} />, 'Place Your Order', 'Buy YES or NO shares between ₹0.5 and ₹9.5. Your price is your probability estimate.'],
								[<Trophy size={20} />, 'Collect Returns', 'Winning shares pay ₹10 each at settlement. Withdraw profits directly to your bank account.'],
							].map(([icon, title, desc]) => (
								<div
									key={title as string}
									className="bg-gray-50 dark:bg-white/3 border border-gray-100 dark:border-white/4 rounded-lg p-4"
								>
									<div className="text-xl mb-2.5">{icon}</div>
									<p className="text-sm font-medium text-gray-900 dark:text-white mb-1.5">{title}</p>
									<p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{desc}</p>
								</div>
							))}
						</div>
					</div>

					{/* Why Probstreet */}
					<div className="bg-white dark:bg-[#0F1225] border border-gray-200 dark:border-white/6 rounded-xl p-5 md:p-6">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 tracking-tight">
							Why Probstreet?
						</h2>
						<ul className="space-y-3">
							{features.map(([title, desc]) => (
								<li key={title} className="flex items-start gap-3">
									<span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-[10px] text-gray-600 dark:text-gray-300 font-bold">
										✓
									</span>
									<span className="text-sm text-gray-600 dark:text-gray-300">
										<span className="font-medium text-gray-900 dark:text-white">{title}: </span>
										{desc}
									</span>
								</li>
							))}
						</ul>
					</div>

					<div className="bg-white dark:bg-[#0F1225] border border-gray-200 dark:border-white/6 rounded-xl p-5 md:p-6">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 tracking-tight">
							Legal & Compliance
						</h2>
						<p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
							Probstreet operates in compliance with Indian law. All users are required to complete
							KYC verification before depositing or withdrawing funds. We follow strict AML
							guidelines and retain financial records as mandated by applicable regulations. The
							Platform is restricted to users aged 18 and above.
						</p>
					</div>

					<div className="bg-white dark:bg-[#0F1225] border border-gray-200 dark:border-white/6 rounded-xl p-5 md:p-6">
						<h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 tracking-tight">
							Get in Touch
						</h2>
						<p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
							Have a question, partnership inquiry, or feedback? We'd love to hear from you.
						</p>
						<div className="flex flex-col gap-1.5 text-sm">
							{[
								['Legal', 'legal@probstreet.com'],
								['General', 'hello@probstreet.com'],
								['Support', 'support@probstreet.com'],
							].map(([label, email]) => (
								<p key={label} className="text-gray-500 dark:text-gray-400">
									<span className="text-gray-700 dark:text-gray-300 font-medium">{label}: </span>
									<a
										href={`mailto:${email}`}
										className="text-gray-900 dark:text-white underline underline-offset-2"
									>
										{email}
									</a>
								</p>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
