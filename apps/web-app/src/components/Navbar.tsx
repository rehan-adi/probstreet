import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';
import { socket } from '@/socket';
import { getNotifications, markNotificationsAsRead } from '@/api/notifications';
import {
	Menu,
	Gift,
	Bell,
	LogOut,
	Settings,
	Briefcase,
	Info,
	Trophy,
	Moon,
	Activity,
	Bookmark,
} from 'lucide-react';
import SearchInput from './SearchInput';
import CategoryNav from './CategoryNav';
import BottomNavbar from './BottomNavbar';
import { useAuthStore } from '@/store/auth';
import { formatAmount } from '@/lib/format';
import logo from '@/assets/images/logo.avif';
import { useModalStore } from '@/store/modal';
import { useThemeStore } from '@/store/theme';
import pfpIcon from '@/assets/images/pfp.avif';
import SearchModal from './modals/SearchModal';
import LanguageSelector from './LanguageSelector';
import walletIcon from '@/assets/images/wallet.svg';
import darkLogo from '@/assets/images/dark-logo.avif';
import HowItWorksModal from './modals/HowItWorksModal';
import { motion, AnimatePresence } from 'framer-motion';
import { useBalanceQuery } from '@/hooks/queries/balance';

import notificationSound from '@/assets/audio/notification.wav';

export default function Navbar() {
	const { user } = useAuthStore();
	const { t } = useTranslation();
	const { openOnboardModal } = useModalStore();
	const { theme, toggleTheme } = useThemeStore();
	const { data: balance, isLoading: balanceLoading } = useBalanceQuery();

	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isProfileOpen, setIsProfileOpen] = useState(false);
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [isNotificationOpen, setIsNotificationOpen] = useState(false);
	const [showHowItWorks, setShowHowItWorks] = useState(false);

	const [notifications, setNotifications] = useState<any[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);

	const menuRef = useRef<HTMLDivElement>(null);
	const profileRef = useRef<HTMLDivElement>(null);
	const notifRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMenuOpen(false);
			if (profileRef.current && !profileRef.current.contains(e.target as Node))
				setIsProfileOpen(false);
			if (notifRef.current && !notifRef.current.contains(e.target as Node))
				setIsNotificationOpen(false);
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const userId = user?.id;

	useEffect(() => {
		if (userId) {
			getNotifications().then((res) => {
				if (res.success) {
					setNotifications(res.data.notifications);
					setUnreadCount(res.data.unreadCount);
				}
			});

			socket.emit('SUBSCRIBE_USER', userId);

			const playNotificationSound = () => {
				try {
					const audioEl = document.getElementById('notification-audio') as HTMLAudioElement;
					if (audioEl) {
						audioEl.currentTime = 0;
						const playPromise = audioEl.play();
						if (playPromise !== undefined) {
							playPromise.catch((error) => {
								console.error('Audio playback failed:', error);
							});
						}
					}
				} catch (e) {
					console.error('Failed to play sound:', e);
				}
			};

			const handleNotification = (newNotification: any) => {
				setNotifications((prev) => [newNotification, ...prev]);
				setUnreadCount((prev) => prev + 1);
				playNotificationSound();
			};

			socket.on('NOTIFICATION', handleNotification);

			return () => {
				socket.off('NOTIFICATION', handleNotification);
				socket.emit('UNSUBSCRIBE_USER', userId);
			};
		}
	}, [userId]);

	const handleOpenNotifs = async () => {
		setIsNotificationOpen(!isNotificationOpen);
		if (!isNotificationOpen && unreadCount > 0) {
			await markNotificationsAsRead();
			setUnreadCount(0);
			setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
		}
	};

	const handleLogout = async () => {
		try {
			useAuthStore.getState().logout();
		} catch (error) {
			console.error('Logout failed', error);
		}
	};

	return (
		<>
			<nav className="w-full bg-white dark:bg-[#090C1A] fixed top-0 z-50 transition-colors flex flex-col">
				{/* Audio Element for Notifications */}
				<audio id="notification-audio" src={notificationSound} preload="auto" className="hidden" />

				<div className={`w-full px-6`}>
					<div className="max-w-7xl mx-auto h-16 flex items-center justify-between gap-4">
						<div className="flex items-center gap-6 flex-1">
							<Link to="/events" className="shrink-0">
								<img src={logo} className="w-35 md:w-44 object-contain dark:hidden" alt="Logo" />
								<img
									src={darkLogo}
									className="hidden w-35 md:w-44 object-contain dark:block dark:brightness-110"
									alt="Logo"
								/>
							</Link>

							{user?.role !== 'ADMIN' && (
								<div className="hidden md:flex items-center gap-4 flex-1 max-w-125">
									<div className="w-full">
										<SearchInput />
									</div>
								</div>
							)}
							{user?.role === 'ADMIN' && (
								<div className="hidden md:flex items-center gap-6 ml-8">
									<Link
										to="/dashboard/home"
										className="text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors"
									>
										Admin
									</Link>
									<Link
										to="/verifications"
										className="text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors"
									>
										Verifications
									</Link>
								</div>
							)}
						</div>

						<div className="flex items-center gap-2 lg:gap-2 shrink-0">
							{!user && (
								<>
									<button
										onClick={() => setShowHowItWorks(true)}
										className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md text-black dark:text-white bg-gray-100 dark:bg-slate-800 transition-colors cursor-pointer"
									>
										<div className="flex items-center justify-center">
											<Info size={14} className="text-black dark:text-white" />
										</div>
										{t('How it works')}
									</button>

									<button
										onClick={openOnboardModal}
										className="bg-black dark:bg-white text-white dark:text-black font-medium text-sm px-4 py-1.5 rounded-md hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
									>
										{t('Sign In')}
									</button>

									<div ref={menuRef} className="relative">
										<button
											onClick={() => setIsMenuOpen(!isMenuOpen)}
											className="hidden lg:block p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-700 dark:text-gray-300 cursor-pointer"
										>
											<Menu size={22} />
										</button>
										<AnimatePresence>
											{isMenuOpen && (
												<div onMouseLeave={() => setIsMenuOpen(false)}>
													<motion.div
														initial={{ opacity: 0, y: 10 }}
														animate={{ opacity: 1, y: 0 }}
														exit={{ opacity: 0, y: 10 }}
														className="absolute right-0 top-12 w-56 bg-white dark:bg-slate-900 shadow-xl rounded-xl py-2 border border-gray-100 dark:border-slate-800 z-50"
													>
														<div className="px-2">
															<Link
																to="/leaderboard"
																onClick={() => setIsMenuOpen(false)}
																className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
															>
																<Trophy size={16} className="text-black dark:text-white" />
																{t('Leaderboard')}
															</Link>

															<button className="flex w-full items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors cursor-pointer">
																<Activity size={16} className="text-black dark:text-white" />
																{t('Status')}
															</button>

															<button
																onClick={toggleTheme}
																className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
																role="switch"
																aria-checked={theme === 'dark'}
															>
																<div className="flex items-center gap-3">
																	<Moon size={16} className="text-black dark:text-white" />
																	<span>{t('Dark Mode')}</span>
																</div>
																<div
																	className={`relative inline-flex h-5.5 w-10.5 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-opacity-75 ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
																>
																	<span className="sr-only">Toggle Dark Mode</span>
																	<span
																		aria-hidden="true"
																		className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`}
																	/>
																</div>
															</button>

															<div className="h-px bg-gray-100 dark:bg-slate-800 my-1 mx-2" />

															<LanguageSelector />
														</div>
													</motion.div>
												</div>
											)}
										</AnimatePresence>
									</div>
								</>
							)}

							{user?.role === 'USER' && (
								<div className="flex items-center gap-2 lg:gap-2">
									{/* Wallet - Hidden on mobile, shown on bottom nav instead */}
									<Link
										to="/wallet"
										className="hidden md:flex items-center gap-2 border border-gray-200 dark:border-white/10 px-8 py-1 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 transition-colors h-8"
									>
										<img src={walletIcon} alt="Wallet" className="w-4 h-4 dark:invert" />
										<span className="font-semibold text-sm text-gray-900 dark:text-white">
											₹{balanceLoading ? '0' : formatAmount(balance?.data?.data?.amount)}
										</span>
									</Link>

									<Link
										to="/referral"
										className="flex group relative items-center justify-center p-0.5 w-9 h-8 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors rounded-md cursor-pointer"
									>
										<Gift size={20} className="text-gray-700 dark:text-gray-300" />
										<div className="absolute top-12 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-white dark:text-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
											Refer & Reward
										</div>
									</Link>

									<div ref={notifRef} className="relative">
										<button
											onClick={handleOpenNotifs}
											className="flex items-center justify-center w-9 h-8 p-0.5 border border-gray-200 dark:border-white/10 cursor-pointer rounded-md hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-gray-700 dark:text-gray-300 relative"
										>
											<Bell size={19} className="text-black dark:text-white" />
											{unreadCount > 0 && (
												<span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center">
													{unreadCount > 99 ? '99+' : unreadCount}
												</span>
											)}
										</button>
										<AnimatePresence>
											{isNotificationOpen && (
												<motion.div
													initial={{ opacity: 0, y: 10, scale: 0.95 }}
													animate={{ opacity: 1, y: 0, scale: 1 }}
													exit={{ opacity: 0, y: 10, scale: 0.95 }}
													className="absolute right-0 top-12 w-80 md:w-96 max-h-[32rem] overflow-hidden bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-2xl shadow-2xl rounded-2xl border border-gray-200/50 dark:border-white/10 z-50 flex flex-col"
												>
													<div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 flex items-center justify-between sticky top-0 z-10">
														<h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
															Notifications
															{unreadCount > 0 && (
																<span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
																	{unreadCount} NEW
																</span>
															)}
														</h3>
													</div>

													<div className="flex-1 overflow-y-auto p-2 space-y-1">
														{notifications.length === 0 ? (
															<div className="py-12 px-4 flex flex-col items-center justify-center text-center">
																<div className="w-16 h-16 bg-gray-50 dark:bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
																	<Bell size={28} className="text-gray-300 dark:text-gray-500" />
																</div>
																<p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
																	All caught up!
																</p>
																<p className="text-xs text-gray-500 dark:text-gray-400">
																	You have no new notifications right now.
																</p>
															</div>
														) : (
															notifications.map((n) => (
																<Link
																	key={n.id}
																	to={n.link || '#'}
																	className={`flex items-start gap-4 p-3 rounded-xl transition-all duration-200 text-left relative group ${
																		!n.isRead
																			? 'bg-blue-50/50 dark:bg-blue-500/10 hover:bg-blue-50 dark:hover:bg-blue-500/20'
																			: 'hover:bg-gray-50 dark:hover:bg-white/5'
																	}`}
																>
																	<div className="shrink-0 mt-0.5">
																		<div
																			className={`w-10 h-10 rounded-full flex items-center justify-center ${
																				!n.isRead
																					? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
																					: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
																			}`}
																		>
																			{n.type === 'TRADE_EXECUTED' ? (
																				<svg
																					xmlns="http://www.w3.org/2000/svg"
																					width="18"
																					height="18"
																					viewBox="0 0 24 24"
																					fill="none"
																					stroke="currentColor"
																					strokeWidth="2"
																					strokeLinecap="round"
																					strokeLinejoin="round"
																				>
																					<path d="M2 12h4l3-9 5 18 3-9h5" />
																				</svg>
																			) : n.type === 'PRICE_ALERT' ? (
																				<svg
																					xmlns="http://www.w3.org/2000/svg"
																					width="18"
																					height="18"
																					viewBox="0 0 24 24"
																					fill="none"
																					stroke="currentColor"
																					strokeWidth="2"
																					strokeLinecap="round"
																					strokeLinejoin="round"
																				>
																					<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
																					<path d="M12 9v4" />
																					<path d="M12 17h.01" />
																				</svg>
																			) : (
																				<Bell size={18} />
																			)}
																		</div>
																	</div>

																	<div className="flex-1 min-w-0 pr-2">
																		<p
																			className={`text-sm mb-0.5 truncate ${
																				!n.isRead
																					? 'font-semibold text-gray-900 dark:text-white'
																					: 'font-medium text-gray-800 dark:text-gray-200'
																			}`}
																		>
																			{n.title}
																		</p>
																		<p
																			className={`text-xs line-clamp-2 ${
																				!n.isRead
																					? 'text-gray-700 dark:text-gray-300'
																					: 'text-gray-500 dark:text-gray-400'
																			}`}
																		>
																			{n.message}
																		</p>
																		<p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 font-medium">
																			{new Date(n.createdAt).toLocaleDateString(undefined, {
																				month: 'short',
																				day: 'numeric',
																				hour: '2-digit',
																				minute: '2-digit',
																			})}
																		</p>
																	</div>

																	{!n.isRead && (
																		<div className="absolute top-1/2 -translate-y-1/2 right-4 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
																	)}
																</Link>
															))
														)}
													</div>
												</motion.div>
											)}
										</AnimatePresence>
									</div>

									<div ref={profileRef} className="relative">
										<div
											onMouseEnter={() => setIsProfileOpen(true)}
											className="flex items-center cursor-pointer p-0.5 rounded-full hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
										>
											<img
												src={user?.avatarUrl || pfpIcon}
												alt="Profile"
												className="w-8.5 h-8.5 rounded-full object-cover border border-gray-200 dark:border-white/10"
											/>
										</div>

										<AnimatePresence>
											{isProfileOpen && (
												<div onMouseLeave={() => setIsProfileOpen(false)}>
													<motion.div
														initial={{ opacity: 0, y: 10 }}
														animate={{ opacity: 1, y: 0 }}
														exit={{ opacity: 0, y: 10 }}
														className="absolute right-0 top-12 w-56 bg-white dark:bg-[#1C1C1E] shadow-xl rounded-xl py-2 border border-gray-100 dark:border-white/10 z-50"
													>
														<div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-white/5 mb-1">
															<img
																src={user?.avatarUrl || pfpIcon}
																alt="Profile"
																className="w-10 h-10 rounded-full object-cover"
															/>
															<div className="flex flex-col">
																<span className="text-sm font-bold text-gray-900 dark:text-gray-100">
																	{user?.username || 'User'}
																</span>
															</div>
														</div>

														<div className="px-2">
															<Link
																to="/settings"
																className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
															>
																<Settings size={16} className="text-black dark:text-white" />{' '}
																{t('Settings')}
															</Link>
															<Link
																to="/portfolio"
																className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
															>
																<Briefcase size={16} className="text-black dark:text-white" />{' '}
																{t('Portfolio')}
															</Link>
															<Link
																to="/wishlist"
																className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
															>
																<Bookmark size={16} className="text-black dark:text-white" />{' '}
																{t('Wishlist')}
															</Link>
															<Link
																to="/leaderboard"
																className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
															>
																<Trophy size={16} className="text-black dark:text-white" />{' '}
																{t('Leaderboard')}
															</Link>

															<button className="flex w-full items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors cursor-pointer">
																<Activity size={16} className="text-black dark:text-white" />
																{t('Status')}
															</button>

															<button
																onClick={toggleTheme}
																className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
																role="switch"
																aria-checked={theme === 'dark'}
															>
																<div className="flex items-center gap-3">
																	<Moon size={16} className="text-black dark:text-white" />
																	<span>{t('Dark Mode')}</span>
																</div>
																<div
																	className={`relative inline-flex h-5.5 w-10.5 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-opacity-75 ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
																>
																	<span className="sr-only">Toggle Dark Mode</span>
																	<span
																		aria-hidden="true"
																		className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`}
																	/>
																</div>
															</button>

															<div className="h-px bg-gray-100 dark:bg-white/5 my-1 mx-2" />

															<LanguageSelector />

															<button
																onClick={handleLogout}
																className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-sm font-medium text-red-600 dark:text-red-400 transition-colors w-full text-left"
															>
																<LogOut size={16} /> Logout
															</button>
														</div>
													</motion.div>
												</div>
											)}
										</AnimatePresence>
									</div>
								</div>
							)}

							{user?.role === 'ADMIN' && (
								<div className="flex items-center gap-2 lg:gap-2">
									<div ref={profileRef} className="relative">
										<div
											onMouseEnter={() => setIsProfileOpen(true)}
											className="flex items-center cursor-pointer p-0.5 rounded-full hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
										>
											<img
												src={user?.avatarUrl || pfpIcon}
												alt="Profile"
												className="w-8.5 h-8.5 rounded-full object-cover border border-gray-200 dark:border-white/10"
											/>
										</div>

										<AnimatePresence>
											{isProfileOpen && (
												<div onMouseLeave={() => setIsProfileOpen(false)}>
													<motion.div
														initial={{ opacity: 0, y: 10 }}
														animate={{ opacity: 1, y: 0 }}
														exit={{ opacity: 0, y: 10 }}
														className="absolute right-0 top-12 w-56 bg-white dark:bg-[#1C1C1E] shadow-xl rounded-xl py-2 border border-gray-100 dark:border-white/10 z-50"
													>
														<div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-white/5 mb-1">
															<img
																src={user?.avatarUrl || pfpIcon}
																alt="Profile"
																className="w-10 h-10 rounded-full object-cover"
															/>
															<div className="flex flex-col">
																<span className="text-sm font-bold text-gray-900 dark:text-gray-100">
																	Admin
																</span>
															</div>
														</div>
														<div className="px-2">
															<button
																onClick={toggleTheme}
																className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
																role="switch"
																aria-checked={theme === 'dark'}
															>
																<div className="flex items-center gap-3">
																	<Moon size={16} className="text-black dark:text-white" />
																	<span>{t('Dark Mode')}</span>
																</div>
																<div
																	className={`relative inline-flex h-5.5 w-10.5 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-opacity-75 ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
																>
																	<span className="sr-only">Toggle Dark Mode</span>
																	<span
																		aria-hidden="true"
																		className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`}
																	/>
																</div>
															</button>
															<div className="h-px bg-gray-100 dark:bg-white/5 my-1 mx-2" />
															<button
																onClick={handleLogout}
																className="flex w-full items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-sm font-medium text-red-600 dark:text-red-400 transition-colors cursor-pointer"
															>
																<LogOut size={16} /> {t('Logout')}
															</button>
														</div>
													</motion.div>
												</div>
											)}
										</AnimatePresence>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
				<CategoryNav />
			</nav>
			<div className="h-12 w-full" />

			<BottomNavbar
				onOpenSearch={() => setIsSearchOpen(true)}
				onOpenMenu={() => setIsMenuOpen(true)}
			/>

			<AnimatePresence>
				{showHowItWorks && <HowItWorksModal onClose={() => setShowHowItWorks(false)} />}
			</AnimatePresence>

			<AnimatePresence>
				{isSearchOpen && <SearchModal onClose={() => setIsSearchOpen(false)} />}
			</AnimatePresence>
		</>
	);
}
