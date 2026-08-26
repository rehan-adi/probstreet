import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@/store/theme';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Moon, Sun, Activity, Check } from 'lucide-react';

const LANGUAGES = [
	{ code: 'en', name: 'English', flag: '🇬🇧' },
	{ code: 'es', name: 'Español', flag: '🇪🇸' },
	{ code: 'pt', name: 'Português', flag: '🇵🇹' },
	{ code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
	{ code: 'bn', name: 'বাংলা', flag: '🇧🇩' },
];

export default function MenuModal({ onClose: _onClose }: { onClose?: () => void }) {
	const { t, i18n } = useTranslation();
	const { theme, toggleTheme } = useThemeStore();

	const [showLanguages, setShowLanguages] = useState(false);

	return (
		<motion.div
			initial={{ opacity: 0, y: -10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -10 }}
			className="absolute right-0 top-12 bg-white shadow-xl rounded-xl py-3 px-2 text-sm border border-gray-100 flex flex-col z-50 min-w-[240px]"
			onClick={(e) => e.stopPropagation()}
		>
			<div className="flex flex-col gap-1 border-b border-gray-100 pb-2 mb-2 px-2">
				<button className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-colors cursor-pointer">
					<Trophy size={18} className="text-yellow-500" />
					{t('Leaderboard')}
				</button>
				<button
					onClick={toggleTheme}
					className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-colors cursor-pointer"
				>
					{theme === 'dark' ? (
						<>
							<Sun size={18} className="text-orange-500" /> {t('Light Mode')}
						</>
					) : (
						<>
							<Moon size={18} className="text-blue-500" /> {t('Dark Mode')}
						</>
					)}
				</button>
				<button className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-colors cursor-pointer">
					<Activity size={18} className="text-green-500" />
					{t('Status')}
				</button>
			</div>

			<div className="px-2">
				<button
					onClick={() => setShowLanguages(!showLanguages)}
					className="flex w-full items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-colors cursor-pointer"
				>
					<div className="flex items-center gap-2">
						<span>🌐</span>
						<span>{t('Language')}</span>
					</div>
					<span
						className={`transition-transform duration-200 ${showLanguages ? 'rotate-180' : ''}`}
					>
						▼
					</span>
				</button>

				<AnimatePresence>
					{showLanguages && (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: 'auto', opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							className="overflow-hidden flex flex-col gap-1 mt-1 pl-2 border-l-2 border-gray-100 ml-4"
						>
							{LANGUAGES.map((lang) => (
								<button
									key={lang.code}
									onClick={() => {
										i18n.changeLanguage(lang.code);
										setShowLanguages(false);
									}}
									className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors font-medium text-sm cursor-pointer ${
										i18n.language === lang.code
											? 'bg-gray-100 text-black'
											: 'hover:bg-gray-50 text-gray-600'
									}`}
								>
									<div className="flex items-center gap-3">
										<span className="text-base">{lang.flag}</span>
										<span>{lang.name}</span>
									</div>
									{i18n.language === lang.code && <Check size={14} />}
								</button>
							))}
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</motion.div>
	);
}
