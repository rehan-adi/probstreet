import { toast } from 'sonner';
import api from '@/config/axios';
import { useAuthStore } from '@/store/auth';
import { useEffect, useState } from 'react';
import { UsernameModal } from '@/components/modals/UsernameModal';
import { User, Bell, LogOut, Trash2, Wallet, Edit2, Mail, Smartphone } from 'lucide-react';

export default function Settings() {
	const [activeTab, setActiveTab] = useState('profile');

	const { user, updateUser, logout } = useAuthStore();
	const [loading, setLoading] = useState(false);
	const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);

	const [bio, setBio] = useState('');
	const [username, setUsername] = useState(user?.username || '');
	const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');

	const [emailNewMarket, setEmailNewMarket] = useState(false);
	const [emailTradeExecuted, setEmailTradeExecuted] = useState(false);
	const [emailPriceAlerts, setEmailPriceAlerts] = useState(false);
	const [inAppNewMarket, setInAppNewMarket] = useState(true);
	const [inAppTradeExecuted, setInAppTradeExecuted] = useState(true);
	const [inAppPriceAlerts, setInAppPriceAlerts] = useState(false);

	useEffect(() => {
		setUsername(user?.username || '');
		setAvatarUrl(user?.avatarUrl || '');
		setBio(user?.bio || '');

		const fetchSettings = async () => {
			try {
				const res = await api.get('/settings');
				if (res.data.notificationPrefs) {
					const prefs = res.data.notificationPrefs;
					setEmailNewMarket(prefs.emailNewMarket);
					setEmailTradeExecuted(prefs.emailTradeExecuted);
					setEmailPriceAlerts(prefs.emailPriceAlerts || false);
					setInAppNewMarket(prefs.inAppNewMarket);
					setInAppTradeExecuted(prefs.inAppTradeExecuted);
					setInAppPriceAlerts(prefs.inAppPriceAlerts);
				}
			} catch (err) {
				console.error('Failed to fetch settings', err);
			}
		};
		fetchSettings();
	}, [user]);

	const handleSaveProfile = async () => {
		try {
			setLoading(true);
			const res = await api.put('/settings/profile', { bio });
			if (res.data.user) {
				updateUser(res.data.user);
				toast.success('Profile updated successfully');
			}
		} catch (error: any) {
			toast.error(error.response?.data?.error || 'Failed to update profile');
		} finally {
			setLoading(false);
		}
	};

	const handleUpdateNotifications = async (key: string, value: boolean) => {
		const newPrefs = {
			emailNewMarket,
			emailTradeExecuted,
			emailPriceAlerts,
			inAppNewMarket,
			inAppTradeExecuted,
			inAppPriceAlerts,
			[key]: value,
		};
		try {
			await api.put('/settings/notifications', newPrefs);
			toast.success('Notification preferences updated');
		} catch (error) {
			toast.error('Failed to update preferences');
		}
	};

	const handleDeleteAccount = async () => {
		if (confirm('Permanently delete your account. This action cannot be undone. Are you sure?')) {
			try {
				await api.delete('/settings/account');
				toast.success('Account deleted successfully');
				logout();
			} catch (error) {
				toast.error('Failed to delete account');
			}
		}
	};

	return (
		<div className="max-w-5xl mx-auto px-6 py-10 md:py-10">
			<div className="flex flex-col md:flex-row gap-8">
				{/* Sidebar */}
				<div className="w-full md:w-48 shrink-0 flex flex-col gap-1.5 md:sticky md:top-24 h-fit">
					<button
						onClick={() => setActiveTab('profile')}
						className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer rounded-xl text-sm font-semibold transition-colors ${
							activeTab === 'profile'
								? 'bg-black dark:bg-white text-white dark:text-black shadow-sm'
								: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
						}`}
					>
						<User size={18} /> Profile
					</button>
					<button
						onClick={() => setActiveTab('account')}
						className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer rounded-xl text-sm font-semibold transition-colors ${
							activeTab === 'account'
								? 'bg-black dark:bg-white text-white dark:text-black shadow-sm'
								: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
						}`}
					>
						<Wallet size={18} /> Account
					</button>
					<button
						onClick={() => setActiveTab('notifications')}
						className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer rounded-xl text-sm font-semibold transition-colors ${
							activeTab === 'notifications'
								? 'bg-black dark:bg-white text-white dark:text-black shadow-sm'
								: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
						}`}
					>
						<Bell size={18} /> Notifications
					</button>
				</div>

				{/* Content */}
				<div className="flex-1 max-w-3xl">
					{activeTab === 'profile' && (
						<div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
							<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Profile</h2>

							<div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-white/5 shadow-sm">
								{/* Profile Picture */}
								<div className="p-6 flex items-center justify-between">
									<div>
										<h3 className="text-sm font-bold text-gray-900 dark:text-white">
											Profile picture
										</h3>
									</div>
									<div className="flex items-center gap-4">
										<div className="w-12 h-12 rounded-full overflow-hidden border border-gray-200 dark:border-white/10 flex items-center justify-center bg-gray-100 dark:bg-[#111111] cursor-pointer hover:opacity-80 transition-opacity">
											{avatarUrl ? (
												<img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
											) : (
												<span className="text-black dark:text-white font-bold text-lg">
													{username?.charAt(0).toUpperCase() || 'U'}
												</span>
											)}
										</div>
									</div>
								</div>

								{/* Username */}
								<div className="p-6 flex items-center justify-between gap-8">
									<h3 className="text-sm font-bold text-gray-900 dark:text-white shrink-0">
										Username
									</h3>
									<div className="flex items-center gap-3">
										<span className="text-gray-900 dark:text-white font-medium text-sm bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-lg">
											{user?.username}
										</span>
										<button
											onClick={() => setIsUsernameModalOpen(true)}
											className="text-gray-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/5"
										>
											<Edit2 size={16} />
										</button>
									</div>
								</div>

								{/* Email */}
								<div className="p-6 flex items-center justify-between gap-8">
									<h3 className="text-sm font-bold text-gray-900 dark:text-white shrink-0">
										Email
									</h3>
									<div className="text-gray-500 dark:text-gray-400 text-sm font-medium">
										{user?.email}
									</div>
								</div>
							</div>

							{/* Bio Section */}
							<div>
								<h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 px-1">Bio</h3>
								<div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/5 rounded-2xl p-4 shadow-sm focus-within:border-gray-400 dark:focus-within:border-white/20 transition-colors">
									<textarea
										value={bio}
										onChange={(e) => setBio(e.target.value)}
										maxLength={200}
										placeholder="Tell others about yourself"
										className="w-full bg-transparent outline-none resize-none text-sm text-gray-900 dark:text-white min-h-20 placeholder:text-gray-400 dark:placeholder:text-gray-500"
									/>
									<div className="text-right text-xs font-semibold text-gray-400 mt-2">
										{bio.length}/200
									</div>
								</div>
							</div>

							{/* Save Button */}
							{bio !== user?.bio && (
								<div className="flex justify-end">
									<button
										onClick={handleSaveProfile}
										disabled={loading}
										className="bg-black dark:bg-white text-white dark:text-black px-6 py-2.5 rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:scale-100 cursor-pointer"
									>
										{loading ? 'Saving...' : 'Save Profile'}
									</button>
								</div>
							)}
						</div>
					)}

					{activeTab === 'account' && (
						<div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
							<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Account</h2>

							<div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/5 rounded-2xl p-6 shadow-sm">
								<h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">
									Device Management
								</h3>
								<p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">
									Manage the devices you are currently logged in from.
								</p>

								<div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/5">
									<div className="flex items-center gap-4">
										<div className="w-10 h-10 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/5">
											<LogOut size={18} />
										</div>
										<div>
											<p className="text-sm font-bold text-gray-900 dark:text-white">
												Current Session
											</p>
											<p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
												Mac OS • Chrome • Active now
											</p>
										</div>
									</div>
									<button className="text-sm text-gray-500 dark:text-gray-400 font-bold hover:text-black dark:hover:text-white transition-colors cursor-pointer">
										Log out
									</button>
								</div>
							</div>

							<div className="bg-red-50/50 dark:bg-[#150505] border border-red-100 dark:border-red-900/30 rounded-2xl p-6">
								<div className="flex items-start justify-between gap-8">
									<div>
										<h3 className="text-lg font-bold text-red-600 dark:text-red-500 mb-1.5">
											Delete account
										</h3>
										<p className="text-sm text-red-900/60 dark:text-red-400/80 font-medium">
											Permanently delete your account. This action cannot be undone.
										</p>
									</div>
									<button
										onClick={handleDeleteAccount}
										className="shrink-0 flex items-center gap-2 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl font-bold text-sm hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors cursor-pointer"
									>
										<Trash2 size={16} /> Delete
									</button>
								</div>
							</div>
						</div>
					)}

					{activeTab === 'notifications' && (
						<div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
							<h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
								Notifications
							</h2>

							{/* Email Notifications */}
							<div>
								<div className="flex items-center gap-2 px-2 mb-3">
									<Mail className="w-4 h-4 text-gray-500 dark:text-gray-400" />
									<h3 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
										Email Notifications
									</h3>
								</div>
								<div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-white/5 shadow-sm">
									<div className="p-6 flex items-center justify-between gap-8">
										<div>
											<h4 className="text-sm font-bold text-gray-900 dark:text-white">
												New Markets
											</h4>
											<p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
												Receive an email when new markets are added.
											</p>
										</div>
										<label className="relative inline-flex items-center cursor-pointer">
											<input
												type="checkbox"
												className="sr-only peer"
												checked={emailNewMarket}
												onChange={() => {
													setEmailNewMarket(!emailNewMarket);
													handleUpdateNotifications('emailNewMarket', !emailNewMarket);
												}}
											/>
											<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-[#222] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-black dark:peer-checked:bg-white transition-colors"></div>
										</label>
									</div>

									<div className="p-6 flex items-center justify-between gap-8">
										<div>
											<h4 className="text-sm font-bold text-gray-900 dark:text-white">
												Order Fills
											</h4>
											<p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
												Receive an email when your order is filled.
											</p>
										</div>
										<label className="relative inline-flex items-center cursor-pointer">
											<input
												type="checkbox"
												className="sr-only peer"
												checked={emailTradeExecuted}
												onChange={() => {
													setEmailTradeExecuted(!emailTradeExecuted);
													handleUpdateNotifications('emailTradeExecuted', !emailTradeExecuted);
												}}
											/>
											<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-[#222] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-black dark:peer-checked:bg-white transition-colors"></div>
										</label>
									</div>

									<div className="p-6 flex items-center justify-between gap-8">
										<div>
											<h4 className="text-sm font-bold text-gray-900 dark:text-white">
												Price Alerts
											</h4>
											<p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
												Receive an email when your price targets are hit.
											</p>
										</div>
										<label className="relative inline-flex items-center cursor-pointer">
											<input
												type="checkbox"
												className="sr-only peer"
												checked={emailPriceAlerts}
												onChange={() => {
													setEmailPriceAlerts(!emailPriceAlerts);
													handleUpdateNotifications('emailPriceAlerts', !emailPriceAlerts);
												}}
											/>
											<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-[#222] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-black dark:peer-checked:bg-white transition-colors"></div>
										</label>
									</div>
								</div>
							</div>

							{/* In-App Notifications */}
							<div>
								<div className="flex items-center gap-2 px-2 mb-3">
									<Smartphone className="w-4 h-4 text-gray-500 dark:text-gray-400" />
									<h3 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
										In-App Notifications
									</h3>
								</div>
								<div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-white/5 shadow-sm">
									<div className="p-6 flex items-center justify-between gap-8">
										<div>
											<h4 className="text-sm font-bold text-gray-900 dark:text-white">
												New Markets
											</h4>
											<p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
												Receive in-app alerts when new markets are added.
											</p>
										</div>
										<label className="relative inline-flex items-center cursor-pointer">
											<input
												type="checkbox"
												className="sr-only peer"
												checked={inAppNewMarket}
												onChange={() => {
													setInAppNewMarket(!inAppNewMarket);
													handleUpdateNotifications('inAppNewMarket', !inAppNewMarket);
												}}
											/>
											<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-[#222] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-black dark:peer-checked:bg-white transition-colors"></div>
										</label>
									</div>

									<div className="p-6 flex items-center justify-between gap-8">
										<div>
											<h4 className="text-sm font-bold text-gray-900 dark:text-white">
												Order Fills
											</h4>
											<p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
												Receive in-app alerts when your order is filled.
											</p>
										</div>
										<label className="relative inline-flex items-center cursor-pointer">
											<input
												type="checkbox"
												className="sr-only peer"
												checked={inAppTradeExecuted}
												onChange={() => {
													setInAppTradeExecuted(!inAppTradeExecuted);
													handleUpdateNotifications('inAppTradeExecuted', !inAppTradeExecuted);
												}}
											/>
											<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-[#222] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-black dark:peer-checked:bg-white transition-colors"></div>
										</label>
									</div>

									<div className="p-6 flex items-center justify-between gap-8">
										<div>
											<h4 className="text-sm font-bold text-gray-900 dark:text-white">
												Price Alerts
											</h4>
											<p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
												Receive in-app alerts when your price targets are hit.
											</p>
										</div>
										<label className="relative inline-flex items-center cursor-pointer">
											<input
												type="checkbox"
												className="sr-only peer"
												checked={inAppPriceAlerts}
												onChange={() => {
													setInAppPriceAlerts(!inAppPriceAlerts);
													handleUpdateNotifications('inAppPriceAlerts', !inAppPriceAlerts);
												}}
											/>
											<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-[#222] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-black dark:peer-checked:bg-white transition-colors"></div>
										</label>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
			{isUsernameModalOpen && (
				<UsernameModal
					onClose={() => setIsUsernameModalOpen(false)}
					usernameChangedAt={user?.usernameChangedAt}
				/>
			)}
		</div>
	);
}
