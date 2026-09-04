import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LANGUAGES = [
	{ code: 'en', name: 'English', flag: '🇬🇧' },
	{ code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
	{ code: 'es', name: 'Español', flag: '🇪🇸' },
	{ code: 'pt', name: 'Português', flag: '🇵🇹' },
	{ code: 'bn', name: 'বাংলা', flag: '🇧🇩' },
];

export default function LanguageSelector() {
	const { i18n } = useTranslation();
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const activeLang = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	return (
		<div className="relative w-full" ref={dropdownRef}>
			<button
				onClick={(e) => {
					e.stopPropagation();
					setIsOpen(!isOpen);
				}}
				className="flex w-full items-center justify-between px-3 py-2 bg-transparent hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
			>
				<div className="flex items-center gap-3">
					<span className="flex items-center justify-center w-4 h-4">
						<span className="text-sm leading-none">🌐</span>
					</span>
					<span>{activeLang.name}</span>
				</div>
				<ChevronDown
					size={14}
					className={`text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
				/>
			</button>

			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ opacity: 0, y: -8, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -8, scale: 0.98 }}
						transition={{ duration: 0.15, ease: 'easeOut' }}
						className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-white/10 rounded-xl shadow-xl z-60 py-1.5 overflow-hidden"
					>
						{LANGUAGES.map((lang) => (
							<button
								key={lang.code}
								onClick={(e) => {
									e.stopPropagation();
									i18n.changeLanguage(lang.code);
									localStorage.setItem('language', lang.code);
									setIsOpen(false);
								}}
								className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
							>
								<div className="flex items-center gap-3">
									<span className="text-sm leading-none opacity-80 group-hover:opacity-100 transition-opacity">
										{lang.flag}
									</span>
									<span
										className={
											i18n.language === lang.code
												? 'text-blue-600 dark:text-blue-400 font-semibold'
												: 'text-gray-700 dark:text-gray-300'
										}
									>
										{lang.name}
									</span>
								</div>
								{i18n.language === lang.code && (
									<motion.div
										layoutId="active-indicator"
										className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shadow-sm"
									/>
								)}
							</button>
						))}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
