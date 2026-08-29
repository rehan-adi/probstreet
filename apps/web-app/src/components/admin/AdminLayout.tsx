import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
	LayoutDashboard,
	Activity,
	ShieldCheck,
	PlusCircle,
	Users,
	WalletCards,
	LogOut,
	ChevronRight,
	MoreVertical,
	Moon,
	Sun,
	ExternalLink,
	Menu,
	X,
	BrainCircuit,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import logo from '@/assets/images/logo.avif';
import { useThemeStore } from '@/store/theme';
import darkLogo from '@/assets/images/dark-logo.avif';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface AdminLayoutProps {
	children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
	const location = useLocation();
	const { user, logout } = useAuthStore();
	const { theme, toggleTheme } = useThemeStore();
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	// Close mobile menu whenever route changes
	useEffect(() => {
		setIsMobileMenuOpen(false);
	}, [location.pathname]);

	const navGroups = [
		{
			title: 'Overview',
			items: [{ title: 'Dashboard', href: '/dashboard/home', icon: LayoutDashboard }],
		},
		{
			title: 'Markets',
			items: [
				{ title: 'All Markets', href: '/dashboard/markets', icon: Activity },
				{ title: 'Create Market', href: '/dashboard/markets/create', icon: PlusCircle },
				{ title: 'Oracle Review', href: '/dashboard/oracle/review', icon: BrainCircuit },
			],
		},
		{
			title: 'Users',
			items: [
				{ title: 'Verifications', href: '/dashboard/verifications', icon: ShieldCheck },
				{ title: 'All Users', href: '/dashboard/users', icon: Users },
			],
		},
		{
			title: 'Finance',
			items: [{ title: 'Transactions', href: '/dashboard/transactions', icon: WalletCards }],
		},
	];

	const getPageTitle = () => {
		if (location.pathname.startsWith('/dashboard/markets/create')) return 'Create Market';
		if (location.pathname.startsWith('/dashboard/markets')) return 'Markets Management';
		if (location.pathname.startsWith('/dashboard/verifications')) return 'Verifications';
		if (location.pathname.startsWith('/dashboard/users')) return 'Users';
		if (location.pathname.startsWith('/dashboard/transactions')) return 'Transactions';
		return 'Dashboard Overview';
	};

	const renderNavContent = () => (
		<>
			<nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto custom-scrollbar">
				{navGroups.map((group) => (
					<div key={group.title}>
						<h3 className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 dark:text-gray-500">
							{group.title}
						</h3>
						<div className="space-y-1">
							{group.items.map((item) => {
								const isActive =
									location.pathname === item.href ||
									(item.href !== '/dashboard/home' && location.pathname.startsWith(item.href));
								return (
									<Link
										key={item.href}
										to={item.href}
										onClick={() => setIsMobileMenuOpen(false)}
										className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
											isActive
												? 'bg-gray-100 text-gray-900 shadow-xs dark:bg-white/10 dark:text-white dark:backdrop-blur-md font-bold'
												: 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5'
										}`}
									>
										<div className="flex items-center gap-3">
											<item.icon
												size={18}
												className={`transition-colors duration-200 ${
													isActive
														? 'text-gray-900 dark:text-white'
														: 'text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300'
												}`}
											/>
											{item.title}
										</div>
										{isActive && (
											<ChevronRight size={14} className="text-gray-400 dark:text-gray-500" />
										)}
									</Link>
								);
							})}
						</div>
					</div>
				))}
			</nav>

			{/* User footer */}
			<div className="p-4 border-t border-gray-100 dark:border-white/5">
				<Popover>
					<PopoverTrigger asChild>
						<button className="flex items-center gap-3 w-full p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors text-left group border border-transparent dark:hover:border-white/5 cursor-pointer">
							<div className="w-9 h-9 shrink-0 rounded-full bg-gray-100 dark:bg-[#1C1C1E] flex items-center justify-center text-gray-700 dark:text-white font-bold border border-gray-200 dark:border-white/10 text-xs">
								{user?.username?.charAt(0).toUpperCase() || 'A'}
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-bold text-gray-900 dark:text-white truncate">
									{user?.username || 'Admin User'}
								</p>
								<p className="text-[11px] text-gray-400 truncate">Administrator</p>
							</div>
							<MoreVertical
								size={16}
								className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"
							/>
						</button>
					</PopoverTrigger>
					<PopoverContent
						className="w-56 p-1 bg-white dark:bg-[#1C1C1E] border-gray-200 dark:border-white/10 rounded-xl shadow-xl dark:shadow-2xl dark:shadow-black/50 mb-2 backdrop-blur-xl"
						align="start"
					>
						<div className="p-3 border-b border-gray-100 dark:border-white/5 mb-1 bg-gray-50/50 dark:bg-white/5 rounded-t-lg">
							<p className="text-sm font-bold text-gray-900 dark:text-white">Admin Account</p>
							<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
								{user?.email}
							</p>
						</div>

						<div className="p-1 space-y-0.5">
							<button
								onClick={toggleTheme}
								className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors w-full text-left cursor-pointer"
							>
								<div className="flex items-center gap-2">
									{theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
									<span>Dark Mode</span>
								</div>
								<div
									className={`w-8 h-4 rounded-full transition-colors relative border border-gray-300 dark:border-transparent ${theme === 'dark' ? 'bg-white/30' : 'bg-gray-300'}`}
								>
									<div
										className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow-xs ${theme === 'dark' ? 'translate-x-4' : 'translate-x-0'}`}
									/>
								</div>
							</button>

							<Link
								to="/"
								className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors w-full text-left"
							>
								<ExternalLink size={15} />
								<span>Main Platform</span>
							</Link>

							<div className="h-px bg-gray-100 dark:bg-white/5 my-1 mx-2" />

							<button
								onClick={logout}
								className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors w-full text-left cursor-pointer"
							>
								<LogOut size={15} />
								<span>Logout</span>
							</button>
						</div>
					</PopoverContent>
				</Popover>
			</div>
		</>
	);

	return (
		<div className="flex h-full w-full bg-gray-50 dark:bg-[#09090B] font-sans text-gray-900 dark:text-white transition-colors duration-200">
			{/* Desktop Sidebar */}
			<aside className="w-64 shrink-0 bg-white dark:bg-[#121214] border-r border-gray-200 dark:border-white/5 hidden md:flex flex-col relative z-20 shadow-sm dark:shadow-none">
				<div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 dark:border-white/5">
					<Link to="/" className="flex items-center gap-2">
						<img src={logo} alt="Probstreet" className="h-10 dark:hidden" />
						<img src={darkLogo} alt="Probstreet" className="h-10 hidden dark:block" />
					</Link>
					<button
						onClick={toggleTheme}
						className="p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
						title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
						aria-label="Toggle theme"
					>
						{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
					</button>
				</div>
				{renderNavContent()}
			</aside>

			{/* Mobile Slide-Out Drawer Sidebar */}
			{isMobileMenuOpen && (
				<div
					className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
					onClick={() => setIsMobileMenuOpen(false)}
				>
					<div
						className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white dark:bg-[#121214] border-r border-gray-200 dark:border-white/10 flex flex-col shadow-2xl z-50 animate-in slide-in-from-left duration-200"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 dark:border-white/5">
							<Link to="/" className="flex items-center gap-2">
								<img src={logo} alt="Probstreet" className="h-8 dark:hidden" />
								<img src={darkLogo} alt="Probstreet" className="h-8 hidden dark:block" />
							</Link>
							<button
								onClick={() => setIsMobileMenuOpen(false)}
								className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
								aria-label="Close menu"
							>
								<X size={20} />
							</button>
						</div>
						{renderNavContent()}
					</div>
				</div>
			)}

			{/* Main Content Area */}
			<div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
				{/* Top Header Bar for Desktop & Mobile */}
				<header className="h-16 flex items-center justify-between px-4 sm:px-6 md:px-8 bg-white/80 dark:bg-[#121214]/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 sticky top-0 z-30 shrink-0">
					<div className="flex items-center gap-3">
						{/* Mobile Hamburger Button */}
						<button
							onClick={() => setIsMobileMenuOpen(true)}
							className="p-2 -ml-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 md:hidden hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
							aria-label="Open navigation menu"
						>
							<Menu size={18} />
						</button>

						<Link to="/dashboard/home" className="flex items-center gap-2 md:hidden">
							<img src={logo} alt="Probstreet" className="h-7 dark:hidden" />
							<img src={darkLogo} alt="Probstreet" className="h-7 hidden dark:block" />
						</Link>

						<div className="hidden md:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
							<span className="font-bold text-gray-900 dark:text-white text-base">
								{getPageTitle()}
							</span>
						</div>
					</div>

					<div className="flex items-center gap-2 sm:gap-3">
						<button
							onClick={toggleTheme}
							className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100/80 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-xs font-semibold cursor-pointer shadow-xs"
							title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
							aria-label="Toggle theme"
						>
							{theme === 'dark' ? (
								<>
									<Sun size={15} className="text-amber-400" />
									<span className="hidden sm:inline">Light</span>
								</>
							) : (
								<>
									<Moon size={15} className="text-gray-700" />
									<span className="hidden sm:inline">Dark</span>
								</>
							)}
						</button>

						<Link
							to="/"
							className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors text-xs font-semibold shadow-xs"
						>
							<ExternalLink size={14} />
							<span>App</span>
						</Link>

						<button
							onClick={logout}
							className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-xs font-semibold cursor-pointer flex items-center gap-1.5"
							title="Logout"
						>
							<LogOut size={16} />
							<span className="hidden sm:inline">Logout</span>
						</button>
					</div>
				</header>

				<main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-8 custom-scrollbar">
					<div className="mx-auto max-w-7xl">{children}</div>
				</main>
			</div>
		</div>
	);
}
