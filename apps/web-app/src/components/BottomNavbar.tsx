import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useTranslation } from 'react-i18next';
import { Home, Search, Menu } from 'lucide-react';
import walletIcon from '@/assets/images/wallet.svg';

export default function BottomNavbar({
	onOpenSearch,
	onOpenMenu,
}: {
	onOpenSearch: () => void;
	onOpenMenu: () => void;
}) {
	const { t } = useTranslation();
	const { user } = useAuthStore();

	const renderNavLinks = () => (
		<>
			<NavLink
				to="/events"
				end
				className={({ isActive }) =>
					`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-black dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'}`
				}
			>
				<Home size={22} className="stroke-2" />
				<span className="text-[10px] font-normal text-gray-900 dark:text-gray-100">
					{t('Home')}
				</span>
			</NavLink>

			<button
				onClick={onOpenSearch}
				className={`flex flex-col items-center gap-1 transition-colors text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white`}
			>
				<Search size={22} className="stroke-2" />
				<span className="text-[10px] font-normal text-gray-900 dark:text-gray-100">
					{t('Search')}
				</span>
			</button>

			{user?.role === 'USER' ? (
				<NavLink
					to="/wallet"
					className={({ isActive }) =>
						`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-black dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'}`
					}
				>
					<img src={walletIcon} alt="Wallet" className="w-5.5 h-5.5 opacity-80" />
					<span className="text-[10px] font-normal text-gray-900 dark:text-gray-100">
						{t('Wallet')}
					</span>
				</NavLink>
			) : (
				<button
					onClick={onOpenMenu}
					className="flex flex-col items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
				>
					<Menu size={22} className="stroke-2" />
					<span className="text-[10px] font-normal text-gray-900 dark:text-gray-100">
						{t('More')}
					</span>
				</button>
			)}
		</>
	);

	return (
		<div className="fixed bottom-0 w-full bg-white dark:bg-[#090C1A] border-t border-gray-200 dark:border-gray-800 py-2 px-12 flex justify-between items-center z-50 md:hidden pb-safe">
			{renderNavLinks()}
		</div>
	);
}
