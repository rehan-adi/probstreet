import api from '@/config/axios';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth';
import { useModalStore } from '@/store/modal';
import { useState, useEffect } from 'react';
import { Loader2, Mail, Clock } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

interface ProviderSelectProps {
	onSelectEmail: (email: string) => void;
	onNextUsername: (user: any) => void;
	onNextReferral: (user: any) => void;
}

export default function ProviderSelect({
	onSelectEmail,
	onNextUsername,
	onNextReferral,
}: ProviderSelectProps) {
	const { closeOnboardModal } = useModalStore();
	const { login } = useAuthStore();
	const [email, setEmail] = useState('');
	const [isSendingOtp, setIsSendingOtp] = useState(false);
	const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
	const [lastProvider, setLastProvider] = useState<string | null>(null);

	const isValidEmail = /^\S+@\S+\.\S+$/.test(email);

	useEffect(() => {
		const storedLastProvider = localStorage.getItem('last_provider');
		if (storedLastProvider) {
			setLastProvider(storedLastProvider);
		}

		if (window.opener && window.location.hash.includes('access_token')) {
			const params = new URLSearchParams(window.location.hash.substring(1));
			const accessToken = params.get('access_token');
			if (accessToken) {
				window.opener.postMessage({ type: 'DISCORD_AUTH', accessToken }, window.location.origin);
				window.close();
			}
		}

		const handleMessage = (e: MessageEvent) => {
			if (e.origin !== window.location.origin) return;
			if (e.data.type === 'DISCORD_AUTH' && e.data.accessToken) {
				setLoadingProvider('discord');
				api
					.post('/auth/discord/callback', { accessToken: e.data.accessToken })
					.then((res) => {
						if (res.data.success) {
							localStorage.setItem('last_provider', 'discord');
							const user = res.data.data;
							if (user.onboardingStatus === 'PENDING_USERNAME') onNextUsername(user);
							else if (user.onboardingStatus === 'PENDING_PREFERENCES') onNextReferral(user);
							else {
								login(user);
								closeOnboardModal();
							}
						}
					})
					.catch((err) => {
						console.error('Discord Auth Failed', err);
						alert('Discord login failed');
					})
					.finally(() => setLoadingProvider(null));
			}
		};

		window.addEventListener('message', handleMessage);

		(window as any).onTelegramAuth = (user: any) => {
			setLoadingProvider('telegram');
			api
				.post('/auth/telegram/callback', { widgetData: user })
				.then((res) => {
					if (res.data.success) {
						localStorage.setItem('last_provider', 'telegram');
						const userData = res.data.data;
						if (userData.onboardingStatus === 'PENDING_USERNAME') onNextUsername(userData);
						else if (userData.onboardingStatus === 'PENDING_PREFERENCES') onNextReferral(userData);
						else {
							login(userData);
							closeOnboardModal();
						}
					}
				})
				.catch((err) => {
					console.error('Telegram Auth Failed', err);
					alert('Telegram login failed');
				})
				.finally(() => setLoadingProvider(null));
		};

		return () => {
			window.removeEventListener('message', handleMessage);
			delete (window as any).onTelegramAuth;
		};
	}, [onNextUsername, onNextReferral, login, closeOnboardModal]);

	const googleLogin = useGoogleLogin({
		onSuccess: async (tokenResponse) => {
			setLoadingProvider('google');
			try {
				const res = await api.post('/auth/google/callback', {
					idToken: tokenResponse.access_token,
				});

				if (res.data.success) {
					localStorage.setItem('last_provider', 'google');

					const user = res.data.data;

					if (user.onboardingStatus === 'PENDING_USERNAME') {
						onNextUsername(user);
					} else if (user.onboardingStatus === 'PENDING_PREFERENCES') {
						onNextReferral(user);
					} else {
						login(user);
						closeOnboardModal();
					}
				}
			} catch (error) {
				console.error('Google Auth Failed', error);
			} finally {
				setLoadingProvider(null);
			}
		},
	});

	const handleProviderClick = (provider: string) => {
		localStorage.setItem('last_provider', provider);
		setLastProvider(provider);
		if (provider === 'email') {
			handleSendEmailOtp();
		} else if (provider === 'google') {
			googleLogin();
		} else if (provider === 'telegram') {
			const tg = (window as any).Telegram?.WebApp;
			if (tg && tg.initData) {
				setLoadingProvider('telegram');
				api
					.post('/auth/telegram/callback', { initData: tg.initData })
					.then((res) => {
						if (res.data.success) {
							const user = res.data.data;
							if (user.onboardingStatus === 'PENDING_USERNAME') onNextUsername(user);
							else if (user.onboardingStatus === 'PENDING_PREFERENCES') onNextReferral(user);
							else {
								login(user);
								closeOnboardModal();
							}
						}
					})
					.catch((err) => {
						console.error('Telegram Auth Failed', err);
						alert('Telegram login failed');
					})
					.finally(() => setLoadingProvider(null));
			} else {
			}
		} else if (provider === 'discord') {
			const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
			if (!clientId) {
				alert('Discord Client ID is missing in frontend .env (VITE_DISCORD_CLIENT_ID)');
				return;
			}
			const redirectUri = encodeURIComponent(window.location.origin + '/');
			const width = 500;
			const height = 750;
			const left = window.screen.width / 2 - width / 2;
			const top = window.screen.height / 2 - height / 2;
			window.open(
				`https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=token&redirect_uri=${redirectUri}&scope=identify+email`,
				'Discord OAuth',
				`width=${width},height=${height},left=${left},top=${top}`,
			);
		} else {
			alert(`${provider} OAuth coming soon!`);
		}
	};

	const handleSendEmailOtp = async () => {
		if (!isValidEmail) return;

		setIsSendingOtp(true);
		try {
			await api.post('/auth/init-signin', { email });
			onSelectEmail(email);
		} catch (error: any) {
			alert(error.response?.data?.error || 'Failed to send OTP');
		} finally {
			setIsSendingOtp(false);
		}
	};

	const renderLastUsedIndicator = () => (
		<span className="absolute -top-1 -right-1 flex h-3 w-3 z-10">
			<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
			<span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500 border-2 border-white dark:border-slate-900"></span>
		</span>
	);

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.98 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.98 }}
			transition={{ duration: 0.3 }}
			className="flex flex-col h-full max-w-83.25 mx-auto w-full py-4 md:py-2"
		>
			<div className="flex-1 flex flex-col justify-center">
				<div className="text-center md:mb-8 mb-10">
					<h2 className="text-lg font-medium text-black dark:text-white tracking-normal">
						Continue to your Trader Account
					</h2>
				</div>

				<div className="flex flex-col gap-3">
					<div className="flex flex-col relative">
						{lastProvider === 'email' && renderLastUsedIndicator()}
						<div className="relative">
							<Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="Email address"
								className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-[#28292E] border border-gray-200 dark:border-white/5 rounded-md focus:outline-none transition-all text-[13px] text-gray-900 dark:text-white placeholder:text-gray-500"
								onKeyDown={(e) => {
									if (e.key === 'Enter' && isValidEmail) handleProviderClick('email');
								}}
							/>
						</div>
						<button
							className="mt-2.5 flex items-center justify-center gap-2 px-4 py-3 rounded-md text-[13px] font-medium transition-all active:scale-[0.98] cursor-pointer bg-black text-white hover:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-gray-200 disabled:cursor-not-allowed disabled:hover:bg-black dark:disabled:hover:bg-white"
							disabled={!isValidEmail || isSendingOtp || loadingProvider !== null}
							onClick={() => handleProviderClick('email')}
						>
							{isSendingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue with Email'}
						</button>
					</div>

					<div className="flex items-center my-1 opacity-50">
						<div className="flex-1 h-px bg-gray-200 dark:bg-white/10"></div>
						<span className="px-3 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest">
							OR
						</span>
						<div className="flex-1 h-px bg-gray-200 dark:bg-white/10"></div>
					</div>

					<div className="grid grid-cols-1 gap-2">
						<button
							className="relative flex items-center justify-center gap-2.5 w-full px-4 py-3 border border-gray-200 dark:border-transparent rounded-md hover:bg-gray-50 dark:hover:bg-gray-200 transition-all text-[13px] font-medium text-gray-700 dark:text-gray-900 active:scale-[0.98] bg-white dark:bg-white cursor-pointer"
							disabled={loadingProvider !== null}
							onClick={() => handleProviderClick('google')}
						>
							{loadingProvider === 'google' ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<>
									{lastProvider === 'google' && renderLastUsedIndicator()}
									<svg
										viewBox="0 0 24 24"
										className="w-4.5 h-4.5"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
											fill="#4285F4"
										/>
										<path
											d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
											fill="#34A853"
										/>
										<path
											d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
											fill="#FBBC05"
										/>
										<path
											d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
											fill="#EA4335"
										/>
									</svg>
									Continue with Google
								</>
							)}
						</button>

						<button
							className="relative flex items-center justify-center gap-2.5 w-full px-4 py-3 border border-gray-200 dark:border-transparent rounded-md hover:bg-gray-50 dark:hover:bg-gray-200 transition-all text-[13px] font-medium text-gray-700 dark:text-gray-900 active:scale-[0.98] bg-white dark:bg-white cursor-pointer"
							disabled={loadingProvider !== null}
							onClick={() => handleProviderClick('discord')}
						>
							{loadingProvider === 'discord' ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<>
									{lastProvider === 'discord' && renderLastUsedIndicator()}
									<svg
										viewBox="0 0 24 24"
										className="w-4.5 h-4.5 fill-[#5865F2]"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
									</svg>
									Continue with Discord
								</>
							)}
						</button>

						<div className="relative group">
							<button
								className="relative flex items-center justify-center gap-2.5 w-full px-4 py-3 border border-gray-200 dark:border-transparent rounded-md hover:bg-gray-50 dark:hover:bg-gray-200 transition-all text-[13px] font-medium text-gray-700 dark:text-gray-900 active:scale-[0.98] bg-white dark:bg-white cursor-pointer disabled:cursor-not-allowed"
								disabled={loadingProvider !== null}
								onClick={() => {
									if ((window as any).Telegram?.WebApp?.initData) {
										handleProviderClick('telegram');
									}
								}}
							>
								{loadingProvider === 'telegram' ? (
									<Loader2 className="w-4 h-4 animate-spin" />
								) : (
									<>
										{lastProvider === 'telegram' && renderLastUsedIndicator()}
										<svg
											viewBox="0 0 24 24"
											className="w-4.5 h-4.5 fill-[#2AABEE]"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.892-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
										</svg>
										Continue with Telegram
									</>
								)}
							</button>
							{!(window as any).Telegram?.WebApp?.initData && (
								<div className="absolute top-14 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-white dark:text-black text-white text-xs px-2.5 py-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg flex items-center gap-1.5">
									<Clock className="w-3 h-3" />
									<span className="font-medium text-[10px]">coming soon</span>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			<div className="md:mt-10 mt-14 text-center flex items-center justify-center gap-3">
				<a
					href="/terms"
					className="text-[13px] font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
				>
					Terms
				</a>
				<span className="text-gray-400 text-xs">&bull;</span>
				<a
					href="/privacy"
					className="text-[13px] font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
				>
					Privacy
				</a>
			</div>
		</motion.div>
	);
}
